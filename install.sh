#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

ZEUS_ROOT="$(cd "$(dirname "$0")" && pwd)"
INSTANCES_DIR="$ZEUS_ROOT/instances"
PORTAL_SERVICE="zeus-portal"

echo ""
echo -e "${BOLD}${CYAN}⚡ ZEUS — Install${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. System dependencies ────────────────────
echo -e "\n${CYAN}[1] System setup${NC}"
bash "$ZEUS_ROOT/setup.sh" --check 2>/dev/null || bash "$ZEUS_ROOT/setup.sh"

# ── 2. Ask for workspace name ─────────────────
echo ""
echo -e "${CYAN}[2] Create workspace${NC}"

# Find next available port
mkdir -p "$INSTANCES_DIR"
USED_PORTS=$(find "$INSTANCES_DIR" -name "instance.json" -exec python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['port'])" {} \; 2>/dev/null | sort -n)
NEXT_PORT=3001
for p in $USED_PORTS; do
  if [ "$NEXT_PORT" -eq "$p" ]; then
    NEXT_PORT=$((NEXT_PORT + 1))
  fi
done

# List existing workspaces
EXISTING=$(ls -1 "$INSTANCES_DIR" 2>/dev/null | head -20)
if [ -n "$EXISTING" ]; then
  echo -e "  ${YELLOW}Existing workspaces:${NC}"
  for dir in "$INSTANCES_DIR"/*/; do
    [ ! -d "$dir" ] && continue
    local_name=$(basename "$dir")
    local_port=$(python3 -c "import json; print(json.load(open('$dir/instance.json'))['port'])" 2>/dev/null || echo "?")
    local_pid="$dir/zeus.pid"
    local_status="stopped"
    [ -f "$local_pid" ] && kill -0 "$(cat "$local_pid")" 2>/dev/null && local_status="running"
    echo -e "    $local_name → port $local_port ($local_status)"
  done
  echo ""
fi

read -p "  Workspace name (e.g. john, family, work): " WS_NAME
WS_NAME=$(echo "$WS_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')

if [ -z "$WS_NAME" ]; then
  echo -e "  ${YELLOW}No name provided. Generating one...${NC}"
  WS_NAME="workspace-$(date +%s | tail -c 5)"
fi

WS_DIR="$INSTANCES_DIR/$WS_NAME"

if [ -d "$WS_DIR" ]; then
  echo -e "  ${YELLOW}Workspace '$WS_NAME' already exists.${NC}"
  EXISTING_PORT=$(python3 -c "import json; print(json.load(open('$WS_DIR/instance.json'))['port'])")
  echo -e "  Starting existing workspace on port $EXISTING_PORT..."
  NEXT_PORT=$EXISTING_PORT
else
  echo -e "  Creating workspace '${BOLD}$WS_NAME${NC}' on port ${BOLD}$NEXT_PORT${NC}..."
  mkdir -p "$WS_DIR/data/logs" "$WS_DIR/data/workspace" "$WS_DIR/data/backups"

  cat > "$WS_DIR/instance.json" << EOF
{
  "name": "$WS_NAME",
  "port": $NEXT_PORT,
  "createdAt": "$(date -Iseconds)"
}
EOF

  # Create database
  cd "$ZEUS_ROOT/backend"
  DATABASE_URL="file:../../instances/$WS_NAME/data/zeus.db" npx prisma migrate deploy --schema prisma/schema.prisma 2>/dev/null
  DATABASE_URL="file:../../instances/$WS_NAME/data/zeus.db" npx tsx prisma/seed.ts 2>/dev/null
  echo -e "  ${GREEN}Database created and seeded${NC}"
fi

# ── 3. Build frontend ─────────────────────────
echo -e "\n${CYAN}[3] Building frontend${NC}"
cd "$ZEUS_ROOT"
pnpm build 2>/dev/null || (pnpm install && pnpm build)

# ── 4. Create systemd service ─────────────────
echo -e "\n${CYAN}[4] Creating service${NC}"

NODE_BIN=$(which node)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
NODE_BIN=$(which node)
NPX_DIR=$(dirname $(which npx))

SERVICE_NAME="zeus-${WS_NAME}"

cat > "/tmp/${SERVICE_NAME}.service" << EOF
[Unit]
Description=ZEUS Workspace: ${WS_NAME}
After=network.target

[Service]
Type=simple
WorkingDirectory=$ZEUS_ROOT/backend
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:../../instances/${WS_NAME}/data/zeus.db
Environment=PORT=${NEXT_PORT}
Environment=PATH=${NPX_DIR}:/usr/local/bin:/usr/bin:/bin
ExecStart=${NODE_BIN} ${NPX_DIR}/npx tsx src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo cp "/tmp/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME" 2>/dev/null
sudo systemctl restart "$SERVICE_NAME"
sleep 3

# ── 5. Set up portal on port 3000 ─────────────
echo -e "\n${CYAN}[5] Portal${NC}"

cat > "$ZEUS_ROOT/portal.py" << 'PYEOF'
import http.server, socketserver, json, os, subprocess

INSTANCES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instances")

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        try:
            ip = subprocess.check_output(["hostname", "-I"]).decode().split()[0]
        except:
            ip = "localhost"

        workspaces = []
        if os.path.isdir(INSTANCES_DIR):
            for name in sorted(os.listdir(INSTANCES_DIR)):
                cfg_path = os.path.join(INSTANCES_DIR, name, "instance.json")
                if os.path.exists(cfg_path):
                    with open(cfg_path) as f:
                        cfg = json.load(f)
                    workspaces.append({"name": name, "port": cfg["port"]})

        links = ""
        for ws in workspaces:
            links += f'<a href="http://{ip}:{ws["port"]}">{ws["name"]}<span>port {ws["port"]}</span></a>'

        if not links:
            links = '<p style="color:#5a5a66;font-size:14px">No workspaces yet. Run: bash install.sh</p>'

        html = f'''<!DOCTYPE html><html><head><title>ZEUS</title>
<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{background:#08080c;color:#e4e4e8;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}}.c{{text-align:center;width:100%;max-width:400px;padding:20px}}.t{{color:#e5a210;font-size:28px;font-weight:700;letter-spacing:2px;margin-bottom:8px}}.s{{color:#5a5a66;font-size:13px;margin-bottom:32px}}a{{display:flex;align-items:center;justify-content:space-between;color:#e4e4e8;text-decoration:none;padding:14px 20px;margin:6px 0;border:1px solid #1e1e28;border-radius:10px;font-size:15px;font-weight:500;transition:all .2s}}a:hover{{border-color:#e5a210;background:rgba(229,162,16,.06)}}a span{{color:#5a5a66;font-size:12px}}</style></head>
<body><div class="c"><div class="t">ZEUS</div><div class="s">Select a workspace</div>{links}</div></body></html>'''
        self.wfile.write(html.encode())
    def log_message(self, *a): pass

with socketserver.TCPServer(("", 3000), Handler) as s:
    s.serve_forever()
PYEOF

# Create portal service if not exists
if ! systemctl is-active --quiet "$PORTAL_SERVICE" 2>/dev/null; then
  cat > "/tmp/${PORTAL_SERVICE}.service" << EOF
[Unit]
Description=ZEUS Portal
After=network.target

[Service]
Type=simple
WorkingDirectory=$ZEUS_ROOT
ExecStart=/usr/bin/python3 $ZEUS_ROOT/portal.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  sudo cp "/tmp/${PORTAL_SERVICE}.service" "/etc/systemd/system/${PORTAL_SERVICE}.service"
  sudo systemctl daemon-reload
  sudo systemctl enable "$PORTAL_SERVICE" 2>/dev/null
  sudo systemctl start "$PORTAL_SERVICE"
fi

# ── Done ──────────────────────────────────────
VM_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}${BOLD}⚡ Workspace '${WS_NAME}' is running.${NC}"
echo ""
echo -e "  ${BOLD}Workspace URL:${NC}  ${CYAN}http://${VM_IP}:${NEXT_PORT}${NC}"
echo -e "  ${BOLD}Portal URL:${NC}     ${CYAN}http://${VM_IP}:3000${NC}"
echo ""
echo "  Share the workspace URL with the user."
echo "  First visit → onboarding (name, password)."
echo ""
echo "  To create another workspace:"
echo "    bash install.sh"
echo ""
echo "  Commands:"
echo "    sudo systemctl status ${SERVICE_NAME}"
echo "    sudo systemctl restart ${SERVICE_NAME}"
echo "    sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
