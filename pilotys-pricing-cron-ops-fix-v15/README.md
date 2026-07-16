# Pilotys pricing cron ops fix v15

Prevents optional operational-event logging from blocking pricing cron jobs.

Changes:
- closes stdin for `docker compose exec`;
- kills the logging attempt after 5 seconds;
- always allows the real cron job to continue.
