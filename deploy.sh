#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

ZEUS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${BOLD}${CYAN}⚡ ZEUS — Deploy${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Run full setup (installs deps, builds, migrates, seeds)
echo -e "${CYAN}[1/3] Installing...${NC}"
bash "$ZEUS_DIR/setup.sh"

# 2. Detect node path and create systemd service
echo ""
echo -e "${CYAN}[2/3] Creating systemd service...${NC}"

NODE_BIN=$(which node)
PNPM_BIN=$(which pnpm)

# Resolve NVM paths
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
NODE_BIN=$(which node)
PNPM_BIN=$(which pnpm)

cat > /tmp/zeus.service << EOF
[Unit]
Description=ZEUS Agent Runtime
After=network.target

[Service]
Type=simple
WorkingDirectory=$ZEUS_DIR/backend
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:../../data/zeus.db
Environment=PORT=3000
Environment=PATH=$(dirname $NODE_BIN):$(dirname $PNPM_BIN):/usr/local/bin:/usr/bin:/bin
ExecStart=$NODE_BIN $(dirname $PNPM_BIN)/npx tsx src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo cp /tmp/zeus.service /etc/systemd/system/zeus.service
sudo systemctl daemon-reload
sudo systemctl enable zeus
sudo systemctl restart zeus

sleep 3

# 3. Check it's running and print URL
echo ""
echo -e "${CYAN}[3/3] Verifying...${NC}"

if sudo systemctl is-active --quiet zeus; then
  VM_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}${BOLD}⚡ ZEUS is running.${NC}"
  echo ""
  echo -e "  ${BOLD}Share this link:${NC}"
  echo ""
  echo -e "  ${CYAN}${BOLD}http://${VM_IP}:3000${NC}"
  echo ""
  echo "  First-time visitors will set up their password"
  echo "  and name their assistant."
  echo ""
  echo "  Commands:"
  echo "    sudo systemctl status zeus    # check status"
  echo "    sudo systemctl restart zeus   # restart"
  echo "    sudo systemctl stop zeus      # stop"
  echo "    sudo journalctl -u zeus -f    # live logs"
  echo ""
else
  echo -e "\033[0;31mFailed to start. Check: sudo journalctl -u zeus -n 50\033[0m"
  exit 1
fi
