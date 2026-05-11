#!/usr/bin/env bash
# setup.sh — one-time first-run setup for Product Review Radar
# Handles the Node 26 / better-sqlite3 / Electron binary bootstrap.

set -e
cd "$(dirname "$0")/.."

echo ""
echo "=== Product Review Radar — First-run Setup ==="
echo ""

# 1. Install npm deps WITHOUT running native build scripts
echo "[1/4] Installing npm dependencies (skipping native build)..."
npm install --ignore-scripts
echo "      Done."

# 2. Download the correct better-sqlite3 prebuilt binary for Electron 33
ARCH=$(uname -m)           # arm64 or x86_64
BSQLITE_VERSION="11.10.0"
ELECTRON_ABI="130"         # Electron 33 uses ABI 130
PLATFORM="darwin"

if [ "$ARCH" = "arm64" ]; then
  BINARY_ARCH="arm64"
else
  BINARY_ARCH="x64"
fi

TARBALL="better-sqlite3-v${BSQLITE_VERSION}-electron-v${ELECTRON_ABI}-${PLATFORM}-${BINARY_ARCH}.tar.gz"
URL="https://github.com/WiseLibs/better-sqlite3/releases/download/v${BSQLITE_VERSION}/${TARBALL}"

echo "[2/4] Downloading better-sqlite3 prebuilt for Electron 33 (${BINARY_ARCH})..."
curl -L --progress-bar "$URL" -o /tmp/bsqlite3-prebuilt.tar.gz
tar -xzf /tmp/bsqlite3-prebuilt.tar.gz -C node_modules/better-sqlite3/ build/Release/better_sqlite3.node
rm /tmp/bsqlite3-prebuilt.tar.gz
echo "      Done."

# 3. Download the Electron binary
echo "[3/4] Downloading Electron binary..."
node node_modules/electron/install.js
echo "      Done."

# 4. Copy .env if not already present
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "[4/4] Created .env from .env.example — edit it to add API keys (all optional)."
else
  echo "[4/4] .env already exists — skipping."
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the app:  npm run dev"
echo ""
