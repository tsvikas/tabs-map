# Phase 2 Requirements: Read-Only Tree Display

## Overview

Transform the sidebar from showing a tab count to displaying all tabs and windows in a hierarchical tree structure that mirrors the browser's organization.

---

## User-Visible Behavior

### What the User Sees

**Tree Structure:**
```
Window 1 (focused)
├─ 📌 Pinned
│  ├─ Gmail
│  └─ Calendar
├─ Wikipedia
│  ├─ History of Rome
│  └─ Roman Empire
└─ GitHub

Window 2
├─ News Site
└─ Article
```

**Visual Style:**
- Dense vertical spacing (similar to Tabs Outliner)
- Indentation shows parent-child relationships
- Favicon + tab title for each tab
- Active window/tab is highlighted
- Window nodes show window title and focused state
- Pinned tabs grouped under "Pinned" label

### User Interactions

1. **Double-click tab** → Browser focuses that tab
2. **Tree updates automatically** when user:
   - Opens new tab
   - Closes tab
   - Moves tab within window
   - Moves tab between windows
   - Pins/unpins tab
   - Switches active tab

### No Interactions (Yet)

- Cannot collapse/expand sections
- Cannot drag-and-drop tabs
- Cannot suspend/restore tabs
- Tree does not persist (rebuilds on extension reload)

---

## Tree Structure Rules

### The Order Property

**Critical constraint:** Reading the tree from top to bottom (depth-first) must yield tabs in the exact order they appear in the browser.

**Example:**
```
Browser tabs (left to right): [pinned1, pinned2, tabA, tabA1, tabA2, tabB]

Tree structure:
Window
├─ Pinned
│  ├─ pinned1  (position 0)
│  └─ pinned2  (position 1)
├─ tabA        (position 2)
│  ├─ tabA1    (position 3)
│  └─ tabA2    (position 4)
└─ tabB        (position 5)
```

### Node Types

**WindowNode:**
- Top-level container for all tabs in a browser window
- Shows window title and focused state
- Always a root node
- Optional: shows the desktop and/or monitor it currently lives in

