<script lang="ts">
  let tabCount = $state(0);

  async function syncTabCount() {
    try {
      const tabs = await browser.tabs.query({});
      // Filter out hidden Firefox tabs
      const visibleTabs = tabs.filter(tab => !tab.hidden);
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
      if (!tab.hidden) {
        tabCount++;
      }
    };

    const onRemoved = () => {
      // Decrement immediately, don't wait for query
      tabCount--;
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
