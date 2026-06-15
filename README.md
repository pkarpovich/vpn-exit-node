# vpn-exit-node

A small, reusable docker-compose appliance that turns any box (a VPS, a home
server, a spare RU machine) into a controllable [Tailscale](https://tailscale.com)
exit node, optionally with a tailnet-only SOCKS5 proxy and optionally routed out
through a VPN tunnel. No application code - just off-the-shelf images wired
together.

It is built from two orthogonal axes:

- **Consumer axis** - how a device uses the box:
  - **Exit node** (full tunnel) - select the box as an exit node on any tailnet
    device (e.g. an Apple TV) to send all its traffic out through the box.
  - **SOCKS5** (selective) - a SOCKS5 proxy bound to the box's tailnet address,
    for app-level routing (e.g. only one service's traffic goes through the box).
- **Egress axis** - where the box itself exits to the internet:
  - **Physical** - the box's own internet connection / location.
  - **VPN** - via a [gluetun](https://github.com/qdm12/gluetun) tunnel to a
    target country (OpenVPN or WireGuard).

A single box can combine roles - e.g. a RU box that is both a selective SOCKS5
for one service and an on-demand RU exit node for geo-locked content.

## The three modes

| Mode | What you get | Egress | Command |
|------|--------------|--------|---------|
| 1 | Exit node + tailnet-only SOCKS5 (selective) | Physical | `make up-socks` |
| 2 | Exit node (full tunnel) | Physical | `make up-exit` |
| 3 | Exit node routed out through a VPN | VPN (gluetun) | `make up-vpn` |

Modes are static per deployment - chosen by which compose files/profiles you
start, configured via `.env`. There is no runtime control API.

## Quick start

1. Install Docker + Compose on the box.
2. Copy and fill the environment file:
   ```bash
   cp .env.example .env
   # edit .env: set TS_AUTHKEY and TS_HOSTNAME (and VPN vars for mode 3)
   ```
3. Generate a Tailscale auth key at
   <https://login.tailscale.com/admin/settings/keys> (see
   [Auth keys](#auth-keys--key-expiry) below).
4. Start the mode you want:
   ```bash
   make up-exit    # mode 2: exit node only
   make up-socks   # mode 1: exit node + SOCKS5
   make up-vpn     # mode 3: exit node via VPN
   ```
5. Approve the exit-node route in the Tailscale admin console (Machines -> the
   box -> Edit route settings -> enable "Use as exit node"), unless you have set
   up `autoApprovers` (see [Tailnet ACL](#tailnet-acl-optional)).

`make` is just a thin wrapper; the equivalent raw commands are:

```bash
docker compose up -d                                   # mode 2
docker compose --profile socks up -d                   # mode 1
docker compose -f compose.yml -f compose.vpn.yml up -d  # mode 3

docker compose down --remove-orphans   # stop (make down)
docker compose logs -f                  # follow logs (make logs)
```

To run mode 1 *and* mode 3 together (selective SOCKS over a VPN egress), use
`make up-socks-vpn`, or the equivalent raw command - add the profile to the VPN
composition:

```bash
docker compose -f compose.yml -f compose.vpn.yml --profile socks up -d
```

## Run commands per mode

### Mode 2 - exit node, physical egress
```bash
make up-exit
```
Starts only the `tailscale` service. It advertises itself as an exit node
(`--advertise-exit-node`) in kernel mode for full streaming throughput. Select
the box as an exit node on any tailnet device.

### Mode 1 - selective SOCKS5, physical egress
```bash
make up-socks
```
Starts `tailscale` plus the `socks5` service (compose profile `socks`). The
proxy shares tailscale's network namespace and is bound **only** to the box's
`100.x` tailnet address - reachable from the tailnet, never from the public
internet. Point an app at `socks5h://<box-tailnet-ip>:1080`.

> Note: the SOCKS5 image (`vimagick/microsocks`) is amd64-only. On ARM hosts
> (e.g. a Raspberry Pi or an ARM VPS) it runs under emulation if at all; modes 2
> and 3 use multi-arch images and are unaffected.

### Mode 3 - exit node via VPN egress
```bash
make up-vpn
```
Adds the `gluetun` service from `compose.vpn.yml`. gluetun becomes the network-
namespace owner and `tailscale` joins it (`network_mode: service:gluetun`), so
all exit-node traffic leaves through the VPN tunnel. gluetun's killswitch stays
on, and a `route-fix` sidecar repairs the tailnet return path (see
[VPN killswitch](#vpn-killswitch-mode-3)).

## Environment reference

All configuration lives in `.env` (copy from `.env.example`). `.env` is
gitignored - never commit real keys or VPN credentials.

### Core Tailscale (every mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `TS_AUTHKEY` | _(required)_ | Tailscale auth key. Prefer a reusable key (or OAuth client) tagged `tag:exit-node`; see [Auth keys](#auth-keys--key-expiry). |
| `TS_HOSTNAME` | `vpn-exit-node` | Node name on the tailnet (also the Docker container name). Unique per box. |
| `TS_EXTRA_ARGS` | `--advertise-exit-node` | Extra `tailscale up` args. Keep `--advertise-exit-node` for exit-node modes; add `--advertise-tags=tag:exit-node` when registering with an OAuth client (required - see [Auth keys](#auth-keys--key-expiry)). |

### SOCKS5 (mode 1, profile `socks`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SOCKS_PORT` | `1080` | Port the SOCKS5 proxy listens on (bound to the `100.x` address only). |
| `SOCKS_USER` | _(empty)_ | Optional SOCKS5 username. Leave both blank for unauthenticated tailnet-only access. |
| `SOCKS_PASS` | _(empty)_ | Optional SOCKS5 password. Set together with `SOCKS_USER`. |
| `TS_IFACE` | `tailscale0` | Advanced: interface the entrypoint reads the `100.x` address from. |
| `SOCKS_WAIT_RETRIES` | `60` | Advanced: number of 2s polls to wait for the tailnet IPv4. |

### VPN egress via gluetun (mode 3, `compose.vpn.yml`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VPN_SERVICE_PROVIDER` | _(required for mode 3)_ | gluetun provider, e.g. `mullvad`, `nordvpn`, `protonvpn`, or `custom`. See the [gluetun wiki](https://github.com/qdm12/gluetun-wiki). |
| `VPN_TYPE` | `openvpn` | Tunnel protocol: `openvpn` or `wireguard`. |
| `SERVER_COUNTRIES` | _(empty)_ | Target egress country, provider-dependent, e.g. `Russia`. |
| `OPENVPN_USER` | _(empty)_ | OpenVPN username (`VPN_TYPE=openvpn`). |
| `OPENVPN_PASSWORD` | _(empty)_ | OpenVPN password (`VPN_TYPE=openvpn`). |
| `OPENVPN_CUSTOM_CONFIG` | _(empty)_ | For `VPN_SERVICE_PROVIDER=custom`: path to a `.ovpn` mounted under `./vpn-files`, e.g. `/gluetun/custom/myconfig.ovpn`. |
| `WIREGUARD_PRIVATE_KEY` | _(empty)_ | WireGuard private key (`VPN_TYPE=wireguard`). |
| `WIREGUARD_ADDRESSES` | _(empty)_ | WireGuard interface addresses (`VPN_TYPE=wireguard`). |
| `FIREWALL_OUTBOUND_SUBNETS` | _(empty)_ | LAN subnets the box may reach **bypassing** the VPN (comma-separated), e.g. `192.168.1.0/24`. Do **not** put the tailnet range here - it breaks the return path (see [VPN killswitch](#vpn-killswitch-mode-3)). Never set `FIREWALL=off`. |
| `TZ` | `UTC` | Container timezone (affects gluetun log timestamps). |

## Security posture

The box is **tailnet-only by design**:

- **No published ports.** Neither `compose.yml` nor `compose.vpn.yml` declares a
  `ports:` mapping, so nothing is exposed on the host's public interface.
- **SOCKS5 binds to `100.x` only.** `scripts/socks-entrypoint.sh` waits for the
  tailnet IPv4 on `tailscale0` and binds microsocks to that address - never
  `0.0.0.0`. In the shared namespace the box's public interface is also present,
  so binding to the Tailscale address is what keeps the proxy off the internet.
- **Access is governed by your tailnet ACL** (see below).

### Optional host hardening
Defense in depth, not required for the tailnet-only posture: a host firewall
allowing inbound only Tailscale (UDP `41641`) and SSH. Everything else - the
exit-node forwarding and the SOCKS proxy - happens inside the container
namespace and never needs an open host port.

## VPN killswitch (mode 3)

gluetun ships a killswitch (`FIREWALL=on` by default) that drops all traffic not
going through the tunnel - so a tunnel drop cannot leak your real IP. Leave it
on; **never** set `FIREWALL=off`.

### Return-path routing (the `route-fix` sidecar)

The exit-node return path is a **routing** problem, not a firewall one. In the
shared namespace gluetun pushes the tailnet CGNAT range out the VPN tunnel via
low-numbered `ip rule`s - its default-via-tunnel rule, plus a priority-99 rule
for anything in `FIREWALL_OUTBOUND_SUBNETS`. All of these outrank Tailscale's own
priority-5270 / table-52 rule, so replies to tailnet peers (destined to
`100.64.0.0/10`) are sent out the wrong interface and black-hole.

`compose.vpn.yml` therefore runs a tiny `route-fix` sidecar in gluetun's netns
that reinstates a higher-priority (lower-numbered) rule sending the tailnet
ranges to Tailscale's table 52, ahead of gluetun's rules:

```sh
ip rule add to 100.64.0.0/10 table 52 priority 90
ip -6 rule add to fd7a:115c:a1e0::/48 table 52 priority 90
```

It reuses the already-pulled `tailscale/tailscale` image (for `iproute2`), starts
no `tailscaled`, and the rule is a no-op if table 52 has no matching route, so it
cannot regress behavior. This still warrants a live check on first deploy, since
the gluetun-vs-Tailscale `iptables`/`nftables` interaction cannot be exercised in
CI (see [Manual verification per mode](#manual-verification-per-mode)).

`FIREWALL_OUTBOUND_SUBNETS` is **not** part of this fix. It is an OUTPUT-chain
allowance for LAN subnets you want the box to reach while bypassing the VPN (e.g.
`192.168.1.0/24`); leave it empty otherwise. Do not put the tailnet range there -
it does not cover the forwarded return traffic, and its priority-99 route is one
of the rules the sidecar has to override.

## Auth keys / key expiry

Exit nodes are long-lived, and two separate expiries are in play:

- **The auth key** that registers the node. All auth keys expire (90 days max -
  reusable or not, they cannot be made non-expiring). `compose.yml` sets
  `TS_AUTH_ONCE=true`, so with the persisted state volume the node authenticates
  **once** and does not re-run `tailscale up` on restart. That sidesteps a known
  failure where restarting with an expired key drops an already-authenticated
  node ([tailscale#19501](https://github.com/tailscale/tailscale/issues/19501)).
  Use a **reusable** key so a future re-auth (e.g. after recreating the state
  volume) still works while the key is within its 90-day window.
- **The node's key expiry**, which is what actually keeps the box on the tailnet
  long-term. Either **disable key expiry** for the node in the admin console
  (Machines -> the box -> Disable key expiry) or register with an **OAuth
  client** (whose credentials do not expire), as below.

### Registering with an OAuth client (non-expiring credentials)

OAuth client secrets do not expire, so they are the durable option for a
long-lived node or a fleet. Tailscale requires OAuth-registered nodes to be
tagged, so the default reusable-key config is **not** enough on its own - you
must pass the tag and opt out of the ephemeral default:

1. Create an OAuth client with the **`auth_keys`** write scope and assign it
   `tag:exit-node`
   ([Tailscale OAuth registration](https://tailscale.com/docs/features/oauth-clients#register-new-nodes-using-oauth-credentials)).
2. In `.env`, use the client secret as the auth key with `?ephemeral=false`
   (without it the node registers as **ephemeral** and is removed from the
   tailnet when the container stops), and advertise the tag:
   ```env
   TS_AUTHKEY=tskey-client-xxxxx?ephemeral=false
   TS_EXTRA_ARGS=--advertise-exit-node --advertise-tags=tag:exit-node
   ```

Tag the key (e.g. `tag:exit-node`) so `autoApprovers` can approve the route
automatically.

## Tailnet ACL (optional)

Add an `autoApprovers` entry so tagged exit nodes are approved without a manual
click - handy when expanding a fleet. Edit your tailnet policy file (Access
controls) - it is [HuJSON](https://github.com/tailscale/hujson) (JSON with
comments and trailing commas):

```jsonc
// acl.hujson
{
  "tagOwners": {
    "tag:exit-node": ["autogroup:admin"],
  },

  // Zero-click: any node tagged tag:exit-node is auto-approved as an exit node.
  "autoApprovers": {
    "exitNode": ["tag:exit-node"],
  },
}
```

Optional granular ACL - restrict who may reach the SOCKS5 proxy on the box
(here, only nodes tagged `tag:sync` may reach port `1080`):

```jsonc
{
  "acls": [
    {
      "action": "accept",
      "src":    ["tag:sync"],
      "dst":    ["tag:exit-node:1080"],
    },
  ],
}
```

## Manual verification per mode

Requires real infrastructure (a tailnet, the box, and - for mode 3 - VPN
credentials). Run from another tailnet host unless noted.

- **Mode 1 (selective SOCKS, physical):**
  ```bash
  curl --socks5 <box-tailnet-ip>:1080 https://api.ipify.org
  ```
  Expect the box's public IP (e.g. a RU IP for a RU box).

- **Mode 2 (exit node, physical):** select the box as the exit node on a device
  (e.g. an Apple TV), then confirm the device's public IP shows the box's
  country.

- **Mode 3 (exit node via VPN):**
  ```bash
  docker compose -f compose.yml -f compose.vpn.yml exec gluetun wget -qO- ipinfo.io
  ```
  Expect the VPN country. Then route a consumer device through the box as its
  exit node and confirm it both reaches the internet (this exercises the tailnet
  **return path** the `route-fix` sidecar repairs - see [VPN
  killswitch](#vpn-killswitch-mode-3)) and shows the VPN country. If replies
  black-hole, check `docker compose -f compose.yml -f compose.vpn.yml exec
  gluetun ip rule` shows the priority-90 rule to table 52. Finally stop the
  gluetun container and confirm there is **no leak** (the killswitch holds and
  traffic stops).

## Non-goals

- **Multi-hop chaining** (traffic through box B -> box A -> internet). Tailscale
  does not support exit-node-through-exit-node, so it is not built here. It is
  possible later via a stacked gluetun config, but out of scope.
- A runtime control API / UI - mode and country are set per deployment via
  `.env` + compose profiles/overrides.

## License

See [LICENSE](LICENSE).
