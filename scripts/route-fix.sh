#!/bin/sh
set -eu

# Repairs the exit-node return path inside gluetun's netns. gluetun installs
# low-priority `ip rule`s (e.g. priority 99 for outbound subnets, plus its
# default-via-tunnel rule) that outrank Tailscale's priority-5270/table-52 rule,
# so replies to tailnet peers get pushed out the VPN tunnel and never reach
# tailscale0. We reinstate a higher-priority (lower-numbered) rule pointing the
# tailnet ranges at Tailscale's table 52. The rule is a no-op when table 52 has
# no matching route, so it cannot regress behavior. Re-checked on a loop because
# gluetun re-applies its rules on reconnect.

PRIO=90
TABLE=52
INTERVAL="${ROUTE_FIX_INTERVAL:-30}"

# Ensures one address family's return-path rule is present, adding it when
# missing. Logs only on state changes so a permanently IPv6-less netns does not
# warn every interval. Prints the new state ("ok"/"down") to stdout; all
# human-facing output goes to stderr.
sync_rule() {
    family="$1"
    range="$2"
    label="$3"
    prev="$4"

    if ip "$family" rule show 2>/dev/null | grep -qE "^${PRIO}:.* to ${range} lookup ${TABLE}( |\$)"; then
        [ "$prev" = ok ] || echo "route-fix: ${label} return-path rule present (${range} -> table ${TABLE})" >&2
        echo ok
        return
    fi

    if err=$(ip "$family" rule add to "$range" table "$TABLE" priority "$PRIO" 2>&1); then
        echo "route-fix: installed ${label} return-path rule (${range} -> table ${TABLE}, priority ${PRIO})" >&2
        echo ok
        return
    fi

    [ "$prev" = down ] || echo "route-fix: WARNING cannot add ${label} return-path rule (${range}); mode-3 ${label} replies will black-hole: ${err}" >&2
    echo down
}

echo "route-fix: maintaining tailnet return-path rules (priority ${PRIO} -> table ${TABLE}); re-checking every ${INTERVAL}s" >&2

v4=init
v6=init
while true; do
    v4=$(sync_rule -4 100.64.0.0/10 IPv4 "$v4")
    v6=$(sync_rule -6 fd7a:115c:a1e0::/48 IPv6 "$v6")
    sleep "$INTERVAL"
done
