# ADR-D5: Event Vocabulary, Payload Typing, and Serialization Hook Shape

**Status**: accepted (with revisions per 2026-05-08 user review — see "Resolutions" section)
**Date**: 2026-05-08
**Last revised**: 2026-05-08 (user review)
**Supersedes / extends**: D3.3 (Events Over Signals), D3.4 (Events and Commands Reconciled)
**Related cluster**: Reviewer Feedback Cluster C (F6, F8, F9)

## Context

D3.3 committed to an event/callback model at the extension boundary
(`node.on('executed', fn)`, `widget.getValue()/setValue()`). It explicitly
deferred two follow-up questions:

1. **Event vocabulary** — what events exist and what do they mean?
2. **Payload typing** — what is the type signature of every event handler?

Reviewer feedback in `extensionV2Service.ts` surfaced three concrete instances
where these unresolved questions caused either ambiguous APIs or untyped
fallbacks:

- **F6** (`extensionV2Service.ts:145-150`) — the single `'change'` event on
  `WidgetHandle` watches only `value`, not `options` or `props`. Extensions
  that want to react to option changes (e.g. `hidden` toggling, label changes,
  serialize-mode flips) have no event to subscribe to.
- **F8** (`extensionV2Service.ts:149`) — event handler signatures are typed as
  `Function`. No payload type, no inference, no IDE help.
- **F9** (`extensionV2Service.ts:157-163`) — `WidgetHandle.setSerializeValue(fn)`
  is a callback registration, not an event. The reviewer proposed
  `widget.on('beforeSerialize', …)` and letting the handler mutate state
  through the standard `setValue` path instead of returning a transformed value.

This ADR is the smoking-gun-driven decision: real-world R4 evidence shows that
v1's untyped event surface created six different parameter signatures for
`onConnectionsChange` across the ecosystem (R4-P4). Shipping v2 without typed
payloads recreates exactly that failure mode.

## Decision

### Part 1 — Type every event payload

Every event the public API exposes must have a named payload interface in the
declaration file. No `Function`, no `(...args: unknown[]) => void`, no
implicit `any`.

```ts
export interface NodeEvents {
  executed: NodeExecutedEvent
  configured: NodeConfiguredEvent
  connectionsChanged: NodeConnectionsChangedEvent
  removed: NodeRemovedEvent
  // ...
}

export interface WidgetEvents {
  valueChange: WidgetValueChangeEvent
  optionChange: WidgetOptionChangeEvent
  propertyChange: WidgetPropertyChangeEvent
  beforeSerialize: WidgetBeforeSerializeEvent
}

// Discriminated handler type — TS can infer payload from event name.
type Handler<E extends keyof NodeEvents> = (event: NodeEvents[E]) => void
```

Payload interfaces live next to the entity that emits them
(`NodeEvents` next to `NodeHandle`, `WidgetEvents` next to `WidgetHandle`).

### Part 2 — Ship only `valueChange`; defer non-value channels to D7

**Revised on user review (2026-05-08).** Original proposal was three separate
events (`valueChange | optionChange | propertyChange`). User pushback: the
options-vs-property distinction is confusing and presupposes a widget data
model that D7 hasn't decided yet.

**Resolution:**

- D5 ships `valueChange` (the one channel everyone agrees on).
- The shape, naming, and even existence of non-value change channels is
  **deferred to D7** (widget shape & persistence). When D7 lands a coherent
  data model for "options" vs "properties" vs "extension state", THAT ADR
  decides what events fire on which channel.
- No `'change'` umbrella event in v1.

| Event             | Source                 | Fired when                  | Status |
|-------------------|------------------------|-----------------------------|--------|
| `valueChange`     | `WidgetValue.value`    | user or extension setValue  | ✅ ships in D5 |
| (non-value)       | TBD per D7             | TBD per D7                  | 🟡 deferred to D7 |

This keeps D5 unblocked from D7 (good — D5 can land while D7 is still
scoping) and means `WidgetEvents` interface starts with one entry and
grows when D7 ships.

### Part 3 — Replace `setSerializeValue(fn)` with `on('beforeSerialize', fn)`

