#!/usr/bin/env bash
set -euo pipefail

ZEUS_ROOT="$(cd "$(dirname "$0")" && pwd)"
INSTANCES_DIR="$ZEUS_ROOT/instances"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

usage() {
  echo ""
  echo -e "${BOLD}ZEUS Instance Manager${NC}"
  echo ""
  echo "Usage:"
  echo "  zeus.sh create <name> --port <port>   Create a new instance"
  echo "  zeus.sh start <name>                  Start an instance"
  echo "  zeus.sh stop <name>                   Stop an instance"
  echo "  zeus.sh list                          List all instances"
  echo "  zeus.sh portal                        Start portal on port 3000"
  echo ""
  echo "Examples:"
  echo "  bash zeus.sh create john --port 3001"
  echo "  bash zeus.sh create marie --port 3002"
  echo "  bash zeus.sh start john"
  echo "  bash zeus.sh list"
  echo ""
}

create_instance() {
  local name="$1"
  local port="$2"

  if [[ -z "$name" || -z "$port" ]]; then
    echo -e "${RED}Usage: zeus.sh create <name> --port <port>${NC}"
    exit 1
  fi

  local dir="$INSTANCES_DIR/$name"
  if [[ -d "$dir" ]]; then
    echo -e "${RED}Instance '$name' already exists at $dir${NC}"
    exit 1
  fi

  echo -e "${CYAN}Creating instance '$name' on port $port...${NC}"
  mkdir -p "$dir/data/logs"

  # Store instance config
  cat > "$dir/instance.json" << EOF
{
  "name": "$name",
  "port": $port,
  "createdAt": "$(date -Iseconds)"
}
EOF

  # Create the database
  cd "$ZEUS_ROOT/backend"
  DATABASE_URL="file:../../instances/$name/data/zeus.db" npx prisma migrate deploy --schema prisma/schema.prisma 2>/dev/null
  DATABASE_URL="file:../../instances/$name/data/zeus.db" npx tsx prisma/seed.ts 2>/dev/null

  echo -e "${GREEN}Instance '$name' created.${NC}"
  echo -e "  Database: $dir/data/zeus.db"
  echo -e "  Port: $port"
  echo -e "  Start:  ${BOLD}bash zeus.sh start $name${NC}"
}

start_instance() {
  local name="$1"
  local dir="$INSTANCES_DIR/$name"

  if [[ ! -d "$dir" ]]; then
    echo -e "${RED}Instance '$name' not found. Create it first.${NC}"
    exit 1
  fi

  local port=$(python3 -c "import json; print(json.load(open('$dir/instance.json'))['port'])")
  local pidfile="$dir/zeus.pid"

  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo -e "${GREEN}Instance '$name' is already running (PID $(cat "$pidfile")) on port $port${NC}"
    return
  fi

  echo -e "${CYAN}Starting '$name' on port $port...${NC}"
  cd "$ZEUS_ROOT/backend"
  DATABASE_URL="file:../../instances/$name/data/zeus.db" PORT=$port nohup npx tsx src/index.ts > "$dir/data/logs/server.log" 2>&1 &
  echo $! > "$pidfile"
  sleep 2

  if kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo -e "${GREEN}Instance '$name' running at http://0.0.0.0:$port (PID $(cat "$pidfile"))${NC}"
  else
    echo -e "${RED}Failed to start. Check $dir/data/logs/server.log${NC}"
  fi
}

stop_instance() {
  local name="$1"
  local dir="$INSTANCES_DIR/$name"
  local pidfile="$dir/zeus.pid"

  if [[ ! -f "$pidfile" ]]; then
    echo -e "Instance '$name' is not running."
    return
  fi

  local pid=$(cat "$pidfile")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo -e "${GREEN}Instance '$name' stopped.${NC}"
  fi
  rm -f "$pidfile"
}

list_instances() {
  echo ""
  echo -e "${BOLD}ZEUS Instances${NC}"
  echo "────────────────────────────────────────"

  if [[ ! -d "$INSTANCES_DIR" ]] || [[ -z "$(ls -A "$INSTANCES_DIR" 2>/dev/null)" ]]; then
    echo "  No instances. Create one: bash zeus.sh create <name> --port <port>"
    echo ""
    return
  fi

  printf "  %-15s %-8s %-10s %s\n" "NAME" "PORT" "STATUS" "PID"
  echo "  ─────────────────────────────────────"

  for dir in "$INSTANCES_DIR"/*/; do
    [[ ! -d "$dir" ]] && continue
    local name=$(basename "$dir")
    local port=$(python3 -c "import json; print(json.load(open('$dir/instance.json'))['port'])" 2>/dev/null || echo "?")
    local pidfile="$dir/zeus.pid"
    local status="stopped"
    local pid="-"

    if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
      status="running"
      pid=$(cat "$pidfile")
    fi

    local color="$RED"
    [[ "$status" == "running" ]] && color="$GREEN"
    printf "  %-15s %-8s ${color}%-10s${NC} %s\n" "$name" "$port" "$status" "$pid"
  done
  echo ""
}

start_portal() {
  echo -e "${CYAN}Starting ZEUS Portal on port 3000...${NC}"
  echo "This serves a page linking to all instances."

  local html="<html><head><title>ZEUS Portal</title><style>body{background:#08080c;color:#e4e4e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.c{text-align:center}.t{color:#e5a210;font-size:2em;font-weight:bold;margin-bottom:1em}a{display:block;color:#e5a210;text-decoration:none;padding:.5em 1.5em;margin:.3em;border:1px solid #1e1e28;border-radius:.5em;transition:all .2s}a:hover{border-color:#e5a210;background:rgba(229,162,16,.08)}.s{color:#5a5a66;font-size:.8em;margin-top:2em}</style></head><body><div class='c'><div class='t'>ZEUS</div>"

  if [[ -d "$INSTANCES_DIR" ]]; then
    for dir in "$INSTANCES_DIR"/*/; do
      [[ ! -d "$dir" ]] && continue
      local name=$(basename "$dir")
      local port=$(python3 -c "import json; print(json.load(open('$dir/instance.json'))['port'])" 2>/dev/null || continue)
      html+="<a href='http://\$(hostname -I | awk \"{print \\\$1}\"):$port'>$name (port $port)</a>"
    done
  fi

  html+="<div class='s'>Select an instance</div></div></body></html>"

  python3 -c "
import http.server, socketserver
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type','text/html')
        self.end_headers()
        import subprocess
        ip = subprocess.check_output(['hostname','-I']).decode().split()[0]
        html = '''$html'''.replace('\$(hostname -I | awk \"{print \\\\\$1}\")', ip)
        self.wfile.write(html.encode())
    def log_message(self, *a): pass
with socketserver.TCPServer(('',3000),H) as s:
    print('Portal running at http://0.0.0.0:3000')
    s.serve_forever()
"
}

# ── Main ─────────────────────────────────────────
mkdir -p "$INSTANCES_DIR"

case "${1:-}" in
  create)
    port=""
    name="${2:-}"
    shift 2 || true
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --port) port="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    create_instance "$name" "$port"
    ;;
  start)   start_instance "${2:-}" ;;
  stop)    stop_instance "${2:-}" ;;
  list)    list_instances ;;
  portal)  start_portal ;;
  *)       usage ;;
esac
