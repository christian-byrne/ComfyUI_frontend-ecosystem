# <a href="/decisions/D-no-app-beforeprompt" class="wiki-link">D-no-app-beforeprompt</a> — N11 closure: no `app.on('beforePrompt')` surface

**Status**: ACCEPTED — 2026-05-20 (wave-13, user direction)
**Closes**: `D-uwf-drafting-board.md` §N11

## Context

`D-uwf-drafting-board.md` §N11 asked whether extensions should have a
hook to mutate the workflow → API conversion before the prompt ships
to the backend. Three options were sketched:

- **Option A** — `app.on('beforePrompt', payload => mutate(payload))`
- **Option B** — `graph.on('beforeSerialize', mut)` + `app.on('beforePrompt', read)`
- **Option C** — Typed contribution slots ("registerPromptContributor")

The use cases enumerated on the drafting board:
- Inject extension-managed metadata into the prompt payload
- Add "extra_pnginfo" sidecar fields at queue time
- Mutate node arguments based on cross-node state (e.g. resolve "use the value from node X")
- Inject auth headers / API-key tokens into the prompt before send

## Decision

**REJECTED — Phase A v2 does not expose any `app.on('beforePrompt')`,
`graph.on('beforeSerialize')`, or `registerPromptContributor` surface.**

User direction 2026-05-20 (verbatim):

> "extensions should not have an app.on(beforePrompt). we need to
> identify why people needed that and solve it per-need as the issues
> arrive by adding dedicated features. i am firm on this"

The decision is firm. A generic prompt-mutation hook is rejected
in favor of per-need dedicated features that the framework adds as
concrete use cases arrive.

## Rationale

A general-purpose `beforePrompt` mutation hook is the same anti-pattern
class as runtime `addWidget` (<a href="/axioms#a15-refs" class="wiki-link">A15</a>) and the 4-context serialization
discriminator (<a href="/axioms#a16-refs" class="wiki-link">A16</a>): it inverts the direction of knowledge flow by
making *extensions* responsible for the prompt's transport-time shape,
when the prompt's shape is a *framework* concern that should be
deterministic from the <a href="/glossary#workflowspec" class="wiki-link">WorkflowSpec</a>.

Concrete failure modes a generic mutation hook would invite:

1. **Multiple extensions racing on the same payload key** — last
   handler wins; no resolution scheme; impossible to debug.
2. **Plugin order dependence** — moving an extension up the load
   list changes prompt output silently.
3. **Round-trip breakage** — the prompt no longer matches the
   serialized workflow JSON, breaking replay / <a href="/glossary#runsnapshot" class="wiki-link">RunSnapshot</a> (<a href="/axioms#a7-refs" class="wiki-link">A7</a>).
4. **Backend schema drift** — extensions feed arbitrary fields
   the backend may not recognize; failures are deferred to
   <a href="/api-docs/server" class="wiki-link">server</a>-side error responses.
5. **Hot-path performance regression** — every prompt-build pays
   the cost of every extension's `beforePrompt` handler, even when
   no mutation is needed.

Per-need solutions avoid all five:

- "Inject extra_pnginfo" → dedicated `defineExtraPnginfoField()` API
  with typed schema and validation.
- "Auth headers" → handled at the network layer, not the prompt
  layer.
- "Cross-node value resolution" → solved at the WorkflowSpec layer
  (<a href="/decisions/D-cross-node-observation" class="wiki-link">D-cross-node-observation</a>, N13 closure).
- "Extension-managed metadata" → use `widget.on('beforeSerialize')`
  on a metadata-bearing widget (<a href="/axioms#a16-refs" class="wiki-link">A16</a>) or a dedicated sidecar API.

## Consequences

### Phase A
- Zero new surface. No `app.on(...)` event for prompt-build.
- The `app` global remains a v1 transition shim only; v2 surfaces
  scope events through `graph` / `execution` / `server` / `workbench`
  per <a href="/decisions/D-bootstrap-hooks" class="wiki-link">D-bootstrap-hooks</a>.
- `GraphEventPayloads` does not gain a `'beforeSerialize'` / `'beforePrompt'`
  / `'promptBuilt'` key.

### v1 consumers
- v1 monkey-patching of `app.queuePrompt` remains functional (<a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>
  parallel-paths). Migration guide will not advertise a v2
  replacement for this pattern — instead it documents the
  per-need feature surfaces as they ship.

### Future
- New ADRs for specific use cases (`D-extra-pnginfo-fields`,
  `D-auth-header-injection`, etc.) land as the concrete need is
  evidenced from the ecosystem. Each gets its own axiom-compliance
  audit and dedicated typed surface.

## Restoration criteria

This decision re-opens only if:
1. A new use case appears that fundamentally cannot be served by
   a dedicated feature (not just "inconvenient").
2. The 5 failure modes above are addressed in the new ADR
   (ordering scheme, schema validation, round-trip invariant,
   performance budget, debuggability).
3. An axiom amendment is proposed to permit transport-time
   prompt mutation (currently implicitly forbidden by <a href="/axioms#a7-refs" class="wiki-link">A7</a>
   §Source-of-Truth Rules — "Prompt is derived, never authored
   directly").

Bar set deliberately high — same posture as
`D-widget-serialization-simplification`.

## Validation

- No `'beforePrompt'` / `'promptBuilt'` / `'beforeSend'` event keys
  in `src/extension-api/events.ts` `GraphEventPayloads` /
  `WorkbenchEventPayloads` declarations.
- No `registerPromptContributor` / `definePromptContributor` exports
  in `src/extension-api/index.ts`.
- No `app.on(...)` in any `@publicAPI` JSDoc example block.
