# Pilotys owner token cockpit v34

Fixes v32 reservation bars disappearing while keeping connector lines.

v34 keeps the horizontal connector lines, but separates the planning lane into two layers:
- connector lines behind the stays
- reservation bars in a higher layer above them

Do not apply v33 if you want to keep the connector lines. Apply v34 from the repo root:

```bash
bash pilotys-owner-token-cockpit-v34/scripts/install-v34-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
