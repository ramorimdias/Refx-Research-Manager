# Oracle Ampere VM Operations Guide

## Purpose

This is the operational guide for the Oracle Ampere VM used by this workspace. It records the live architecture observed over SSH on 2026-09-17 (UTC), with Wealthfolio updater state reverified on 2026-10-05. Treat live Docker labels, Compose files, mounts, and service state as authoritative; update this document when important architecture changes are made.

This document is documentation only. It intentionally contains no passwords, tokens, private keys, raw `.env` values, cookies, or credential material.

## Agent Safety Rules

1. Inspect before changing anything.
2. Prefer the individual stack under `/opt/docker/apps/<stack>` rather than `/opt/docker/compose.yaml`.
3. Do not accidentally recreate the legacy `aio` umbrella Compose project.
4. Before editing a Compose stack, inspect its Compose file, `.env` variable names, running containers, mounts, labels, networks, and dependencies.
5. Validate with `docker compose config` or `docker compose config -q` before deployment.
6. For profile-based stacks, determine the required `COMPOSE_PROFILES` or explicit `--profile` value before starting them.
7. Do not use `docker network connect` as a permanent configuration fix. Persistent network changes belong in `compose.yaml`.
8. Traefik-routed applications generally need the external `aio_network`.
9. Never regenerate application encryption/signing keys simply because their values are unknown.
10. Back up critical configuration/data before destructive migrations.
11. Never expose `.env` contents or place secrets in Git.
12. Never use `docker system prune`, volume deletion, mass container deletion, or equivalent destructive cleanup without explicit authorization.
13. Never blindly update every container.
14. Verify container health and public routing after infrastructure changes.
15. Treat Docker, Traefik, Authelia, databases, Gluetun, Watchtower, Palworld world data, and authentication/encryption keys as critical infrastructure.
16. Prefer reversible changes and preserve ownership/permissions when replacing configuration.
17. Record important architectural discoveries back into this file.

## Host Overview

- Hostname: `vm-ampere1`.
- Distribution: Ubuntu 24.04.4 LTS (Noble Numbat).
- Kernel: `6.17.0-1018-oracle`.
- Architecture: ARM64/aarch64; QEMU/KVM virtual machine on Oracle Ampere hardware.
- CPU: 4 ARM Neoverse-N1 cores, one socket, one thread per core.
- Memory: 23 GiB RAM; no swap configured.
- Root disk: `/dev/sda1`, ext4, about 193 GiB usable, about 47 GiB used at discovery. EFI is `/dev/sda15`; `/boot` is `/dev/sda16`.
- Filesystems: root `/` is the main persistent filesystem; no separate data mount was found.
- Timezone: host is `Etc/UTC`; systemd Palworld timers explicitly use `Europe/Paris`.
- Host private address: `10.0.0.26` on `enp0s6`.
- Tailscale address: `100.105.177.95` on `tailscale0`.
- Oracle characteristics: VCN interface on `10.0.0.0/24`, Oracle metadata route `169.254.169.254`, and ARM64 images are required for native execution. Docker reports `overlay2` storage.
- The host reported a pending restart and available Ubuntu updates during discovery; do not reboot casually because Docker and game workloads are active.

## SSH and Access

### Connection source

- The local workspace file `C:\Users\rad-d\Downloads\VS\VM\ssh` is the connection source. It contains sensitive access material and must remain private.
- Observed connection fields are `VM_HOST` and `VM_USER`; the live connection is `ubuntu@100.105.177.95`.
- No explicit port or identity-file setting was present in that file. The successful connection used the default SSH port 22 and Tailscale SSH browser authorization.
- The VM's SSH daemon is active and listens on TCP 22. Tailscale SSH may require a browser authorization step before a new session.

### Privilege model

- SSH user: `ubuntu`.
- `ubuntu` belongs to `sudo` and `docker` groups and has passwordless sudo on this host.
- Use the least privilege needed. Do not print or copy credentials while inspecting privileged paths.

### Security rules

- Never copy the contents of the local `ssh` file, private keys, passwords, tokens, or `.env` files into this guide or into Git.
- Refer to credentials by path/variable name only.
- Do not use `docker inspect` without a restrictive `--format` when environment variables may be present.

## Filesystem Layout

Important paths verified on the VM:

```text
/opt/docker/                         operations Git repository, branch main, currently dirty
/opt/docker/apps/                    independent application stacks and templates
/opt/docker/data/                    bind-mounted application data
/opt/docker/backups/                 protected Compose/config archives and manual backups
/opt/docker/backup/                  older/manual backup area (singular)
/opt/docker/env-backups/             protected historical environment-file backups
/opt/docker/scripts/                 root-owned maintenance and backup scripts
/opt/docker/compose.yaml             legacy umbrella Compose file; not the active control plane
/opt/docker/.env                     legacy/root environment file; never print values
/var/lib/docker/                     Docker root and overlay2 storage
/home/ubuntu/palworld-server/        Palworld Compose stack and persistent world files
/home/ubuntu/corrida-rodizio/        Rodizio deployment repository watched by systemd
/opt/unified-monitoring-agent/       Oracle monitoring agent
```

`/opt/docker/README.md` is a historical/template guide. `/opt/docker/PROJECT_STRUCTURE.md` was not found. Many directories under `/opt/docker/apps` have Compose files but no running containers; treat those as inactive, templates, or retired stacks until verified with Docker labels.

## Docker Architecture

### Docker root

- Docker Server 29.6.1, API 1.55, Linux ARM64.
- Docker root: `/var/lib/docker`.
- Storage driver: `overlay2`.
- Docker Compose: v5.3.1 (`docker compose`, not the legacy `docker-compose`).
- Current state after Wealthfolio deployment: 32 containers, all running; no stopped containers were present. Docker reported 29 images.
- All discovered containers use `restart=unless-stopped`.
- Healthchecks report healthy for the core majority; containers without a healthcheck must be checked by logs/endpoints rather than assumed healthy.

