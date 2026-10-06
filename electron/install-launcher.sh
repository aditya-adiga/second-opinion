#!/usr/bin/env bash
# Installs a desktop launcher entry (Linux .desktop file) so the app shows up in your
# application menu/launcher with its own icon, instead of needing `npm run electron` by hand.
# Safe to re-run any time (e.g. after moving the repo) — it just overwrites the entry.
set -e
PROJECT_ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
TARGET_DIR="$HOME/.local/share/applications"
TARGET_FILE="$TARGET_DIR/second-opinion.desktop"

mkdir -p "$TARGET_DIR"
cat > "$TARGET_FILE" << EOF
[Desktop Entry]
Type=Application
Name=Second Opinion
Comment=A chart fairness checker
Exec=${PROJECT_ROOT}/electron/launch.sh
Icon=${PROJECT_ROOT}/electron/icon.png
Terminal=false
Categories=Utility;Graphics;
StartupWMClass=Second Opinion
EOF
chmod +x "$TARGET_FILE"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$TARGET_DIR"
fi

echo "Installed launcher: $TARGET_FILE"
echo "It should now show up in your application menu/launcher as \"Second Opinion\"."
