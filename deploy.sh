#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/aplikasi-sertifikat/app}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-aplikasi-sertifikat}"
HEALTH_URL="${HEALTH_URL:-http://100.66.177.8:8081/}"

echo "== Deploy ${SERVICE_NAME} =="
echo "Waktu  : $(date -Is)"
echo "Folder : ${APP_DIR}"
echo "Branch : ${BRANCH}"

cd "$APP_DIR"

echo "== Cek git remote =="
git remote -v

echo "== Ambil update dari GitHub =="
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "== Build dan restart Docker Compose =="
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --build
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up -d --build
else
  echo "ERROR: docker compose/docker-compose tidak ditemukan." >&2
  exit 1
fi

echo "== Status container =="
docker ps --filter "name=${SERVICE_NAME}" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo "== Health check website =="
for i in {1..10}; do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; then
    echo "OK: website merespons di ${HEALTH_URL}"
    break
  fi
  if [ "$i" = "10" ]; then
    echo "ERROR: website belum merespons setelah deploy." >&2
    exit 1
  fi
  sleep 3
done

echo "== Bersihkan image Docker tidak terpakai =="
docker image prune -f >/dev/null || true

echo "Deploy selesai: $(date -Is)"
