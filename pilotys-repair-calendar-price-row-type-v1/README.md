# Pilotys repair calendar price Row type v1

Fixes TypeScript error where the inserted free-day price helper was placed above `type Row`.

It changes helper signatures from:

```ts
day: Row | null | undefined
```

to:

```ts
day: Record<string, any> | null | undefined
```

Apply:

```bash
bash pilotys-repair-calendar-price-row-type-v1/scripts/install-repair-calendar-price-row-type-v1.sh
cd apps/cleaner-web
npm run build
```
