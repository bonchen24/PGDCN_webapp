#!/usr/bin/env bash
# Author: Gemini
# OS support: Docker Desktop / Bash
# Description: Build and restart the DDT webapp locally with Docker Desktop.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.supabase.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-E:/CODING/TVCI_APP/supabase-docker/.env}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI không khả dụng. Hãy mở Docker Desktop trước khi deploy."
  exit 1
fi

if [ ! -f "$COMPOSE_ENV_FILE" ]; then
  echo "Không tìm thấy Supabase env file: $COMPOSE_ENV_FILE"
  echo "Có thể truyền đường dẫn khác qua COMPOSE_ENV_FILE."
  exit 1
fi

echo "Building and restarting DDT with Docker Desktop..."
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" up --build -d

if command -v curl >/dev/null 2>&1; then
  echo "Checking application health..."
  curl --fail --silent --show-error http://localhost:2357/api/health
  echo
  curl --fail --silent --show-error http://localhost:2357/api/db/health
  echo
fi

echo "Docker Desktop deployment completed."

# --- End of deploy.sh ---
