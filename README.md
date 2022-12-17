# VPN Exit Node

Automated traffic exit node on the base of tailscale with the ability to turn on and control VPN through OpenVPN.

## Pre-requirements
If you want to forward traffic through a host machine, you need to apply the following iptables rules on the host machine:
```bash
# For default traffic
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE  
sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT

# For VPN traffic
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE  
sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT
```

If you want to save these rules after reboot, you can use the following commands:
```bash
sudo netfilter-persistent save
```

If you want to clear all iptables rules, you can use the following commands:
```bash
sudo netfilter-persistent flush
sudo netfilter-persistent save
```

## Example of usage

### Docker Compose
```yaml
services:
  vpn-exit-node:
    container_name: ${TAILSCALE_HOSTNAME}
    hostname: ${TAILSCALE_HOSTNAME}
    build:
      dockerfile: ./Dockerfile
    environment:
      - TAILSCALE_AUTH_KEY=${TAILSCALE_AUTH_KEY}
      - TAILSCALE_HOSTNAME=${TAILSCALE_HOSTNAME}
      - HTTP_PORT=${HTTP_PORT}
      - VPN_FILES_PATH=${VPN_FILES_PATH}
    restart: unless-stopped
    volumes:
      - "/dev/net/tun:/dev/net/tun"
      - "./vpn-files:/usr/app/vpn-files"
    ports:
      - ${HTTP_PORT}:${HTTP_PORT}
    privileged: true
    network_mode: "host"
    cap_add:
      - NET_ADMIN
      - SYS_ADMIN
```

### HTTP API

```bash
#Get all available VPN files:
curl -X GET http://localhost:8080/vpn/files

# Start OpenVPN client with the following file:
curl -X POST http://localhost:8080/vpn/start -d '{"vpnFile": "R4.ovpn"}'

# Stop OpenVPN client
curl -X POST http://localhost:8080/vpn/stop
```

## Environment variables
- `TAILSCALE_AUTH_KEY` - tailscale auth key
- `TAILSCALE_HOSTNAME` - name of exit node
- `HTTP_PORT` - port for web interface for control VPN
- `VPN_FILES_PATH` - path to directory with VPN files inside container
