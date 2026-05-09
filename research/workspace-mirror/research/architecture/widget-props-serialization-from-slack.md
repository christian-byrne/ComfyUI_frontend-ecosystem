Jedrzej Kosinski  [1:57 PM]
@Austin Mroz slightly related to the above, what is the status of the good int and float primitive nodes that let you specify min/max/step? imo, if this is blocked be design, we should just skip that entirely and just do it. it's been like 3-4 months now or more. Nodes are going to have some level of technicality to them that is not going to suddenly be turned around and increase ComfyUI adoption because we have some super specific way of showing 2 widgets. If we can have 1 week on design to improve that's one thing, but a third or half a year for that is a signal that shouldn't be part of the initial node rollout for almost anything. (edited) 
42 repliesChristian Byrne  [3:52 PM]
Is it actually blocked by design? I can see the designs for it now which look like they've been ready for a while
Screenshot 2026-03-18 at 11.00.08 PM.png [3:56 PM]More likely blocker is the difficulty to merge this change in core. Would these values be persisted in the workflow / restored on load? In that case we would want the min and max to be part of the value itself and need to adjust the schema (or add a new one). And if adjusting, we would need node replacement or migration layer. This would all require core changes
Jedrzej Kosinski  [3:58 PM]
Easiest is we don't use node replacement and do something I suggested a long while back. We mark the original nodes as deprecated so users can replace them anymore. Then we just create new nodes for this. Reason being, the old nodes had no concept of minimum + maximum and were set to absolute biggest min and max possible. So this will prevent any possible reasons for regression. Long term, zero tech debt for the old primitive int + float nodes because they do nothing special (just pass the value from frontend straight out), we just need to not delete them (edited) 
[3:59 PM]Source: I've been forced to do this in my custom nodes before with zero negative repercussions
[4:01 PM]For frontend, we'd need to make a special case to show both values on one line in nodes 2.0, and in lite graph we just keep it as two rows
[4:02 PM]I guess the other difference is this design asks for integers that can have no value set
[4:06 PM]Basically optional widgets, which is a pretty good idea. In the short term we could just code it up specifically for these two nodes "Int" and "Float" and the backend can just get the values and deal with em. In the long term would be cool to add to the schema.
Austin Mroz  [4:07 PM]
They've been long merged with bad design (manually setting props), but I got the impression design was still under review. I can get the screenshot Christian showed implemented fairly quickly
Jedrzej Kosinski  [4:10 PM]
Gotcha. We should really improve the comms pipeline of things like this. When the tasks exchange hands accross team, can easily become invisible to folks who would actually be implementing the feature. Maybe linear can help with that going forward
[4:12 PM]Btw when you say long merged, are those nodes useable rn or still hidden in some way? (edited) 
Christian Byrne  [4:12 PM]
How are you planning to persist the min/max metadata while keeping it as a INT / FLOAT? the node properties? (edited) 
Austin Mroz  [4:20 PM]
PR was #7768. It adds the functionality onto the existing "Primitive Int" and "Primitive Float" nodes.
[4:21 PM]It's set as a node property. So the doesn't currently see the props at all for validation.
[4:22 PM]Makes it easy to extend later with pure UI (in the side panel), but the functionality is already being used in some internal made workflows
Christian Byrne  [4:24 PM]
Long term we likely need to make input props be serialized and persisted in both save format and API format. Not saying you had that option in the above PR though -- would require some major work
[4:26 PM]In this case we could have done that by following the pattern of e.g. BBox boxed type (a type that can have values and config and output all wrapped in an object), but then we lack the generic-ness of our comfy type system to make this compatible with float/int links/connections
[4:27 PM]Or polymorphic-ness / structural typing-ness, more accurately
[4:30 PM]@Glary-Bot for the above problem, what solution would you recommend?


Change the engine across the stack to allow putting props and value inside inputs (type instances)
Gradually start using boxed types like BBOX (clone ComfyUI to see what I mean), then add a structural typing or polymorphism system
The problem with serializing the property on the node or other data structure is the widget needs to be decoupled at runtime and possibly transported, teleported, promoted, serialized, etc. clone the frontend to see what I mean. You can also propose third or fourth alternatives
Austin Mroz  [4:34 PM]
I don't remember specifically why we moved away from passing/storing the props as hidden widgets, but I think boxing types is way out of scope here.

