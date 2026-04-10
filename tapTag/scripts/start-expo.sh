#!/usr/bin/env bash
set -euo pipefail

HOST_IP=""

if command -v ip >/dev/null 2>&1; then
  if ip -4 addr show tailscale0 >/dev/null 2>&1; then
    HOST_IP="$(ip -4 -brief addr show tailscale0 | awk '{print $3}' | cut -d/ -f1 | head -n1)"
  fi
fi

if [ -n "$HOST_IP" ]; then
  export REACT_NATIVE_PACKAGER_HOSTNAME="$HOST_IP"
  echo "Using Tailscale Expo host: $REACT_NATIVE_PACKAGER_HOSTNAME"
else
  echo "Tailscale interface not found, using Expo default host selection"
fi

exec npx expo start "$@"