### Stack model

Each active application is controlled from its own Compose project under `/opt/docker/apps/<stack>/compose.yaml`. Docker Compose labels on live containers confirm the working directory and Compose file. `docker compose ls -a` showed these active projects:

`aiometadata`, `aiostreams`, `authelia`, `crosswatch`, `dockge`, `gluetun`, `lantern`, `mediaflow-proxy`, `palworld-server`, `picsur`, `prowlarr`, `refx-qwen-proxy`, `refx-site`, `rodizio`, `stack-sentinel`, `stl-sniffer`, `traefik`, `viscobat`, `watchtower`, `webstreamr`, and `wealthfolio`.

### Legacy umbrella Compose project

The root `/opt/docker/compose.yaml` contains commented `include` entries and a default network expression using `aio_default`. No active container currently belongs to a Compose project named `aio`, and `aio_default` was not present in the live network list. Do not run root-level `docker compose up` or `down` as a shortcut.

### Dockge

Dockge is active at `/opt/docker/apps/dockge/compose.yaml`. It mounts `/opt/docker/apps` and the Docker socket and is routed through Traefik as `dockge.667764.xyz`. Use Dockge as an application-stack manager, but still inspect the target stack and validate Compose before changes.

### Compose conventions

- Active files are normally named `compose.yaml`.
- Shared environment variables are merged/maintained by `/opt/docker/scripts/sync-stack-envs.sh`; this script backs up environments and installs stack `.env` files with restrictive permissions.
- Profile names discovered from active Compose files include `required`, `traefik`, `authelia`, `aiostreams`, `all`, `stremio`, `prowlarr`, `debrid_media_server`, `webstreamr`, `gluetun`, `mediaflow-proxy`, `watchtower`, `crawler`, and `tracker`.
- Current Compose validation with `docker compose config -q` succeeded for all active `/opt/docker/apps` stacks.

### Shared networks

`aio_network` is the shared ingress network:

- Driver: bridge; subnet `172.18.0.0/16`; gateway `172.18.0.1`.
- `internal=false`, `attachable=false`.
- Current members: 18 containers; the original inventory below plus the Qwen proxy member listed immediately after it.
- The complete member list verified after deployment was: `aiometadata`, `aiostreams`, `authelia`, `authelia_postgres`, `crosswatch`, `dockge`, `lantern-web-1`, `mediaflow-proxy`, `picsur`, `prowlarr`, `refx-site`, `rodizio-next`, `stl-sniffer-api-1`, `traefik`, `viscobat`, `wealthfolio`, `webstreamr`.

- Added by the Qwen proxy deployment: `refx-qwen-proxy-qwen-proxy-1`.

Stack-local networks are also used: `aiometadata_default` (`172.19.0.0/16`), `authelia_default` (`172.22.0.0/16`), `gluetun_default` (`172.23.0.0/16`), `aiostreams_default` (`172.24.0.0/16`), `mediaflow-proxy_default` (`172.25.0.0/16`), `prowlarr_default` (`172.26.0.0/16`), `watchtower_default` (`172.27.0.0/16`), `lantern_internal` (`192.168.16.0/20`), `picsur_default` (`172.21.0.0/16`), `refx-site_default` (`172.20.0.0/16`), `palworld-server_default` (`172.31.0.0/16`), `stack_sentinel` (`172.29.0.0/16`), `viscobat_default` (`172.30.0.0/16`), and `stl-sniffer_default` (`192.168.0.0/20`).

### Volumes and persistent data

Named volumes discovered:

- `lantern_postgres_data`
- `picsur_picsur-postgres-data`
- `stl-sniffer_stl_sniffer_data`
- `stl-sniffer_stl_sniffer_meili`
- `stl-sniffer_stl_sniffer_postgres`
- `stl-sniffer_stl_sniffer_redis`
- `wealthfolio_wealthfolio-data`

Most other persistence is via bind mounts under `/opt/docker/data`, application directories, or `/home/ubuntu/palworld-server/palworld`. Never delete a named volume or bind-mounted data directory as part of routine cleanup.

## Active Stacks

All paths below are live paths verified from Compose labels or `docker compose ls`. “Traefik” means a live `traefik.enable=true` route was observed. A route without `authelia@docker` was not protected by the observed Traefik forward-auth middleware; the application may still have its own authentication.

### traefik

- Path: `/opt/docker/apps/traefik/compose.yaml`; container: `traefik`; image: `traefik:v3`.
- Host ports: TCP 80, 443, and 853. Network: `aio_network`.
- Persistence: `/opt/docker/data/traefik` to `/data`; Docker socket is mounted without a read-only flag for provider discovery, so Traefik has high Docker/host control.
- Purpose: public HTTP/HTTPS/DOT ingress, TLS termination, Docker label discovery, access log, and ACME storage.
- Profile names: `required`, `traefik`.

### authelia

- Path: `/opt/docker/apps/authelia/compose.yaml`; containers: `authelia`, `authelia_postgres`, `authelia_redis`.
- `authelia` and `authelia_postgres` join `aio_network` and `authelia_default`; Redis is on `authelia_default` only.
- Persistence: `/opt/docker/apps/authelia/config` to `/config`, `/opt/docker/data/authelia/db` for Postgres, and `/opt/docker/data/authelia/cache` for Redis.
- Internal application port: 9091. Public route: `auth.667764.xyz`.
- The service publishes the Traefik forward-auth middleware named `authelia`; profile names: `required`, `authelia`.

### dockge

- Path: `/opt/docker/apps/dockge/compose.yaml`; container: `dockge`; image `louislam/dockge`.
- Internal port: 5001; network: `aio_network`; public route: `dockge.667764.xyz`.
- Mounts `/opt/docker/apps`, `/var/run/docker.sock`, and `/opt/docker/apps/dockge/data` to `/app/data`.

