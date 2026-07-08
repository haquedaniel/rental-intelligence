#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(pwd)"

mkdir -p "$REPO_ROOT/app/owner/[ownerToken]/cockpit"
cp "$PACKAGE_ROOT/app/owner/[ownerToken]/cockpit/page.tsx" "$REPO_ROOT/app/owner/[ownerToken]/cockpit/page.tsx"
cp "$PACKAGE_ROOT/app/owner/[ownerToken]/cockpit/data.ts" "$REPO_ROOT/app/owner/[ownerToken]/cockpit/data.ts"
cp "$PACKAGE_ROOT/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx" "$REPO_ROOT/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx"
cp "$PACKAGE_ROOT/app/owner/[ownerToken]/cockpit/types.ts" "$REPO_ROOT/app/owner/[ownerToken]/cockpit/types.ts"

mkdir -p "$REPO_ROOT/public/pilotys-assets"
cp -R "$PACKAGE_ROOT/public/pilotys-assets/." "$REPO_ROOT/public/pilotys-assets/"

mkdir -p "$REPO_ROOT/public/owner/cockpit"
cp "$PACKAGE_ROOT/public/owner/cockpit/manifest.webmanifest" "$REPO_ROOT/public/owner/cockpit/manifest.webmanifest"

echo "Installed Pilotys owner cockpit v6 route files and assets."
echo "Now run: npm run build"