**Revised on user review (2026-05-08, after grepping real code).** The
original proposal had `event.overrideValue(v)` only. Verifying against
`webcamCapture.ts`, `load3d.ts`, `uploadAudio.ts`, `dynamicPrompts.ts`
revealed three distinct patterns in the wild, not one:

1. **Override**: serialize a value different from the runtime value
   (`dynamicPrompts.ts`: replace `{var}` with computed substitution at
   serialize time, runtime value stays the template).
2. **Skip**: omit this widget from serialization entirely
   (`webcamCapture.ts:117`: `btn.serializeValue = () => undefined`).
3. **Async I/O at serialize time**: side-effecting handler that does
   network I/O and returns a value derived from that I/O
   (`webcamCapture.ts:120-150`: capture from camera, upload to server,
   return uploaded filename; `load3d.ts`, `uploadAudio.ts` similar).

The event shape must support all three. Final API:

```ts
// Override — serialize a transformed value, runtime value unchanged.
widget.on('beforeSerialize', (event) => {
  event.setSerializedValue(transform(event.value))
})

// Skip — omit this widget from the serialized workflow.
widget.on('beforeSerialize', (event) => {
  event.skip()
})

// Async with I/O — handler is awaited; serialization waits.
widget.on('beforeSerialize', async (event) => {
  const filename = await uploadCanvasFrame()
  event.setSerializedValue(filename)
})
```

**Async exception.** D5 is otherwise sync-only (Q2 below). `beforeSerialize`
is the **one async-aware event** in v1. This matches Vue's `<Suspense>`
boundary model — async happens at well-defined boundaries, not anywhere.
Required because webcam/load3d/uploadAudio all do real I/O at serialize
time and that is not removable.

**Cost**: ~6 known repos using `widget.serializeValue =` migrate. Pattern
maps mechanically:

| v1                                       | v2                                         |
|------------------------------------------|--------------------------------------------|
| `w.serializeValue = () => undefined`     | `w.on('beforeSerialize', e => e.skip())`   |
| `w.serializeValue = () => v`             | `w.on('beforeSerialize', e => e.setSerializedValue(v))` |
| `w.serializeValue = async () => v`       | `w.on('beforeSerialize', async e => e.setSerializedValue(await fetchV()))` |

R4 evidence: touch-points S4.W3 ranks #10 (★1,837, occ=6) — real ecosystem
pressure but not viral. Acceptable migration cost.

### Part 4 — Naming convention for event names

`camelCase`, action-verb form, present tense for "happened" events
(`valueChange`, `executed`), `before…` prefix for pre-mutation hooks
(`beforeSerialize`, `beforePrompt`), `after…` only when paired with a
`before…`. No `on…` prefix on event names themselves — the prefix is on the
*handler registration* (`widget.on('valueChange', …)`), not the event name.

## Consequences

- ✅ Every event handler in every extension gets full IDE inference and
  typecheck — eliminates the R4-P4 "six different signatures" failure mode at
  the type level.
- ✅ Events become the single discipline at the extension boundary (no more
  callback registrations like `setSerializeValue`). Easier to teach, easier to
  document, easier to mock in tests.
- ✅ The discriminated `WidgetEvents` interface lets us add new event channels
  later without breaking old subscribers — opt-in growth.
- ⚠️ More event names to learn. Mitigated by typed payloads making them
  discoverable in IDE.
- ⚠️ `setSerializeValue` migration. Affects ~6 known repos. P3 migration
  guide must include before/after.
- ⚠️ `event.overrideValue(v)` is a new pattern that needs careful docs —
  it's "fire-and-forget side channel" semantics, distinct from `setValue`'s
  "persist to state" semantics.

## Alternatives Considered

1. **Keep single `'change'` event with discriminator field**
   (`event.kind: 'value' | 'option' | 'property'`). Rejected: forces every
   subscriber to write a switch statement; defeats the typed-payload win;
   discriminated union is strictly worse than separate events for the
   common case.