### aiostreams

- Path: `/opt/docker/apps/aiostreams/compose.yaml`; container: `aiostreams`; image `ghcr.io/viren070/aiostreams` with tag controlled by `AIOSTREAMS_TAG`.
- Internal port: 3000; networks: `aio_network`, `aiostreams_default`; data bind: `/opt/docker/data/aiostreams` to `/app/data`.
- Public route: `aiostreams.667764.xyz`; no `authelia@docker` middleware label was observed.
- Profile names: `aiostreams`, `all`, `stremio`.
- `SECRET_KEY` is tied to encrypted application data. It is critical recovery material stored in the stack `.env`; never regenerate casually.

### aiometadata

- Path: `/opt/docker/apps/aiometadata/compose.yaml`; containers: `aiometadata`, `aiometadata-redis`.
- App internal port: 3232; networks: `aio_network`, `aiometadata_default`; Redis is stack-local.
- Persistence: `/opt/docker/apps/aiometadata/data` to `/app/addon/data` and `/opt/docker/apps/aiometadata/redis` to Redis `/data`.
- Public route: `aiometadata.667764.xyz`; depends on its Redis service; no Authelia middleware label was observed.

### prowlarr

- Path: `/opt/docker/apps/prowlarr/compose.yaml`; container: `prowlarr`; image `ghcr.io/hotio/prowlarr`.
- Internal port: 9696; networks: `aio_network`, `prowlarr_default`; bind mounts `/opt/docker/data/prowlarr` to `/config` and the stack custom definitions directory.
- Public route: `prowlarr.667764.xyz`; no Authelia middleware label was observed.
- `prowlarr_default` is also used by the Gluetun stack, so inspect both stacks before changing that network.

### webstreamr

- Path: `/opt/docker/apps/webstreamr/compose.yaml`; container: `webstreamr`; internal port 51546.
- Networks: `aio_network`, `webstreamr_default`; public route: `webstreamr.667764.xyz`.
- The route explicitly uses `authelia@docker` forward authentication.
- Profile names: `webstreamr`, `all`.

### gluetun

- Path: `/opt/docker/apps/gluetun/compose.yaml`; containers: `gluetun`, `gost`.
- `gluetun` uses `/opt/docker/data/gluetun` and networks `gluetun_default`, `prowlarr_default`. `gost` uses `network_mode: service:gluetun`, so it has no independent network namespace.
- Internal ports exposed by the container include 1080 TCP/UDP, 8000 TCP, 8388 TCP/UDP, and 8888 TCP; none were published directly on the host.
- Profile names: `gluetun`; related `gost` service is in the same Compose file.
- A weekly `gluetun-rotate.timer` exists and was active, but its last service state was `failed`; inspect logs before relying on rotation.

### mediaflow-proxy

- Path: `/opt/docker/apps/mediaflow-proxy/compose.yaml`; container: `mediaflow-proxy`; internal port 8888.
- Networks: `aio_network`, `mediaflow-proxy_default`; public route: `mediaflow-proxy.667764.xyz`.
- Profile names: `mediaflow-proxy`, `stremio`; no Authelia middleware label was observed.

### refx-site

- Path: `/opt/docker/apps/refx-site/compose.yaml`; container: `refx-site`; image `nginx:alpine`.
- Internal port 80; networks: `aio_network`, `refx-site_default`; public route: `refx.667764.xyz`.
- Site bind mount: `/opt/docker/apps/refx-site/site` to Nginx document root.

### refx-qwen-proxy

