# Deploy Ocean from VM root

## 1. Clone the repo (first time only)

```bash
cd ~
git clone https://github.com/MarcelAssistant/ocean-team.git
cd ocean-team
```

## 2. Deploy

From the **root of the cloned project** (ocean-team):

```bash
cd ~/ocean-team
bash deploy.sh
```

**Change the port** (default 3000, e.g. if it conflicts with another app):

```bash
PORT=3001 bash deploy.sh
```

Or if you cloned elsewhere:

```bash
cd /path/to/ocean-team
bash deploy.sh
```

The deploy script will:
1. Run setup (install deps, build, migrate, seed)
2. Create a systemd service (`zeus`)
3. Start the backend on port 3000

## 3. Access

After deploy, open: `http://<YOUR_VM_IP>:3000`

First-time setup: set password and name your assistant. Add your **Venice API key** in Settings → Video — Venice AI.

## 4. Useful commands

```bash
sudo systemctl status zeus    # check status
sudo systemctl restart zeus   # restart
sudo systemctl stop zeus      # stop
sudo journalctl -u zeus -f    # live logs
```

## 5. Update from GitHub

```bash
cd ~/ocean-team
git pull origin main
bash deploy.sh
```
