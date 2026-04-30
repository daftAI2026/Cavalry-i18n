const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const captureToolPath = path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js');

test('buildAccessibilityInventory preserves recursive menus and visible text fields', () => {
  const { buildAccessibilityInventory } = require(captureToolPath);

  const inventory = buildAccessibilityInventory({
    language: 'en',
    capture: {
      pid: 24945,
      source: 'live-accessibility',
      wallclockUtc: '2026-04-29T11:00:00Z',
      menuBarItems: [
        {
          text: 'File',
          submenu: {
            title: 'File',
            items: [
              { text: 'Open...' },
              {
                text: 'Import',
                submenu: {
                  title: 'Import',
                  items: [{ text: 'Import Reference...' }],
                },
              },
            ],
          },
        },
      ],
      windows: [
        {
          role: 'AXWindow',
          title: 'Preferences',
          textNodes: [
            { role: 'AXStaticText', name: 'General' },
            { role: 'AXTextField', value: 'Search Preferences' },
          ],
        },
      ],
    },
  });

  assert.equal(inventory.language, 'en');
  assert.equal(inventory.menuBars.length, 1);
  assert.equal(inventory.menuBars[0].items[0].text, 'File');
  assert.equal(inventory.menuBars[0].items[0].submenu.title, 'File');
  assert.equal(inventory.menuBars[0].items[0].submenu.items[1].submenu.items[0].text, 'Import Reference...');

  assert.equal(inventory.widgetTexts.length, 3);
  assert.equal(inventory.widgetTexts[0].strings.windowTitle, 'Preferences');
  assert.equal(inventory.widgetTexts[1].strings.name, 'General');
  assert.equal(inventory.widgetTexts[2].strings.value, 'Search Preferences');
});
