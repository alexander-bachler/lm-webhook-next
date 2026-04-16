# VPS deployment

## Overview

The app runs as a **Next.js** server. Configure your LoRa network server (e.g. Actility) to send uplink webhooks to:

`POST /api/webhooks/incoming`

### Webhook authentication

Optional shared secret(s): set `WEBHOOK_SECRET` to one or more comma-separated values. Send either:

- `Authorization: Bearer <secret>`, or  
- `X-Webhook-Secret: <secret>`

Any configured secret may be used; rotate by updating the env and redeploying.

Rate limiting applies to this route (see `.env.example`: `WEBHOOK_RATE_LIMIT_*`).

### Data storage

- **SQLite** (`webhooks.sqlite` under `DATA_DIR`) stores webhooks, devices, job runs, and dispatch logs.
- Legacy `devices.json` is migrated once on startup into the `devices` table and renamed to `devices.json.migrated`.

## Environment

Copy `.env.example` to `.env` and configure at least:

| Variable | Description |
|----------|-------------|
| `DATA_DIR` | Directory for SQLite and decoder cache (default `./data`; use `/app/data` in Docker) |
| `NEXT_PUBLIC_BASE_URL` | Public base URL (e.g. `https://webhooks.example.com`) |
| `WEBHOOK_SECRET` | Optional comma-separated secrets for incoming webhooks |
| `NEXTAUTH_SECRET` | Required in production to enable admin session protection |
| `NEXTAUTH_URL` | Public URL of the app (must match how users reach `/login`) |
| `ADMIN_USER` / `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` | Admin credentials |
| `CREDENTIALS_KEY` | AES-GCM key (hex or base64) for encrypting LineMetrics `clientSecret` in the DB; required in production when storing secrets |
| `SCHEDULER_DISABLED` | Set `1` to disable cron jobs inside the Node process |
| `SCHEDULER_ENABLED` | Set `1` so `/api/health` expects the scheduler to be running (unless `SCHEDULER_DISABLED=1`) |
| `WEBHOOK_SOURCE` | `local` (default): dashboard reads SQLite; `webhooksite`: pull history from webhook.site |

See `.env.example` for the full list.

## Docker

```bash
cp .env.example .env
# edit .env
mkdir -p data
docker compose up -d --build
```

The compose file mounts `./data` to `/app/data` so SQLite and configuration survive container restarts.

### Healthcheck

The `app` service includes a Docker `healthcheck` calling `GET /api/health`. Unhealthy containers can be restarted automatically.

## HTTPS (Caddy)

For a domain with automatic TLS (Let's Encrypt), run a reverse proxy in front of port `3000`.

1. Copy `docker-compose.override.example.yml` to `docker-compose.override.yml`.
2. Copy `Caddyfile.example` to `Caddyfile` and set your real domain (replace `localhost` or use env `DOMAIN`).
3. Ensure DNS points to the host and ports `80`/`443` are reachable.
4. `docker compose up -d --build`

The `app` service stays on the internal network; Caddy terminates TLS and reverse-proxies to `app:3000`.

IP-only access without TLS remains possible by publishing port `3000` only (not recommended for production).

## Backups

On the VPS, schedule a nightly archive of the data directory (adjust paths):

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC=/opt/lm-webhook-next/data
DEST=/var/backups/lm-webhook
mkdir -p "$DEST"
tar -czf "$DEST/data-$(date +%Y%m%d).tar.gz" -C "$(dirname "$SRC")" "$(basename "$SRC")"
find "$DEST" -name 'data-*.tar.gz' -mtime +7 -delete
```

Optional: sync `DEST` to offsite storage (e.g. restic, S3).

## Structured logging

The app uses `winston`; correlate logs with webhook `requestId` where logged in routes and jobs.
