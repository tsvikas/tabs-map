# Phase 2 Design Document: Read-Only Tree Display

## Overview

Implementation plan for displaying tabs in a hierarchical tree. See `requirements-phase2.md` for what we're building; this document covers how.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SIDEBAR (Svelte)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  TreeView.svelte                                        │ │
│  │    └─> TreeItem.svelte (recursive)                     │ │
│  │          - WindowNode                                   │ │
│  │          - PinnedTabsNode                               │ │
│  │          - TabNode                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                         ↕ (port connection)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  tree-store.ts                                          │ │
│  │    - Manages port to background                         │ │
│  │    - Receives TreeState updates                         │ │
│  │    - Sends commands (FOCUS_TAB)                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↕ (runtime.Port)
┌─────────────────────────────────────────────────────────────┐
│              BACKGROUND (Service Worker)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  index.ts (Coordinator)                                 │ │
│  │    - Initializes TabTracker & TreeManager               │ │
│  │    - Manages port connections                           │ │
│  │    - Broadcasts TreeState updates                       │ │
│  │    - Handles commands from sidebar                      │ │
│  └────────────────────────────────────────────────────────┘ │
│             ↕                                    ↕            │
│  ┌──────────────────────┐          ┌──────────────────────┐ │
│  │  TabTracker          │          │  TreeManager         │ │
│  │  - Wraps browser API │          │  - Maintains tree    │ │
│  │  - Normalizes events │          │  - Parent assignment │ │
│  │  - Filters hidden    │          │  - Order invariant   │ │
│  └──────────────────────┘          └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────┐
│              BROWSER APIs                                    │
│  browser.tabs.*    browser.windows.*                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Tree Nodes (TypeScript)

**Base interface:**
```typescript
interface BaseTreeNode {
  id: string;              // Generated via NodeId helpers
  type: 'window' | 'pinned-tabs' | 'tab';
  childIds: string[];      // Ordered array of child node IDs
  parentId: string | null; // Parent node ID (null for root)
}
```

**WindowNode:**
```typescript
interface WindowNode extends BaseTreeNode {
  type: 'window';
  windowId: number;        // Browser's window ID
  focused: boolean;
  incognito: boolean;
  title: string;
}
```

**PinnedTabsNode:**
```typescript
interface PinnedTabsNode extends BaseTreeNode {
  type: 'pinned-tabs';
  windowId: number;        // Parent window's ID
}
```

**TabNode:**
```typescript
interface TabNode extends BaseTreeNode {
  type: 'tab';
  tabId: number;           // Browser's tab ID
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string | undefined;
  pinned: boolean;
  active: boolean;
  status: 'loading' | 'complete';
  index: number;           // Browser's index position
}
```

**NodeId Helpers:**
```typescript
const NodeId = {
  window: (windowId: number) => `window-${windowId}`,
  pinnedTabs: (windowId: number) => `pinned-${windowId}`,
  tab: (tabId: number) => `tab-${tabId}`,
}
```

### TreeState (Serializable)

```typescript
interface TreeState {
  nodes: Record<string, TreeNode>;  // Map of all nodes
  rootIds: string[];                // Window node IDs in order
  focusedWindowId: number | null;
  activeTabId: number | null;
}
```

### Messages

**Sidebar → Background:**
```typescript
type SidebarMessage =
  | { type: 'GET_TREE_STATE' }
  | { type: 'FOCUS_TAB'; tabId: number }
```

**Background → Sidebar:**
```typescript
type BackgroundMessage =
  | { type: 'TREE_STATE'; state: TreeState }      // Initial state
  | { type: 'TREE_UPDATE'; state: TreeState }     // Updates
```

---

## Component Responsibilities

### Background: TabTracker (`tab-tracker.ts`)

**Purpose:** Wrap browser API and emit normalized events.

