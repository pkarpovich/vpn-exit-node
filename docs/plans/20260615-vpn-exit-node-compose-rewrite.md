# Rewrite vpn-exit-node into a Tailscale exit-node + SOCKS5 compose appliance

## Overview
Full rewrite of `vpn-exit-node` from a Node/TS application into a declarative
docker-compose deployment template. The original 2022 design (custom Node
controller hand-rolling `tailscaled` + OpenVPN in one privileged container) is
obsolete and broken.

The new appliance is reusable across servers and works in three modes,
expressed as two orthogonal axes (no custom application code):

- **Consumer axis** - how a device uses the box:
  - exit node (full tunnel) - for Apple TV "teleport"
  - SOCKS5 on the tailnet (selective) - for app-level routing (e.g. only Yandex
    traffic from the playlist-synchronizer service)
- **Egress axis** - where the box exits to the internet:
  - physical location of the box
  - VPN tunnel (gluetun -> target country)

A single box can combine roles (e.g. a RU box that is both a selective SOCKS5
for the sync service and an on-demand RU exit node for geo-locked content).

Goals preserved from the original project: a controllable, self-hostable exit
node whose country is configurable, usable by Apple TV and other tailnet
devices.

## Context (from discovery)
- Repo: `pkarpovich/vpn-exit-node`, currently Node/TS, clean on `main`.
- Files/components to remove: `src/`, `dist/`, `node_modules/`, `package.json`,
  `pnpm-lock.yaml`, `tsconfig.json`, `nodemon.json`, `.eslintrc.json`,
  `.prettierrc`, `.nvmrc`, `.changeset/`, `CHANGELOG.md`, `Dockerfile`,
  `scripts/entrypoint.sh` (old), the Node-oriented `.github` workflows.
- Files to keep/rewrite: `LICENSE`, `.editorconfig`, `.gitignore` (update),
  `README.md` (rewrite), `vpn-files/` (becomes gluetun config dir, optional).
- Building blocks (all off-the-shelf images, no build step):
  - `tailscale/tailscale` - tailnet membership + `--advertise-exit-node`
  - `qmcgaw/gluetun` - optional VPN egress (OpenVPN/WireGuard) for mode 3
  - a minimal SOCKS5 image (e.g. `serjs/go-socks5-proxy`) - optional, mode 1
- Verified facts:
  - exit node works in kernel mode (`TS_USERSPACE=false` + `NET_ADMIN` +
    `/dev/net/tun` + `ip_forward=1`); kernel chosen for streaming bandwidth.
  - gluetun + tailscale exit node is a known pattern via
    `network_mode: service:gluetun`, with a return-traffic "black hole" gotcha
    that must be solved at the gluetun firewall level (without disabling the
    killswitch).
  - tsnet (embedded Tailscale in Go) cannot be an exit node - so exit-node
    functionality must come from the official tailscaled image, not custom code.
  - native multi-hop / chained exit nodes are NOT supported by Tailscale
    (out of scope, see non-goals).

## Non-goals
- True multi-hop chaining (traffic through box B -> box A -> internet). Tailscale
  does not support exit-node-through-exit-node. Documented as "possible later via
  a stacked gluetun config" but not built.
- playlist-synchronizer integration (separate effort in that repo).
- A runtime control API / UI. Mode and country are set per deployment via
  `.env` + compose profiles/overrides (static per-deploy).

## Development Approach
- **This is an infrastructure / compose + shell repo - there are no unit tests.**
  Per decision during planning: author the artifacts, verify manually.
- Automatable sanity only: `docker compose config` must parse for both the base
  and the VPN-override composition; `shellcheck` clean on the entrypoint script.
- Live functional verification (requires a real tailnet, a VPS, an Apple TV, and
  VPN credentials) is manual and lives in Post-Completion - it cannot run inside
  the ralphex Docker sandbox.
- Make small, focused commits; complete each task fully before the next.
- Security posture is a hard requirement, not optional: tailnet-only exposure
  (no published ports + SOCKS bound to the `100.x` tailnet address).

## Progress Tracking
- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with the prefix.
- Document blockers with a warning prefix.
- Keep this plan in sync with actual work.

## What Goes Where
- **Implementation Steps** (`[ ]`): file authoring + static sanity checks the
  agent can run locally.
- **Post-Completion** (no checkboxes): live deployment and mode verification on
  real boxes, tailnet ACL changes, credential provisioning.

## Implementation Steps

### Task 1: Strip the obsolete Node/TS application
- [x] remove `src/`, `dist/`, `node_modules/`, `package.json`, `pnpm-lock.yaml`,
      `tsconfig.json`, `nodemon.json`, `.eslintrc.json`, `.prettierrc`, `.nvmrc`
- [x] remove `.changeset/`, `CHANGELOG.md`, old `Dockerfile`, old
      `scripts/entrypoint.sh`
- [x] rewrite `.gitignore` for a compose repo (ignore `.env`, drop node entries)
- [x] confirm `LICENSE` and `.editorconfig` are retained
- [x] `git status` shows only the intended deletions/changes

### Task 2: Base compose - Tailscale exit node (modes 1/2, physical egress)
- [x] create `compose.yml` with a `tailscale` service using `tailscale/tailscale`
- [x] kernel mode: `TS_USERSPACE=false`, `cap_add: [NET_ADMIN]`, device
      `/dev/net/tun`, sysctl `net.ipv4.ip_forward=1` (also `net.ipv6.conf.all.forwarding=1`
      so the exit node forwards IPv6 too)