2. **Keep `setSerializeValue` as syntactic sugar over
   `on('beforeSerialize')`**. Rejected: two ways to do the same thing
   bifurcates docs and example code. Pick one; recommend the events one;
   delete the callback one.

3. **Type event handlers as `(...args: unknown[]) => void` with manual
   narrowing**. Rejected: this is what v1 effectively did and it's the
   direct cause of R4-P4. Non-starter.

4. **Use Vue's `emits` array typing pattern** (string array of event names
   with type hints). Rejected: extensions are external to Vue components;
   the `emits` macro doesn't apply. The hand-written `Events` interface is
   the equivalent for non-component code.

## Resolutions (2026-05-08 user review)

- **Q1 RESOLVED** — Skip exists as `event.skip()` on `beforeSerialize`
  (per Part 3 revision). Confirmed by `webcamCapture.ts:117` evidence.
- **Q2 PARTIALLY RESOLVED** — Events are sync EXCEPT `beforeSerialize`
  which is async-aware (per Part 3 revision). All other events are sync
  in v1.
- **Q3 OPEN** — Hook ordering across extensions still unspecified; tracked
  in D10b (lifecycle/ordering ADR, see todo I-NEW.3).
- **NEW Q4** — Confirm during PKG2 implementation: does `dynamicPrompts.ts`
  current shape (handler receives `(workflowNode, widgetIndex)`) need
  those args in the event payload? If yes, `BeforeSerializeEvent` includes
  them; if no (extensions can read from `widget` directly), drop.

## UWF Note — `context` enum and Phase 2 (I-UWF.7, resolved 2026-05-08)

**Question:** When UWF Phase 2 lands and the save path changes from LiteGraph
workflow JSON to the unified format, does `WidgetBeforeSerializeEvent.context`
need a new `'unified-format'` value?

**Resolution: No API change needed. Option (a).**

`'workflow'` means "the user is saving to disk." UWF Phase 2 changes the
*container format* of that saved file, not the *semantic trigger*. A widget
handler that runs during `context === 'workflow'` still has the same job in
either format: produce the serialized value for the widget. It has no reason
to care whether the outer container is LiteGraph JSON or a unified spec object.

Adding `'unified-format'` (option b) would force every extension that switches
on `context === 'workflow'` to add a second branch — unnecessary breaking change
for zero ergonomic gain.

Option (c) — "UWF Phase 2 fires no `beforeSerialize`" — is wrong. `beforeSerialize`
is per-widget and widget-level serialization still happens inside the unified
format; only the container structure changes.

**Implication for `widget.ts`:** No change to `WidgetBeforeSerializeEvent.context`
type when UWF Phase 2 ships. The JSDoc on `'workflow'` should be updated at that
time to say "saving to disk (LiteGraph JSON before UWF Phase 2, unified format
after)" — a documentation patch, not a semver-minor addition.

**Closed. Does not reopen D5.**

## Open Questions

- **Q5 (UWF, 2026-05-08)** — D5 resolves S6.A1 for the *per-node* serialization case
  (`node.on('beforeSerialize')`). The *cross-node* case — extensions that intercept
  `graphToPrompt` to transform the entire workflow graph (virtual node resolution,
  cg-useeverywhere auto-wiring, global seed sync) — cannot be expressed through
  `beforeSerialize`. Those patterns require an app-level hook not yet in the API.
  Deferred to **I-UWF.4** (decision: `defineExtension({ onBeforeWorkflowSave })` vs
  `app.on('beforePrompt')` vs out-of-scope). Does not reopen D5; noted here so the
  S6.A1 cross-reference isn't misread as "fully solved."

## Cross-References

- R4 finding P4 (CONTEXT.md): six distinct `onConnectionsChange` signatures
- Touch-points DB: S2.N12, S2.N14, S4.W3, S6.A1, S2.N6
- D3.3 (events over signals)
- D4 BLOCKER G7 (mandatory widget dispose) — feeds into beforeUnmount event
- I-UWF.4 — app-level serialization hook (cross-node case, S6.A1 remainder)
- P1-comfy-extension-v2-api.md (current proposal that this ADR amends)