**Key Methods:**
```typescript
class TabTracker {
  initialize(): void
  getAllWindows(): Promise<TrackedWindow[]>
  getAllTabs(): Promise<TrackedTab[]>
  getTab(tabId): Promise<TrackedTab | null>
  subscribe(listener: TabTrackerListener): () => void
}
```

**Events Emitted:**
```typescript
type TabTrackerEvent =
  | { type: 'TAB_CREATED'; tab: TrackedTab }
  | { type: 'TAB_REMOVED'; tabId: number; windowId: number }
  | { type: 'TAB_UPDATED'; tab: TrackedTab; changedProps: string[] }
  | { type: 'TAB_MOVED'; tabId, windowId, fromIndex, toIndex }
  | { type: 'TAB_ATTACHED'; tabId, newWindowId, newIndex }
  | { type: 'TAB_DETACHED'; tabId, oldWindowId, oldIndex }
  | { type: 'TAB_ACTIVATED'; tabId, windowId, previousTabId }
  | { type: 'WINDOW_CREATED'; window: TrackedWindow }
  | { type: 'WINDOW_REMOVED'; windowId: number }
  | { type: 'WINDOW_FOCUS_CHANGED'; windowId: number }
```

**Implementation Notes:**
- Filter `tab.hidden` tabs (Firefox internal pages)
- Normalize undefined fields (e.g., `tab.title || 'Loading...'`)
- Only emit relevant updates (title/url/favicon/pinned/status changes)

### Background: TreeManager (`tree-manager.ts`)

**Purpose:** Maintain authoritative tree state.

**Key Methods:**
```typescript
class TreeManager {
  constructor(tabTracker: TabTracker)

  initialize(): Promise<void>
  getState(): TreeState
  subscribe(listener: TreeChangeListener): () => void

  // Event handlers (private)
  private handleTabCreated(tab)
  private handleTabRemoved(tabId)
  private handleTabMoved(tabId, toIndex)
  private handleTabAttached(tabId, newWindowId, newIndex)
  private handleTabDetached(tabId)
  private handleTabUpdated(tab)
  private handleTabActivated(tabId, previousTabId)
  private handleWindowCreated(window)
  private handleWindowRemoved(windowId)
  private handleWindowFocusChanged(windowId)
}
```

**Internal State:**
```typescript
private nodes: Map<string, TreeNode>
private rootIds: string[]
private focusedWindowId: number | null
private activeTabId: number | null
private tabOpeners: Map<number, number>  // tabId → openerTabId
private listeners: Set<TreeChangeListener>
```

**Helper Methods:**
```typescript
private addWindow(window)
private addPinnedTabsNode(windowId)
private addTabNode(tab, parentId): nodeId
private removeFromParent(nodeId)
private removeNodeAndDescendants(nodeId)
private cleanupPinnedTabsNode(windowId)
private promoteChildrenToWindow(node)
private reorderTabInParent(tabId, targetIndex)
private reassignParentByPosition(node)
private notifyChange()
```

### Background: index.ts

**Purpose:** Initialize and coordinate.

```typescript
export default defineBackground(async () => {
  const tabTracker = new TabTracker()
  const treeManager = new TreeManager(tabTracker)

  tabTracker.initialize()
  await treeManager.initialize()

  const connectedPorts: Set<browser.runtime.Port> = new Set()

  // Subscribe to tree changes → broadcast to all ports
  treeManager.subscribe((state) => {
    for (const port of connectedPorts) {
      port.postMessage({ type: 'TREE_UPDATE', state })
    }
  })

  // Handle port connections
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sidebar') return

    connectedPorts.add(port)

    // Send initial state
    port.postMessage({ type: 'TREE_STATE', state: treeManager.getState() })

    port.onDisconnect.addListener(() => {
      connectedPorts.delete(port)
    })

    port.onMessage.addListener(async (message: SidebarMessage) => {
      if (message.type === 'FOCUS_TAB') {
        const tab = await browser.tabs.get(message.tabId)
        await browser.tabs.update(message.tabId, { active: true })
        await browser.windows.update(tab.windowId, { focused: true })
      }
    })
  })
})
```

