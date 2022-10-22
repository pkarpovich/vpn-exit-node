#!/usr/bin/env sh

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
