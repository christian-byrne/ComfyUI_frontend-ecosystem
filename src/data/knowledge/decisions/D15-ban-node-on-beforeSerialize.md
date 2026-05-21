# <a href="/decisions/D15-ban-node-on-beforeSerialize" class="wiki-link">D15</a> — Ban `node.on('beforeSerialize')`, deprecate node-level serialization control

**Status**: ACCEPTED — 2026-05-12 (decision logged in design-review-12142.md row #11; restratify branches contain ADR-0010 with implementation plan; reconciled into `*-v2` branches in wave-4 reconciliation 2026-05-13)

## Context

v1 `LGraphNode` exposes a `beforeSerialize` callback that custom-node
authors patch to mutate the about-to-be-serialized representation
(stripping ephemeral state, re-encoding outputs, etc.). Design review
#11 surfaced that this is the wrong layer: serialization control belongs
to the WIDGETS that own the data, not the NODE that aggregates them.
Per <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> (widget state categories), widgets already declare which
serialization target they participate in (`prompt` / `workflow` / `none`)
via their `state` taxonomy. A second escape hatch at the node layer
defeats the convergence and makes audit impossible.

## Decision

Ban `node.on('beforeSerialize')` from the v2 extension-api surface:

1. v2 `defineNode` / `NodeHandle` MUST NOT expose any pre-serialization
   hook. Serialization is driven entirely by widget-state taxonomy (<a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a>)
   and is OPAQUE to extensions.
2. v1 path remains operational during <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a> parallel-paths window but emits
   a dev-mode `console.warn` when `beforeSerialize` is patched: pointing
   at the migration guide (`docs/extensions/migration-v1-to-v2.md`)
   and the widget-state alternative.
3. Hard removal of the v1 callback is gated on <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.2 sunset criteria
   (telemetry showing <5% adoption + 12-month soak window).

## Consequences

- **Convergence on a single serialization path**: every byte that ends
  up in `prompt` / `workflow` JSON traces to a widget-state declaration.
  Audit-friendly. Test-friendly.
- **Migration cost for v1 consumers**: the W2F-1 re-audit found the
  S6.<a href="/axioms#a1-refs" class="wiki-link">A1</a> graphToPrompt cluster has 15 listener-variant consumers and
  S2.N* widget-event consumers number in the dozens. Many of those are
  using `beforeSerialize` to massage prompt payloads. Each one needs a
  rewrite to the widget-state model.
- **Migration guide priority**: `docs/extensions/migration-v1-to-v2.md`
  must include a "Replacing beforeSerialize" section with worked
  examples for the top three patterns (strip-ephemeral / re-encode /
  conditional include). Tracked under <a href="/decisions/D6.2-types-package-sunset-criteria" class="wiki-link">D6</a>.2 Gate 3.
- **Tooling**: dev-mode warning + (eventual) lint rule that flags
  `node.on('beforeSerialize'`-style patches in extension code.

## Alternatives considered

| Option | Verdict |
|---|---|
| Keep `beforeSerialize` as a v2 escape hatch | Rejected — defeats <a href="/decisions/D14-widget-state-categories" class="wiki-link">D14</a> convergence |
| Provide a v2 equivalent (`onBeforeSerialize`) on `NodeHandle` | Rejected — same problem under a new name |
| Hard-ban v1 callback immediately | Rejected — breaks ~30+ consumers without migration runway |
| Ban + dev-mode warning + sunset gates (chosen) | **Accepted** — graceful migration path |

## References

- design-review-12142.md row #11 (decision logged 2026-05-12)
- restratify ADR commit `ccfd53bdf5 docs(adr): ADR-0010 deprecate node-level serialization control` (the original ADR-0010 — content preserved in this <a href="/decisions/D15-ban-node-on-beforeSerialize" class="wiki-link">D15</a> record so workspace decisions/ folder is the canonical home)
- D14 — widget state categories (the convergence target)
- D6.2 — types-package sunset criteria (Gate 3 migration guide dependency)
- W2F-1 re-audit: research/meta/sourcegraph-mcp-coverage-investigation.md (S6.<a href="/axioms#a1-refs" class="wiki-link">A1</a> graphToPrompt = 15 consumers post-re-audit; many use this pattern)
- research/touch-points/database.yaml entries for S6.<a href="/axioms#a1-refs" class="wiki-link">A1</a>, S6.<a href="/axioms#a2-refs" class="wiki-link">A2</a> (serialization listeners)
