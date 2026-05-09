---
source_url: file://Frontend-Sprint-Planning-8057ee19-4703.md
type: meeting_transcript
date_accessed: 2026-04-14
relevance: 5
---

# Sprint Planning Meeting: ECS + Hook API Design Direction

## Summary

The frontend team (Jacob, Christian, Alex, Terry, Kaili, Simon) aligned on the need for an explicit public API for ComfyUI extensions, replacing monkey-patching with a formalized hook+ECS system. Jacob championed API-consumer-first design ("write the extension you want to write"), Christian proposed a Vue-inspired hook system wiring ECS query/mutation APIs into setup contexts, and the team agreed on parallel design tracks with a target of initial design by end of week.

## Evidence Table

| # | Finding | Speaker | Confidence | Key Quote |
|---|---------|---------|------------|-----------|
| 1 | ComfyUI does not have a real public API today | Jacob | high | "I don't think it's even rebuilt. I think we do not have a public API today." [17:12-17:16] |
| 2 | 0% of ICPs use ComfyUI without custom nodes | Jacob | high | "the number of our ICPs who use ComfyUI without custom nodes is 0. So if something works, if Comfy is unstable with custom nodes, that just means comfyUI is unstable." [48:04-48:07] |
| 3 | Hook system (Vue/React style) is superior to pure event bus — provides hoisted state, scheduling, composability | Christian | high | "event registry event bus callback system... insanely hard to type... can't have hoisted client state. The state becomes the problem of each individual consumer." [21:04-21:48] |
| 4 | Existing hooks should keep working with additive new params; deprecation period for monkey-patching | Christian | high | "you can just pass in, still pass in the same parameters and then just add more parameters and then do like the deprecation period" [38:51] |
| 5 | Widget registration should look like SFC; context kept alive across DOM moves | Christian | high | "the widget registration looked exactly like an SFC file and then the context is just like managed... kept alive during that transition" [27:10-28:45] |
| 6 | ECS "component as trigger" model enables declarative system watching | Alex | high | "if you do the component as trigger model you can say I want to execute, I have a system and I want the system to watch for this" [20:43] |
| 7 | Design from API-consumer perspective first, not from data organization | Jacob | high | "we need to start with the API... write the custom node or the extension that we want to write and look at what would I need" [49:11-49:42] |
| 8 | Auto-documentable API: public surface should be in specific location, auto-generate docs | Jacob | high | "our public interface should be designed in some specific location... and generate documentation for it" [51:34-52:06] |
| 9 | Chrome extension model is worth studying for explicit API surface | Jacob/Kaili | medium | "Chrome extension... there's an explicit API. You're not randomly hooking Chrome functions." [12:52-13:00] |
| 10 | Security/sandboxing is future concern, not designing for now | Jacob/Christian | medium | "I'm not saying we should try to solve it... it's at least worth thinking about" [01:01:29-01:02:20] |
| 11 | Subgraph bugs are the #1 motivator — formalizing the API makes subgraphs maintainable | Jacob | high | "sub graphs have been in for like eight months now and they are still barely usable" [31:10] |
| 12 | The existing ECS ADR covers technical design but NOT the public API surface for extensions | Jacob/Christian | high | "the part that I don't feel like this one covers... custom nodes would have no way to access this system" [47:16-47:37] |

## Decisions

1. **Design from API-consumer first** — Write the ideal extension code, then build the API to support it (Jacob, unanimous)
2. **Christian leads initial design draft** — Wire ECS APIs into existing hook setup contexts (Jacob assigned)
3. **Parallel exploratory track** — Get outside perspectives on ideal API shape alongside Christian's draft (Jacob)
4. **Auto-documentable public API** — Single location (`src/types/index.ts` barrel) that can generate docs (Jacob)
5. **Backward compatible migration** — Existing hooks keep working; new params added; deprecation period (Christian, Alex)
6. **Target timeline** — Initial design by Thursday/Friday, implementation start end of week/next week (Jacob)

## Requirements

### Functional
- Extensions can query ECS World state (read components)
- Extensions can mutate state through explicit APIs (commands, not monkey-patching)
- Widgets work without a node instance (app mode, subgraph promotion)
- Widget registration preserves context across DOM moves (graph↔app mode)
- Signal/reactivity system exposed to extensions (bound to Vue internals)
- Hooks still receive same lifecycle params + new ECS params

### Non-Functional
- Auto-documentable API surface
- Custom nodes should only need documented functions
- Stable across internal refactors (public API contract)
- Performance: no regression in render loop

## Constraints
- Backward compatibility required during migration period
- Cannot block existing custom node installations
- Security sandboxing deferred (not designing for now)
- AI should not design the API (Jacob: "AI not good at API design")

## Open Questions
1. How exactly does the hook setup context expose ECS APIs? (types TBD)
2. How do widgets register and work identically in node vs app mode?
3. Should future sandboxing (Chrome extension model) influence current design?
4. How do extensions that modify connection behavior (onLinkConnect/Disconnect) work under ECS?
5. What's the enforcement model for extensions using private APIs? (badge system discussed, not decided)

## Per-Person Positions
- **Jacob**: Product-first, API-consumer-first design. Explicit APIs like Chrome extensions. Auto-documentable.
- **Christian**: Vue-inspired hook+setup system. Wire ECS queries/mutations into setup context. Maintain existing hooks with additive params.
- **Alex**: ECS "component as trigger" model. Systems watch for components. Gradual phase-out, not hard cut.
- **Terry**: Concerned about community adoption. Wants to ensure real custom node patterns are supported. Prefers strong enforcement.
- **Kaili**: Agrees ECS structure stabilization is priority. Suggests Chrome extension API as model.
- **Simon**: Quiet in meeting, jokingly promised to critique proposals (quality gate role).
