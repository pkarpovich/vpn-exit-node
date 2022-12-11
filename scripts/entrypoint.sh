openvpn --config ./vpn-files/R4.ovpn &

tailscaled \
  --tun=userspace-networking \
  &

until tailscale up \
  --advertise-exit-node \
  --authkey="${TAILSCALE_AUTH_KEY}" \
  --hostname="${TAILSCALE_HOSTNAME}"
do
    sleep 0.1
done

echo "tailscale started"

tail -f /dev/null