- Path: `/opt/docker/apps/refx-qwen-proxy/deploy/qwen-proxy/compose.yaml`; container: `refx-qwen-proxy-qwen-proxy-1`; image `refx-qwen-proxy:local`.
- Internal port 3000 on `aio_network`; no host port is published. Traefik routes only `Host(refx.667764.xyz) && PathPrefix(/api/qwen/v1)` to this service; the existing static Nginx route remains active for the rest of the site.
- The Next.js server route proxies only the supported models and chat-completions operations to `https://llm.667764.xyz/v1`, adding the Cloudflare Access service-token headers server-side. Browser/desktop clients do not receive those credentials.
- Server environment file: `/opt/docker/apps/refx-qwen-proxy/.env.qwen`, mode `0600`, ignored by Git. It contains `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `QWEN_ENABLER_PASSWORD`, `QWEN_API_BASE_URL`, and `QWEN_MODEL`; never print its values.
- Validate/apply only this stack with `docker compose -f /opt/docker/apps/refx-qwen-proxy/deploy/qwen-proxy/compose.yaml config -q` and `docker compose -f /opt/docker/apps/refx-qwen-proxy/deploy/qwen-proxy/compose.yaml up -d qwen-proxy`.

### rodizio

- Path: `/opt/docker/apps/rodizio/compose.yaml`; container: `rodizio-next`; image `rodizio-next:local`.
- Internal port 3000; network: `aio_network`; public routes: `rodiziorace.mechama.eu` and `rodizio.667764.xyz`.
- This is a locally built image. A separate enabled systemd service watches `/home/ubuntu/corrida-rodizio` branch `main`, polls every 10 seconds, and rebuilds/redeploys `rodizio-next` when the remote branch changes. Do not edit the live image manually without checking this deployment loop.

### watchtower

- Path: `/opt/docker/apps/watchtower/compose.yaml`; container: `watchtower`; image `containrrr/watchtower`.
- No host port or Traefik route; network: `watchtower_default`; Docker socket is mounted.
- Profile name: `watchtower`. Update schedule and notification behavior are environment-driven in the stack `.env`; inspect variable names and current policy before changing it. Do not blindly update every container.

### crosswatch

- Path: `/opt/docker/apps/crosswatch/compose.yaml`; container: `crosswatch`; image `ghcr.io/cenodude/crosswatch`.
- Internal port 8787; network: `aio_network`; bind mount `/opt/docker/data/crosswatch` to `/config`.
- Public route: `crosswatch.667764.xyz`; no Authelia middleware label was observed.

### viscobat

- Path: `/opt/docker/apps/viscobat/compose.yaml`; containers: `viscobat`, `viscobat-postgres`.
- App internal port 3000; networks: `aio_network`, `viscobat_default`; Postgres is stack-local.
- Postgres bind mount: `/opt/docker/data/viscobat-postgres` to the database data directory.
- Public route: `viscobat.667764.xyz`; app depends on Postgres; no Authelia middleware label was observed.

### picsur

- Path: `/opt/docker/apps/picsur/compose.yaml`; containers: `picsur`, `picsur-postgres`.
- App has no published host port; networks: `aio_network`, `picsur_default`; Postgres is stack-local.
- Public route: `i.667764.xyz`; Postgres persistence is named volume `picsur_picsur-postgres-data`.
- App depends on Postgres; no Authelia middleware label was observed.

### stack-sentinel

- Path: `/opt/docker/apps/stack-sentinel/compose.yaml`; containers: `stack-sentinel`, `docker-socket-proxy`.
- Network: `stack_sentinel` only; state bind mount: `/opt/docker/apps/stack-sentinel/state` to `/state`.
- The socket proxy, not the sentinel, owns the Docker socket mount. No Traefik route was observed. The stack `.env` contains the configured container/network/URL monitoring policy; do not print its values.

### stl-sniffer

- Path: `/opt/docker/apps/stl-sniffer/compose.yaml`; active containers: `stl-sniffer-api-1`, `stl-sniffer-worker-1`, `stl-sniffer-postgres-1`, `stl-sniffer-redis-1`, `stl-sniffer-meilisearch-1`.
- API internal port 8000; API joins `aio_network` and `stl-sniffer_default`; public route: `stlsniffer.667764.xyz`.
- Postgres, Redis, Meilisearch, and worker are stack-local. Persistence is via named volumes `stl-sniffer_stl_sniffer_data`, `stl-sniffer_stl_sniffer_meili`, `stl-sniffer_stl_sniffer_postgres`, and `stl-sniffer_stl_sniffer_redis`.
- Compose profiles `crawler` and `tracker` exist, but `source-poller` and `tracker` were not active at discovery. Determine profiles before starting them.
- API route has no Authelia middleware label.

### wealthfolio

- Path: `/opt/docker/apps/wealthfolio`; Compose files: `compose.yaml`, `compose.proxy.yaml`, and `compose.override.yaml`; container: `wealthfolio`.
- Image is pinned to the official ARM64-capable `wealthfolio/wealthfolio:3.9.1` release in `compose.override.yaml`; the base `compose.yaml` uses `latest`, but the override controls the deployed version.
- Internal port: 8088; no host port is published. The container is on `aio_network` at internal address `172.18.0.18`.
- Persistence: named volume `wealthfolio_wealthfolio-data` mounted at `/data`; the container has a read-only root filesystem, a 64 MiB `/tmp`, and `no-new-privileges`.
- Traefik route: `wealthfolio.667764.xyz`, `websecure`, Let's Encrypt resolver, service port 8088, and `traefik.docker.network=aio_network`.
- The route does not use `authelia@docker`; unauthenticated public HTTPS requests were verified to reach the Wealthfolio page directly with HTTP 200.
- Daily stable-release updater: `/opt/docker/scripts/wealthfolio-auto-update.sh`, run by `wealthfolio-auto-update.service` and `wealthfolio-auto-update.timer`. It checks GitHub Releases daily at 04:15 UTC with up to 15 minutes of randomized delay and catches up after downtime. It updates only Wealthfolio and only when a newer stable semantic version is available. The installed Watchtower is label-only; Wealthfolio has no Watchtower enable label.
- Before a version change, the updater stores `compose.override.yaml` and a full stopped-volume archive under `/opt/docker/backups/wealthfolio-auto-update/<UTC timestamp>/` with root-only permissions. It validates Compose, container health, the internal health endpoint, and public HTTP 200. If checks fail, it restores the prior pinned Compose version and SQLite database files, then verifies the rollback.
- The initial automated update ran on 2026-10-05: Wealthfolio moved from `3.8.0` to `3.9.1`; container health is `healthy`, Compose validates, and the public route returned HTTP 200. Backup: `/opt/docker/backups/wealthfolio-auto-update/20261005T065641Z/`.
- Built-in Wealthfolio authentication is enabled with `WF_AUTH_REQUIRED=true`. The password hash is stored in the protected `.env.docker`; the container is not directly reachable through a host port.
- Protected environment file: `/opt/docker/apps/wealthfolio/.env.docker`. It contains `WF_SECRET_KEY` and the exact CORS origin; never print or regenerate the key.
- Self-hosted add-ons are persisted under `/data/addons` inside the container, backed by the `wealthfolio_wealthfolio-data` volume. The DeGiro Importer is installed at `/data/addons/degiro-importer` and currently uses the patched local package version `1.0.8` with current account/activity and `market-data` permission names, corrected DeGiro trade-row parsing, French DEGIRO deposit/tax recognition, native stock-split activities, corporate-action trade rows, internal FX transfer legs, and Wealthfolio-compatible final trade amounts; do not replace it with the older 1.0.1 manifest without checking Wealthfolio compatibility.
- Before replacing the add-on, targeted copies of the previous packages were saved at `/opt/docker/backups/wealthfolio-pre-addon-20260917/degiro-importer-1.0.6` and `/opt/docker/backups/wealthfolio-pre-addon-20260917-v1.0.8/degiro-importer-1.0.7`. The generic `/opt/docker/scripts/backup-compose-stack.sh` still backs up `compose.yaml` and `.env` files, but not this stack's `.env.docker`, `compose.proxy.yaml`, `compose.override.yaml`, or named-volume contents.
- On 2026-09-17 the DeGiro Account statement was parsed locally with add-on `1.0.8` into 805 activities, including 169 `TRANSFER_IN` and 169 `TRANSFER_OUT` FX legs. After the owner's clean re-import, the live Wealthfolio database retained 791 activities after 14 duplicate rows and matched all 18 securities by effective quantity, including the previously missing stock splits, J&J/Kenvue merger, Sony Financial spin-off, and Twitter delisting. The Portfolio export totaled approximately EUR 41,004.54 including cash. The Xetra ETF `IE00BK5BQT80` (5 shares) initially lacked a quote; its Yahoo provider override is now `VWCE.DE`, the quote sync succeeded, and portfolio recalculation changed the live valuation to approximately EUR 41,007.07 with status `COMPLETE`. A targeted pre-change volume backup is stored at `/opt/docker/backups/wealthfolio-pre-market-symbol-20260917/wealthfolio-volume-before-vwce-symbol.tgz`.

### lantern

- Project: `lantern`; source repository `/opt/docker/apps/lantern`.
- Live Compose files are release-specific under `/opt/docker/apps/.lantern-releases/<release>/compose.production.yml`; `docker compose ls` reported two release files for the project. Active containers are `lantern-web-1` and `lantern-db-1`.
- Web internal port 3000; web joins `aio_network` and `lantern_internal`; DB is on `lantern_internal` only.
- Public route: `lanterna.mechama.eu`; no Authelia middleware label was observed.
- Persistence: named volume `lantern_postgres_data` for Postgres. Verify the active release pair before editing the source repository.

### palworld-server

- Path: `/home/ubuntu/palworld-server/compose.yaml`; container: `palworld-server`; image `thijsvanloef/palworld-server-docker:latest`, confirmed ARM64.
- Network: `palworld-server_default`; no Traefik route.
- Published ports: UDP 8211 (game) and UDP 27015 (query); RCON 25575 is container-only.
- Persistent bind mount: `/home/ubuntu/palworld-server/palworld` to `/palworld`; internal backup directory exists under the mounted tree.
- Startup is Compose `restart=unless-stopped` plus `palworld-watchdog.timer` every minute. Daily maintenance saves the world, runs the container backup command, pulls the image, and recreates the service; warning is scheduled five minutes before maintenance. Do not modify this workload during unrelated stack work.

## Reverse Proxy and Public Routing

Traefik is the only active public HTTP reverse proxy. Runtime configuration observed in the container:

- Docker provider enabled; `exposedByDefault=false`; provider network `aio_network`.
- Entrypoints: `web=:80`, `websecure=:443`, and `dot=:853`.
- HTTP redirects to HTTPS. Forwarded-header and proxy-protocol trust is restricted to Docker bridge ranges; do not broaden it casually.
- ACME certificate resolver: `letsencrypt` using TLS challenge, standard Let's Encrypt directory, and `/data/acme.json` for storage.
- Dashboard is not exposed insecurely; it is served through a labeled internal service route.
- Routing is label-based. Common labels are `traefik.enable=true`, `traefik.http.routers.<name>.rule=Host(...)`, `entrypoints=websecure`, `tls.certresolver=letsencrypt`, and `traefik.http.services.<name>.loadbalancer.server.port=<internal-port>`.
- The Docker socket is mounted read-write for discovery. No separate dynamic-file provider directory was detected in the Traefik stack. Treat Traefik configuration as high-impact host infrastructure.

Live hostnames observed: `traefik.667764.xyz`, `auth.667764.xyz`, `dockge.667764.xyz`, `aiostreams.667764.xyz`, `aiometadata.667764.xyz`, `prowlarr.667764.xyz`, `webstreamr.667764.xyz`, `crosswatch.667764.xyz`, `mediaflow-proxy.667764.xyz`, `i.667764.xyz`, `refx.667764.xyz`, `rodizio.667764.xyz`, `stlsniffer.667764.xyz`, `viscobat.667764.xyz`, `wealthfolio.667764.xyz`, plus `lanterna.mechama.eu` and `rodiziorace.mechama.eu`.

## Authentication Architecture

- Authelia is the forward-auth provider at `http://authelia:9091/api/authz/forward-auth`.
- The middleware label `authelia@docker` was observed on the Traefik dashboard route and the Webstreamr route.
- Wealthfolio intentionally uses its own built-in password authentication and is not protected by the Authelia middleware.
- Other live Traefik routes listed above did not carry that middleware label at discovery. Treat this as observed routing state, not proof that the applications have no authentication of their own.
- Authelia secrets and user/configuration data are under `/opt/docker/apps/authelia/.env` and `/opt/docker/apps/authelia/config`; never print them.
- Authelia profile names are `required` and `authelia`; it uses Postgres and Redis backing services.