### Sidebar: tree-store.ts

**Purpose:** Manage connection to background.

```typescript
export function createTreeStore() {
  let state = $state<TreeState | null>(null)
  let connected = $state(false)
  let port: browser.runtime.Port | null = null

  function connect() {
    port = browser.runtime.connect({ name: 'sidebar' })
    connected = true

    port.onMessage.addListener((message: BackgroundMessage) => {
      if (message.type === 'TREE_STATE' || message.type === 'TREE_UPDATE') {
        state = message.state
      }
    })

    port.onDisconnect.addListener(() => {
      port = null
      connected = false
      state = null
    })
  }

  function disconnect() {
    port?.disconnect()
  }

  function focusTab(tabId: number) {
    port?.postMessage({ type: 'FOCUS_TAB', tabId })
  }

  return {
    get state() { return state },
    get connected() { return connected },
    connect,
    disconnect,
    focusTab,
  }
}
```

### Sidebar: TreeItem.svelte

**Purpose:** Recursive node renderer.

```svelte
<script lang="ts">
  interface Props {
    nodeId: string;
    state: TreeState;
    depth: number;
    onFocusTab: (tabId: number) => void;
  }

  let { nodeId, state, depth, onFocusTab }: Props = $props()

  let node = $derived(state.nodes[nodeId])
  let hasChildren = $derived(node?.childIds?.length > 0)
  let indentStyle = $derived(`padding-left: ${depth * 16}px`)

  function handleDoubleClick() {
    if (node?.type === 'tab') {
      onFocusTab(node.tabId)
    }
  }
</script>

{#if node}
  <div class="tree-item" class:active={node.type === 'tab' && node.active}>
    {#if node.type === 'window'}
      <div class="window-node" class:focused={node.focused} style={indentStyle}>
        <span class="window-icon">🗔</span>
        <span>{node.title}</span>
      </div>
    {:else if node.type === 'pinned-tabs'}
      <div class="pinned-tabs-node" style={indentStyle}>
        <span class="pinned-icon">📌</span>
        <span>Pinned</span>
      </div>
    {:else if node.type === 'tab'}
      <div class="tab-node" style={indentStyle} ondblclick={handleDoubleClick}>
        {#if node.favIconUrl}
          <img class="favicon" src={node.favIconUrl} alt="" />
        {:else}
          <span class="favicon-placeholder">📄</span>
        {/if}
        <span class="tab-title">{node.title}</span>
      </div>
    {/if}

    {#if hasChildren}
      <div class="children">
        {#each node.childIds as childId (childId)}
          <svelte:self {nodeId}={childId} {state} depth={depth + 1} {onFocusTab} />
        {/each}
      </div>
    {/if}
  </div>
{/if}
```

### Sidebar: TreeView.svelte

```svelte
<script lang="ts">
  interface Props {
    state: TreeState;
    onFocusTab: (tabId: number) => void;
  }

  let { state, onFocusTab }: Props = $props()
</script>

<div class="tree-view">
  {#each state.rootIds as windowId (windowId)}
    <TreeItem nodeId={windowId} {state} depth={0} {onFocusTab} />
  {/each}
</div>
```

### Sidebar: Sidebar.svelte

```svelte
<script lang="ts">
  import { createTreeStore } from '../../lib/stores/tree-store'
  import TreeView from '../../lib/components/TreeView.svelte'

  const store = createTreeStore()

  $effect(() => {
    store.connect()
    return () => store.disconnect()
  })
</script>

<div class="sidebar">
  {#if !store.connected}
    <div class="loading">Connecting...</div>
  {:else if !store.state}
    <div class="loading">Loading tabs...</div>
  {:else}
    <TreeView state={store.state} onFocusTab={(tabId) => store.focusTab(tabId)} />
  {/if}
</div>
```

