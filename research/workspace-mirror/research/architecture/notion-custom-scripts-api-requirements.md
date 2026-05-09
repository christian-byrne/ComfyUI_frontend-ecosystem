---
source_url: https://www.notion.so/comfy-org/APIs-required-by-Custom-Scripts-1ef6d73d365080bdbc42c9276088e9b5
date_accessed: 2026-05-08
page_date: 2025-05-10
notion_task_id: COM-3668
status_in_source: Done
assignee: Simon Tranter
---

# APIs Required by Custom Scripts (COM-3668)

Notion task examining which Custom Scripts functionality could be supported by a stable ComfyUI frontend API.
Two comments, both from Simon Tranter (user 445c43b3), 2025-05-11 and 2025-05-12.

---

## Comment 1 — API requirements by Custom Scripts feature (Simon, 2025-05-11)

### Autocomplete
- Custom API endpoints
- Allow hook on (DOM?) widget creation  ← **GAP: not in DB**
- Custom dialogs from settings  ← **GAP: not in DB**
- Should this just be a core feature?

### Better combos
- Should be a core feature (no API needed)

### Arrange graph
- Should this just be a core feature?
- Requires access to LiteGraph graph  → covered by S11.G* (graph-level state)

### Preset text
- Modify widget values on queue  → S4.W1/W4/W5 partial
- Custom frontend widget validation  ← **GAP: not in DB**
- Button widgets & callbacks  → S4.W* partial, callbacks undercovered

### Widget defaults
- Modify node definitions  → S1.H2 beforeRegisterNodeDef (already top-tier in DB)
- Should this just be a core feature?

### General
- Custom context menu items (canvas & node)  → S3.C*/S1.H3/S1.H4, BC.22
- Event on graph/node executed  → S5.A1/S2.N2 (BC.16, BC.17)
- Dynamic inputs/outputs (both count & type)  → S10.D1 (BC.09)
- Ability to have both a "base" widget value, and an actual value embedded in the workflow (e.g. dynamic prompts: {cat|dog} resolves to cat or dog)  → S4.W3 + D7 BeforeSerializeEvent + S15.OS1 (BC.12)

---

## Comment 2 — Veto on canvas drawing APIs (Simon, 2025-05-12)

> "Various features are too hacky/specific to implement APIs for (e.g. overriding litegraph drawing functions) so shouldn't be considered imo"

**Significance:** Simon is the designated core-extension converter (I-COORD.1). His explicit veto here:
1. Confirms S3.C* (canvas drawing overrides, BC.06) should NOT be in v2 scope for v1
2. Directly supports D9 Phase C deferral for the drawing surface
3. Scopes v1 surface to the data/lifecycle/event model, not canvas rendering
4. Aligns with PLAN.md compat floor: S3.C* patterns exist but v2 needn't replace them 1:1

---

## New gaps identified (not in database.yaml)

### GAP-A: DOM widget creation hook
**Feature:** Autocomplete — "Allow hook on (DOM?) widget creation"  
**Intent:** Extension-side hook that fires when any DOM widget is created (not just the extension's own). Allows Autocomplete to attach its input listener to any widget regardless of which extension created it.  
**v2 shape:** `onDOMWidgetCreated(handler: (widget: WidgetHandle) => void)` in `defineExtension` setup context.  
**Surface family candidate:** S4 (widget surface). New pattern ID: S4.W6  
**Distinction from S4.W2:** S4.W2 is the call to *create* a DOM widget; this is an *observer* hook from a *different* extension watching for widget creation events cross-extension.

### GAP-B: Custom dialogs from settings
**Feature:** Autocomplete — "Custom dialogs from settings"  
**Intent:** Extensions open custom modal dialogs triggered from the settings panel. Currently done ad-hoc via DOM injection (S16.DOM3).  
**v2 shape:** `app.ui.openDialog(component)` or settings entry with `type: 'dialog-trigger'`.  
**Surface family candidate:** S12 (shell UI registries). New pattern ID: S12.UI3  
**Note:** Related to S16.DOM3 (raw innerHTML modal injection) but distinct — this is about settings-integrated dialogs, not arbitrary DOM injection.

### GAP-C: Frontend widget validation
**Feature:** Preset text — "Custom frontend widget validation"  
**Intent:** Pre-queue hook to validate widget values and surface errors before the workflow is submitted. Currently: extensions either mutate widget values directly on queue (S6.A4 queuePrompt patching) or silently fail.  
**v2 shape:** `widget.on('beforeQueue', event => { if (invalid) event.reject('message') })` or `node.on('beforeQueue', event => ...)`.  
**Surface family candidate:** S6 (app globals/lifecycle). New pattern ID: S6.A5 (or extend S5 execution events).  
**Note:** Distinct from `beforeSerialize` (D5) — validation is about rejecting submission, not transforming values.

---

## Cross-references to existing DB

| Notion item | DB coverage | Category |
|---|---|---|
| Custom API endpoints (Autocomplete) | S5.A1/S6.A3 | BC.17/BC.18 |
| DOM widget creation hook | **GAP-A (new)** | new BC candidate |
| Custom dialogs from settings | **GAP-B (new)** | S12 extension |
| Arrange graph / LiteGraph access | S11.G* | BC.29/BC.30 |
| Modify widget values on queue | S4.W1/W4/W5 | BC.10/BC.11 |
| Frontend widget validation | **GAP-C (new)** | new BC candidate |
| Button widgets & callbacks | S4.W* partial | BC.10/BC.11 |
| Modify node definitions | S1.H2 | BC.20 |
| Custom context menu items | S3.C*/S1.H3/H4 | BC.06/BC.22 |
| Event on graph/node executed | S5.A1/S2.N2 | BC.16/BC.17 |
| Dynamic inputs/outputs | S10.D1 | BC.09 |
| Base vs actual widget value | S4.W3/S15.OS1/D7 | BC.12 |
| Canvas drawing overrides | S3.C* — **vetoed by Simon** | BC.06 (v1 out of scope) |
