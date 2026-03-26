#!/bin/zsh
# Wrapper for Next.js LaunchAgent — loads .env and starts production server
set -euo pipefail

PROJECT_DIR="/Users/z/PocketWatch"
LOG_DIR="${PROJECT_DIR}/logs"
mkdir -p "${LOG_DIR}"

# Source Homebrew environment (required for node, npm, pg tools)
eval "$(/opt/homebrew/bin/brew shellenv)"

# Source nvm if it exists (for node version management)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Source .env file — export all variables
if [[ -f "${PROJECT_DIR}/.env" ]]; then
  set -a
  source "${PROJECT_DIR}/.env"
  set +a
else
  echo "[start-nextjs] ERROR: .env file not found at ${PROJECT_DIR}/.env"
  exit 1
fi

# Force production mode for Secure cookies and scheduler activation
export NODE_ENV="production"

# Kill any existing process on port 3500
existing_pid=$(lsof -ti :3500 2>/dev/null || true)
if [[ -n "$existing_pid" ]]; then
  echo "[start-nextjs] Killing existing process on port 3500 (PID: $existing_pid)"
  kill -9 $existing_pid 2>/dev/null || true
  sleep 1
fi

# Wait for PostgreSQL to be ready (up to 30s)
PGREADY=0
for i in {1..30}; do
  if /opt/homebrew/opt/postgresql@17/bin/pg_isready -q 2>/dev/null; then
    PGREADY=1
    break
  fi
  sleep 1
done

if [[ $PGREADY -eq 0 ]]; then
  echo "[start-nextjs] ERROR: PostgreSQL not ready after 30s"
  exit 1
fi

echo "[start-nextjs] PostgreSQL ready"
cd "${PROJECT_DIR}"

# Run migrations if needed
echo "[start-nextjs] Running db:prepare..."
npm run db:prepare 2>&1 || {
  echo "[start-nextjs] WARNING: db:prepare failed, continuing anyway"
}

# Build if .next is missing or stale (older than package.json)
if [[ ! -d ".next" ]] || [[ "package.json" -nt ".next/BUILD_ID" ]]; then
  echo "[start-nextjs] Building Next.js..."
  npm run build 2>&1
fi

echo "[start-nextjs] Starting Next.js production server on port 3500..."
exec npx next start --hostname 0.0.0.0 --port 3500
