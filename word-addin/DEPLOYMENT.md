# Refx Word Add-in Deployment

This add-in has two supported hosting modes:

- Development: `https://localhost:5174`
- Production: `https://word.667764.xyz`

The production web assets are public HTTPS files, but the add-in still depends on the local Refx desktop companion bridge at `http://127.0.0.1:38474`.

## Build Production Assets

From the repository root:

```powershell
pnpm --dir word-addin manifests
pnpm --dir word-addin build:production
```

Deploy the contents of:

```text
word-addin/dist/
```

to the web root served by:

```text
https://word.667764.xyz/
```

Expected production URLs after deployment:

- `https://word.667764.xyz/index.html`
- `https://word.667764.xyz/assets/icon-16.png`
- `https://word.667764.xyz/assets/icon-32.png`
- `https://word.667764.xyz/assets/icon-64.png`
- `https://word.667764.xyz/assets/icon-80.png`

## Manifest Strategy

Generate manifests with:

```powershell
pnpm --dir word-addin manifests
```

Generated files:

- `word-addin/manifest.xml`: local development manifest pointing to `https://localhost:5174`.
- `word-addin/manifest.production.xml`: production manifest pointing to `https://word.667764.xyz`.

Use `manifest.xml` for local sideloading and debugging. Use `manifest.production.xml` for private deployment, organizational deployment, and later Marketplace validation.

## Cloudflare and VM Setup

1. Create a DNS record in Cloudflare:
   - Type: `A` or `CNAME`
   - Name: `word`
   - Target: your VM IP or hostname
   - Proxy: either proxied or DNS-only is acceptable, but HTTPS must work from Microsoft Office clients.
2. Configure the VM web server to serve `word-addin/dist/` at the domain root.
3. Ensure HTTPS is active for `https://word.667764.xyz`.
4. Avoid auth gates, IP restrictions, or bot challenges for the add-in assets. Office must be able to load `index.html`, JavaScript, CSS, and icon files directly.

## Verify Hosting

Before using the production manifest, verify these in a browser:

```text
https://word.667764.xyz/index.html
https://word.667764.xyz/assets/icon-32.png
```

Then inspect `word-addin/manifest.production.xml` and confirm all add-in URLs use `https://word.667764.xyz`.

## Validate the Production Manifest

Recommended checks:

```powershell
pnpm --dir word-addin manifests
pnpm --dir word-addin build:production
```

If using Microsoft's validation tooling locally, validate:

```text
word-addin/manifest.production.xml
```

## Local Bridge Model

The hosted frontend still calls:

```text
http://127.0.0.1:38474
```

That means the Refx desktop app must be open on the same computer as Word. If the bridge is unavailable, the task pane shows a disconnected banner and disables real reference loading.

This is suitable for controlled beta/private deployment, but it remains the main architectural item to review before broad Marketplace submission.

## Development Flow Remains Unchanged

For local development:

```powershell
pnpm --dir word-addin certs:install
pnpm --dir word-addin dev
```

Then sideload:

```text
word-addin/manifest.xml
```