## Network Architecture

- Host routing uses `enp0s6` to `10.0.0.1`; Tailscale provides `tailscale0` at `100.105.177.95`.
- Docker creates one bridge per stack plus `aio_network`. Do not assume bridge interface names are stable; resolve network IDs with `docker network inspect`.
- Public ingress terminates at host TCP 80/443 in Traefik. Direct game UDP ports are published separately by Palworld.
- Host listeners observed include SSH 22, Traefik 80/443/853, Netdata 19999, Palworld UDP 8211/27015, DNS stub 53, and Tailscale UDP 41641.
- UFW is not installed. The host uses iptables-nft/nftables rules with Docker chains and Tailscale chains; INPUT policy was `accept`, FORWARD policy was `drop`, and Docker/Tailscale rules provide the effective filtering. Never edit firewall rules without explicit authorization.

## DNS / Cloudflare

- Existing tested `*.667764.xyz` names resolve to Cloudflare anycast addresses and responses include Cloudflare headers, indicating Cloudflare is in the public path for those records.
- The root/app environment variable name `CLOUDFLARE_API_TOKEN` exists, and a `cloudflare-ddns` Compose directory exists, but no `cloudflare-ddns` container was active. Do not infer that its automation is currently running.
- Traefik itself uses ACME TLS challenge, not a detected Cloudflare DNS challenge.
- `wealthfolio.667764.xyz` now resolves through Cloudflare after the DNS record was created by the owner. Public HTTPS reaches Traefik and the Wealthfolio built-in login page; the Wealthfolio backend health endpoint returns `ok` internally.

