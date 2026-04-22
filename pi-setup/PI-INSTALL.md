# Raspberry Pi 5 installation — Maxwell Family HQ

End-to-end install for a wall-mounted 1920×1080 touchscreen.
Assumes Raspberry Pi OS (Bookworm), Node 20, npm 10, and git are already installed; your Pi user is `kyle`.

All commands are run over SSH as `kyle@192.168.1.64` unless noted.

---

## 1. Clone and install

```bash
ssh kyle@192.168.1.64

# One-time system packages (Chromium + cursor hider)
sudo apt-get update
sudo apt-get install -y chromium-browser unclutter curl build-essential python3

# Clone the app into your home directory
cd ~
git clone https://github.com/kylemaxwell-afk/maxwell-family-hq.git
cd maxwell-family-hq

# Install deps — better-sqlite3 will compile from source here (needed tools
# were installed above). Client deps install normally.
npm run install:all
```

First install takes ~3–5 min on a Pi 5 because `better-sqlite3` compiles.

Smoke-test it runs before wiring up systemd:

```bash
./start-all.sh
# open http://localhost:5173 on the Pi, or
# curl http://localhost:3001/api/health  from another machine
# Ctrl+C to stop
```

---

## 2. Auto-start the server + client on boot (systemd system service)

```bash
sudo cp ~/maxwell-family-hq/maxwell-hq.service /etc/systemd/system/maxwell-hq.service
sudo systemctl daemon-reload
sudo systemctl enable --now maxwell-hq.service

# Verify
systemctl status maxwell-hq.service
journalctl -u maxwell-hq -f        # tail live logs (Ctrl+C to exit)
curl http://localhost:3001/api/health
```

If you want a different admin PIN than `1234`, edit `/etc/systemd/system/maxwell-hq.service`, uncomment the `Environment=ADMIN_PIN=...` line, then:

```bash
sudo systemctl daemon-reload && sudo systemctl restart maxwell-hq
```

---

## 3. Chromium kiosk mode (the wall display)

Two paths depending on which session type your Pi OS uses. Check with:

```bash
echo $XDG_SESSION_TYPE     # "wayland" on Bookworm default, "x11" on older setups
```

### 3a. Wayland (Bookworm default — labwc)

Use the included user-level systemd service:

```bash
mkdir -p ~/.config/systemd/user
cp ~/maxwell-family-hq/pi-setup/maxwell-kiosk.service ~/.config/systemd/user/
# Let user services run without an active login (survives boot before login):
sudo loginctl enable-linger kyle
# Enable the kiosk service
systemctl --user daemon-reload
systemctl --user enable --now maxwell-kiosk.service
# Check it
systemctl --user status maxwell-kiosk.service
journalctl --user -u maxwell-kiosk -f
```

Screen blanking on Wayland is controlled by the compositor, not xset. Disable it via:

```bash
# Pi OS desktop: open Raspberry Pi Configuration → Display → "Screen Blanking" → Off
# Or headless via raspi-config:
sudo raspi-config nonint do_blanking 1
```

### 3b. X11 / LXDE-pi (older Pi OS or X11 session)

Use the autostart file — it handles both Chromium + screen blanking + cursor hiding in one place:

```bash
mkdir -p ~/.config/lxsession/LXDE-pi
cp ~/maxwell-family-hq/pi-setup/autostart ~/.config/lxsession/LXDE-pi/autostart
sudo reboot
```

---

## 4. Hide the mouse cursor

- **X11**: `unclutter` (installed in step 1) is wired up by the autostart file — cursor disappears after 0.1s of no movement. No extra steps.
- **Wayland (labwc)**: The CSS in the app (`cursor: none !important` on `*`) already hides the cursor inside the app. For the brief moment before Chromium loads, the compositor cursor is shown. If that's a problem, install `interception-tools` or just disable the desktop cursor with `sed -i 's/XCURSOR_SIZE=.*/XCURSOR_SIZE=1/' ~/.bashrc`.

---

## 5. Disable screen blanking (belt and suspenders)

```bash
sudo raspi-config nonint do_blanking 1

# Also in ~/.bash_profile, if the screen ever still blanks in X sessions:
echo 'xset s off; xset -dpms; xset s noblank' >> ~/.bash_profile
```

---

## 6. Nightly reboot at 3:00 AM

```bash
sudo cp ~/maxwell-family-hq/pi-setup/nightly-reboot /etc/cron.d/maxwell-hq-reboot
sudo chmod 644 /etc/cron.d/maxwell-hq-reboot
# Verify cron picked it up:
sudo systemctl reload cron
grep . /etc/cron.d/maxwell-hq-reboot
```

The systemd service auto-restarts the app after boot; the kiosk service waits for the URL to come up before launching Chromium, so the 3 AM reboot is clean.

---

## 7. Pulling updates later

```bash
cd ~/maxwell-family-hq
git pull
npm run install:all                         # only needed if deps changed
sudo systemctl restart maxwell-hq           # restart API + Vite
systemctl --user restart maxwell-kiosk      # restart Chromium (Wayland)
```

---

## 8. Backing up the database

The whole app's state lives in `server/data.db`. Pull it to your laptop periodically:

```bash
scp kyle@192.168.1.64:/home/kyle/maxwell-family-hq/server/data.db ./backup-$(date +%F).db
```

To restore: stop the service, drop the file back into `server/`, restart.

```bash
ssh kyle@192.168.1.64
sudo systemctl stop maxwell-hq
# (copy your backup file into /home/kyle/maxwell-family-hq/server/data.db)
sudo systemctl start maxwell-hq
```

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Blank screen on boot | `systemctl status maxwell-hq` — did the API start? `systemctl --user status maxwell-kiosk` — did Chromium launch? |
| "Not found" in Chromium | API didn't start. `journalctl -u maxwell-hq -n 200` |
| Screen keeps blanking | `raspi-config` → Display → Screen Blanking → Off, then reboot |
| Cursor still visible on X11 | `pgrep unclutter` should return a PID. If not, check the autostart file |
| Changes don't appear | `git pull` on the Pi, then restart services |
| better-sqlite3 fails to build | `sudo apt-get install -y build-essential python3`, then `cd server && rm -rf node_modules && npm install` |