Users redefining allowed ranges on widgets should require using a secondary node. It better communicates to workflow consumers that something special has been applied.
Glary-Bot  [4:34 PM]
Recommendation: Option 3 — store metadata on the widget config, not on node.propertiesAfter reading both repos, I'd reject both options as framed and recommend a third path. Here's the reasoning, then the proposal.What I found in the codeBackend (comfyui)
INPUT_TYPES is a tuple (type_name, options_dict) and is class-level only. The options dict (min/max/step/default/tooltip/forceInput…) is read at validation/exec time via get_input_info() in comfy_execution/graph.py and never serialized into a workflow or API prompt.
Type matching in comfy_execution/validation.py is pure string equality with two niceties: * wildcard, and comma-separated unions (e.g. IO.NUMBER = "FLOAT,INT", IO.PRIMITIVE = "STRING,FLOAT,INT,BOOLEAN"). There is no structural typing today.
BBOX is not a fancy boxed type — it's just list[list[dict]] with a string tag "BBOX". The "wrapping" lives in producer/consumer convention, not in any type machinery. There's also a newer BoundingBox (io_type "BOUNDING_BOX") which is a TypedDict, but matching is still string-based.
Frontend (comfyui_frontend) — what survives each transport:Transport
node.properties
widget.value
widget[CONFIG] (PrimitiveNode)
Workflow JSON save/load
✅
✅
derived at connect time
API prompt (graphToPrompt)
❌
✅
n/a
Promote widget → input (PrimitiveNode)
❌
✅
✅ (via output.widget[CONFIG])
Subgraph IO promotion
❌
✅ (projected)
❌ (re-derived from source)
Copy/paste, clone
✅
⚠️ (broken for PrimitiveNode — see ADR-0006)
❌
So the current PR #7768 design (Object.defineProperty shim that reads/writes this.properties.min/max/step in customWidgets.ts) is correct for save/load of the unconnected node, but as soon as the user promotes the widget to an input socket, the metadata is dropped — the receiving PrimitiveNode rebui… It also doesn't reach the backend at all. That's actually fine — see below.Why I'd reject Option 1 (props-on-inputs as type instances)This is the heaviest possible change for the smallest possible payoff:
It mutates the public API contract that thousands of custom nodes depend on (the prompt schema becomes {"width": {"value": 512, "min": 64, "max": 8192}} instead of {"width": 512}).
It forces every consumer of the prompt JSON (executors, history, embedded PNG metadata, ComfyMetadata PROMPT tag, third-party tooling, the API node ecosystem) to migrate.
It conflates two genuinely different things: per-class constraints (engine-side validation, today in extra_info) and per-instance UI hints (what the slider should clamp to). They don't belong together.
The backend doesn't actually need this data. Validation already uses class-level min/max. The Primitive Int/Float feature is a UI affordance — it's the user declaring "I want this slider to clamp to 0..100", not the node author.
Why I'd reject Option 2 (gradually adopt BBOX-style boxed types + structural typing)
BBOX isn't a structural type in any meaningful sense — it's a string tag on a dict. Adopting "BBOX-style" doesn't actually solve the polymorphism problem; it just renames it.
To make BoxedInt connect to an INT socket, you'd need real structural/subtyping in validate_node_input. That's a significant engine change with subtle compatibility risks (every custom node that does if input_type == "INT" somewhere breaks).
Loses the connection-compatibility property that's the whole point of keeping these as INT/FLOAT.
And it still doesn't survive widget promotion cleanly — the boxed value would have to round-trip through PrimitiveNode, which today is value-only.
Recommendation: Option 3 — push metadata into the input spec, kept on the linkConcretely:
Frontend: store min/max/step on widget[CONFIG], not on node.properties. This is the same place PrimitiveNode already reads from when promoting (output.widget[CONFIG] in widgetInputs.ts:501 / GET_CONFIG accessor at :349). Today CONFIG is derived from the target node's INPUT_TYPES at connection time. We extend it to be overridable per-instance by the source Primitive node.
In onCustomIntCreated / onCustomFloatCreated, instead of redirecting widget.options.min through this.properties.min, write into the widget's CONFIG slot used by promotion.
Add a small CONFIG-merge step at promote time: target's class-level (type, opts) ⊕ source-instance overrides, with instance overrides winning. This is one-line in _onFirstConnection.
Result: metadata travels with the widget through promotion and subgraph projection because it lives on the same channel CONFIG already does.

