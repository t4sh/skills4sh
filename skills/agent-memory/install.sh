#!/usr/bin/env bash
# Install agent-memory skill
# Works on macOS and Linux.
#
# Usage:
#   ./install.sh           # interactive prompt
#   ./install.sh --global  # install to $HOME/.claude/skills/agent-memory
#   ./install.sh --project # install to ./.claude/skills/agent-memory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_NAME="$(basename "$SCRIPT_DIR")"

GLOBAL_DIR="$HOME/.claude/skills/$SKILL_NAME"
PROJECT_DIR="$(pwd)/.claude/skills/$SKILL_NAME"

choose_destination() {
  echo "┌─────────────────────────────────────────┐"
  echo "│  Install skill: $SKILL_NAME"
  echo "├─────────────────────────────────────────┤"
  echo "│  1) Global  → $GLOBAL_DIR"
  echo "│  2) Project → $PROJECT_DIR"
  echo "└─────────────────────────────────────────┘"
  echo ""
  printf "Choose [1/2]: "
  read -r choice
  case "$choice" in
    1) DEST="$GLOBAL_DIR" ;;
    2) DEST="$PROJECT_DIR" ;;
    *) echo "Invalid choice. Exiting."; exit 1 ;;
  esac
}

install_skill() {
  local dest="$1"

  # Validate destination is under a .claude/skills/ path
  case "$dest" in
    */.claude/skills/*) ;;
    *) echo "Error: unexpected destination path: $dest" >&2; exit 1 ;;
  esac

  if [ -L "$dest" ]; then
    echo "Found older symlink-based installation at $dest — removing."
    rm -f "$dest"
  elif [ -d "$dest" ]; then
    echo "Found existing installation at $dest"
    printf "Overwrite? [y/N]: "
    read -r confirm
    case "$confirm" in
      [yY]*) rm -rf "$dest" ;;
      *)     echo "Aborted."; exit 0 ;;
    esac
  fi

  mkdir -p "$dest"

  # Copy only the files this skill needs
  cp "$SCRIPT_DIR/SKILL.md" "$dest/"
  cp "$SCRIPT_DIR/bootstrap.sh" "$dest/"
  chmod +x "$dest/bootstrap.sh"

  echo ""
  echo "Installation complete! The skill will now be loaded from $dest"
  echo "Refresh or restart your session for changes to take effect."
}

# Parse arguments
MODE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --global)  MODE="global"; shift ;;
    --project) MODE="project"; shift ;;
    -h|--help)
      echo "Usage: $0 [--global | --project]"
      echo "  --global   Install to $GLOBAL_DIR"
      echo "  --project  Install to $PROJECT_DIR"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

case "$MODE" in
  global)  DEST="$GLOBAL_DIR" ;;
  project) DEST="$PROJECT_DIR" ;;
  *)       choose_destination ;;
esac

install_skill "$DEST"
