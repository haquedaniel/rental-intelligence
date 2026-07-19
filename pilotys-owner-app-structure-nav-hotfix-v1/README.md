# Owner navigation compatibility hotfix

The new owner navigation introduced four primary sections, but existing pages
still pass legacy `active` values to `OwnerBottomNav` and `OwnerTopNav`.

This hotfix preserves source compatibility and maps legacy values as follows:

- `cockpit`, `reports`, `reservations` → `dashboard`
- `missions`, `payments` → `operations`
- `settings` → `admin`
- `activity` remains `activity`

No database migration is required.