Persist it in the workflow as part of the widget's serialized state, not on node.properties. Use the existing two-tier serialization (widget.serialize for workflow, widget.options.serialize for prompt — see docs/WIDGET_SERIALIZATION.md). Add a sidecar widget.options_overrides that is serialized to the workflow JSON but not to the prompt. This keeps the API surface unchanged while making save/load durable.
Backend: zero changes. Class-level INPUT_TYPES still owns the contract (what's safely accepted). The frontend min/max/step are UI clamps, not validation. The prompt that hits /prompt still contains a plain int/float — validate_inputs keeps working unchanged. No engine churn, no API break, no structural typing needed.
Promotion semantics: when a Primitive Int/Float is promoted to an outer subgraph input, the override config travels via the existing CONFIG channel that widgetInputs.ts and groupNode.ts already use. This fixes the bug Christian implicitly raised — that's where the current PR #7768 actually breaks.
Migration: ship a one-shot onConfigure shim that reads legacy node.properties.{min,max,step} and rewrites them into the new override slot, so existing workflows from PR #7768 keep working.
Why this is the right call
No backend changes. The team's biggest blocker (U087MJCDHHC's "would require some major work") disappears. Per-instance metadata isn't a backend concern — it's a UI concern, and our class-level extra_info already does the validation job.
No structural typing. INT :left_right_arrow: INT connections keep working with string equality. We don't have to retrofit subtyping into a system that has 4+ years of custom nodes assuming string-equality.
Survives promotion. Because we're using the channel that's already the promotion-aware channel.
Preserves the widget-decoupling-at-runtime invariant the user is worried about: the metadata travels with the widget, not with the node.
Matches existing patterns documented in WIDGET_SERIALIZATION.md and ADR-0006, rather than inventing new ones.
Caveats / things to sanity-check
ADR-0006 ("PrimitiveNode Copy/Paste Lifecycle") is still Proposed, and Option 3 here interacts with it — the override CONFIG needs to be captured during clone()→serialize(), which is the exact bug ADR-0006 is solving. I'd sequence ADR-0006 Option A (override serialize() to fall back to this.widgets_values) first, then layer the per-instance overrides on top. Otherwise we ship a feature that's broken on copy/paste.
ADR-0008 (ECS) prohibits adding methods to LGraphNode. Putting overrides on the widget config (data-only) is ECS-compatible; adding them as instance properties on the node would not be.
The "long-term" item the team flagged — making input props serialized in both save AND API formats — is still desirable, but should be a separate ADR. This proposal doesn't preclude it; it just stops blocking on it.
TL;DRDon't change the engine. Don't add structural typing. Don't box INT/FLOAT.
Move the per-instance min/max/step from node.properties onto the widget config channel that PrimitiveNode/subgraph promotion already use, persist it as a workflow-only sidecar, and leave the prompt API and backend untouched.
Sequence: land ADR-0006 Option A first, then this on top.Austin Mroz  [4:35 PM]
Widget config isn't serialized.
Christian Byrne  [4:51 PM]
@Glary-Bot option 3 that you provided is what I meant with item 1 from my message. But we would want this to be a format level change, not something specific to the frontend runtime necessarily. And it does need to work for API prompt, promotion, primitives, subgraph IO promotion, and copy paste.
Glary-Bot  [4:52 PM]
Analyzing type system architecture for primitive nodes with min/max metadata

