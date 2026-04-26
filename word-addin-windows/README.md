# Refx Word Add-in for Windows

This folder contains the Windows-only production Word add-in for Refx.

It is a VSTO add-in built for Microsoft Word desktop on Windows and is meant to work alongside the local Refx desktop app.

## What Lives Here

- `RefxWordAddIn.sln`: the Visual Studio solution
- `src/RefxWordAddIn/`: the VSTO add-in host, ribbon, and task pane shell
- `src/RefxWordAddIn.Bridge/`: the reusable local bridge client library
- `src/RefxWordAddIn.Tests/`: lightweight unit tests for the bridge-side formatting helpers

## How This Differs From the Web Add-in

The existing `word-addin/` folder remains the browser-based path.

This folder is different:

- Windows only
- VSTO + .NET Framework
- Native Word desktop ribbon integration
- Custom task pane shell
- Reuses the same local Refx bridge where possible

## Required Prerequisites

- Windows 10 or Windows 11
- Microsoft Word desktop
- Visual Studio 2022
- Office development workload
- .NET Framework 4.8 targeting pack

## Manual Setup

1. Open `RefxWordAddIn.sln` in Visual Studio.
2. Restore NuGet packages.
3. Set `RefxWordAddIn` as the startup project.
4. Build the solution.
5. Press `F5` to launch Word with the add-in attached.

## Debugging Notes

- The Ribbon is defined with Ribbon XML instead of the visual designer.
- The task pane is a WPF view hosted inside a WinForms custom task pane shell.
- The bridge client is a separate class library so it can be tested without Word.

## Bridge Endpoints

The Windows add-in uses the same local bridge endpoints documented in [`../docs/word-bridge-contract.md`](../docs/word-bridge-contract.md):

- `GET /status`
- `GET /works`
- `GET /works/{id}/references`
- `GET /references/{id}`

## Phase 1 Scope

Phase 1 includes:

- Ribbon button
- Task pane open/close flow
- Bridge connectivity check
- Work and reference browsing
- Simple citation insertion

It does not yet include the full citation state and bibliography engine.
