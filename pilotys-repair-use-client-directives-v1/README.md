# Pilotys repair use-client directives v1

Repairs files where helper code was inserted above an existing `"use client"` directive.

Next.js requires `"use client"` to be the first statement in a client component file.

Apply from repo root:

```bash
bash pilotys-repair-use-client-directives-v1/scripts/install-repair-use-client-directives-v1.sh
cd apps/cleaner-web
npm run build
```
