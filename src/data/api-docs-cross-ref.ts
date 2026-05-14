/**
 * API docs → pattern/behavior cross-reference mapping.
 *
 * Maps API doc slugs to the v1 patterns they replace/relate to,
 * enabling "blast radius" and "affected repos" display on doc pages.
 */

import rollupData from "./touch-points-rollup.json";
import categoriesData from "./behavior-categories.json";

export interface PatternInfo {
  pattern_id: string;
  name: string;
  blast_radius: number;
  occurrences: number;
  cumulative_stars: number;
  top_repos: { repo: string; stars: number }[];
}

export interface CategoryInfo {
  category_id: string;
  name: string;
  intent: string;
  usage_weight: number;
  member_pattern_ids: string[];
}

export interface CrossRefData {
  /** Related v1 patterns this API replaces/improves */
  patterns: PatternInfo[];
  /** Behavior categories this API covers */
  categories: CategoryInfo[];
  /** Migration note shown to users */
  migrationNote?: string;
}

/**
 * Map API doc slug → related pattern IDs + behavior category IDs.
 *
 * Structure:
 * - patterns: v1 patterns this v2 API replaces
 * - categories: BC.* behavior categories covered
 * - note: migration context
 */
const CROSS_REF_MAP: Record<string, {
  patterns: string[];
  categories: string[];
  note?: string;
}> = {
  // Lifecycle hooks
  onnodemounted: {
    patterns: ["S2.N1", "S2.N8"],
    categories: ["BC.01"],
    note: "Replaces nodeType.prototype.onNodeCreated patching. Call inside nodeCreated/loadedGraphNode."
  },
  onnoderemoved: {
    patterns: ["S2.N4"],
    categories: ["BC.02"],
    note: "Replaces nodeType.prototype.onRemoved patching for cleanup."
  },

  // Node handle and events
  nodehandle: {
    patterns: ["S2.N1", "S2.N2", "S2.N3", "S2.N4", "S2.N5", "S10.D1", "S10.D3"],
    categories: ["BC.01", "BC.02", "BC.04", "BC.09"],
    note: "Unified node access surface. Replaces direct LGraphNode property access and prototype patching."
  },
  nodeexecutedevent: {
    patterns: ["S2.N2"],
    categories: ["BC.04"],
    note: "Type-safe executed event payload. Replaces onExecuted prototype patching."
  },
  nodeconnectedevent: {
    patterns: ["S2.N3", "S2.N12", "S2.N13"],
    categories: ["BC.07"],
    note: "Connection event with typed slot info. Replaces onConnectionsChange/onConnectInput/onConnectOutput."
  },
  nodedisconnectedevent: {
    patterns: ["S2.N3"],
    categories: ["BC.07"],
  },
  nodemodechangedevent: {
    patterns: ["S2.N17"],
    categories: ["BC.04"],
  },
  nodepositionchangedevent: {
    patterns: ["S10.D3"],
    categories: ["BC.09"],
  },
  nodesizechangedevent: {
    patterns: ["S2.N19", "S10.D3"],
    categories: ["BC.09"],
    note: "Replaces onResize patching and setSize/computeSize calls."
  },

  // Widget handle and events
  widgethandle: {
    patterns: ["S4.W1", "S4.W2", "S4.W3", "S4.W4", "S4.W5", "S2.N16"],
    categories: ["BC.10", "BC.11", "BC.12"],
    note: "Unified widget access. Replaces direct widget array manipulation and callback assignment."
  },
  widgetvaluechangeevent: {
    patterns: ["S4.W5", "S4.W1"],
    categories: ["BC.10"],
    note: "Typed value change event. Replaces widget.callback chaining."
  },
  widgetbeforequeueevent: {
    patterns: ["S6.A5"],
    categories: ["BC.35"],
    note: "Pre-queue validation hook. New v2 pattern for widget-level validation."
  },
  widgetbeforeserializeevent: {
    patterns: ["S4.W3"],
    categories: ["BC.12"],
    note: "Replaces widget.serializeValue assignment."
  },
  widgetoptions: {
    patterns: ["S4.W4"],
    categories: ["BC.11"],
    note: "Type-safe widget options. Replaces widget.options.values mutation."
  },
  widgetoptionchangeevent: {
    patterns: ["S4.W4"],
    categories: ["BC.11"],
  },
  widgetpropertychangeevent: {
    patterns: ["S2.N14"],
    categories: ["BC.10"],
    note: "Replaces onWidgetChanged prototype patching."
  },
  domwidgetoptions: {
    patterns: ["S4.W2"],
    categories: ["BC.12"],
    note: "Options for addDOMWidget. Type-safe replacement for direct DOM widget creation."
  },

  // Extension entry points
  defineextension: {
    patterns: ["S1.H6", "S12.UI1"],
    categories: ["BC.20", "BC.26"],
    note: "App-scoped extension registration. Replaces manual app.registerExtension calls."
  },
  definenode: {
    patterns: ["S2.N1", "S1.H6"],
    categories: ["BC.01", "BC.20"],
    note: "Node-scoped extension registration. Replaces nodeType.prototype patching pattern."
  },
  definewidget: {
    patterns: ["S1.H2", "S4.W2"],
    categories: ["BC.21", "BC.12"],
    note: "Custom widget type registration. Replaces getCustomWidgets hook."
  },

  // Extension options
  extensionoptions: {
    patterns: ["S1.H6", "S12.UI1"],
    categories: ["BC.20", "BC.26"],
  },
  nodeextensionoptions: {
    patterns: ["S2.N1", "S2.N7"],
    categories: ["BC.01", "BC.03"],
    note: "Node extension config with lifecycle hooks. Covers creation, hydration, and teardown."
  },
  widgetextensionoptions: {
    patterns: ["S1.H2"],
    categories: ["BC.21"],
  },

  // Shell UI
  extensionmanager: {
    patterns: ["S12.UI1"],
    categories: ["BC.26"],
    note: "Shell UI registration API. Replaces direct manager access."
  },
  commandmanager: {
    patterns: ["S12.UI1"],
    categories: ["BC.26"],
  },
  sidebartabextension: {
    patterns: ["S12.UI1"],
    categories: ["BC.26"],
  },
  bottompanelextension: {
    patterns: ["S12.UI1"],
    categories: ["BC.26"],
  },

  // Identity helpers
  nodelocatorid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
    note: "Cross-subgraph node identification. Replaces manual ID construction."
  },
  nodeexecutionid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
    note: "Execution-time node identification from websocket frames."
  },
  createnodelocatorid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
  },
  createnodeexecutionid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
  },
  isnodelocatorid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
  },
  isnodeexecutionid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
  },

  // Slots
  slotinfo: {
    patterns: ["S10.D1", "S9.S1"],
    categories: ["BC.09"],
    note: "Read-only slot snapshot. Replaces direct slot property access."
  },

  // Serialization (deprecated)
  nodebeforeserializeevent: {
    patterns: ["S2.N6", "S2.N15"],
    categories: ["BC.08"],
    note: "DEPRECATED. Migrate to widget.on('beforeSerialize') or ctx.on('beforePrompt')."
  },

  // Handlers
  handler: {
    patterns: ["S5.A1", "S5.A2", "S5.A3"],
    categories: ["BC.23"],
    note: "Typed event handler. Used across all on() subscriptions."
  },
  asynchandler: {
    patterns: ["S4.W3"],
    categories: ["BC.12"],
    note: "Async handler for beforeSerialize. Supports async widget serialization."
  },

  // Node mode enum
  nodemode: {
    patterns: ["S2.N17"],
    categories: ["BC.04"],
    note: "String-based node execution mode. Maps to LGraphEventMode enum values."
  },

  // Identity parsing helpers
  parsenodeexecutionid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
    note: "Parse NodeExecutionId into component node IDs for execution-time resolution."
  },
  parsenodelocatorid: {
    patterns: ["S14.ID1"],
    categories: ["BC.29"],
    note: "Parse NodeLocatorId into subgraph UUID and local node ID."
  },

  // Geometry primitives
  point: {
    patterns: ["S10.D3"],
    categories: ["BC.09"],
    note: "2D point tuple. Used for node positioning and slot coordinates."
  },
  size: {
    patterns: ["S10.D3", "S2.N19"],
    categories: ["BC.09", "BC.04"],
    note: "2D size tuple. Used for node dimensions and resize events."
  },

  // Slot types
  slotdirection: {
    patterns: ["S10.D1", "S9.S1"],
    categories: ["BC.09", "BC.27"],
    note: "Input/output direction discriminator for slot operations."
  },

  // Toast UI
  toastmanager: {
    patterns: ["S12.UI1"],
    categories: ["BC.25", "BC.26"],
    note: "Shell UI toast notification manager. Add/remove toast messages."
  },
  toastmessageoptions: {
    patterns: ["S12.UI1"],
    categories: ["BC.25"],
    note: "Toast message configuration including severity, lifecycle, and styling."
  },

  // Event subscription cleanup
  unsubscribe: {
    patterns: ["S5.A1", "S5.A2", "S5.A3"],
    categories: ["BC.17"],
    note: "Cleanup function returned by on() subscriptions. Call to remove listener."
  },

  // Widget value type
  widgetvalue: {
    patterns: ["S4.W1", "S4.W5"],
    categories: ["BC.10", "BC.11"],
    note: "Union of legal widget scalar values. Complex widgets may return custom shapes."
  },
};

