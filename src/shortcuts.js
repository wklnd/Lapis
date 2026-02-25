import { openPalette } from './palette.js';
import { closeTab, getActiveTab, getAllTabs, setActiveTab, markClean } from './tabs.js';
import { getEditorView } from './editor.js';
import {GlobalSearch} from "./globalsearch.js";
import { allFiles } from "./filetree";

let _newFile   = null;
let _openFile  = null;
let _readTextFile = null;

export function initShortcuts({ newFile, openFile, readTextFile }) {
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

      // Ctrl+Shift+F — global search
      case 'f':
        if (!e.shiftKey) break;
        e.preventDefault();
        const globalSearch = new GlobalSearch(readTextFile, _openFile);
        globalSearch.openGlobalSearch();
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

      // Ctrl+B - set bold (TODO: move to editor shortcuts)
      case 'b': {
          e.preventDefault();
          const view = getEditorView();
          if (!view) break;
          const { from, to } = view.state.selection.main;
          const selected = view.state.sliceDoc(from, to);
          if (selected) {
              // Wrap selection in bold
              view.dispatch({
                  changes: { from, to, insert: `**${selected}**` },
                  selection: { anchor: from + 2, head: to + 2 },
              });
          } else {
              // No selection — insert markers and place cursor between them
              view.dispatch({
                  changes: { from, insert: '****' },
                  selection: { anchor: from + 2 },
              });
          }
          view.focus();
          break;
      }
    }
  });
}