#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"; PKG="$(cd "$(dirname "$0")" && pwd)"
[ -d "$ROOT/src/rental_intel" ] || { echo "Run from rental-intelligence root"; exit 1; }
[ -d "$ROOT/apps/cleaner-web" ] || { echo "Missing apps/cleaner-web"; exit 1; }
BACKUP="$ROOT/.pilotys-backups/explainable-pricing-v4-$(date +%Y%m%d-%H%M%S)";mkdir -p "$BACKUP"
copy(){ local s="$1" d="$2";mkdir -p "$(dirname "$d")";[ -e "$d" ]&&{ mkdir -p "$BACKUP/$(dirname "${d#$ROOT/}")";cp -a "$d" "$BACKUP/${d#$ROOT/}";};cp "$s" "$d";}
while IFS= read -r -d '' f;do rel="${f#$PKG/backend/rental_intel/}";copy "$f" "$ROOT/src/rental_intel/$rel";done < <(find "$PKG/backend/rental_intel" -type f -print0)
while IFS= read -r -d '' f;do rel="${f#$PKG/frontend/}";copy "$f" "$ROOT/apps/cleaner-web/$rel";done < <(find "$PKG/frontend" -type f -print0)
copy "$PKG/migration/20260716013000_explainable_pricing_versions.sql" "$ROOT/supabase/migrations/20260716013000_explainable_pricing_versions.sql"
BASE="";for f in docker-compose.yml compose.yml docker-compose.yaml compose.yaml;do [ -f "$ROOT/$f" ]&&BASE="$f"&&break;done
if [ "$BASE" != "docker-compose.yml" ];then sed "s/file: docker-compose.yml/file: $BASE/" "$PKG/docker-compose.pricing.yml" > "$ROOT/docker-compose.pricing.yml";else cp "$PKG/docker-compose.pricing.yml" "$ROOT/docker-compose.pricing.yml";fi
if ! grep -q '^PRICING_INTERNAL_SECRET=' "$ROOT/.env" 2>/dev/null; then
  SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
  echo "PRICING_INTERNAL_SECRET=$SECRET" >> "$ROOT/.env"
fi
if [ -n "$BASE" ]; then
  SEP=':'; case "$(uname)" in MINGW*|MSYS*|CYGWIN*) SEP=';' ;; esac
  VALUE="$BASE${SEP}docker-compose.pricing.yml"
  if grep -q '^COMPOSE_FILE=' "$ROOT/.env" 2>/dev/null; then
    echo "NOTE: .env already contains COMPOSE_FILE; ensure docker-compose.pricing.yml is included."
  else
    echo "COMPOSE_FILE=$VALUE" >> "$ROOT/.env"
  fi
fi
python -m py_compile "$ROOT/src/rental_intel/pricing/engine.py" "$ROOT/src/rental_intel/pricing/api.py" "$ROOT/src/rental_intel/pricing/market_signal.py"
echo "Installed explainable pricing v4. Backup: $BACKUP"
echo "Next: supabase db push && docker compose up -d --build"
