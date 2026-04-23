# Refx Word Add-in Submission Prep

This folder keeps the non-code assets and notes needed for private deployment, organizational deployment, and eventual Microsoft Marketplace review.

Current recommended status:

- Private sideload / controlled beta: ready after `https://word.667764.xyz` is deployed and tested.
- Organizational deployment: likely ready after tenant admin validation.
- Public Marketplace: not final until the local desktop bridge dependency is accepted in the submission story or replaced with a broader supported integration path.

## Listing Summary

Refx for Word connects Microsoft Word to your Refx desktop research library so you can insert citations from your own works, refresh numbering, and rebuild a reference table.

## Short Description

Insert Refx references into Word and refresh citation numbering automatically.

## Long Description Draft

Refx for Word is a companion add-in for Refx Research Manager. It helps researchers cite references attached to a selected Refx "My Work" document directly inside Microsoft Word.

The add-in inserts citations into Word content controls and stores stable citation state in the document, so citation numbers can be refreshed globally when references are inserted, deleted, or moved. It can rebuild a numeric reference table and optionally order that table by first appearance in Word or by the current Refx reference order.

The Refx desktop app must be running on the same computer so the add-in can read the user's local Refx library through the local companion bridge.

## Support Statement

Support URL: `https://667764.xyz/refx/support`

Support response should cover:

- Installing or sideloading the Word add-in.
- Opening the Refx desktop app before using the add-in.
- Troubleshooting the disconnected bridge banner.
- Repairing citation state in Word.

## Privacy Policy Placeholder

Required before Marketplace submission:

- Publish a privacy policy URL under `https://667764.xyz`.
- State that the Word add-in reads reference metadata from the local Refx desktop app.
- State whether any telemetry, logs, or document contents are collected.
- State that citation state is stored inside the Word document as custom XML.

Suggested URL:

```text
https://667764.xyz/refx/privacy
```

## Terms Placeholder

Required before Marketplace submission:

- Publish terms of use for the add-in and desktop companion app.
- Explain that the add-in requires Refx desktop for full functionality.

Suggested URL:

```text
https://667764.xyz/refx/terms
```

## Known Limitations

- Desktop Word is the supported target for beta use.
- The add-in requires the Refx desktop app to be open on the same computer.
- The current bridge URL is local: `http://127.0.0.1:38474`.
- Word for the web is not recommended for this citation workflow because the add-in depends on stable content-control and custom XML behavior.
- Grouped citation state is supported by the refresh engine, but the beta UI inserts one reference at a time.

## Reviewer Test Notes

1. Install and open Refx desktop.
2. Confirm the local bridge responds at `http://127.0.0.1:38474/health`.
3. Open Word desktop.
4. Install or deploy `manifest.production.xml`.
5. Open the Refx task pane from the References tab.
6. Choose one My Work from the dropdown.
7. Insert reference A, then B, then A again.
8. Click `Refresh citations`; expected labels are `[1]`, `[2]`, `[1]`.
9. Insert another reference between A and B.
10. Click `Refresh citations`; expected numbering is recomputed in document order.
11. Click `Rebuild table`; expected reference table is inserted at the end of the document.
12. Close and reopen the document, then click `Repair`; expected state is restored from document XML.
13. Close Refx desktop and click `Sync Refx`; expected: disconnected banner and actionable error, no crash.

## Screenshots Checklist

- Task pane connected to Refx desktop.
- Disconnected bridge banner.
- My Work dropdown with references loaded.
- Inserted citations in Word.
- Rebuilt reference table.
- Options panel with citation style choices.

## Icon Checklist

Current add-in icons:

- `public/assets/icon-16.png`
- `public/assets/icon-32.png`
- `public/assets/icon-64.png`
- `public/assets/icon-80.png`

Before Marketplace submission, verify current Microsoft listing image requirements in Partner Center and add any required store logos/screenshots.

## Release Checklist

- `pnpm --dir word-addin manifests`
- `pnpm --dir word-addin build:production`
- Deploy `word-addin/dist/` to `https://word.667764.xyz`.
- Verify production URLs load without auth, redirects to login, or Cloudflare challenge pages.
- Verify `manifest.production.xml` points only to HTTPS production URLs.
- Validate the manifest with Microsoft tooling.
- Test Word desktop on Windows and macOS.
- Test bridge offline state.
- Publish support, privacy, and terms pages.
