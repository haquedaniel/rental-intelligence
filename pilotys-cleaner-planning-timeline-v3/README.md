# Pilotys cleaner planning timeline v3

Polishes the cleaner planning timeline after v2.

Fixes:
- hide vertical scrollbar inside the horizontal calendar scroller;
- centre today's date using container width;
- remove the whole-calendar dotted horizontal line;
- replace pure vertical connectors with an L-shaped connector from linked reservation checkout to mission bubble;
- increase row height / mission lane so profile photos are not clipped.

Apply from repo root:

```bash
bash pilotys-cleaner-planning-timeline-v3/scripts/install-cleaner-planning-timeline-v3.sh
cd apps/cleaner-web
npm run build
```

Apply from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-cleaner-planning-timeline-v3/scripts/install-cleaner-planning-timeline-v3.sh
npm run build
```
