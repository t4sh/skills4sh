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

setup_credentials() {
  local dest="$1"
  local env_example="$SCRIPT_DIR/$SKILL_NAME.env.example"
  local env_file="$dest/$SKILL_NAME.env"

  # Copy the example file as reference
  if [ -f "$env_example" ]; then
    cp "$env_example" "$dest/$SKILL_NAME.env.example"
  else
    return 0
  fi

  echo ""
  echo "Credential setup:"
  echo "  1) Import credentials from a .env file"
  echo "  2) Enter credentials one by one"
  echo "  3) Skip — I'll add credentials later"
  echo ""
  printf "Choose [1/2/3]: "
  read -r cred_choice

  case "$cred_choice" in
    1)
      printf "Path to .env file: "
      read -r env_path
      env_path="${env_path/#\~/$HOME}"
      if [ -f "$env_path" ]; then
        cp "$env_path" "$env_file"
        echo "Credentials imported."
      else
        echo "File not found: $env_path — skipping."
      fi
      ;;
    2)
      echo ""
      : > "$env_file"
      while IFS= read -r line; do
        if [[ "$line" =~ ^#.*$ ]] || [[ -z "$line" ]]; then
          echo "$line" >> "$env_file"
          continue
        fi
        key="${line%%=*}"
        key="${key#export }"
        printf "  %s: " "$key"
        read -r value
        echo "export $key=$value" >> "$env_file"
      done < "$env_example"
      echo "Credentials saved."
      ;;
    3|*)
      echo "Skipping credentials. Edit $SKILL_NAME.env.example → $SKILL_NAME.env when ready."
      ;;
  esac
}

install_skill() {
  local dest="$1"

  # Clean up older installations (symlink from old installer, or directory from previous install)
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

  # Copy skill files only (exclude installer and agent instruction files)
  for f in "$SCRIPT_DIR"/*; do
    fname="$(basename "$f")"
    case "$fname" in
      install.sh|install.ps1|AGENTS.md|CLAUDE.md|*.env.example) continue ;;
      *) cp -r "$f" "$dest/" ;;
    esac
  done

  # Ensure bootstrap script is executable
  if [ -f "$dest/bootstrap.sh" ]; then
    chmod +x "$dest/bootstrap.sh"
  fi

  setup_credentials "$dest"

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