:white_check_mark: Read full context: customWidgets.ts, widgetInputs.ts (PrimitiveNode), LGraphNode serialize/configure, executionUtil graphToPrompt, ExposedWidget/Subgraph promotion, widget types
:white_check_mark: Create glary/* branch on frontend
:loading: Survey subgraph promotion + group node + executableGroupNodeDto for envelope plumb points
:heavy_minus_sign: Define value envelope type + type guard in litegraph types
:heavy_minus_sign: Add overrides field + serializeWorkflowValue hook to IBaseWidget in widgets.ts
:heavy_minus_sign: Implement widget.overrides in onCustomIntCreated/onCustomFloatCreated (replace node.properties shim)
:heavy_minus_sign: Add envelope detection + unwrap in LGraphNode.serialize/configure
:heavy_minus_sign: Migration shim: fold legacy node.properties.{min,max,step,precision,round,gradient_stops,display} into widget.overrides on configure
:heavy_minus_sign: PrimitiveNode promotion: propagate source widget.overrides into created widget options
:heavy_minus_sign: Extend ExposedWidget type to include optional overrides; thread through subgraph promotion read/write paths
:heavy_minus_sign: graphToPrompt: emit {value, ...overrides} envelope when widget has overrides
:heavy_minus_sign: Unit tests: envelope serialize/configure round-trip, migration shim, graphToPrompt envelope output, promotion propagation
:heavy_minus_sign: E2E (Playwright): create primitive int with overrides, save+load, copy+paste, promote-to-input, prompt API shape
:heavy_minus_sign: Run pnpm typecheck, lint, format, knip, test:unit on changed files
:heavy_minus_sign: Open draft PR with cross-repo instructions for ComfyUI backend (7-line execution.py patch)
:heavy_minus_sign: Fire parallel reviews: Oracle (architecture), /review (code), librarian (litegraph conventions)
:heavy_minus_sign: Address review feedback (cap 5 iterations)

:speech_balloon: Done

View Session (edited) 
Glary-Bot  [4:57 PM]
You're right — and U098L2BBHC2 is right about widget config not being serialized. Here's a concrete format-level proposal.The actual key insightThere's already a precedent in the prompt format for "value plus extra fields": the __value__ wrapper. executionUtil.ts wraps array-typed widget values as {"__value__": [...]} so the backend doesn't mistake them for [node_id, slot] links, and execution.py:957-973 unwraps it before type coercion. The… And the widget value position in the workflow JSON (widgets_values: TWidgetValue[]) already permits objects — TWidgetValue = string | number | boolean | object | null. So both formats can carry richer payloads today without breaking the schema; we're just specifying a new variant.The schema deltaA single canonical "value envelope" used in three places. Optional fields, additive, no node migration.// New shared shape — name TBD, e.g. WidgetValueEnvelope
type WidgetValueEnvelope<T = number> = {
  value: T              // the actual scalar
  min?: number          // per-instance UI clamp
  max?: number
  step?: number
  // Reserved for future: precision, round, gradient_stops, etc.
}It appears in exactly four format positions:1. Workflow JSON — widgets_values[i]Today: widgets_values: [20, "fixed"]
Proposed: widgets_values: [{value: 20, min: 0, max: 100, step: 1}, "fixed"]LGraphNode.serialize() (line 972-983) already iterates widgets and writes widget.value. The widget gains a serializeValue() hook (already used elsewhere — executionUtil.ts:104) that returns the envelope when overrides exist, the bare scalar otherwise. configure() symmetrically detects the envelope s… 2. API prompt — inputs[name]Today: inputs: {seed: 8566257} or inputs: {model: ["4", 0]}
Proposed adds: inputs: {seed: {value: 8566257, min: 0, max: 9999}}graphToPrompt in executionUtil.ts:104 already calls widget.serializeValue() — same hook returns the envelope. Disambiguation from links is unambiguous: links are arrays, envelopes are objects.Backend: a 7-line addition in execution.py:957-973, alongside the existing __value__ unwrap:if isinstance(val, dict):
    if "__value__" in val:
        val = val["__value__"]
    elif "value" in val:               # NEW
        val = val["value"]             # NEW
    inputs[x] = valFUNCTION, VALIDATE_INPUTS, IS_CHANGED keep receiving plain scalars. Class-level INPUT_TYPES min/max remains the safety contract. No node migration. No structural typing.3. Subgraph IO promotion — ExposedWidget gains an optional override slotToday (serialisation.ts:176-181):interface ExposedWidget { id: NodeId; name: string }Proposed:interface ExposedWidget {
  id: NodeId
  name: string
  overrides?: { min?: number; max?: number; step?: number }  // NEW, optional
}This is the field that doesn't exist anywhere today and is the actual root of U098L2BBHC2's "widget config isn't serialized" complaint. The frontend's PromotedWidgetView (read-only projection in promotedWidgetTypes.ts) merges these overrides on read; the source widget's class-level INPUT_TYPES still… 4. Copy/paste — automaticClipboard uses ISerialisedNode (serialisation.ts:194-200), so it inherits (1) for free. The PrimitiveNode-specific copy/paste bug is orthogonal — that's ADR-0006, fix it independently with Option A (override serialize() to fall back to this.widgets_values).Why this respects every constraintConstraint
How this satisfies it
Format-level, not frontend-only
Spec lives in the workflow + prompt schemas; multiple frontends/SDKs can implement
Survives workflow save/load
widgets_values[i] envelope is part of the persisted JSON
Survives API prompt
Inputs envelope passes through; backend unwraps to scalar
Survives PrimitiveNode promotion
PrimitiveNode reads source widget's serialized envelope (not node.properties)
Survives subgraph IO promotion
ExposedWidget.overrides is the new persistent slot
Survives copy/paste
Inherits from ISerialisedNode.widgets_values
No structural typing
Type tag stays INT/FLOAT; envelope is a value-shape, not a type-shape
No backend rework
7 lines in execution.py + the unwrap reuses the existing __value__ codepath
No node migration
All custom nodes keep working; FUNCTION still receives a scalar
What changes, concretelyWorkflow JSON schema (additive):
TWidgetValue already includes object; we're specifying that primitive number widgets may serialize as {value, min?, max?, step?} instead of bare number.
Prompt API schema (additive):
Document {value, min?, max?, step?} as an accepted shape alongside scalar and __value__-wrapper. min/max/step are advisory metadata — the backend's authoritative validation remains class-level INPUT_TYPES.
Subgraph format (additive):
ExposedWidget.overrides?: { min?, max?, step? } — new optional field.
Frontend code:
customWidgets.ts onCustomIntCreated/onCustomFloatCreated: stop redirecting through this.properties.*; instead set widget.overrides = {...} and implement widget.serializeValue() returning the envelope when overrides are non-empty.
LGraphNode.serialize/configure: standard hook, already exists for many widgets.
widgetInputs.ts PrimitiveNode: read source's widget.overrides and apply them to the freshly created widget so promotion preserves them.
groupNode.ts / subgraph IO: write/read ExposedWidget.overrides during exposure.
executionUtil.ts graphToPrompt: no change — already calls widget.serializeValue().
Backend code:
execution.py:957-973: 7-line elif "value" in val branch. That's it.
Migration:
One-shot onConfigure shim: if node.properties.{min,max,step} exists from a PR #7768 workflow, fold them into widget.overrides and delete from properties.
Christian Byrne  [7:19 PM]
@Glary-Bot yeah this is basically what I meant. But there's not really a need to use this cryptic dunder type simply because that's what existed in one place at one time. We can add support for this in the foundation -- types, schema, expressiveness, etc... So it's just a matter of whether to have overloading/polymorphism, structural typing, or a simple compat layer (which is more applied per-need)? Is that aligned with your understanding so far?
Glary-Bot  [7:19 PM]
Yes, that's aligned. Let me clarify the three paths as I understand them:
Overloading/polymorphism — BoxedInt type that can connect to INT sockets via some dispatch/subtyping mechanism in the type system
Structural typing — "if it has a value field that's an int, it's compatible with INT" duck-typing at the validation layer
Simple compat layer — keep types as string-equality, add a narrowly-scoped unwrap at execution time (the 7-line patch) that extracts value when present
My read of the constraints:
Path 1 or 2 give you principled type-level expressiveness but require non-trivial engine changes to validate_node_input and ripple out to every custom node that does string-equality checks on types. They're "foundation" changes in the sense that they expand what the type system can express.
Path 3 is "applied per-need" — it's a value-shape convention, not a type-level change. The type tag stays INT/FLOAT, validation stays string-equality, and the unwrap happens late (execution-time, not validation-time). It's cheaper but less general.
Your question is: given that we're willing to invest in foundation changes (types, schema, expressiveness), which of the three makes sense long-term, not just for this primitive Int/Float feature but for the ecosystem?Is that the right framing? And if so, do you have a preference, or are you asking me to recommend one based on the broader architecture?Christian Byrne  [7:21 PM]
@Glary-Bot that's right. Can you assist me on decision making by laying out some pros/cons and tradeoffs analysis?
Glary-Bot  [7:22 PM]
Type System Extension: Tradeoffs AnalysisAnalyzing three paths for handling metadata (min/max/step) on primitive values across the ComfyUI stack.Path 1: Overloading/Polymorphism (Explicit Subtyping)Description: Create new types like BoxedInt, BoxedFloat that are explicitly declared compatible with INT, FLOAT through a subtyping/polymorphism system.Pros
Principled & explicit: Type relationships are declared, discoverable, and self-documenting
Type-safe at validation time: Can catch incompatibilities before execution
IDE/tooling friendly: Autocomplete, type checkers, and schema validators can understand the relationships
Extensible foundation: Once built, supports future use cases (e.g., ConstrainedString, BoundedFloat, etc.)
Clear migration path: Old nodes keep using INT, new nodes can opt into BoxedInt, with explicit conversion rules
Cons
High implementation cost: Requires adding subtype registry, dispatch logic in validate_node_input, potentially a type hierarchy/DAG
Breaking change risk: Every custom node doing if input_type == "INT" needs auditing; some will break silently
Schema complexity: Need to version and document the subtyping rules; third-party tools must implement the same logic
Overkill for this feature: Polymorphism is powerful but heavyweight if primitive metadata is the only near-term use case
Learning curve: Node authors must understand which type to use when, and how to declare new subtypes
When This Wins
You anticipate many future cases needing subtyping (e.g., constrained types, unit-aware types like Distance, Angle)
You're willing to invest 3-6 months in a type system v2 project with broad stakeholder alignment
You want the backend to enforce that a node accepting INT also accepts BoxedInt (not just convention)
Path 2: Structural Typing (Duck Typing)Description: Validator checks if value/input "looks like" the target type (e.g., {"value": 20} satisfies INT because it has an int-typed value field).Pros
Flexible & forgiving: "If it quacks like an int, it's an int" — no need to enumerate all compatible types upfront
Low boilerplate: Node authors don't declare subtypes; compatibility emerges from shape
Easier migration: Existing nodes mostly work unchanged; only the validator logic changes
Fits Python culture: Python's own duck-typing ethos; feels natural for Python-heavy custom nodes
Future-proof for unknown shapes: Can handle new envelope formats (e.g., {value, unit}) without updating a registry
Cons
Ambiguity risk: What if a node legitimately wants a dict with a value key? Hard to distinguish metadata envelope from actual payload
Weak discoverability: No central place to see "what shapes are valid for INT"—it's implicit in the validator code
Testing burden: Compatibility is emergent, so you need exhaustive tests to verify every shape against every type
Silent breakage: A node expecting a plain int in FUNCTION might get {"value": 20} if the unwrap layer has a bug
Third-party divergence: ComfyUI Python backend, JS frontend, third-party SDKs (Rust, Go, etc.) must all implement identical duck-typing rules—easy to drift
When This Wins
You expect diverse value shapes in the future (not just primitives—think {value, confidence}, {value, provenance}, etc.)
You want minimal friction for custom node authors—no need to learn a type declaration system
You're comfortable with runtime validation being the source of truth (not compile-time/schema-time)
Path 3: Simple Compat Layer (Value Unwrap Convention)Description: Types stay string-equality (INT, FLOAT). Add a narrow unwrap at execution time: if value is {"value": x, ...}, extract x; otherwise use value as-is. Metadata (min/max/step) is advisory and stays in frontend/workflow layer only.Pros
Minimal engine change: 7 lines in execution.py, no validator changes, no type system churn
Zero breaking changes: Every existing node, SDK, tool keeps working unchanged
Fast to ship: Can land this week; unblocks the primitive Int/Float feature immediately
Separation of concerns: UI metadata (min/max/step) stays in UI layer; backend only sees the scalar for validation/execution
Proven pattern: __value__ wrapper already uses this approach; team is familiar with it
Low maintenance: No new abstractions to document, teach, or debug
Cons
Not generalizable: Solving this problem, not building a foundation for future metadata-on-types use cases
Implicit convention: The unwrap is "magic"—no schema declares that {value, min, max} is a valid INT shape
Scattered knowledge: Each value shape needing special handling adds a new unwrap branch; could accumulate tech debt
No validation-time use of metadata: Backend can't use min/max for smarter validation/coercion because it's stripped before validation runs
Fragile to misuse: If someone accidentally sends {value: {value: 20}} (double-wrapped), silent breakage
When This Wins
You need to ship now and can't block on a multi-month type system redesign
The metadata is purely UI-facing (min/max for sliders) and the backend doesn't need to see it
You expect few future cases like this—not the start of a pattern
You want to defer the foundation decision until you have more use cases to inform the design
Tradeoff MatrixDimension
Path 1 (Polymorphism)
Path 2 (Structural)
Path 3 (Unwrap)
Implementation time
3-6 months
1-2 months
1 week
Breaking change risk
Medium-High
Medium
None
Generality (future use cases)
High
High
Low
Cognitive load on node authors
High
Low-Medium
Very Low
Type safety
Validation-time
Runtime
Runtime (weakest)
Third-party SDK burden
High (must impl subtyping)
High (must impl duck-typing)
Low (just unwrap)
Discoverability
High (declared)
Low (implicit)
Very Low (magic)
Fits current architecture
Requires refactor
Moderate changes
Minimal changes
Tech debt risk
Low (principled)
Medium (scattered rules)
High (accumulates unwraps)
My Recommendation (with caveats)Ship Path 3 now, plan Path 1 for Q2/Q3.Reasoning:
You have an immediate blocker — primitive Int/Float with min/max has been stalled 3-4 months. Path 3 unblocks it this week without holding the team hostage to a type system redesign.
You don't yet know the right abstraction — you have one concrete use case (primitive metadata). Paths 1 & 2 are speculative: "we might need X in the future." Don't design the foundation until you have 2-3 real examples to generalize from. The second use case will clarify whether you need subtyping (Path 1) or duck-typing (Path 2).
Path 3 doesn't preclude Paths 1 or 2 — the unwrap layer is backward-compatible with a future type system. When you ship BoxedInt (Path 1) or structural typing (Path 2), you can deprecate the unwrap convention and migrate workflows over a grace period. It's a stepping stone, not a dead end.
Risk mitigation — Path 3's tech debt is localized (one unwrap function). If it becomes a problem, you'll see it early (within 6 months, when the second metadata use case arises) and can course-correct. Paths 1 & 2's risk is distributed (every custom node, every SDK) and much harder to unwind if you get the design wrong.
What to do in parallel:
Track future metadata use cases in a "Type System v2" roadmap issue. When you hit 2-3 concrete examples (e.g., "unit-aware numbers", "confidence-tagged outputs", "versioned model weights"), schedule the Path 1 design sprint.
Write an ADR documenting Path 3 as a temporary pattern with a sunset plan, so future you knows it's intentional tech debt, not accidental.
Prototype Path 2 in a spike branch if you have idle cycles — implement duck-typing validation for {value: T} shapes and see how invasive it actually is. Might reveal it's easier than feared.
Exception: Choose Path 1 immediately if...Alex Tov  [12:00 PM]
Just to be clear, the design above was meant for app mode

@Austin Mroz @Christian Byrne If we were to go with something like this for our current nodes, I could imagine this fitting into the prop panel, but probably not the node itself
Alex Tov  [12:40 PM]
@Jedrzej Kosinski You mentioned optional, is there a way to have these hidden until the user wants to interact with them as well? In the app mode design I have a right click option for "Adding" these min/max (and step would be here too).

I don't think it'd be a good experience if each input widget in litegraph had 3 extra rows underneath
image.png Jedrzej Kosinski  [12:45 PM]
To clarify, the conversation above was trying to add min max to ONLY the primitive nodes, as they can be used to give a sane experience when exposing values for workflow + subgraphs. All float/int widgets should NOT have this exposed to be configurable, that is the job of the node definitions
Alex Tov  [1:09 PM]
Sorry missed that. Gotcha, if it's just limited to primitive nodes, was there a concern with just listing these out individually? I know we previously were discussing this in one of the saturday brainstorming sessions. Been a while now, I don't remember the conclusion from that meeting

Could min/max/step_size be connected to from other primitives?
image.png Austin Mroz  [1:11 PM]
Since the primitive nodes are common, there was concern about increasing the size of the nodes.
Alex Tov  [1:11 PM]
In that case, last time we ideated on something like this, but there was a concern about this approach too
image.png Austin Mroz  [1:11 PM]
I don't remember the exact train of logic behind 'storing as node prop' instead of 'hidden widgets', though
Jedrzej Kosinski  [1:13 PM]
Maybe we just bite the bullet
[1:13 PM]And they become bigger
[1:14 PM]Or we make the widgets never visible outside the side panel
Alex Tov  [1:14 PM]
We're going to shift the size of Save Image nodes anyway due to the extended widgets we're adding in there like format, so we're already biting the bullet there
[1:15 PM]Or we make the widgets never visible outside the side panelI think this was the approach we mightve settled on last time? @Simon (pythongosssss) Do you happen to remember?
[1:19 PM]Why don't we go with the properties panel approach for the design for now? Get that out, and see if users want a more discoverable way to add constraints. If so, we can come back to a more discoverable design for this
Christian Byrne  [3:13 AM]
Linked widgets, hidden widgets, using node properties for widget instance props -- these are all pretty unmaintainable. We need a new foundation, we need to be able to scope widget instance props to the widget itself (and its serialized form). (edited)
