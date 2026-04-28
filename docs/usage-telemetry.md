# Anonymous usage telemetry for Refx

This setup counts active desktop installs by assigning each installation an anonymous local ID and sending heartbeat events to a Cloudflare Worker.

## What the app stores locally

- `shareAnonymousUsageStats`
- `usageInstallId`
- `usageTelemetryLastSentAt`

These values live in the existing settings store.

## What the app sends

```json
{
  "install_id": "anonymous-uuid",
  "app_version": "0.8.3",
  "platform": "Win32",
  "locale": "en",
  "event": "heartbeat",
  "session_started_at": "2026-04-28T10:00:00.000Z",
  "sent_at": "2026-04-28T10:30:00.000Z"
}
```

## Event flow

- `app_started` when the desktop app starts
- `heartbeat` every 30 minutes while the app remains open
- `app_closed` on unload when possible

## How counts are derived

- Current open estimate: last heartbeat within 5 minutes
- DAU: last heartbeat within 1 day
- WAU: last heartbeat within 7 days
- MAU: last heartbeat within 30 days

## Admin dashboard

The Worker also exposes a tiny admin UI:

```text
https://your-worker.workers.dev/admin
```

Use your `ADMIN_TOKEN` there to load:

- Current open estimate
- DAU
- WAU
- MAU
- Breakdown by version
- Breakdown by platform
- Breakdown by locale

## Desktop build configuration

Build the desktop app with this environment variable set:

```bash
NEXT_PUBLIC_REFX_USAGE_TELEMETRY_URL=https://your-worker.workers.dev/usage/heartbeat
```

If the variable is missing, telemetry becomes a no-op and nothing is sent.

## User control

The desktop Settings page exposes a toggle for anonymous usage stats so the feature can be disabled locally.
