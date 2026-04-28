# Refx Usage Telemetry Worker

This Worker receives anonymous heartbeat events from the desktop app and stores one row per install in Cloudflare D1.

## What it tracks

- Anonymous install ID
- App version
- Platform
- Locale
- Last heartbeat time

It does not require account login and it does not identify a person by default.

## Endpoints

- `POST /usage/heartbeat`
- `GET /usage/stats`
- `GET /usage/breakdown`
- `GET /health`
- `GET /admin`

## Local setup

1. Install Wrangler:
   - `npm install -g wrangler`
2. Log into Cloudflare:
   - `wrangler login`
3. Create the D1 database:
   - `wrangler d1 create refx-usage-telemetry`
4. Copy the returned `database_id` into `wrangler.toml`.
5. Apply the schema:
   - `wrangler d1 execute refx-usage-telemetry --file=./schema.sql`
6. Choose a long random `ADMIN_TOKEN` and replace the placeholder in `wrangler.toml`.
7. Run locally:
   - `wrangler dev`

## Deploy

1. Deploy the Worker:
   - `wrangler deploy`
2. Note the Worker URL, for example:
   - `https://refx-usage-telemetry.your-subdomain.workers.dev/usage/heartbeat`
3. Build the Refx desktop app with:
   - `NEXT_PUBLIC_REFX_USAGE_TELEMETRY_URL=https://refx-usage-telemetry.your-subdomain.workers.dev/usage/heartbeat`

## Read the stats as JSON

Use your admin token:

```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  https://refx-usage-telemetry.your-subdomain.workers.dev/usage/stats
```

Example response:

```json
{
  "ok": true,
  "stats": {
    "current_open_estimate": 3,
    "dau": 27,
    "wau": 94,
    "mau": 241
  }
}
```

## Open the dashboard UI

After deploying, open:

```text
https://refx-usage-telemetry.your-subdomain.workers.dev/admin
```

Then:

1. Paste your `ADMIN_TOKEN`
2. Click `Load stats`
3. Optionally click `Remember token` for that browser only

The dashboard shows:

- Current open estimate
- DAU
- WAU
- MAU
- Installs by app version
- Installs by platform
- Installs by locale
