# Pilotys repair usePathname import v1

Fixes `usePathname` import if it was inserted inside a multiline `import type { ... }` block.

Works from repo root or `apps/cleaner-web`.

Apply from repo root:

```bash
bash pilotys-repair-usepathname-import-v1/scripts/install-repair-usepathname-import-v1.sh
cd apps/cleaner-web
npm run build
```

Apply from `apps/cleaner-web`:

```bash
bash ../../pilotys-repair-usepathname-import-v1/scripts/install-repair-usepathname-import-v1.sh
npm run build
```
