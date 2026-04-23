# Word Add-in Readiness Report

## Blockers Removed

- Production manifest no longer points to localhost.
- Production asset URLs now target `https://word.667764.xyz`.
- Development and production manifests are generated separately.
- Production build supports domain-root deployment.
- Runtime bridge URL is centralized through Vite environment config.
- Disconnected bridge state is explicit in the UI.
- Desktop stability protections remain in place: mutation lock, reduced Word writes, custom XML dedupe, and explicit-action-only mutations.

## Remaining Blockers Before Public Marketplace

- The add-in still requires a local desktop bridge at `http://127.0.0.1:38474`.
- Marketplace reviewers need clear access to a Refx desktop build and test data.
- Legal pages need to be published: privacy policy and terms.
- Support page at `https://667764.xyz/refx/support` must exist before production submission.
- Final Marketplace screenshots and store listing graphics are not yet included.
- Word for the web should not be advertised as supported until the citation workflow is validated or redesigned for web-safe behavior.

## Recommended Submission Strategy

1. Start with controlled beta using the production-hosted frontend and production manifest.
2. Move to Microsoft 365 admin/organizational deployment for known users who also install Refx desktop.
3. Only pursue broad public Marketplace after deciding whether the local bridge model is acceptable for the listing, or after introducing a cloud/account bridge that works without same-device localhost.

## Current Readiness

- Private deployment: ready after `word.667764.xyz` hosting is live.
- Controlled beta: ready after VM deployment and desktop bridge smoke testing.
- Organizational deployment: close; validate tenant deployment and support docs.
- Public Marketplace: structurally prepared, but not final because of the local desktop bridge dependency and missing public legal/listing assets.