---

## Algorithms

### Initial Tree Build

```
1. Get windows = browser.windows.getAll()
2. Get tabs = browser.tabs.query({}).filter(t => !t.hidden)

3. Group tabs by windowId

4. For each window:
   a. Create WindowNode → add to roots
   b. Sort window's tabs by index
   c. Separate pinned/unpinned

   d. If pinned tabs exist:
      - Create PinnedTabsNode as first child
      - Add pinned tabs to PinnedTabsNode

   e. For each unpinned tab (in order):
      - Store tab.openerTabId in tabOpeners map
      - Determine parent:
          * If openerTabId exists and opener is unpinned: parent = opener
          * Else: parent = window
      - Create TabNode
      - Add to parent.childIds

   f. Set focusedWindowId, activeTabId

5. Return TreeState
```

**Note:** This creates initial structure. Tree then evolves via events.

### Parent Assignment (TAB_CREATED)

```
1. Store tab.openerTabId in tabOpeners

2. Determine parent:
   IF tab.pinned:
     Ensure PinnedTabsNode exists
     parent = PinnedTabsNode

   ELSE IF tab.openerTabId exists:
     opener = nodes.get(NodeId.tab(openerTabId))
     IF opener.pinned:
       parent = window  (maintain order invariant)
     ELSE IF opener exists:
       parent = opener
     ELSE:
       parent = window

   ELSE:
     parent = window

3. Create TabNode
4. Add to parent.childIds
5. Reorder based on tab.index (simplified: append for now)
```

### Parent Reassignment (TAB_MOVED)

```
Simplified approach for Phase 2:

1. Update node.index
2. If tab moved significantly:
     Remove from current parent
     Add to window root
3. Reorder in parent by index
```

**Note:** Full common-ancestor logic deferred to Phase 3 when we have drag-drop.

### Child Promotion (TAB_REMOVED)

```
1. Get node
2. Get parent
3. Find node's index in parent.childIds
4. Remove node from parent.childIds
5. For each child:
     child.parentId = parent.id
     Insert child at node's old position
6. Delete node
7. If pinned: cleanup PinnedTabsNode if empty
```

### Pin State Change

```
IF now pinned:
  - Remove from current parent
  - Ensure PinnedTabsNode exists
  - Set node.parentId = PinnedTabsNode
  - Add to PinnedTabsNode.childIds
  - Promote node's children to window

IF now unpinned:
  - Remove from PinnedTabsNode
  - Set node.parentId = window
  - Add to window.childIds
  - Cleanup PinnedTabsNode if empty
```

---

## Message Flow

### Initial Connection
```
Sidebar                     Background
  |                             |
  |-- connect('sidebar') ------>|
  |                             | add to connectedPorts
  |<---- TREE_STATE ------------|
  |                             |
 (render tree)                  |
```

### Real-Time Update
```
Browser API         Background              Sidebar
  |                     |                      |
  |-- onCreated ------->|                      |
  |                     | handleTabCreated     |
  |                     | notifyChange()       |
  |                     |                      |
  |                     |--- TREE_UPDATE ----->|
  |                     |                      | (re-render)
```

### Focus Tab
```
Sidebar              Background           Browser API
  |                      |                    |
  |-- FOCUS_TAB -------->|                    |
  |                      |-- tabs.update ---->|
  |                      |-- windows.update ->|
  |                      |                    | (tab focused)
```

---

## Testing Strategy

### Unit Tests (Vitest)

**TabTracker:**
- Test event normalization
- Test hidden tab filtering

**TreeManager:**
```javascript
describe('TreeManager', () => {
  it('builds initial tree from tabs', async () => {
    // Mock tabTracker.getAllTabs() with test data
    // Call treeManager.initialize()
    // Assert tree structure
  })

  it('adds tab with openerTabId as child', () => {
    // Setup: parent tab exists
    // Call: handleTabCreated with openerTabId
    // Assert: child.parentId === parent.id
  })

  it('promotes children when tab removed', () => {
    // Setup: tab with children
    // Call: handleTabRemoved
    // Assert: children.parentId === grandparent.id
  })
})
```

