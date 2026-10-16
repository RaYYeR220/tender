#!/bin/sh
# Runs the PayBox starter checks in the reference toolchain (Node 24.21.0, pnpm 11.11.0).
set -e
cd "$(dirname "$0")"
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W 2>/dev/null || pwd):/repo" -w /repo/plugin node:24.21.0-bookworm-slim sh -c \
  "corepack enable >/dev/null 2>&1 && corepack prepare pnpm@11.11.0 --activate >/dev/null 2>&1 && pnpm install --frozen-lockfile --silent && pnpm --silent test"
