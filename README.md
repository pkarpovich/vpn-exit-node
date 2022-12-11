# VPN Exit Node

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
