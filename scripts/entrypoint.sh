#!/usr/bin/env sh

mkdir -p /dev/net
mknod /dev/net/tun c 10 200
IP=$(grep '^server .*$' /etc/openvpn/server.conf | awk '{print $2}')
iptables -t nat -A POSTROUTING -s ${IP}/24 -o eth0 -j MASQUERADE
openvpn --config ./vpn-files/R4.ovpn


set -eou pipefail

tailscaled \
  --tun=userspace-networking \
  --socks5-server="0.0.0.0:1055" \
  --verbose 1 \
  &

until tailscale up \
  --advertise-exit-node \
  --authkey="${TAILSCALE_AUTH_KEY}" \
  --hostname="${TAILSCALE_HOSTNAME}"
do
    sleep 0.1
done

echo "tailscale socks5 proxy started"

tail -f /dev/null