## Storage

Keep these distinctions clear:

- Compose/configuration: `/opt/docker/apps/*/compose.yaml`, stack `.env` files, `/opt/docker/compose.yaml`, and scripts.
- Bind-mounted persistent data: chiefly `/opt/docker/data/*`, application-specific directories, and `/home/ubuntu/palworld-server/palworld`.
- Named Docker volumes: the six volumes listed in the Docker Architecture section.
- Backups: `/opt/docker/backups`, `/opt/docker/backup`, and `/opt/docker/env-backups`; permissions and contents differ, so inspect exact paths before recovery.
- `/var/lib/docker` is Docker's storage root and should not be edited directly.

## Backups and Recovery

- Script: `/opt/docker/scripts/backup-compose-stack.sh`.
- Schedule: `/etc/cron.d/compose-stack-backup`, root cron at 03:15 daily.
- Retention: 30 days for `docker-compose-stack-*.tar.gz` and checksum files.
- Backed up: root Compose and root `.env`, app Compose files and `.env` files, shell scripts, Docker inventory, networks, volumes, and Compose ownership metadata. Archives are created with restrictive permissions.
- Not backed up by this script: `/opt/docker/data`, named-volume contents, Palworld world data, and most application databases. Manual/specialized backups exist but must be verified separately.
- `sync-stack-envs.sh` creates protected environment backups under `/opt/docker/env-backups` before merging root and stack variables.
- Palworld maintenance runs a world save and container backup before image pull/recreate; the mounted data tree is under `/home/ubuntu/palworld-server/palworld`.
- Recovery-critical data includes Traefik `/opt/docker/data/traefik` (including ACME state), Authelia config and database, AIOStreams data plus its `SECRET_KEY`, Wealthfolio data and `/data/addons` plus its `WF_SECRET_KEY` and password hash, all database volumes, and Palworld world data.
- Before migrations or deletion, make a targeted backup of both configuration and the affected persistent data. The daily Compose archive alone is not a full application backup.

## Scheduled Jobs

Important scheduled work observed:

- `/etc/cron.d/compose-stack-backup`: daily Compose/config backup at 03:15 host time.
- `/etc/cron.d/certbot`: twice-daily renewal job if systemd is not in use; Traefik separately owns its ACME storage.
- `/etc/cron.d/update-rodizio`: `/usr/local/bin/update-rodizio.sh` at 02:30 daily.
- `wealthfolio-auto-update.timer`: daily at 04:15 UTC with up to 15 minutes of randomized delay; checks and safely updates only Wealthfolio.
- `palworld-warning.timer`: 08:55 Europe/Paris daily.
- `palworld-maintenance.timer`: 09:00 Europe/Paris daily.
- `palworld-watchdog.timer`: every minute after boot.
- `rodizio-autoupdate.timer`: every 60 seconds after boot; last service invocation was failed with status 128 at discovery, so investigate before relying on it.
- `rodizio-autodeploy.service`: enabled, active, long-running Git poll/rebuild loop.
- `gluetun-rotate.timer`: weekly Sunday 04:10, persistent; last service state was failed at discovery.
- `disk-guard.timer`: every 30 minutes after a five-minute boot delay.
- Oracle unified monitoring configuration downloader: approximately every 15 minutes with randomized delay.
- Standard systemd timers (APT, logrotate, sysstat, fstrim, certbot, etc.) are also enabled.

## Host-Level Services

Relevant running services: `ssh.service`, `docker.service`, `tailscaled.service`, `cron.service`, `netdata.service`, `rodizio-autodeploy.service`, `unified-monitoring-agent.service`, and the monitoring-agent configuration services. No host-level Nginx/Caddy/Traefik service was active; Traefik is Docker-managed.

## Game Servers

- Palworld is active as `palworld-server` under `/home/ubuntu/palworld-server`.
- It uses a native ARM64 image and persistent bind-mounted world data. Ports are UDP 8211 and 27015; RCON 25575 is internal.
- Startup/recovery is Docker restart policy plus the one-minute watchdog; daily save/backup/recreate is scheduled in Europe/Paris.
- `/opt/docker/apps/minecraft` exists as an inactive Compose directory, but no Minecraft container was running. Do not start it merely because the directory exists.

## Development Repositories

Repositories discovered without crawling sensitive/system directories:

- `/opt/docker`: Docker operations/configuration repository, branch `main`, dirty working tree; `scripts/wealthfolio-auto-update.sh` is installed and currently untracked.
- `/opt/docker/apps/lantern`: application repository, branch `master`, dirty; live deployment uses release directories under `.lantern-releases`.
- `/opt/docker/apps/rodizio`: application repository, branch `master`, dirty; related to the local Rodizio image.
- `/opt/docker/apps/stl-sniffer`: application repository, branch `main`, dirty; active stack includes locally built API/worker components.
- `/opt/docker/apps/mechama-landing`: branch `master`, dirty, but no active container was found.
- `/home/ubuntu/corrida-rodizio`: branch `main`, dirty; watched by `rodizio-autodeploy.service`.
- `/home/ubuntu/corrida-rodizio/corrida-rodizio`: nested branch `main`, clean.
- `/home/ubuntu/pizza-rodizio`: branch `main`, clean; no active container found.
- `/home/ubuntu/rodizio`: branch `main`, clean; no active container found.

