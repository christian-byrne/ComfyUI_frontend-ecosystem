# Extension API Model Comparison: Browser + Editor Models → ComfyUI v2 Lessons

<!-- source: generated | task: S2-research | date: 2026-05-08 -->

> S2 research artifact. Covers Chrome MV3, Firefox WebExtensions, VS Code.
> Cross-refs: D6 (entry point), D9 (phase plan), D10 (lifecycle context).

---

## S2.A — Chrome Manifest V3

**Registration model:** Extensions declare all capabilities statically in `manifest.json` before any code runs. The manifest is parsed by the browser before any JS executes; permissions not declared are unavailable at runtime.

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "tabs"],
  "host_permissions": ["https://example.com/*"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"] }]
}
```

**Lifecycle scoping:** Two distinct execution contexts — *background service worker* (event-driven, short-lived, no DOM) and *content scripts* (injected into page, short DOM lifetime). They cannot share memory; all communication is message passing (`chrome.runtime.sendMessage`). Neither can call the other's APIs directly.

**Capability boundaries:** `chrome.*` APIs are gated by `permissions`. Calling `chrome.tabs` without declaring `"tabs"` in permissions throws a runtime error. No way to access an API surface without explicit declaration.

**Cleanup:** Service workers are terminated when idle; event listeners registered via `chrome.runtime.onMessage.addListener` are implicitly scoped to the service worker lifetime. Content scripts are torn down when the tab navigates. No explicit `dispose()` call — lifetime is managed by the browser, not the extension.

**Versioning:** `manifest_version` (currently 3) is a hard compatibility gate. MV2 extensions still work in some browsers; MV3 is the migration target. No semver; breaking changes are gated by manifest version increment.

---

## S2.B — Firefox WebExtensions

Firefox implements the same WebExtensions standard with two notable differences:

1. **`browser` namespace, not `chrome`.** Firefox uses promise-based `browser.*` APIs natively; Chrome uses callbacks. The WebExtension polyfill (`webextensions-polyfill`) normalizes this: `browser.tabs.query(...)` returns a Promise in both.

2. **No service worker requirement.** Firefox MV3 supports persistent background pages as a compatibility option; Chrome MV3 does not. This means Firefox extensions can maintain longer-lived state in background without the service worker eviction/restart cycle.

**Design-relevant difference:** Firefox's promise-native API is the "clean" version of Chrome's callback-first API. For ComfyUI: our event handlers are already async-aware (D5 `beforeSerialize` is async), so we're already closer to Firefox's model than Chrome's.

Neither model changes the key structural lesson: capabilities are declared, not discovered at runtime.

---

## S2.C — VS Code Extension API (most analogous)

VS Code is the closest model to ComfyUI's problem: a TypeScript host with a stable public API, a dynamic extension ecosystem, and a typed extension context.

### `activate(context: vscode.ExtensionContext)`

Every VS Code extension exports a single `activate` function called once at load time:

```ts
export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('myExt.hello', () => {
    vscode.window.showInformationMessage('Hello!')
  })
  context.subscriptions.push(disposable)
}

