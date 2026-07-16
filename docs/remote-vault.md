# Remote Vault collaboration model

Remote Vault is a single-writer, multi-reader synchronization system. One device holds a short renewable write lease; other devices stay read-only and refresh committed revisions in the background. It is not a simultaneous-editing server.

## Storage expectations

- A local network share or strongly consistent NAS provides the best coordination behavior.
- OneDrive, Dropbox, mounted WebDAV, and similar desktop-synchronized folders are supported on a best-effort basis. Their delayed propagation and conflict-copy behavior cannot provide transactional locking guarantees.
- Keep the desktop synchronization client running and avoid editing vault JSON files manually.
- If the app reports an integrity conflict, resolve storage-provider conflicts first and then refresh manually. The app will not automatically apply a snapshot that fails identity, revision, size, or checksum validation.

## Writer handoff

The writer renews its lease every 45 seconds. The lease expires after three minutes without renewal and is released after five minutes without local activity or pending synchronization. Readers may request editing when no other valid lease exists.

Committed snapshots and manifests retain a previous copy for interrupted-write recovery. The manifest is the commit marker and is published only after the snapshot has been written and verified.