Do not print Git remote URLs if they may embed credentials. The active source-vs-image relationships are: Rodizio is locally built/redeployed; Lantern runs release-directory images/configuration; STL Sniffer has local API/worker images plus registry-backed dependencies; most other apps pull images.

## Environment Variable and Secret Policy

Values are intentionally omitted. Relevant locations and variable names only:

- `/opt/docker/.env`: root variables including `DOCKER_DIR`, `DOCKER_APP_DIR`, `DOCKER_DATA_DIR`, `DOCKER_NETWORK`, `DOCKER_NETWORK_EXTERNAL`, `COMPOSE_FILE`, `COMPOSE_PROJECT_NAME`, `COMPOSE_PROFILES`, `DOMAIN`, `TRAEFIK_HOSTNAME`, `AUTHELIA_HOSTNAME`, `LETSENCRYPT_EMAIL`, `LE_CA_SERVER`, `CLOUDFLARE_API_TOKEN`, and `TZ`.
- `/opt/docker/apps/traefik/.env`: Traefik hostnames, ACME settings, network settings, and shared authentication/Cloudflare variable names.
- `/opt/docker/apps/authelia/.env` and `/opt/docker/apps/authelia/config`: Authelia JWT/session/storage-encryption settings, WebAuthn display configuration, users, and provider configuration.
- `/opt/docker/apps/aiostreams/.env`: `SECRET_KEY`, `AIOSTREAMS_TAG`, auth settings, `BASE_URL`, `DATABASE_URI`, `PORT`, and service-specific provider settings. `SECRET_KEY` must be preserved because it is tied to encrypted application data.
- `/opt/docker/apps/wealthfolio/.env.docker`: `WF_SECRET_KEY`, `WF_AUTH_PASSWORD_HASH`, `WF_AUTH_REQUIRED`, `WF_CORS_ALLOW_ORIGINS`, `WF_REQUEST_TIMEOUT_MS`, `WF_MCP_ENABLED`, and any explicitly configured add-on directory variable; values are secret-bearing or deployment-specific and must not be printed. The current Compose file derives the add-on directory from the data path (`/data/addons`) rather than setting a separate `WF_ADDONS_DIR`. Use `--env-file .env.docker` for Wealthfolio Compose commands so required variables are loaded; `WF_SECRET_KEY` must be backed up together with the Wealthfolio data volume.
- `/opt/docker/apps/refx-qwen-proxy/.env.qwen`: Cloudflare Access service-token credentials and the Qwen feature password plus upstream URL/model settings. This file is mode `0600`, ignored by Git, and must never be printed or copied into a build context/image.
- Other active app `.env` files: hostnames, database credentials, app auth keys, proxy/VPN settings, and notification settings as appropriate. Examples include `VISCOBAT_AUTH_SECRET`, Picsur JWT/admin settings, STL Sniffer database/Meilisearch/tracker settings, Stack Sentinel notification settings, and Watchtower schedule/notification settings.
- `/home/ubuntu/palworld-server/.env`: Palworld server settings and any credentials; never print.
- `/opt/docker/env-backups` and backup archives may contain secret-bearing environments. Treat them as restricted recovery material.

Never regenerate a secret just to make a Compose file look complete. Preserve ownership and permissions, and redact values in logs, command output, issue reports, and documentation.

## Standard Operational Commands

