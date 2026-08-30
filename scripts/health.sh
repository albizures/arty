#!/usr/bin/env sh
set -eu

base="${1:-}"

if [ "$base" = "--" ]; then
  base="${2:-}"
fi

if [ -z "$base" ]; then
  echo "Usage: pnpm health -- <base-ref>" >&2
  exit 2
fi

fallow audit --base "$base"