// Build lookup maps from rollup data
const patternById = new Map<string, PatternInfo>();
for (const p of (rollupData as { patterns: PatternInfo[] }).patterns) {
  patternById.set(p.pattern_id, p);
}

const categoryById = new Map<string, CategoryInfo>();
for (const c of (categoriesData as { categories: CategoryInfo[] }).categories) {
  categoryById.set(c.category_id, c);
}

/**
 * Get cross-reference data for an API doc slug.
 */
export function getCrossRef(slug: string): CrossRefData | null {
  const ref = CROSS_REF_MAP[slug.toLowerCase()];
  if (!ref) return null;

  const patterns: PatternInfo[] = [];
  for (const pid of ref.patterns) {
    const p = patternById.get(pid);
    if (p) patterns.push(p);
  }

  const categories: CategoryInfo[] = [];
  for (const cid of ref.categories) {
    const c = categoryById.get(cid);
    if (c) categories.push(c);
  }

  if (patterns.length === 0 && categories.length === 0) return null;

  return {
    patterns,
    categories,
    migrationNote: ref.note,
  };
}

/**
 * Get total blast radius across all related patterns.
 */
export function getTotalBlastRadius(data: CrossRefData): number {
  return data.patterns.reduce((sum, p) => sum + p.blast_radius, 0);
}

/**
 * Get unique affected repos across all patterns.
 */
export function getAffectedRepos(data: CrossRefData): { repo: string; stars: number }[] {
  const seen = new Set<string>();
  const repos: { repo: string; stars: number }[] = [];

  for (const p of data.patterns) {
    for (const r of p.top_repos.slice(0, 3)) {
      if (!seen.has(r.repo)) {
        seen.add(r.repo);
        repos.push(r);
      }
    }
  }

  return repos.sort((a, b) => b.stars - a.stars).slice(0, 5);
}

/**
 * Get blast radius color (green → yellow → red)
 */
export function getBlastRadiusColor(radius: number): string {
  if (radius < 3) return "text-green-600 dark:text-green-400";
  if (radius < 5) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function getBlastRadiusBg(radius: number): string {
  if (radius < 3) return "bg-green-100 dark:bg-green-900/30";
  if (radius < 5) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}
