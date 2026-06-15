#!/bin/sh
set -eu

IFACE="${TS_IFACE:-tailscale0}"
PORT="${SOCKS_PORT:-1080}"
MAX_WAIT="${SOCKS_WAIT_RETRIES:-60}"

if { [ -n "${SOCKS_USER:-}" ] && [ -z "${SOCKS_PASS:-}" ]; } \
    || { [ -z "${SOCKS_USER:-}" ] && [ -n "${SOCKS_PASS:-}" ]; }; then
    echo "socks-entrypoint: set both SOCKS_USER and SOCKS_PASS, or neither" >&2
    exit 1
fi

echo "socks-entrypoint: waiting for tailnet IPv4 on ${IFACE}..."

ts_ip=""
attempt=0
while [ -z "$ts_ip" ]; do
    ts_ip=$(ip -4 addr show dev "$IFACE" 2>/dev/null \
        | awk '/inet 100\./ { split($2, parts, "/"); print parts[1]; exit }')
    [ -n "$ts_ip" ] && break

    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$MAX_WAIT" ]; then
        echo "socks-entrypoint: gave up waiting for a tailnet IPv4 on ${IFACE}" >&2
        exit 1
    fi
    sleep 2
done

echo "socks-entrypoint: binding SOCKS5 to ${ts_ip}:${PORT} (tailnet-only)"

set -- microsocks -i "$ts_ip" -p "$PORT"
if [ -n "${SOCKS_USER:-}" ] && [ -n "${SOCKS_PASS:-}" ]; then
    set -- "$@" -u "$SOCKS_USER" -P "$SOCKS_PASS"
fi

exec "$@"
