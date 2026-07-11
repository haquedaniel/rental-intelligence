# Pilotys cleaner planning timeline v2

Polishes the cleaner planning timeline after v1.

Changes:
- includes 1 week of history and auto-scrolls close to today;
- removes the redundant property-name bubble inside calendar rows;
- removes colour-name text from the top property legend;
- thickens stay bars and gives them two lines of text;
- adds dashed connector lines from linked stays to mission bubbles;
- accepted/completed mission bubbles show profile photo or initials instead of a lonely tick;
- keeps proposed/problem symbols.

Apply from repo root:

```bash
bash pilotys-cleaner-planning-timeline-v2/scripts/install-cleaner-planning-timeline-v2.sh
cd apps/cleaner-web
npm run build
```

Apply from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-cleaner-planning-timeline-v2/scripts/install-cleaner-planning-timeline-v2.sh
npm run build
```
