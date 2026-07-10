# Pilotys repair OwnerBottomNav import v2

Stronger repair for pages where `<OwnerBottomNav ... />` exists but the import is missing.

Works when run from either:
- repository root
- `apps/cleaner-web`

Apply:

```bash
bash pilotys-repair-owner-bottom-nav-import-v2/scripts/install-repair-owner-bottom-nav-import-v2.sh
cd apps/cleaner-web
npm run build
```

Or from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-repair-owner-bottom-nav-import-v2/scripts/install-repair-owner-bottom-nav-import-v2.sh
npm run build
```
