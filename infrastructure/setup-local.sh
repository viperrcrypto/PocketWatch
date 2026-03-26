#!/bin/zsh
# PocketWatch Local Infrastructure Setup
# Run once: cd /Users/z/PocketWatch && zsh infrastructure/setup-local.sh
set -euo pipefail

PROJECT_DIR="/Users/z/PocketWatch"
INFRA_DIR="${PROJECT_DIR}/infrastructure"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
LOG_DIR="${PROJECT_DIR}/logs"

echo "╔══════════════════════════════════════════╗"
echo "║  PocketWatch — Local Infrastructure      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── 1. Homebrew ───
if ! command -v brew &>/dev/null; then
  echo "ERROR: Homebrew not installed. Install from https://brew.sh"
  exit 1
fi
echo "✓ Homebrew found"

# ─── 2. Dependencies ───
echo ""
echo "Installing dependencies..."
brew install cloudflared postgresql@17 2>/dev/null || true
echo "✓ cloudflared + postgresql installed"

# ─── 3. PostgreSQL ───
echo ""
echo "Starting PostgreSQL..."
brew services start postgresql@17 2>/dev/null || true

for i in {1..15}; do
  if pg_isready -q 2>/dev/null; then
    echo "✓ PostgreSQL running"
    break
  fi
  if [[ $i -eq 15 ]]; then
    echo "ERROR: PostgreSQL not responding after 15s"
    exit 1
  fi
  sleep 1
done

# Create database if it doesn't exist
if psql -lqt 2>/dev/null | cut -d\| -f1 | grep -qw pocketwatch; then
  echo "✓ Database 'pocketwatch' exists"
else
  createdb pocketwatch
  echo "✓ Database 'pocketwatch' created"
fi

# ─── 4. .env check ───
echo ""
LOCAL_URL="postgresql://$(whoami)@localhost:5432/pocketwatch"
if [[ -f "${PROJECT_DIR}/.env" ]]; then
  if grep -q "localhost:5432/pocketwatch" "${PROJECT_DIR}/.env" 2>/dev/null; then
    echo "✓ .env already points to local Postgres"
  else
    echo "⚠  ACTION REQUIRED: Update your .env file:"
    echo ""
    echo "   DATABASE_URL=\"${LOCAL_URL}\""
    echo "   DATABASE_URL_UNPOOLED=\"${LOCAL_URL}\""
    echo ""
    echo "   Press Enter after updating .env..."
    read -r
  fi
else
  echo "⚠  No .env file found. Copy .env.example and configure:"
  echo "   cp ${PROJECT_DIR}/.env.example ${PROJECT_DIR}/.env"
  echo "   Then set DATABASE_URL=\"${LOCAL_URL}\""
  echo ""
  echo "   Press Enter after creating .env..."
  read -r
fi

# ─── 5. Migrations ───
echo ""
echo "Running database migrations..."
cd "${PROJECT_DIR}"
mkdir -p backups
npm run db:prepare 2>&1 || {
  echo "WARNING: db:prepare had issues — check your DATABASE_URL"
}
echo "✓ Migrations applied"

# ─── 6. Production build ───
echo ""
echo "Building Next.js (production)..."
NODE_ENV=production npm run build 2>&1
echo "✓ Build complete"

# ─── 7. Directories ───
mkdir -p "${LOG_DIR}" "${PROJECT_DIR}/backups"

# ─── 8. Sleep prevention ───
echo ""
echo "Configuring sleep prevention (requires sudo)..."
sudo pmset -c sleep 0 disksleep 0 displaysleep 10
echo "✓ System sleep disabled on AC power (display sleeps after 10min)"

# ─── 9. Make scripts executable ───
chmod +x "${INFRA_DIR}/start-nextjs.sh"

# ─── 10. Log rotation ───
echo ""
NEWSYSLOG_CONF="/etc/newsyslog.d/pocketwatch.conf"
if [[ ! -f "${NEWSYSLOG_CONF}" ]]; then
  echo "Setting up log rotation (requires sudo)..."
  sudo tee "${NEWSYSLOG_CONF}" > /dev/null << LOGEOF
# PocketWatch log rotation — rotate at 10MB, keep 5 archives, compress
${LOG_DIR}/nextjs.log        $(whoami):staff 644  5  10240  *  JG
${LOG_DIR}/nextjs-error.log  $(whoami):staff 644  5  10240  *  JG
${LOG_DIR}/cloudflared.log   $(whoami):staff 644  5  10240  *  JG
LOGEOF
  echo "✓ Log rotation configured at ${NEWSYSLOG_CONF}"
else
  echo "✓ Log rotation already configured"
fi

# ─── 11. Install LaunchAgents ───
echo ""
echo "Installing LaunchAgents..."
mkdir -p "${LAUNCH_AGENTS_DIR}"

for plist in com.pocketwatch.nextjs com.pocketwatch.cloudflared com.pocketwatch.caffeinate; do
  src="${INFRA_DIR}/${plist}.plist"
  dst="${LAUNCH_AGENTS_DIR}/${plist}.plist"
  if [[ ! -f "${src}" ]]; then
    echo "  WARNING: ${src} not found — skipping"
    continue
  fi
  cp "${src}" "${dst}"
  launchctl bootout "gui/$(id -u)/${plist}" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "${dst}"
  echo "  ✓ ${plist}"
done

# ─── 12. Cloudflare Tunnel setup guide ───
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  MANUAL STEPS — Cloudflare Tunnel        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "1. Authenticate (opens browser):"
echo "   cloudflared tunnel login"
echo ""
echo "2. Create the tunnel:"
echo "   cloudflared tunnel create pocketwatch"
echo "   (note the UUID printed)"
echo ""
echo "3. Create config file:"
echo "   mkdir -p ~/.cloudflared"
echo "   cat > ~/.cloudflared/config.yml << EOF"
echo "   tunnel: <YOUR-TUNNEL-UUID>"
echo "   credentials-file: /Users/z/.cloudflared/<YOUR-TUNNEL-UUID>.json"
echo "   ingress:"
echo "     - hostname: <YOUR-DOMAIN>"
echo "       service: http://localhost:3500"
echo "       originRequest:"
echo "         connectTimeout: 30s"
echo "         keepAliveConnections: 100"
echo "     - service: http_status:404"
echo "   EOF"
echo ""
echo "4. Add DNS route:"
echo "   cloudflared tunnel route dns pocketwatch <YOUR-DOMAIN>"
echo ""
echo "5. Update NEXT_PUBLIC_APP_URL in .env:"
echo "   NEXT_PUBLIC_APP_URL=\"https://<YOUR-DOMAIN>\""
echo ""
echo "6. Restart services:"
echo "   launchctl kickstart -k gui/$(id -u)/com.pocketwatch.cloudflared"
echo "   launchctl kickstart -k gui/$(id -u)/com.pocketwatch.nextjs"
echo ""
echo "7. Verify:"
echo "   curl http://localhost:3500/api/health"
echo "   curl https://<YOUR-DOMAIN>/api/health"
echo ""
echo "════════════════════════════════════════════"
echo "Setup complete! Services are starting..."
echo "Check logs: tail -f ${LOG_DIR}/nextjs.log"
