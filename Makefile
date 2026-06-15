# vpn-exit-node convenience targets. The three `up-*` targets map to the
# deployment shapes documented in the README:
#   up-exit   Tailscale exit node, physical egress (modes 1/2)
#   up-socks  exit node + tailnet-only SOCKS5 proxy (mode 1, selective)
#   up-vpn    exit node routed out through a gluetun VPN tunnel (mode 3)
# Configuration comes from .env (see .env.example).

COMPOSE     := docker compose
COMPOSE_VPN := docker compose -f compose.yml -f compose.vpn.yml

.PHONY: up-exit up-socks up-vpn down logs

up-exit:
	$(COMPOSE) up -d

up-socks:
	$(COMPOSE) --profile socks up -d

up-vpn:
	$(COMPOSE_VPN) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f
