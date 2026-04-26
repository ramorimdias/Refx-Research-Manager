# Refx Windows Word Add-in

Refx now has two Word add-in paths:

- [`word-addin/`](../word-addin/): the existing web add-in, kept for future cross-platform use
- [`word-addin-windows/`](../word-addin-windows/): the new Windows-only production path built with VSTO and .NET Framework

The Windows add-in exists because the production Word experience on Windows can be tighter and more reliable when it runs as a native VSTO add-in instead of a browser task pane. It is still a local companion to the Refx desktop app and still reuses the same bridge contract.

## Why This Exists

The VSTO add-in gives Windows users:

- Native Word desktop integration
- A Ribbon tab that feels like a real Office add-in
- A custom task pane that can stay open while editing
- Direct access to the local Refx bridge without routing through a cloud backend

This path does not replace the existing web add-in. The web add-in remains in the repo for future cross-platform or hosted scenarios.

## Windows-Only Scope

This add-in is intentionally Windows-only.

Supported scope:

- Microsoft Word desktop on Windows
- VSTO + .NET Framework
- Local Refx desktop app on the same machine

Not supported:

- Word for macOS
- Word for the web
- Marketplace-only installation
- A cloud-only Refx deployment model

## Phase 1 Milestone

Phase 1 is intentionally small:

- The add-in loads in Word desktop
- A Refx Ribbon tab appears
- Clicking the button opens the Refx pane
- The pane shows bridge connection status
- The pane loads works and references from the local bridge
- The pane inserts a simple citation marker into the current document

Phase 1 does not try to fully rebuild citation numbering, bibliography regeneration, or document repair logic.

## Phase 2 Direction

Planned later work:

- Smarter citation selection and search
- Full citation group management
- Bibliography rendering and refresh
- Better document state persistence
- Optional bridge hardening beyond the current local-only model
- Installer packaging for broader internal deployment

## Prerequisites

To build and debug the VSTO add-in locally, you will need:

- Windows 10 or Windows 11
- Microsoft Word desktop
- Visual Studio 2022 on Windows
- The Office development workload
- The .NET Framework 4.8 targeting pack

If you want to debug the add-in directly from Visual Studio, you also need the VSTO/Office developer tooling that ships with the Office/desktop workload.

## Build and Debug

Open [`word-addin-windows/RefxWordAddIn.sln`](../word-addin-windows/RefxWordAddIn.sln) in Visual Studio.

Then:

1. Restore NuGet packages
2. Set `RefxWordAddIn` as the startup project
3. Build the solution
4. Start debugging

Visual Studio should launch Word with the add-in loaded.

## Bridge Contract

The add-in consumes the local bridge documented in [`docs/word-bridge-contract.md`](./word-bridge-contract.md).

The Windows add-in uses the same local data model as the web add-in:

- `/status` or `/health` for connection checks
- `/works` to list candidate works
- `/works/{id}/references` to list references for a selected work
- `/references/{id}` to resolve one reference

## What Phase 1 Does Not Solve

Phase 1 is intentionally not a complete bibliography engine. It does not yet:

- Renumber all citations automatically
- Rebuild bibliographies from full document state
- Handle grouped citations in a final form
- Synchronize with every editing edge case
- Replace the existing web add-in implementation

Those are the next steps once the Windows host and bridge client are stable.
