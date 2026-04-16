# VPS deployment

## Overview

The app runs as a **Next.js** server. Configure your LoRa network server (e.g. Actility) to send uplink webhooks to:

`POST /api/webhooks/incoming`

Optional authentication: set `WEBHOOK_SECRET` and send either:

- `Authorization: Bearer <WEBHOOK_SECRET>`, or  
- `X-Webhook-Secret: <WEBHOOK_SECRET>`

## Environment

Copy `.env.example` to `.env` and set at least:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BASE_URL` | Public base URL (e.g. `https://webhooks.example.com`) — used for internal decode API calls |
| `DATA_DIR` | Directory for `devices.json`, SQLite (`webhooks.sqlite`), and decoder cache (default `./data`) |
| `WEBHOOK_SOURCE` | `local` (default): dashboard reads from SQLite; `webhooksite`: pull history from webhook.site |
| `WEBHOOK_SECRET` | Optional shared secret for incoming webhooks |

## Docker

```bash
cp .env.example .env
# edit .env — set NEXT_PUBLIC_BASE_URL and WEBHOOK_SECRET as needed
mkdir -p data
docker compose up -d --build
```

The compose file mounts `./data` to `/app/data` so device configuration and webhook history survive container restarts.

## HTTPS

Terminate TLS on a reverse proxy (Caddy, nginx, Traefik) in front of port 3000 and set `NEXT_PUBLIC_BASE_URL` to the HTTPS URL.
