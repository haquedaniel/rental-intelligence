# Pilotys ops script health page v1

Adds a simple admin page for `public.ops_script_health`.

Route:
- `/admin/ops-health`

Alias:
- `/admin/health` redirects to `/admin/ops-health`

Features:
- uses `select("*")` so future columns appear automatically;
- sorts in the same order as your SQL: critical, warning, then the rest, then `job_name`;
- basic filters: status, job, search;
- dynamic columns;
- small status KPI cards;
- admin protected via `requireAdmin()`.

Apply from repo root:

```bash
bash pilotys-ops-script-health-page-v1/scripts/install-ops-script-health-page-v1.sh
cd apps/cleaner-web
npm run build
```

Apply from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-ops-script-health-page-v1/scripts/install-ops-script-health-page-v1.sh
npm run build
```