- [x] env-driven: `TS_AUTHKEY`, `TS_HOSTNAME`, `TS_EXTRA_ARGS=--advertise-exit-node`
- [x] persist Tailscale state via a named volume mounted at `/var/lib/tailscale`
- [x] `restart: unless-stopped` + healthcheck (`tailscale status`)
- [x] no `ports:` published (tailnet-only posture)
- [x] `docker compose config` parses cleanly (also removed the stale Node-era
      `docker-compose.yml` that referenced the deleted `Dockerfile`)

### Task 3: SOCKS5 service (mode 1, selective) + bind-to-tailnet entrypoint
- [ ] add `socks5` service under compose profile `socks`, with
      `network_mode: service:tailscale`
- [ ] create `scripts/socks-entrypoint.sh`: wait for `tailscale ip -4`, then start
      the SOCKS5 bound to that `100.x` address only (never `0.0.0.0`)
- [ ] support optional `SOCKS_USER`/`SOCKS_PASS` from env
- [ ] mount the entrypoint script and set it as the service `entrypoint`
- [ ] `shellcheck scripts/socks-entrypoint.sh` is clean
- [ ] `docker compose --profile socks config` parses cleanly

### Task 4: VPN override - gluetun (mode 3, VPN egress)
- [ ] create `compose.vpn.yml` override adding a `gluetun` service
      (provider/country/credentials via env)
- [ ] repoint `tailscale` to `network_mode: service:gluetun` in the override
- [ ] configure gluetun firewall to allow tailnet return traffic WITHOUT
      disabling the killswitch (avoid the black-hole gotcha; document the rule)
- [ ] `restart: unless-stopped` + rely on gluetun's built-in healthcheck
- [ ] `docker compose -f compose.yml -f compose.vpn.yml config` parses cleanly

### Task 5: Environment template + Makefile convenience
- [ ] create `.env.example` documenting every variable, grouped by mode
      (core Tailscale, SOCKS, gluetun/VPN)
- [ ] create `Makefile` targets: `up-exit`, `up-socks`, `up-vpn`, `down`, `logs`
- [ ] ensure `.env` is gitignored and only `.env.example` is committed

### Task 6: README rewrite
- [ ] rewrite `README.md`: what it is, the two axes / three modes, per-mode run
      commands, full env reference
- [ ] document security posture (tailnet-only: no ports + `100.x` bind; optional
      host-firewall note as "optional hardening")
- [ ] document the gluetun killswitch handling and Tailscale auth-key expiry
      consideration (disable expiry or use an OAuth client for long-lived nodes)
- [ ] include an optional `acl.hujson` example with `autoApprovers` for
      `tag:exit-node` (zero-click fleet expansion) and an optional granular ACL
- [ ] include the manual per-mode verification commands (see Post-Completion)
- [ ] note the multi-hop chaining non-goal

### Task 7: Replace obsolete CI
- [ ] remove the Node Docker-image publish workflow(s) under `.github/workflows`
      (they build the deleted Node image and would fail)
- [ ] optionally add a minimal lint workflow: `hadolint` (if any Dockerfile),
      `shellcheck` on `scripts/`, and `docker compose config` validation
- [ ] update or remove `dependabot.yml` (npm ecosystem no longer applies)

### Task 8: Final sanity and docs consistency
- [ ] `docker compose config` and `docker compose -f compose.yml -f compose.vpn.yml config`
      both parse without errors
- [ ] `docker compose --profile socks config` parses
- [ ] every command shown in README matches actual files/targets
- [ ] repo contains no leftover Node/TS artifacts

## Technical Details
- **Netns topology**: base mode keeps `tailscale` in its own netns; `socks5`
  joins it via `network_mode: service:tailscale`. VPN mode introduces `gluetun`
  as the netns owner; `tailscale` joins gluetun, and `socks5` (if used) joins
  the shared namespace transitively.
- **Why bind SOCKS to `100.x`**: in the shared netns the interface set includes
  the box's public interface; binding to the Tailscale address is what makes the
  proxy reachable only from the tailnet.
- **Profiles vs overrides**: SOCKS on/off is a compose `profile` (same netns,
  additive). VPN egress changes `tailscale`'s `network_mode`, which a profile
  cannot toggle - hence a separate `compose.vpn.yml` override file.
- **Kernel mode rationale**: chosen over userspace for exit-node streaming
  throughput (Apple TV). Requires `NET_ADMIN` + `/dev/net/tun` + `ip_forward`.

## Post-Completion
*Manual, requires real infrastructure - no checkboxes.*

**Live verification per mode:**
- Mode 1 (selective SOCKS, physical RU): from a tailnet host run
  `curl --socks5 <box-tailnet-ip>:1080 https://api.ipify.org` -> expect a RU IP.
- Mode 2 (exit node, physical): select the box as exit node on a device (e.g.
  Apple TV) and confirm public IP shows the box country (covers the RU football
  use case).
- Mode 3 (exit node via VPN): `docker compose exec gluetun wget -qO- ipinfo.io`
  -> expect the VPN country; then via the exit node a consumer shows the VPN
  country; stop the VPN container and confirm NO leak (killswitch holds).

**Provisioning / external:**
- Provision a RU VPS for the sync use case; populate `.env`; deploy mode 1 (+2).
- For mode 3: supply gluetun provider credentials and a target-country config.
- In the tailnet ACL: add `autoApprovers` for `tag:exit-node`; disable key expiry
  for these long-lived nodes (or wire an OAuth client).
- Optional host hardening: firewall allowing inbound only Tailscale (UDP 41641)
  + SSH.

**Follow-up (separate repo):**
- playlist-synchronizer: migrate Yandex source to the official
  `api.music.yandex.net` API behind a `socks5h://` agent pointed at the RU box,
  add `YANDEX_MUSIC_TOKEN`, drop `yandex-short-api`, fix silent error handling.
