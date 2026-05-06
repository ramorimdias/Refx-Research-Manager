# Tech Debt Roadmap

This document turns the current codebase review into a prioritized, implementation-ready backlog for contributors. It focuses on maintainability, architecture, reliability, and contributor ergonomics rather than end-user feature marketing.

## High Priority

### 1. Break Up Monolithic Page Files

**Status**  
In progress. The app tour restoration and page-level tour simplification are complete. The reader page has had its main toolbar, search panel, notes panel, tour demo, and page overlay layers extracted into `components/refx/`. The maps page now has its workspace toolbar, management dialogs, and workspace canvas shell extracted as well. `app/documents/page.tsx` is still the next major page hotspot.

**Problem statement**  
Three page entrypoints carry too much UI, behavior, and orchestration in one place:
- `app/reader/view/page.tsx`
- `app/maps/page.tsx`
- `app/documents/page.tsx`

These files are currently large enough that routine edits are harder to review, reason about, and test safely.

**Why it matters**  
Large page files slow down onboarding, increase regression risk, and make it harder to isolate domain behavior. They also blur the boundary between orchestration logic and reusable UI.

**Recommended direction**  
Use extract-only refactors first. Move major UI sections and isolated interaction handlers into `components/refx/` without changing behavior in phase 1. Preserve the existing page routes as composition/orchestration layers.

**Concrete next step**  
Continue the page breakup work in this order:
1. `app/reader/view/page.tsx`
2. `app/maps/page.tsx`
3. `app/documents/page.tsx`

For the reader page, the remaining extractions are now smaller follow-up slices such as:
- custom node/edge rendering or helper utilities that still live beside orchestration logic
- graph/storage helpers that can move cleanly without changing behavior

For the maps page, continue by extracting:
- custom node / edge rendering helpers
- graph preference and persistence helpers where they can move cleanly

For the documents page, start with the same phase-1 rule:
- extract major view sections first
- avoid behavior changes during the initial split

The reader work already completed includes:
- document preview / page surface rendering blocks
- search / occurrence side panels
- toolbar sections
- comment / note panels
- overlay rendering sections

**Suggested success criteria**
- Each page becomes primarily a composition layer.
- New components live under `components/refx/`.
- Phase 1 introduces no intended behavior changes.
- Follow-up UI or store work can happen inside extracted components instead of the original page file.

### 2. Clarify State Management Strategy

**Problem statement**  
The codebase currently mixes a large monolithic `lib/store.ts` with smaller per-domain Zustand stores. In practice, some domain actions still delegate back into the monolith, which weakens ownership boundaries and makes the mental model harder to follow.

**Why it matters**  
When state ownership is unclear, changes become slower and riskier. Indirection without real isolation makes debugging harder and encourages more coupling over time.

**Recommended direction**  
Standardize on domain-isolated Zustand stores as the target architecture. Treat `lib/store.ts` as legacy state that should be reduced over time, not expanded. Avoid adding new domain action indirection that simply routes back through the monolith.

**Concrete first step**  
Do not start with a big-bang store rewrite. Instead:
1. Freeze expansion of `lib/store.ts` for new domain logic.
2. As the large pages are split, identify the state/actions each extracted component truly owns.
3. Move new or clarified domain behavior into the relevant domain store directly.
4. Remove pass-through action layers only when the consuming components are already extracted and easier to validate.

**Suggested success criteria**
- New domain features do not add more action indirection through `useAppStore`.
- Store ownership is obvious from the domain name.
- Components consume domain stores directly where appropriate.
- `lib/store.ts` trends downward in responsibility over time.

### 3. Fix the Disabled App Tour

**Status**  
Completed for the current onboarding scope.

**Problem statement**  
The app tour is currently disabled and tracked in `app-tour-known-issue.md`. The failure is understood well enough to justify a focused debugging pass rather than leaving the feature unavailable.

**Why it matters**  
This is a visible product gap with a known repro pattern. It is also a relatively fast win compared with broader architectural work.

**What was concluded**  
The original note became partially stale. The page-level guides were working, but the first-use global tour was the missing piece. That has now been replaced with:
- a first-use global onboarding flow
- one general overview card per page instead of button-by-button walkthroughs
- skip-and-continue behavior for missing targets
- replay support from Settings
- tour-safe routes for Search, Documents, Reader, and Comments

**Follow-up step**  
Validate the full cross-page tour in packaged desktop builds and add tour-safe surfaces only where a page still depends on live workspace state.

**Suggested success criteria**
- The packaged-build route/target-resolution sequence is captured clearly.
- The root cause is confirmed rather than guessed.
- The tour can be re-enabled behind the existing feature gate once the packaged-build freeze is resolved.

## Medium Priority

### 4. Expand Service-Layer Testing

