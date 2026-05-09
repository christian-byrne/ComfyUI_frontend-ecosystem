# P1 — ComfyExtension v2: Full API Proposal

## Types

```ts
// ─── Entity IDs ───────────────────────────────────────────
type NodeEntityId = number & { readonly __brand: 'NodeEntityId' }
type WidgetEntityId = number & { readonly __brand: 'WidgetEntityId' }
type SlotEntityId = number & { readonly __brand: 'SlotEntityId' }
type LinkEntityId = number & { readonly __brand: 'LinkEntityId' }

// ─── Geometry ─────────────────────────────────────────────
type Point = [number, number]
type Size = [number, number]

// ─── Enums ────────────────────────────────────────────────
type NodeMode = 'always' | 'never' | 'bypass' | 'mute'
type SlotDirection = 'input' | 'output'

// ─── Slot Info ────────────────────────────────────────────
interface SlotInfo {
  readonly entityId: SlotEntityId
  readonly name: string
  readonly type: string
  readonly direction: SlotDirection
  readonly nodeEntityId: NodeEntityId
}

// ─── Widget Options ───────────────────────────────────────
interface WidgetOptions {
  readonly?: boolean
  multiline?: boolean
  hidden?: boolean
  serialize?: boolean
  [key: string]: unknown
}

// ─── NodeHandle ───────────────────────────────────────────
interface NodeHandle {
  readonly entityId: NodeEntityId
  readonly type: string
  readonly comfyClass: string

  // Reads
  getPosition(): Point
  getSize(): Size
  getTitle(): string
  getMode(): NodeMode
  getProperty(key: string): unknown
  getProperties(): Record<string, unknown>
  isSelected(): boolean

  // Writes (dispatch commands internally)
  setPosition(pos: Point): void
  setSize(size: Size): void
  setTitle(title: string): void
  setMode(mode: NodeMode): void
  setProperty(key: string, value: unknown): void

  // Widgets
  widget(name: string): WidgetHandle | undefined
  widgets(): readonly WidgetHandle[]
  addWidget(
    type: string,
    name: string,
    defaultValue: unknown,
    options?: Partial<WidgetOptions>
  ): WidgetHandle

  // Slots
  inputs(): readonly SlotInfo[]
  outputs(): readonly SlotInfo[]

  // Events
  on(event: 'removed', fn: () => void): void
  on(event: 'executed', fn: (output: Record<string, unknown>) => void): void
  on(event: 'configured', fn: () => void): void
  on(event: 'connected', fn: (slot: SlotInfo, remote: SlotInfo) => void): void
  on(event: 'disconnected', fn: (slot: SlotInfo) => void): void
  on(event: 'positionChanged', fn: (pos: Point) => void): void
  on(event: 'sizeChanged', fn: (size: Size) => void): void
  on(event: 'modeChanged', fn: (mode: NodeMode) => void): void
}

// ─── WidgetHandle ─────────────────────────────────────────
interface WidgetHandle {
  readonly entityId: WidgetEntityId
  readonly name: string
  readonly widgetType: string

  // Model value (single source of truth across all views)
  getValue<T = unknown>(): T
  setValue(value: unknown): void

  // State
  isHidden(): boolean
  setHidden(hidden: boolean): void
  getOptions(): WidgetOptions
  setOption(key: string, value: unknown): void

  // Events
  on(event: 'change', fn: (value: unknown, oldValue: unknown) => void): void
  on(event: 'removed', fn: () => void): void

  // Serialization override
  setSerializeValue(
    fn: (workflowNode: unknown, widgetIndex: number) => unknown
  ): void
}

// ─── Extension Registration ───────────────────────────────
interface NodeExtensionOptions {
  name: string
  nodeTypes?: string[]  // Filter to specific comfyClass names. Omit = all nodes.

  nodeCreated?(node: NodeHandle): void
  loadedGraphNode?(node: NodeHandle): void
}

interface WidgetExtensionOptions {
  name: string
  type: string  // Widget type string (e.g., 'MY_SLIDER')

  widgetCreated?(widget: WidgetHandle, parentNode: NodeHandle | null): {
    render(container: HTMLElement): void
    destroy?(): void
  } | void
}

interface ExtensionOptions {
  name: string

  // Global lifecycle (no ECS, runs once at app startup)
  init?(): void | Promise<void>
  setup?(): void | Promise<void>

  // Declarative registrations (same as current API)
  commands?: ComfyCommand[]
  keybindings?: Keybinding[]
  menuCommands?: MenuCommandGroup[]
  settings?: SettingParams[]
  bottomPanelTabs?: BottomPanelExtension[]

  // Graph-level events
  beforeConfigureGraph?(graphData: ComfyWorkflowJSON): void | Promise<void>
  afterConfigureGraph?(): void | Promise<void>

  // Auth events (same as current API)
  onAuthUserResolved?(user: AuthUserInfo): void | Promise<void>
  onAuthTokenRefreshed?(): void | Promise<void>
  onAuthUserLogout?(): void | Promise<void>
}

// ─── Public API Functions ─────────────────────────────────
declare function defineExtension(options: ExtensionOptions): void
declare function defineNodeExtension(options: NodeExtensionOptions): void
declare function defineWidgetExtension(options: WidgetExtensionOptions): void
```

