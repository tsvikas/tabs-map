import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Tabs Map',
    description: 'Tree-style tab manager with suspend and restore',
    permissions: ['tabs', 'storage', 'sessions', 'unlimitedStorage'],
    browser_specific_settings: {
      gecko: {
        id: 'tabs-map@newborn.dev',
        strict_min_version: '109.0',
      },
    },
    sidebar_action: {
      default_title: 'Tabs Map',
      default_panel: 'sidebar.html',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
      },
    },
  },
  runner: {
    startUrls: ['https://example.com'],
  },
});
