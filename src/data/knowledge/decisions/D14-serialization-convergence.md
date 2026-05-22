# ADR-D14: Serialization Convergence — Single Target Model

**Status**: ACCEPTED + SHIPPED — 2026-05-20 (wave-12). Implementation shipped wave-9 via D-widget-serialization-simplification and codified as AXIOMS.md §A15 + §A16. See decisions/D-api-surface-finalization.md §Per-ADR closure verdicts.
**Date**: 2026-05-13
**Supersedes**: D7 Part 4's 4-context model (partial)
**Related**: D7 (widget shape), I-WS (lazy serialization), design-review-12142.md Topic 16

---

## Context

D7 Part 4 collapsed four v1 serialization surfaces (widget.serializeValue, direct widget.value read, node.onSerialize, prototype.serialize) down to two v2 hooks (`widget.on('beforeSerialize')` and `node.on('beforeSerialize')`). However, the hook still exposes **4 context values** (`'workflow' | 'prompt' | 'clone' | 'subgraph-promote'`) that extensions must handle.

The Slack thread (captured in design-review-12142.md Topic 16) proposes a more fundamental simplification:

> Currently, a widget may want to be excluded from the save format but included in the prompt (some transient value computed at queue time), included in save format but excluded from prompt (control_after_generate, combo filter list), or not included in either (previews, audio player, progress text). Sometimes a widget needs special behavior when copy and pasted or promoted. **All of this is living in the wrong layer and is the responsibility of the widget instance.** Instead, the nuances here should be modeled into the structure of the data itself.

The key insight: **serialization context-switching is a framework concern, not an extension concern**. Extensions currently implement 4-way switches because the framework doesn't model the data correctly.

---

## Decision

### The Single Serialization Target Model

**Goal**: A widget has ONE value. The framework handles all persistence/transport variations internally. Extensions never see serialization contexts.

**Core principles**:

1. **Encapsulate dual state on the instance**
   - The widget stores both "display/UI value" and "prompt value" internally
   - These are NOT exposed as separate concepts to extensions
   - The framework materializes the appropriate representation at transport time

2. **Lazy on-access serialization**
   - Serialization is computed when needed, not stored
   - A single getter computes the serialized form from the canonical value
   - Memoization per transport-epoch prevents redundant computation

3. **Single value for all consumers**
   - External systems (workflow save, API prompt, copy/paste, promotion) all consume the same canonical value
   - Transport-specific transformations happen at the framework boundary, invisible to extensions

4. **Widget-specific semantics in widget_options, not serialize hooks**
   - `control_after_generate`: boolean option `{ promptExclude: true }` — framework skips it from prompt
   - Preview widgets: boolean option `{ ephemeral: true }` — framework skips from both workflow and prompt
   - Dynamic prompts: value is stored as-is; transformation happens at a framework layer (prompt processor), not widget layer

### What This Eliminates

| Current pattern | Convergence replacement |
|---|---|
| `widget.on('beforeSerialize', e => { if (e.context === 'prompt') ... })` | Widget stores one value; `promptExclude: true` option handles the control_after_generate case |
| `widget.on('beforeSerialize', e => { if (e.context === 'clone') ... })` | Framework handles clone semantics; no extension involvement |
| `widget.on('beforeSerialize', e => { if (e.context === 'subgraph-promote') ... })` | Framework projects value through boundary; extension sees nothing |
| `widget.options.serialize = false` + `widget.serialize = false` duality | Single `{ ephemeral: true }` or `{ promptExclude: true }` option |

### New Widget Options for Persistence Control

```ts
interface WidgetPersistenceOptions {
  /**
   * Widget is ephemeral — not saved to workflow, not sent to backend.
   * Use for: previews, progress indicators, audio players.
   */
  ephemeral?: boolean

  /**
   * Widget is saved to workflow but excluded from API prompt.
   * Use for: control_after_generate, combo filter lists, UI-only state.
   */
  promptExclude?: boolean
}
```

These replace the `widget.serialize` / `widget.options.serialize` distinction from v1.

### The `beforeSerialize` Hook — Deprecated Path

The `widget.on('beforeSerialize')` hook from D7 Part 4 becomes a **migration shim only**. New v2 extensions should NOT use it. The recommended pattern:

```ts
// DEPRECATED (D7 pattern)
widget.on('beforeSerialize', (e) => {
  if (e.context === 'prompt') {
    e.setSerializedValue(await computeDynamicValue())
  }
})

// RECOMMENDED (D14 pattern)
// Register as a prompt processor at the app level, not per-widget
defineExtension({
  name: 'dynamic-prompts',
  setup(ctx) {
    ctx.on('beforePrompt', (prompt) => {
      // Transform all dynamic-prompt widgets at once
      for (const node of prompt.nodes) {
        for (const input of node.inputs) {
          if (isDynamicPromptValue(input.value)) {
            input.value = processDynamicPrompt(input.value)
          }
        }
      }
    })
  }
})
```

The transformation moves **up a layer** from widget-instance to prompt-processor. This is the "model it in the structure of the data" principle from the Slack thread.

### Implementation Phases

**Phase 1 (I-WS.3 scope)**: Lazy on-access serialization
- Single getter per widget computes serialized form
- Memoized per transport-epoch
- `beforeSerialize` hook still fires for migration compat

**Phase 2**: Option-based persistence control
- Add `ephemeral` and `promptExclude` options
- Deprecate `widget.serialize` / `widget.options.serialize` booleans
- Framework reads options instead of firing hooks

**Phase 3**: Prompt-processor pattern
- Document `ctx.on('beforePrompt')` as the new pattern for value transformation
- Deprecate `e.context === 'prompt'` checks in `beforeSerialize`
- Dynamic prompts, webcam capture, etc. migrate to prompt-processor

**Phase 4**: Remove `beforeSerialize` context parameter
- Hook fires once (not per-context)
- `e.context` removed from `WidgetBeforeSerializeEvent`
- Only use case: custom serialization format (rare)

---

## Consequences

### Resolved

- **Widget doesn't implement serialization logic** — the 4-context switch moves to framework
- **Single value model** — extensions reason about one value, not workflow-vs-prompt-vs-clone
- **Eliminates serialize/options.serialize confusion** — explicit named options replace boolean flags

### Deferred

- **Backend prompt processor support** — `ctx.on('beforePrompt')` needs backend coordination if transformations affect backend validation
- **Migration path for existing `beforeSerialize` users** — deprecation warnings, then removal in v1.0

### Risks

- **Prompt-processor is a new pattern** — teaching cost for extension authors used to per-widget hooks
- **Some edge cases may still need per-widget hooks** — keep `beforeSerialize` as escape hatch

---

## Cross-References

- **D7 Part 4** — superseded by this ADR for the serialization model (D7 shape decisions remain valid)
- **I-WS.3** — implements Phase 1 (lazy getter)
- **design-review-12142.md Topic 16** — original Slack thread captured here
- **D6 §Q4** — `ctx.on('beforePrompt')` specified as Phase B app-level hook