**PinnedTabsNode:**
- Pseudo-node that groups all pinned tabs in a window
- Only exists when window has pinned tabs
- Always first child of window
- Cannot have nested children (pinned tabs can't have visible children)

**TabNode:**
- Represents a browser tab
- Can be child of: window, pinned-tabs, or another tab
- Can have child tabs (tabs opened from it)

**GroupedTabsNode:**
- Pseudo-node that represents a browser tabs group

---

## Parent Assignment Rules

### 1. New Tab via Link (Click on Link)

Browser provides `openerTabId`.

**Rule:** Tab becomes child of the tab it was opened from.

**Appears at:** Same position as in the window.

**Exception:** If opened from a pinned tab → becomes direct child of window (not under pinned-tabs, to maintain order property).

**Example:**
```
User clicks link in "Wikipedia"
→ New tab "Rome" appears under "Wikipedia"

Window
├─ Wikipedia
│  └─ Rome (new)
```

### 2. New Tab via "+" Button, Bookmark, Address Bar

No `openerTabId` provided (unrelated to any tab).

**Rule:** Tab becomes direct child of window.

**Appears at:** Rightmost position in window.

**Example:**
```
User presses Ctrl+T or clicks "+"
→ New tab appears at bottom of window

Window
├─ Wikipedia
├─ GitHub
└─ New Tab (new)
```

### 3. Duplicate Tab (Right-click → Duplicate)

**Rule:** Duplicate becomes sibling of original tab (both under same parent).

**Position:** Appears after original tab and all its descendants.

**Example:**
```
Before:
Window
├─ Wikipedia
│  └─ Rome
└─ GitHub

User duplicates "Wikipedia"

After:
Window
├─ Wikipedia
│  └─ Rome
├─ Wikipedia (duplicate)  ← sibling of original
└─ GitHub
```

### 4. Moved Tab (User Drags Tab)

**Rule:** Tab's new parent is the common ancestor of its new neighbors.

**Exception:** If dragging back to the original position - retain the original parent

**Examples:**

```
Before:
a
├─ a1
├─ a2
│  ├─ a2x
│  └─ a2y
└─ a3

Move a2x between a2y and a3:
a
├─ a1
├─ a2
│  └─ a2y
├─ a2x  ← now child of 'a' (common ancestor of a2y and a3)
└─ a3

Move a2x to first position:
a2x    ← now direct child of window
a
├─ a1
├─ a2
│  └─ a2y
└─ a3

Move a2x to last position:
a
├─ a1
├─ a2
│  └─ a2y
├─ a3
└─ a2x  ← sibling of a3
```

### 5. Tab Moved Between Windows

**Rule:** Tab becomes direct child of the new window.

Then apply moved-tab logic based on its position in the new window.

### 6. Restored Tab (Ctrl+Shift+T or Session Restore)

**Rule:** Treat as if user moved the tab to that position.

Parent = common ancestor of neighbors.

### 7. Childerns of a closed/moved Tab

**Rule:** Children get promoted to their grandparent.

**Order maintained:** Children appear in the same position the parent was.

**Example:**
```
Before:
Window
├─ a
│  ├─ a1
│  └─ a2
│     └─ a2x
└─ b

User closes 'a'

After:
Window
├─ a1  ← promoted
├─ a2  ← promoted
│  └─ a2x  ← kept under a2
└─ b
```

---

## Pinned Tabs Behavior

### When Tab is Pinned

1. If window has no pinned tabs yet:
   - Create PinnedTabsNode as first child of window
2. Move tab under PinnedTabsNode
3. If tab had children:
   - Promote children to window (pinned tabs can't have visible children in tree)

### When Tab is Unpinned

1. Move tab from PinnedTabsNode to window
2. If PinnedTabsNode now empty:
   - Remove PinnedTabsNode

### Tab Opened FROM Pinned Tab

Browser places new tab after all pinned tabs (first unpinned position).

**Rule:** New tab becomes direct child of window, NOT child of pinned-tabs node.

**Why:** To maintain the order property.

---

## Edge Cases

### Empty Window

Window with no tabs (rare).

**Expected:** Window node visible with no children.

### Multiple Windows

Each window is independent.

**Expected:** Separate tree for each window, all visible.

### Window Order

**Expected:** Windows appear in the order Firefox provides them.

### Tab with No Favicon

**Expected:** Show placeholder icon (📄 or similar).

### Tab Still Loading

**Expected:** Show tab with reduced opacity, update when loaded.

### Incognito/Private Window

**Expected:** Label as "Private Window", show with all tabs.

---

## Real-Time Updates

### Timing

All tree updates must appear within **100ms** of browser action.

### No Flashing

Tree should update smoothly without visible flashing or jumping.

### Consistency

At any moment, tree must accurately reflect current browser state.

---

## Success Criteria

**Functional Requirements:**
- [ ] Tree displays all open windows
- [ ] Tree displays all open tabs (except browser internal tabs)
- [ ] Tree order matches browser tab order exactly (DFS = left-to-right)
- [ ] New tab via link → appears under opener
- [ ] New tab via "+" → appears at end of window
- [ ] Duplicate tab → appears as sibling after original
- [ ] Moved tab → parent updates correctly
- [ ] Closed tab → children promoted, order maintained
- [ ] Pinned tab → appears under "Pinned" node
- [ ] Unpinned tab → moves to window, "Pinned" node removed if empty
- [ ] Active tab → highlighted in tree
- [ ] Double-click tab → focuses that tab in browser
- [ ] Multiple windows → each shows complete tree

**Performance:**
- [ ] Updates happen within 100ms
- [ ] No visible flashing or jumping
- [ ] Smooth scrolling with 100+ tabs

**Visual:**
- [ ] Indentation shows hierarchy clearly
- [ ] Favicons display correctly
- [ ] Active tab is highlighted
- [ ] Window focus state visible
- [ ] Dense, compact layout (similar to Tabs Outliner)

---

## Out of Scope (Future Phases)

- Drag-and-drop reordering (Phase 3)
- Collapse/expand tree sections (Phase 3)
- Custom groups/folders (Phase 3)
- Suspend/restore tabs (Phase 4)
- Persistence across sessions (Phase 5)
- Search/filter (Phase 7)
- Keyboard navigation (Phase 7)
- Context menus (Phase 4)
- Hover buttons (Phase 3)