export function deactivate(): void {
  // optional; context.subscriptions are auto-disposed
}
```

**The `Disposable` pattern.** Every API that registers a handler returns a `Disposable`. Extensions push disposables into `context.subscriptions`; VS Code disposes all of them on extension deactivation. Extensions that forget to push a disposable leak handlers.

```ts
interface Disposable {
  dispose(): void
}
interface ExtensionContext {
  subscriptions: { push(...items: Disposable[]): void }
  globalState: Memento
  workspaceState: Memento
  extensionUri: Uri
  // ... storage paths, secrets, etc.
}
```

**Capability declaration via `package.json` `contributes`.** Like Chrome's manifest, VS Code extensions declare their contributions statically:

```json
{
  "contributes": {
    "commands": [{ "command": "myExt.hello", "title": "Hello" }],
    "configuration": { "properties": { "myExt.enabled": { "type": "boolean" } } },
    "languages": [{ "id": "myLang", "extensions": [".ml"] }]
  }
}
```

The runtime won't surface the command in the palette unless it's declared. Activation events (`"activationEvents": ["onCommand:myExt.hello"]`) gate when `activate()` is called.

**Versioning via `engines.vscode`.** Extensions declare `"engines": { "vscode": "^1.70.0" }`. VS Code enforces this; extensions targeting newer APIs won't load on older hosts.

---

## Comparison Table

| Dimension | Chrome MV3 | Firefox WebExtensions | VS Code | ComfyUI v2 (current) |
|---|---|---|---|---|
| **Capability declaration** | `manifest.json` permissions (static, pre-load) | Same | `package.json` contributes (static) | None today — anything goes; no declaration surface |
| **Entry point** | `background.js` module load | Same | `activate(context)` function export | `defineExtension({ setup(ctx) })` (D6) |
| **Lifecycle hooks** | `chrome.runtime.onInstalled`, `onStartup` | Same + `browser.runtime.onConnect` | `activate` / `deactivate` | `nodeCreated`, `onNodeMounted`, `onNodeRemoved` (D10) |
| **Cleanup model** | Browser-managed (service worker eviction, tab close) | Same | `context.subscriptions` disposables + optional `deactivate()` | `NodeInstanceScope.dispose()` + `scope.stop()` (I-SR.2) |
| **Context parameter** | Implicit globals (`chrome.*`) | Implicit (`browser.*`) | **Explicit `ctx`** (no global) | **Explicit `ctx`** (D10 decision (i)) |
| **Permission/surface boundaries** | Hard — undeclared APIs unavailable | Same | Soft — `contributes` is UI, not enforcement | None today |
| **Versioning** | `manifest_version` hard gate | Same + compatibility flags | `engines.vscode` semver range | `apiVersion` field in ExtensionOptions (I-EXT.3); sunset gated on telemetry (D6 Part 2) |
| **Isolation between extensions** | Full process isolation | Same | Weak — shared Node.js process, can interfere | None today — extensions share the same LiteGraph prototype chain |

---

## Design Principles for ComfyUI v2

### P1 — Explicit ctx, no globals (already adopted — D10 decision (i))

VS Code chose explicit `context` parameter over implicit globals (`this.context`, `currentExtension`). Our D10 chose the same: `ctx` is passed to `setup(ctx)`, not read from a module-level global. Both VS Code and our design avoid the React-hooks-style "must be called at top level" rules that a global current-extension pointer would require.

**Where we diverge:** VS Code passes `context` to `activate` once per extension lifetime. We pass `ctx` to `setup` once per *node instance* (one scope per `node.id`). This is the right model for our problem — extensions react to per-node lifecycle, not per-load lifecycle.

### P2 — Subscriptions = disposables (matches our scope.stop pattern)

VS Code's `context.subscriptions.push(disposable)` is structurally identical to our `NodeInstanceScope`'s `onDispose` array. When a node is removed, `scope.stop()` is called, which runs all registered cleanup functions — exactly what `context.subscriptions` does on `deactivate`. Our implementation (`extension-api-service.ts:522`) is sound.

**Gap VS Code plugged that we haven't:** VS Code warns at dev time if an event listener is not disposed (via lint rules / runtime tracking). We have no equivalent. A `console.warn` when a `NodeInstanceScope` is GC'd with uncleared handlers would catch extension memory leaks.

### P3 — Capability declaration gates surface access (not yet adopted)

Chrome and VS Code both require extensions to *declare* what they use before they can use it. We don't. Today, a v1 extension can reach into any prototype. The v2 API partially addresses this — `defineNodeExtension` scopes what you can *see* via the `ctx` parameter. But nothing prevents an extension from importing `LGraphNode` directly and patching.

**Implication:** Phase C strangler (D9) is where this gap gets closed — extensions can only access what's on the handle, not the raw LGraphNode underneath. The declarative surface is `defineNodeExtension({ nodeTypes: ['KSampler'] })` — that's the MV3 `permissions` equivalent for which node types an extension may observe. We should treat `nodeTypes` filtering as a future enforcement surface, not just a performance hint.

### P4 — Two execution contexts, not one (already matches our Phase A/B split)

Chrome separates background (long-lived, no DOM) from content script (DOM-scoped, page lifetime). VS Code separates extension host (background, long-lived) from webview (DOM-scoped, disposable). Our D9 Phase A/B split is analogous: Phase A is the setup/teardown lifecycle scope (background — survives graph loads), Phase B wires to the ECS World (the actual event-firing substrate). Don't conflate them.

### P5 — Versioning as a gate, not a hint (partially adopted)

VS Code's `engines.vscode` is enforced at load time. Chrome's `manifest_version` is a hard gate. Our `apiVersion` field (I-EXT.3) is currently advisory. D6 Part 2 gates v1 removal on telemetry + <5% usage threshold — that's the right approach, but `apiVersion` needs to be *read* by the runtime, not just recorded. The v1/v2 phase transition (Phase B deprecation warnings, Phase D removal) is our versioning gate.

---

## Cross-References

| Decision | Alignment |
|---|---|
| **D6 Part 1** — module-level `defineExtension`, no `window.app` at registration | Matches VS Code `activate(context)` — entry point is a function, not a method call on a global |
| **D6 Part 2** — 4-phase sunset gated on telemetry + <5% usage | Analogous to Chrome's MV2→MV3 transition timeline; never remove before measurement |
| **D9 Phase A/B/C** | A = VS Code "extension host" layer (pure API surface), B = content-script layer (actual DOM/ECS wiring), C = legacy strangler (no equivalent in browser model, but VS Code has deprecated-API shims) |
| **D10 decision (i)** — `currentExtension` global (Vue-style) over explicit ctx | Intentional divergence from VS Code's explicit-ctx model; justified by Vue convention + rules-of-hooks-free ergonomics; but VS Code's explicit-ctx is the safer bet for testability |
