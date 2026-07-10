# Pilotys cleaner reservation briefing v1

Adds a cleaner-accessible reservation briefing route:

```txt
/mission/[token]/reservation
```

Shows operational context only: mission deadline, guest counts, pets, language/country, previous/next stay, and sanitized notes. It hides financials, owner cockpit data, OTA correspondence and owner audit details.

Apply:

```bash
bash pilotys-cleaner-reservation-briefing-v1/scripts/install-cleaner-reservation-briefing-v1.sh
cd apps/cleaner-web
npm run build
```
