#!/usr/bin/env bash
# Double-click/launcher entry point — resolves the project root relative to this script's own
# location, so it works regardless of where the repo is cloned, then runs Electron directly
# (skipping npm's wrapper process).
set -e
PROJECT_ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
cd "$PROJECT_ROOT"
exec ./node_modules/.bin/electron .
