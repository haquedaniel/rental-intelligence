# Pilotys live cleaner polish v1

Small live-safe fixes:

- Owner reservation special notes:
  - title becomes "Add any important notes";
  - save button shows pending feedback;
  - notes are locked after related mission completion.

- Cleaner report/checklist notes:
  - "Important notes" wording;
  - softer colour treatment.

- Owner mission notifications:
  - mobile width/overflow hardening.

- Cleaner "Briefing séjour":
  - adds mission nav + bottom nav;
  - fetches cleaner public token for bottom nav;
  - improves cards/notes styling.

Cleaner planning redesign is intentionally not included.

Apply from repo root:

```bash
bash pilotys-live-cleaner-polish-v1/scripts/install-live-cleaner-polish-v1.sh
cd apps/cleaner-web
npm run build
```

Apply from `apps/cleaner-web`:

```bash
bash ../../pilotys-live-cleaner-polish-v1/scripts/install-live-cleaner-polish-v1.sh
npm run build
```