---

## Examples

### 1. Minimal: Set node size on creation (ImageCrop)

```ts
defineNodeExtension({
  name: 'Comfy.ImageCrop',
  nodeTypes: ['ImageCropV2'],

  nodeCreated(node) {
    const [w, h] = node.getSize()
    node.setSize([Math.max(w, 300), Math.max(h, 450)])
  }
})
```

### 2. Widgets + execution results (PreviewAny)

```ts
defineNodeExtension({
  name: 'Comfy.PreviewAny',
  nodeTypes: ['PreviewAny'],

  nodeCreated(node) {
    const markdown = node.addWidget('MARKDOWN', 'preview_markdown', '', {
      hidden: true, readonly: true, serialize: false
    })
    const plaintext = node.addWidget('STRING', 'preview_text', '', {
      multiline: true, readonly: true, serialize: false
    })
    const toggle = node.addWidget('BOOLEAN', 'previewMode', false, {
      labelOn: 'Markdown', labelOff: 'Plaintext'
    })

    toggle.on('change', (value) => {
      markdown.setHidden(!value)
      plaintext.setHidden(value as boolean)
    })

    node.on('executed', (output) => {
      const text = output.text ?? ''
      const content = Array.isArray(text) ? text.join('\n\n') : text
      markdown.setValue(content)
      plaintext.setValue(content)
    })
  }
})
```

### 3. Serialization override (DynamicPrompts)

```ts
defineNodeExtension({
  name: 'Comfy.DynamicPrompts',

  nodeCreated(node) {
    for (const widget of node.widgets()) {
      if (widget.getOptions().dynamicPrompts) {
        widget.setSerializeValue((_workflowNode, _widgetIndex) => {
          const value = widget.getValue<string>()
          return typeof value === 'string' ? processDynamicPrompt(value) : value
        })
      }
    }
  }
})
```

### 4. React to connections

```ts
defineNodeExtension({
  name: 'Comfy.AutoTitle',
  nodeTypes: ['Reroute'],

  nodeCreated(node) {
    node.on('connected', (slot, remote) => {
      node.setTitle(remote.type)
    })
    node.on('disconnected', () => {
      node.setTitle('Reroute')
    })
  }
})
```

### 5. Custom widget type

```ts
defineWidgetExtension({
  name: 'Comfy.ColorPicker',
  type: 'COLOR',

  widgetCreated(widget, parentNode) {
    return {
      render(container) {
        const input = document.createElement('input')
        input.type = 'color'
        input.value = String(widget.getValue() ?? '#000000')

        input.addEventListener('input', () => {
          widget.setValue(input.value)
        })

        widget.on('change', (value) => {
          input.value = String(value)
        })

        container.appendChild(input)
      },
      destroy() {
        // Optional explicit cleanup (scope handles most cases)
      }
    }
  }
})
```

### 6. Global extension (settings, commands, no per-node hooks)

```ts
defineExtension({
  name: 'Comfy.MyTheme',
  settings: [
    { id: 'my.theme', name: 'Dark Mode', type: 'boolean', defaultValue: true }
  ],
  commands: [
    { id: 'my.toggleTheme', label: 'Toggle Theme', function: () => { ... } }
  ],
  keybindings: [
    { commandId: 'my.toggleTheme', combo: { key: 't', ctrl: true } }
  ]
})
```

### 7. Widget value shared across views (properties panel + node)

```ts
// No special API needed. widget.getValue()/setValue() and widget.on('change')
// are automatically shared across all views of the same WidgetEntityId.
// The framework handles the mirroring.

defineNodeExtension({
  name: 'Comfy.SeedLogger',
  nodeTypes: ['KSampler'],

  nodeCreated(node) {
    const seed = node.widget('seed')
    if (!seed) return

    // This fires whether the user changes the value on the node,
    // in the properties panel, or via a promoted widget in a parent subgraph.
    seed.on('change', (value) => {
      console.log('seed changed to', value, 'from any source')
    })
  }
})
```
