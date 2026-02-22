import { openPalette } from './palette.js';
import { closeTab, getActiveTab, getAllTabs, setActiveTab, markClean } from './tabs.js';

let _newFile   = null;
let _openFile  = null;

export function initShortcuts({ newFile, openFile }) {
  _newFile  = newFile;
  _openFile = openFile;

  document.addEventListener('keydown', async e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    switch (e.key.toLowerCase()) {

      // Ctrl+P — command palette
      case 'p':
        e.preventDefault();
        openPalette();
        break;

      // Ctrl+N — new file
      case 'n':
        e.preventDefault();
        await _newFile();
        break;

      // Ctrl+W — close current tab
      case 'w':
        e.preventDefault();
        const active = getActiveTab();
        if (active) closeTab(active);
        break;

      // Ctrl+Tab — next tab
      case 'tab':
        e.preventDefault();
        const tabs = getAllTabs();
        if (tabs.length < 2) break;
        const current = getActiveTab();
        const idx     = tabs.findIndex(t => t.path === current);
        const next    = e.shiftKey
          ? tabs[(idx - 1 + tabs.length) % tabs.length]
          : tabs[(idx + 1) % tabs.length];
        setActiveTab(next.path);
        _openFile(next.path, null);
        break;

      // Ctrl+S — force save (editor autosaves but this is reassuring)
      case 's':
        e.preventDefault();
        const activeTab = getActiveTab();
        if (activeTab) markClean(activeTab);
  break;
    }
  });
}