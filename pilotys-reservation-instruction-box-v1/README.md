# Pilotys reservation instruction box v1

Adds the visible owner form on:

```txt
/owner/reservations/[reservationId]
```

The form saves to:

```txt
reservations.cleaner_preparation_note
```

Apply:

```bash
bash pilotys-reservation-instruction-box-v1/scripts/install-reservation-instruction-box-v1.sh
cd apps/cleaner-web
npm run build
```

Requires the earlier SQL columns on `reservations`.
