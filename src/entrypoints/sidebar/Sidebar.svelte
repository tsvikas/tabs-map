<script lang="ts">
  let tabCount = $state(0);
  // Track which tab IDs we're counting (to avoid counting hidden tabs)
  let trackedTabIds = new Set<number>();

  async function syncTabCount() {
    try {
      const tabs = await browser.tabs.query({});
      // Filter out hidden Firefox tabs
      const visibleTabs = tabs.filter(tab => !tab.hidden);

      // Update tracked IDs
      trackedTabIds.clear();
      visibleTabs.forEach(tab => {
        if (tab.id !== undefined) {
          trackedTabIds.add(tab.id);
        }
      });

      tabCount = visibleTabs.length;
    } catch (err) {
      console.error('Failed to load tabs:', err);
    }
  }

  // Load tabs and set up listeners on mount
  $effect(() => {
    syncTabCount();

    // Listen for tab events
    const onCreated = (tab: browser.tabs.Tab) => {
      if (!tab.hidden && tab.id !== undefined) {
        trackedTabIds.add(tab.id);
        tabCount++;
      }
    };

    const onRemoved = (tabId: number) => {
      // Only decrement if we were counting this tab
      if (trackedTabIds.has(tabId)) {
        trackedTabIds.delete(tabId);
        tabCount--;
      }
    };

    browser.tabs.onCreated.addListener(onCreated);
    browser.tabs.onRemoved.addListener(onRemoved);

    // Cleanup listeners on unmount
    return () => {
      browser.tabs.onCreated.removeListener(onCreated);
      browser.tabs.onRemoved.removeListener(onRemoved);
    };
  });
</script>

<div class="sidebar">
  <header>
    <h1>Tabs Map</h1>
  </header>
  <main>
    <p>Extension is running!</p>
    <p>You have <strong>{tabCount}</strong> tabs open.</p>
  </main>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: system-ui, -apple-system, sans-serif;
  }

  header {
    padding: 1rem;
    border-bottom: 1px solid #e0e0e0;
    background: #f5f5f5;
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  main {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  p {
    margin: 0.5rem 0;
  }
</style>
