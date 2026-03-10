#!/usr/bin/env bash
set -euo pipefail

# ── Colors ───────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass()  { echo -e "  ${GREEN}✔${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "  ${RED}✘${NC} $1"; }
info()  { echo -e "  ${CYAN}→${NC} $1"; }
step()  { echo -e "\n${CYAN}[$1]${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
RESTART_MARKER="/tmp/.zeus_setup_restarted"
FIXED=0

# Track whether we had to install something that requires a restart
NEEDS_RESTART=false

# Prevent infinite restart loops — allow at most one restart
if [[ "${ZEUS_RESTART_COUNT:-0}" -ge 2 ]]; then
  echo ""
  echo -e "${RED}Setup restarted too many times. Something is still failing.${NC}"
  echo -e "Please install the missing dependencies manually and re-run:"
  echo -e "  ${BOLD}bash setup.sh${NC}"
  exit 1
fi

echo ""
echo -e "${BOLD}${CYAN}⚡ ZEUS — Setup & Install${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─────────────────────────────────────────────────
# Phase 1: System-level dependencies
# ─────────────────────────────────────────────────

step "OS"
if [[ "$(uname)" == "Linux" ]]; then
  . /etc/os-release 2>/dev/null || true
  pass "Linux detected (${PRETTY_NAME:-$(uname -r)})"
else
  warn "Non-Linux OS ($(uname)). ZEUS targets Ubuntu but may still work."
fi

# ── apt-get update (once, only if we'll need it) ─
apt_updated=false
ensure_apt() {
  if [[ "$apt_updated" == false ]]; then
    info "Updating package lists..."
    sudo apt-get update -qq 2>/dev/null
    apt_updated=true
  fi
}

# ── build-essential (needed by some native npm modules) ──
step "Build Tools"
if dpkg -s build-essential &>/dev/null 2>&1; then
  pass "build-essential installed"
else
  warn "build-essential not found — installing..."
  ensure_apt
  if sudo apt-get install -y build-essential -qq 2>/dev/null; then
    pass "build-essential installed"
    ((FIXED++))
  else
    warn "Could not install build-essential (non-critical)"
  fi
fi

# ── curl ─────────────────────────────────────────
step "curl"
if command -v curl &>/dev/null; then
  pass "curl available"
else
  warn "curl not found — installing..."
  ensure_apt
  if sudo apt-get install -y curl -qq 2>/dev/null; then
    pass "curl installed"
    ((FIXED++))
  else
    fail "Could not install curl. Install it manually: sudo apt-get install -y curl"
    exit 1
  fi
fi

# ── git ──────────────────────────────────────────
step "Git"
if command -v git &>/dev/null; then
  pass "git $(git --version | awk '{print $3}')"
else
  warn "git not found — installing..."
  ensure_apt
  if sudo apt-get install -y git -qq 2>/dev/null; then
    pass "git installed ($(git --version | awk '{print $3}'))"
    ((FIXED++))
  else
    warn "Could not install git (non-critical, but recommended)"
  fi
fi

# ── sqlite3 CLI ──────────────────────────────────
step "SQLite"
if command -v sqlite3 &>/dev/null; then
  pass "sqlite3 $(sqlite3 --version | awk '{print $1}')"
else
  warn "sqlite3 CLI not found — installing..."
  ensure_apt
  if sudo apt-get install -y sqlite3 -qq 2>/dev/null; then
    pass "sqlite3 installed ($(sqlite3 --version | awk '{print $1}'))"
    ((FIXED++))
  else
    warn "Could not install sqlite3 (optional — Prisma bundles its own engine)"
  fi
fi

# ── Node.js ──────────────────────────────────────
step "Node.js"
NODE_OK=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if (( NODE_MAJOR >= 18 )); then
    pass "Node.js $NODE_VER"
    NODE_OK=true
  else
    warn "Node.js $NODE_VER is too old (need >= 18) — upgrading..."
  fi
fi

if [[ "$NODE_OK" == false ]]; then
  info "Installing Node.js 22 LTS..."

  # Try nvm first (non-root, preferred)
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    . "$NVM_DIR/nvm.sh"
    nvm install 22 && nvm use 22 && nvm alias default 22
    pass "Node.js $(node -v) installed via nvm"
    ((FIXED++))
    NEEDS_RESTART=true
  else
    # Try nodesource setup
    if curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - 2>/dev/null; then
      if sudo apt-get install -y nodejs -qq 2>/dev/null; then
        pass "Node.js $(node -v) installed via nodesource"
        ((FIXED++))
        NEEDS_RESTART=true
      else
        fail "apt-get install nodejs failed"
      fi
    else
      # Last resort: install nvm from scratch
      info "Installing nvm..."
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>/dev/null
      export NVM_DIR="$HOME/.nvm"
      . "$NVM_DIR/nvm.sh"
      nvm install 22 && nvm use 22 && nvm alias default 22
      pass "Node.js $(node -v) installed via nvm"
      ((FIXED++))
      NEEDS_RESTART=true
    fi
  fi

  # Verify node is now available
  if ! command -v node &>/dev/null; then
    fail "Node.js installation failed. Install manually and re-run this script."
    echo -e "  Try: ${BOLD}curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
    exit 1
  fi
fi

# ── npm ──────────────────────────────────────────
step "npm"
if command -v npm &>/dev/null; then
  pass "npm $(npm -v)"
else
  # npm ships with Node — if missing, something went wrong
  if command -v node &>/dev/null; then
    warn "npm not found but Node.js exists — this is unusual"
    info "Trying to fix with: sudo apt-get install -y npm"
    ensure_apt
    sudo apt-get install -y npm -qq 2>/dev/null && pass "npm installed" && ((FIXED++)) || true
  else
    fail "npm unavailable (Node.js not installed)"
  fi
fi

# ── pnpm ─────────────────────────────────────────
step "pnpm"
PNPM_OK=false
if command -v pnpm &>/dev/null; then
  PNPM_VER=$(pnpm -v)
  PNPM_MAJOR=$(echo "$PNPM_VER" | cut -d. -f1)
  if (( PNPM_MAJOR >= 8 )); then
    pass "pnpm $PNPM_VER"
    PNPM_OK=true
  else
    warn "pnpm $PNPM_VER is outdated (need >= 8) — upgrading..."
  fi
fi

if [[ "$PNPM_OK" == false ]]; then
  info "Installing pnpm..."
  if command -v npm &>/dev/null; then
    npm install -g pnpm@latest 2>/dev/null
  elif command -v corepack &>/dev/null; then
    corepack enable 2>/dev/null
    corepack prepare pnpm@latest --activate 2>/dev/null
  fi

  # Re-check
  if command -v pnpm &>/dev/null; then
    pass "pnpm $(pnpm -v) installed"
    ((FIXED++))
    NEEDS_RESTART=true
  else
    # Try the standalone installer as last resort
    info "Trying standalone pnpm installer..."
    curl -fsSL https://get.pnpm.io/install.sh | sh - 2>/dev/null
    export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
    export PATH="$PNPM_HOME:$PATH"
    if command -v pnpm &>/dev/null; then
      pass "pnpm $(pnpm -v) installed via standalone installer"
      ((FIXED++))
      NEEDS_RESTART=true
    else
      fail "Could not install pnpm. Install manually: npm install -g pnpm"
      exit 1
    fi
  fi
fi

# ── Filesystem ───────────────────────────────────
step "Filesystem"
if [ -w "$SCRIPT_DIR" ]; then
  pass "Write access to project directory"
else
  fail "No write access to $SCRIPT_DIR"
  exit 1
fi

mkdir -p "$DATA_DIR/logs" 2>/dev/null
if [ -w "$DATA_DIR" ]; then
  pass "Data directory ready ($DATA_DIR)"
else
  fail "Cannot create/write to data directory ($DATA_DIR)"
  exit 1
fi

# ─────────────────────────────────────────────────
# Restart check: if we installed Node/pnpm, re-exec
# to pick up the new binaries in a clean shell
# ─────────────────────────────────────────────────
if [[ "$NEEDS_RESTART" == true ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${YELLOW}Installed $FIXED missing dependency(ies).${NC}"
  echo -e "${CYAN}Restarting setup to verify everything...${NC}"
  echo ""

  export ZEUS_RESTART_COUNT=$(( ${ZEUS_RESTART_COUNT:-0} + 1 ))

  # Source nvm/pnpm paths so the restarted script finds them
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
  export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
  export PATH="$PNPM_HOME:$PATH"

  exec bash "$SCRIPT_DIR/setup.sh" "$@"
fi

# ─────────────────────────────────────────────────
# Phase 2: All clear — proceed to ZEUS install
# ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if (( FIXED > 0 )); then
  echo -e "${YELLOW}Auto-fixed $FIXED issue(s).${NC}"
fi
echo -e "${GREEN}All system dependencies are present.${NC}"
echo ""

# ── If --check-only, stop here ───────────────────
if [[ "${1:-}" == "--check" || "${1:-}" == "-c" ]]; then
  echo -e "Run ${BOLD}bash setup.sh${NC} (without --check) to install ZEUS."
  echo ""
  exit 0
fi

# ── Install ZEUS ─────────────────────────────────
step "pnpm install"
info "Installing project dependencies..."
cd "$SCRIPT_DIR"
pnpm install
echo ""

step "Prisma"
info "Generating Prisma client..."
cd "$SCRIPT_DIR/backend"
npx prisma generate
echo ""

if [ ! -f "$DATA_DIR/zeus.db" ]; then
  info "No database found — running migration..."
  npx prisma migrate dev --name init --schema prisma/schema.prisma
  echo ""
  info "Seeding default data..."
  cd "$SCRIPT_DIR"
  pnpm seed
else
  pass "Database exists ($DATA_DIR/zeus.db)"

  info "Applying pending migrations (if any)..."
  npx prisma migrate deploy --schema prisma/schema.prisma 2>/dev/null || true
fi

step "Frontend Build"
info "Building frontend for production..."
cd "$SCRIPT_DIR"
pnpm build
echo ""

# ── Detect VM IP ─────────────────────────────────
VM_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

# ── Done ─────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}${BOLD}⚡ ZEUS is ready.${NC}"
echo ""
echo -e "  Start ZEUS:         ${BOLD}pnpm start${NC}"
echo "  Dev mode:           pnpm dev"
echo "  Reseed data:        pnpm seed"
echo "  Check only:         bash setup.sh --check"
echo ""
if [[ -n "$VM_IP" ]]; then
  echo -e "  ${CYAN}Your VM IP:${NC}  ${BOLD}${VM_IP}${NC}"
  echo -e "  ${CYAN}Access URL:${NC}  ${BOLD}http://${VM_IP}:3000${NC}"
  echo ""
  echo "  On first launch, the UI will ask you to set a password"
  echo "  and confirm the IP address. After that, use the URL above"
  echo "  from any browser on your network."
fi
echo ""
