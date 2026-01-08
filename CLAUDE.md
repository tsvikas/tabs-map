# Tabs Map - Browser Extension

## Project Overview

A Firefox extension that provides tree-style tab management with suspend/restore functionality. Clone of Tabs Outliner with improvements.

**Stack:** WXT + Svelte 5 + TypeScript + IndexedDB (Dexie)
**Target:** Firefox-first (Manifest V2), Chrome support later

## Goals

1. **Tree-style tab view** - Display all tabs/windows in hierarchical tree
2. **Auto-organization** - Child tabs nest under parent (using `openerTabId`)
3. **Suspend/Restore** - Close tabs but keep in tree, restore later with full history
4. **Cumulative sessions** - Tree persists across browser restarts
5. **Crash recovery** - Show crashed/closed windows with timestamps
6. **Future:** Multi-desktop, multi-monitor support, better export/import

## Development Commands

```bash
# Development (watch mode, auto-rebuild)
pnpm run dev:firefox

# Build for production
pnpm run build:firefox

# Testing
pnpm test              # Vitest unit tests
pnpm test:ui           # Vitest UI
pnpm test:e2e          # Playwright e2e tests

# Type checking
pnpm run check         # svelte-check

# Package extension
pnpm run zip:firefox   # Creates .xpi file
```

## Manual Loading in Firefox (WSL)

Since Firefox runs on Windows while dev server is in WSL:

1. Navigate to: `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Browse to: `\\wsl$\Ubuntu\home\fedora\code\_newborns\tabs-map\.output\firefox-mv2-dev`
4. Select `manifest.json`
5. After code changes, click "Reload" in about:debugging

## Architecture

```
Sidebar (Svelte) ←→ Background Worker ←→ Browser APIs
                            ↓
                     IndexedDB (Dexie)
```

- **Sidebar:** UI with tree view, Svelte 5 components
- **Background:** Tab tracking, tree management, persistence
- **Storage:** IndexedDB for tree state, session snapshots

## Key Technical Decisions

### Browser APIs
- Use `browser.*` WebExtension API (Firefox/Chrome compatible)
- Track `tab.hidden` to filter internal Firefox tabs
- Maintain Set of tracked tab IDs to avoid hidden tab bugs

### Svelte 5
- Use `mount()` not `new Component()` for mounting
- Use `$state()` for reactive variables
- Use `$effect()` for lifecycle/side effects

### Real-time Updates
- Increment/decrement counts directly (not re-query)
- Avoids race condition where removed tab still appears in query
- Track which tab IDs we're counting

### Manifest Configuration
- Firefox Manifest V2 (MV3 not fully stable yet)
- `sidebar_action` for Firefox sidebar API
- Permissions: `tabs`, `storage`, `sessions`, `unlimitedStorage`

## Project Structure

```
src/
├── entrypoints/
│   ├── background/          # Service worker (Phase 2+)
│   │   ├── index.ts
│   │   ├── tab-tracker.ts   # Browser API listeners
│   │   ├── tree-manager.ts  # Tree state logic
│   │   └── storage-manager.ts
│   └── sidebar/             # Sidebar UI
│       ├── Sidebar.svelte   # Root component
│       ├── main.ts          # Svelte mount
│       └── index.html
├── components/              # Reusable Svelte components (Phase 2+)
│   └── tree/
├── stores/                  # Svelte stores (Phase 2+)
├── lib/                     # Utilities (Phase 2+)
│   ├── database.ts          # Dexie schema
│   └── tree-utils.ts
└── types/                   # TypeScript types (Phase 2+)
    ├── tree.ts
    └── messages.ts
```

## Implementation Status

### ✅ Phase 1: Project Setup (COMPLETE)
- WXT + Svelte 5 project initialized
- Sidebar displays with real-time tab count
- Event listeners for tab creation/removal
- Hidden tab filtering
- Testing frameworks configured

### 🔄 Phase 2: Read-Only Tree Display (NEXT)
- [ ] Implement TabTracker with all browser events
- [ ] Build TreeManager with tree state logic
- [ ] Create tree UI components (TreeNode, TabNode, WindowNode)
- [ ] Display all tabs/windows in tree view
- [ ] Double-click to focus tabs
- [ ] Handle all browser tab actions (move, attach, detach, etc.)

### 📋 Future Phases
- Phase 3: Tree Organization (drag-drop, groups, collapse/expand)
- Phase 4: Suspend/Restore functionality
- Phase 5: Persistence (IndexedDB, crash recovery)
- Phase 6: Performance (virtual scrolling)
- Phase 7: Additional features (search, export, keyboard nav)

## Important Patterns

### Tab Tracking
```typescript
// Always check tab.hidden to filter Firefox internal tabs
const visibleTabs = tabs.filter(tab => !tab.hidden);

// Track which tabs we're counting
let trackedTabIds = new Set<number>();

// Only decrement if we were counting this tab
if (trackedTabIds.has(tabId)) {
  trackedTabIds.delete(tabId);
  tabCount--;
}
```

### Visual Style Goals
- Match Tabs Outliner: simple tree, dense vertical space
- Buttons visible only on hover
- Minimalist, functional design

## Resources

- Plan document: `.claude/plans/unified-rolling-cake.md`
- WXT docs: https://wxt.dev
- Firefox WebExtension API: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
- Svelte 5 docs: https://svelte.dev/docs/svelte/overview

## Notes

- Firefox `about:firefoxview` and similar tabs are `hidden: true`
- Tab IDs change when tabs are restored (need stable UUID mapping)
- Chrome cannot restore tab history via extension API (Firefox only)
- WSL users must manually load extension in Windows Firefox