**Status**  
In progress. Search tests already existed, and the first broader service-layer pass now includes coverage for reference matching, BibTeX import parsing, and OCR candidacy heuristics.

**Problem statement**  
Automated test coverage is minimal relative to the complexity of the service layer.

**Why it matters**  
Pure services provide the cheapest safety net per hour invested. They are the best place to improve confidence before tackling state and page refactors.

**Recommended direction**  
Start with pure or mostly pure service logic before UI-heavy areas.

**Concrete next step**  
The next non-extraction engineering step should be a service-layer testing pass. Add tests for:
- metadata enrichment helpers
- citation matching heuristics
- OCR-related text processing helpers
- additional search ranking and parsing scenarios

**Suggested success criteria**
- Service-layer regressions are caught without running the full app.
- New refactors in search/metadata/citation flows have basic safety coverage.

### 5. Audit PDF Preview Performance and Lifecycle Safety

**Problem statement**  
PDF preview and reader flows are performance-sensitive and memory-sensitive, especially around loading, cancellation, and cleanup.

**Why it matters**  
PDF handling is central to the product experience, and subtle leaks or race conditions can degrade responsiveness quickly.

**Recommended direction**  
Audit the current preview lifecycle before attempting broad optimization.

**Concrete first step**  
Review `DocumentPdfPreview` and related PDF.js loading paths to confirm:
- `pdf.destroy()` is always reached on cleanup
- cancelled render races do not strand document instances
- `loadPdfJsModule()` is deferred until the preview is actually needed

**Suggested success criteria**
- Cleanup paths are explicit and race-safe.
- Preview loading only happens when the user opens the preview surface.
- Performance changes are targeted, not speculative.

### 6. Strengthen Type Safety in Error-Prone Flows

**Problem statement**  
TypeScript usage is solid overall, but some boot/runtime and service flows still rely on looser patterns.

**Why it matters**  
The startup path, ingestion path, and desktop bridge are exactly where ambiguity becomes painful for debugging and recovery.

**Recommended direction**  
Tighten high-risk flows first instead of pursuing blanket type abstraction.

**Concrete first step**  
Focus on:
- startup/bootstrap globals
- ingestion and enrichment service results
- repetitive `unknown` error handling in service boundaries

Use typed result objects where they remove ambiguity in high-value paths, especially in ingestion-style flows.

**Suggested success criteria**
- Error states become easier to reason about without tracing broad `unknown` branches.
- High-risk service boundaries communicate success/failure shapes clearly.

## Lower Priority / UX

### 7. Complete Planned Reader and Note Features

**Problem statement**  
The roadmap already calls out annotations, richer notes, and deeper metadata work, but the current UI surface is still partial.

**Why it matters**  
The infrastructure already exists in several places, so finishing the user-facing loop is often more valuable than starting unrelated new features.

**Recommended direction**  
Build on the existing note anchor and reader infrastructure rather than replacing it.

**Concrete first step**  
Prioritize the smallest end-to-end completion slices:
- richer PDF annotation surface
- fuller note editing flows
- more complete metadata editing/enrichment feedback

**Suggested success criteria**
- Existing infrastructure becomes meaningfully usable from the UI.
- Planned README features align more closely with real product behavior.

### 8. Improve Production Error UX

**Problem statement**  
Startup and fallback failures can currently surface as low-level diagnostics that are more useful for developers than end users.

**Why it matters**  
Raw technical output can make recoverable failures feel catastrophic and opaque.

**Recommended direction**  
Map known failure modes to friendly, actionable messages while preserving deeper diagnostics for development and support.

**Concrete first step**  
Create friendlier messaging for cases such as:
- database migration failure
- unavailable Tauri bridge
- missing OCR assets

**Suggested success criteria**
- Production users see actionable next steps instead of raw diagnostics.
- Developer diagnostics remain available where needed.

### 9. Simplify CI Workflow Topology

**Problem statement**  
The release/build workflow set is more fragmented than necessary.

**Why it matters**  
Highly split CI configuration increases maintenance overhead and makes release behavior harder to audit.

**Recommended direction**  
Consolidate repeated platform build logic with matrix-based workflows where practical.

**Concrete first step**  
Audit the current GitHub Actions set and identify repeated Windows/macOS build logic that can move into a shared matrix job.

**Suggested success criteria**
- Fewer workflow files are needed for the same release coverage.
- Platform build behavior is easier to inspect and maintain.

## Recommended Execution Order

1. Validate the global app tour in packaged desktop builds
2. Add service-layer tests
3. Continue extracting the remaining maps/documents page sections
4. Continue store boundary cleanup
5. Audit PDF performance and tighten type safety
6. Improve UX error handling
7. Simplify CI

## Notes for Contributors

- Keep this document implementation-oriented and repo-specific.
- Prefer small, verified refactors over broad rewrites.
- When in doubt, reduce architectural ambiguity before adding new feature surface.
