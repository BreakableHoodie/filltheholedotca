#!/bin/bash
# Startup script for fillthehole.ca dev server
# Sources .env and launches the Vite dev server

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

set -a
source "$(dirname "$0")/.env"
set +a

exec /opt/homebrew/bin/npm run dev