Use these commands after inspecting the target and confirming the scope:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
docker inspect <container> --format '{{range $n,$v := .NetworkSettings.Networks}}{{println $n}}{{end}}'
docker inspect <container> --format 'project={{ index .Config.Labels "com.docker.compose.project" }} workdir={{ index .Config.Labels "com.docker.compose.project.working_dir" }} files={{ index .Config.Labels "com.docker.compose.project.config_files" }}'
docker network inspect aio_network
docker network inspect aio_network --format '{{range .Containers}}{{.Name}}{{println}}{{end}}'
cd /opt/docker/apps/<stack>
docker compose config -q
docker compose ps
docker compose logs --tail=100
docker compose up -d
docker compose restart <service>
cd /opt/docker/apps/wealthfolio && docker compose --env-file .env.docker -f compose.yaml -f compose.proxy.yaml -f compose.override.yaml config -q
cd /opt/docker/apps/wealthfolio && docker compose --env-file .env.docker -f compose.yaml -f compose.proxy.yaml -f compose.override.yaml up -d wealthfolio
systemctl list-timers wealthfolio-auto-update.timer --all --no-pager
sudo systemctl start wealthfolio-auto-update.service
journalctl -u wealthfolio-auto-update.service -n 100 --no-pager
systemctl status <unit> --no-pager
journalctl -u <unit> -n 100 --no-pager
df -hT
docker system df
ss -tulpn
```

For environment inspection, list variable names only; never use `printenv`, `docker inspect` with the full JSON, or `docker compose config` output in a report when it could expand secret values.

## Diagnostics

### Container is down

1. Run `docker ps -a` and inspect the Compose project/workdir labels.
2. Enter the labeled stack directory, run `docker compose config -q`, then `docker compose ps` and `docker compose logs --tail=100 <service>`.
3. Check mounts, permissions, healthcheck, disk space, and dependencies before recreating.

### Traefik 404

Confirm the container has `traefik.enable=true`, the expected Host rule, service port, `websecure` entrypoint, and membership in `aio_network`. Check the backend's internal listening port; do not assume the host port is the service port.

### Cloudflare 523

Check DNS record/origin reachability, host TCP 80/443, Traefik health, and whether the origin is actually publicly reachable. Tailscale-only reachability is not enough for a Cloudflare proxied hostname.

### Cloudflare 504

Check Traefik access logs, backend health, Docker network membership, internal service port, and application logs. Verify that the routed container is on the same shared network as Traefik.

### Backend unreachable

Check `docker inspect` mounts/networks, `docker compose ps`, health status, dependencies, and service-specific internal ports. Avoid permanent `docker network connect`; fix Compose and recreate only the target stack.

### Docker network issue

Compare Compose-defined networks with `docker network inspect`. If a container was manually attached, make the change persistent in Compose before removing any temporary attachment. Verify the `aio_network` external declaration and network name.

### Compose profile issue

Run `docker compose config --profiles` in the stack directory, identify the required profile, and start only the intended profile. The root umbrella's `COMPOSE_PROFILES` must not be assumed to control an individual Dockge-managed stack.

### AIOStreams issue

Preserve `/opt/docker/apps/aiostreams/.env` and its `SECRET_KEY`. Check the `aiostreams` container, `/opt/docker/data/aiostreams`, the active image tag, route labels, and database migration/log output. Never replace the key during troubleshooting.

### Disk space issue

Run `df -hT`, `docker system df`, and inspect `/opt/docker/backups` sizes. Remove nothing automatically. Do not use `docker system prune` or delete volumes without explicit authorization and a recovery plan.

## Change Procedures

### Editing a stack

1. Record current `docker compose ps`, mounts, labels, networks, profiles, and relevant logs.
2. Back up the target Compose/configuration and any affected data/key material.
3. Edit only `/opt/docker/apps/<stack>/compose.yaml` and its intended stack configuration.
4. Preserve external network declarations, ownership, and permissions.
5. Run `docker compose config -q`, then apply only the target stack.

### Restarting a stack

Use the labeled stack directory, validate first, and restart/recreate only the affected project. Re-check health, dependencies, Traefik route, and public HTTPS behavior. Never run root-level `docker compose down` for convenience.

### Recreating a container

Inspect its mounts, labels, networks, and Compose service first. Prefer `docker compose up -d --force-recreate <service>` from the owning stack after validation. Do not hand-edit or delete its volumes.

### Adding a routed service

Create or edit the individual stack under `/opt/docker/apps/<stack>`, declare the shared external `aio_network` in Compose, add explicit Traefik labels for `websecure`, TLS resolver, Host rule, and the internal service port, and decide deliberately whether `authelia@docker` is required. Create/verify the DNS record separately. Do not use a one-off `docker network connect` as the final fix.

### Removing a service safely

Confirm the exact Compose project, dependents, routes, mounts, volumes, backups, and recovery path. Disable routing and stop only the owning stack/service. Preserve data and named volumes unless deletion is explicitly authorized.

## Things Agents Must Never Do

- Never reveal or commit credentials from the local `ssh` file, any `.env`, Authelia config, Traefik ACME state, Git configuration, logs, or backup archives.
- Never regenerate AIOStreams `SECRET_KEY`, Authelia encryption/session/JWT secrets, or any application signing key during routine changes.
- Never recreate the legacy `aio` umbrella project accidentally.
- Never assume an inactive Compose directory is an active service.
- Never detach or delete `aio_network`, stack-local networks, databases, or named volumes casually.
- Never change firewall rules, Cloudflare access, DNS, or Tailscale settings during an unrelated application task.
- Never blindly update all images/containers or run destructive Docker cleanup.
- Never modify Palworld while performing unrelated work.
- Never trust stale documentation over live Docker labels and Compose state.

## Verification Checklist

Before declaring an infrastructure change complete:

- Compose validation succeeds for the target stack.
- The intended project directory and Compose file match Docker labels.
- Container status and health are verified; no unexpected containers were stopped.
- Mounts and ownership are intact; persistent data paths were not replaced.
- Required networks, especially `aio_network`, are attached through Compose.
- Traefik labels resolve to the intended internal port and the route is healthy over HTTPS.
- Authelia protection is present or absent intentionally and documented.
- No secret values entered logs, Git, output, or this document.
- Backups/recovery state are known before destructive or migration work.
- Active container names and network membership still match the live inventory.

## Recovery Priorities

1. Host access, Docker daemon, disk space, and Tailscale/SSH reachability.
2. `aio_network` and Traefik public ingress, including ACME state.
3. Authelia, its database/cache, and authentication keys.
4. Critical encrypted application data and keys, especially AIOStreams.
5. Gluetun/proxy dependencies and Watchtower policy.
6. Database-backed applications and named volumes.
7. Palworld world data and its scheduled recovery services.
8. Wealthfolio's named volume and key, then remaining public applications and inactive/template stacks.

## Discovery Discrepancies and Limits

- The historical expected layout was broadly correct, but `/opt/docker/PROJECT_STRUCTURE.md` is absent; `README.md` is the available root documentation.
- The root `aio` Compose file is legacy/commented and is not the active control plane. Live containers are independently managed stacks.
- The historical application list was incomplete/stale. Live additions include `crosswatch`, `viscobat`, `picsur`, `stack-sentinel`, `stl-sniffer`, and `lantern`; Palworld runs outside `/opt/docker/apps`. `mechama-landing` and several other directories exist but were not active.
- The live Lantern project uses release directories under `.lantern-releases`, not only the source repository directory.
- Wealthfolio was subsequently deployed under `/opt/docker/apps/wealthfolio` with a healthy `wealthfolio` container, persistent named volume, `aio_network`, Traefik routing, and built-in password authentication. Its application-specific volume/key backup is not yet part of the generic backup script; targeted backups were made before the add-on and market-symbol changes.
- No raw secret values were written into this file. DNS provider account details, exact secret values, database contents, and backup contents were intentionally not inspected.
