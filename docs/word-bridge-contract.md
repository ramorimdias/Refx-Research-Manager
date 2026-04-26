# Refx Word Bridge Contract

This document describes the local bridge used by the Refx desktop app and reused by both Word add-in paths:

- The existing web add-in in [`word-addin/`](../word-addin/) on desktop Word
- The new Windows-only VSTO add-in in [`word-addin-windows/`](../word-addin-windows/)

The bridge is intentionally local and read-only. It exposes metadata from the local Refx desktop database so Word can browse works and references without talking to a cloud service.

## Runtime Location

- Bridge host: `http://127.0.0.1:38474`
- Server implementation: [`src-tauri/src/commands.rs`](../src-tauri/src/commands.rs)

The server binds only to `127.0.0.1`.

## Security Model

The current bridge does not use a token or session secret.

Instead, the bridge relies on three controls:

1. Loopback-only bind on `127.0.0.1`
2. Read-only `GET`/`OPTIONS` surface
3. Origin allowlist for browser clients

Allowed browser origins are currently:

- `https://localhost:5174`
- `http://localhost:5174`
- `https://refx.667764.xyz`

Native clients that do not send an `Origin` header, such as the VSTO add-in, are allowed when they connect from loopback.

This is a minimal local-security model, not a cloud-style auth system. It is enough for the current desktop companion architecture and keeps the existing web add-in working.

## Endpoint Summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/status` | Bridge health check alias for `/health` |
| `GET` | `/health` | Bridge health check used by the existing web add-in |
| `GET` | `/works?query=...` | List local Refx `my_work` documents |
| `GET` | `/works/{id}/references?query=...` | List references attached to a selected work |
| `GET` | `/references/{id}` | Load one reference by stable id |
| `OPTIONS` | any supported path | CORS preflight for browser clients |

All data is returned as JSON except `OPTIONS`, which returns an empty `204 No Content` response.

## Shared Models

### `WordBridgeHealth`

Response for `/health` and `/status`.

```json
{
  "ok": true,
  "app": "Refx",
  "version": "0.8.2"
}
```

Fields:

- `ok`: `true` when the bridge is running
- `app`: fixed app name, currently `Refx`
- `version`: desktop app version string

### `WordBridgeWork`

Response item for `/works`.

```json
{
  "id": "doc:123",
  "title": "My thesis",
  "authors": ["Smith, Jane", "Lee, Min"],
  "year": 2026,
  "referenceCount": 42
}
```

Fields:

- `id`: Refx document id for the work
- `title`: work title
- `authors`: parsed author list
- `year`: optional publication year
- `referenceCount`: number of references currently attached to the work

### `WordBridgeReference`

Response item for `/works/{id}/references` and `/references/{id}`.

```json
{
  "id": "ref:456",
  "sourceType": "reference",
  "citationKey": "smith2024",
  "title": "An example article",
  "authors": ["Smith, Jane"],
  "year": 2024,
  "journal": "Example Journal",
  "booktitle": null,
  "publisher": null,
  "volume": "12",
  "issue": "3",
  "pages": "11-24",
  "doi": "10.1234/example",
  "url": "https://example.org/article",
  "bibtex": "@article{smith2024, ...}"
}
```

Fields:

- `id`: stable namespaced reference id, typically `ref:<referenceId>`
- `sourceType`: usually `"reference"` for real data
- `citationKey`: optional citation key
- `title`: reference title
- `authors`: parsed author list
- `year`: optional year
- `journal`, `booktitle`, `publisher`, `volume`, `issue`, `pages`, `doi`, `url`, `bibtex`: optional metadata copied from Refx

## Request Shapes

### `GET /status`

Purpose:

- Lightweight bridge health check for the new Windows add-in

Request:

- No body
- No query parameters

Response:

```json
{
  "ok": true,
  "app": "Refx",
  "version": "0.8.2"
}
```

Auth:

- None

### `GET /health`

Purpose:

- Compatibility health check used by the existing web add-in

Request:

- No body
- No query parameters

Response:

```json
{
  "ok": true,
  "app": "Refx",
  "version": "0.8.2"
}
```

Auth:

- None

### `GET /works?query=...`

Purpose:

- List local Refx works that can be linked to the current Word document

Request:

- `query` is optional free text
- Empty query returns all available works

Response:

```json
[
  {
    "id": "doc:123",
    "title": "My thesis",
    "authors": ["Smith, Jane"],
    "year": 2026,
    "referenceCount": 42
  }
]
```

Auth:

- None

Notes:

- The bridge returns at most 100 works
- Matching is case-insensitive and checks id, title, authors, and year

### `GET /works/{id}/references?query=...`

Purpose:

- List references attached to one selected work

Request:

- `{id}` is the work document id URL-encoded
- `query` is optional free text
- Empty query returns all references for the work

Response:

```json
[
  {
    "id": "ref:456",
    "sourceType": "reference",
    "citationKey": "smith2024",
    "title": "An example article",
    "authors": ["Smith, Jane"],
    "year": 2024,
    "journal": "Example Journal",
    "booktitle": null,
    "publisher": null,
    "volume": "12",
    "issue": "3",
    "pages": "11-24",
    "doi": "10.1234/example",
    "url": "https://example.org/article",
    "bibtex": "@article{smith2024, ...}"
  }
]
```

Auth:

- None

Notes:

- The bridge returns at most 200 references
- Matching is case-insensitive and checks ids, citation keys, title, journal, booktitle, publisher, DOI, URL, and authors

### `GET /references/{id}`

Purpose:

- Resolve one reference by its stable id

Request:

- `{id}` is a reference id, usually `ref:<referenceId>`

Response:

```json
{
  "id": "ref:456",
  "sourceType": "reference",
  "citationKey": "smith2024",
  "title": "An example article",
  "authors": ["Smith, Jane"],
  "year": 2024,
  "journal": "Example Journal",
  "booktitle": null,
  "publisher": null,
  "volume": "12",
  "issue": "3",
  "pages": "11-24",
  "doi": "10.1234/example",
  "url": "https://example.org/article",
  "bibtex": "@article{smith2024, ...}"
}
```

Auth:

- None

Notes:

- Returns `404` when the reference id is not found
- Returns `400` when the caller should select a work first and use `/works/{id}/references`

## CORS Behavior

Browser requests from allowed origins receive:

- `Access-Control-Allow-Origin: <exact origin>`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

This keeps the existing web add-in working while reducing accidental exposure to unrelated browser pages.

## Contract Stability

The bridge surface is stable enough to reuse for the Windows VSTO add-in because:

- It is read-only
- It uses simple JSON types
- It already exposes the work/reference structure the add-ins need
- It is backed by local Refx data and not an external service

The only compatibility addition made during this pass is the `/status` alias and origin allowlisting.