### E2E Tests (Playwright)

```javascript
test('displays tabs in tree', async ({ page, context }) => {
  // Load extension in Firefox
  // Open sidebar
  // Verify tabs appear in correct order
})

test('double-click focuses tab', async ({ page }) => {
  // Open sidebar
  // Double-click tab
  // Verify browser tab is focused
})

test('tree updates on tab creation', async ({ page, context }) => {
  // Open sidebar
  // Create new tab in browser
  // Verify tab appears in tree
})
```

### Manual Testing Checklist

- [ ] Open multiple windows → both appear
- [ ] Create tab via link → appears under opener
- [ ] Create tab via "+" → appears at end
- [ ] Pin tab → moves under "Pinned"
- [ ] Unpin tab → moves to window, "Pinned" removed if empty
- [ ] Close tab → children promoted
- [ ] Move tab within window → parent updates
- [ ] Move tab between windows → appears in new window
- [ ] Duplicate tab → appears as sibling
- [ ] Double-click tab → focuses in browser

---

## Implementation Sequence

1. **Create types** (`src/types/tree.ts`, `src/types/messages.ts`)
2. **Implement TabTracker** (`src/entrypoints/background/tab-tracker.ts`)
3. **Implement TreeManager** (`src/entrypoints/background/tree-manager.ts`)
4. **Wire up background** (`src/entrypoints/background/index.ts`)
5. **Create tree-store** (`src/lib/stores/tree-store.ts`)
6. **Create TreeItem** (`src/lib/components/TreeItem.svelte`)
7. **Create TreeView** (`src/lib/components/TreeView.svelte`)
8. **Update Sidebar** (`src/entrypoints/sidebar/Sidebar.svelte`)
9. **Test and debug**

---

## Open Questions

### Multiple Selected Tabs Moved Together

**Scenario:** User selects tabs [A, B, C] and drags them to a new position.

**Browser behavior:** Fires multiple `onMoved` events, one per tab.

**Options:**
1. **Independent moves** - Each tab reassigned parent based on its own neighbors
   - Pro: Simple, follows individual tab rules
   - Con: May break logical grouping

2. **Group move** - Detect consecutive moves, keep relative relationships
   - Pro: Maintains user's grouping intent
   - Con: Complex detection logic

**Phase 2 approach:** Treat independently. Refinement in future phases.

### Insertion Position in childIds

**Critical:** When adding a child, position in `childIds` array must maintain DFS = browser order.

**Algorithm:**
```
When inserting tab at index N:
1. Find where this tab should appear in parent's childIds
2. Compare tab.index with siblings' indices
3. Insert at correct position in childIds array
4. NOT just append to end

Example:
Parent has children with indices [5, 10, 15]
New tab at index 12 → insert between 10 and 15
parent.childIds = [..., child10, newChild, child15, ...]
```

**Implementation in TreeManager:**
```typescript
private insertChildAtCorrectPosition(parentNode, childNode) {
  const siblings = parentNode.childIds
    .map(id => this.nodes.get(id))
    .filter(n => n.type === 'tab') as TabNode[]

  // Find insertion point by comparing indices
  let insertAt = 0
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].index < childNode.index) {
      insertAt = i + 1
    } else {
      break
    }
  }

  parentNode.childIds.splice(insertAt, 0, childNode.id)
}
```

---

## Known Limitations

**Simplified for Phase 2:**
- Parent reassignment for moved tabs uses simplified logic (moves to window root instead of computing common ancestor)
- Multi-tab selection moves treated independently
- No collapse/expand
- No visual feedback during loads
- Tree rebuilds on extension reload (no persistence)

**To be addressed in future phases.**
