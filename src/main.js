import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { state, openVault, showWelcome, renderRecentVaultsList, handleCreateVault, handleOpenVaultDialog, saveVaultConfig, loadVaultConfig, loadGlobalConfig } from './vault.js';
import { buildFileTree } from './filetree.js';
import { openFile as _openFile } from './editor.js';
import { initContextMenu, showContextMenu } from './contextmenu.js';
import { showModal } from './modal.js';
import { initSettings, openSettings, closeSettings, loadAndApplyTheme, setVaultPath } from './settings.js';
import { initTabs, openTab, clearTabs, restoreTabs } from './tabs.js';
import { initPalette } from './palette.js';
import { initCommands } from './commands.js';
import { initShortcuts } from './shortcuts.js';
import { initResize } from './resize.js';
import { initStatusBar } from './statusbar.js';

// ─── Vault list helper (always passes handleOpenVault as callback) ─────────────
function renderVaultsList(vaults) {
  renderRecentVaultsList(vaults, handleOpenVault);
}

// ─── Shared callbacks ─────────────────────────────────────────────────────────
const callbacks = {
  getCurrentVaultPath: () => state.currentVaultPath,
  getCurrentFilePath:  () => state.currentFilePath,
  buildFileTree: (vaultPath) => buildFileTree(vaultPath, callbacks),
  openFile: handleOpenFile,
  showContextMenu,
  currentFilePath: null,
  onDelete: (deletedPath) => {
    if (state.currentFilePath && state.currentFilePath.startsWith(deletedPath)) {
      state.currentFilePath = null;
      document.getElementById('editor-root').style.display = 'none';
      document.getElementById('no-file').style.display = '';
    }
  },
};

// ─── Open file ────────────────────────────────────────────────────────────────
export async function handleOpenFile(filePath, itemEl) {
  state.currentFilePath = filePath;
  callbacks.currentFilePath = filePath;
  openTab(filePath);
  await _openFile(filePath, itemEl, {
    readTextFile,
    recentFiles: state.recentFiles,
    currentVaultPath: state.currentVaultPath,
    saveVaultConfig,
  });
}

// ─── New file ─────────────────────────────────────────────────────────────────
async function newFile() {
  const name = await showModal({ title: 'New File', placeholder: 'filename', confirmText: 'Create' });
  if (!name) return;
  const filePath = state.currentVaultPath + '/' + name + '.md';
  await writeTextFile(filePath, '');
  await callbacks.buildFileTree(state.currentVaultPath);
  await handleOpenFile(filePath, null);
}

// ─── Open vault ───────────────────────────────────────────────────────────────
export async function handleOpenVault(vaultPath) {
  clearTabs();
  await openVault(vaultPath, {
    buildFileTree: callbacks.buildFileTree,
    renderRecentVaultsList: renderVaultsList,
  });
  const cfg = await loadVaultConfig(vaultPath);
  await loadAndApplyTheme(vaultPath, cfg);
  
  setVaultPath(vaultPath);
  await restoreTabs(vaultPath, handleOpenFile);
}

// ─── New file button ──────────────────────────────────────────────────────────
document.getElementById('btn-new-file').addEventListener('click', newFile);

// ─── Vault switcher ───────────────────────────────────────────────────────────
document.getElementById('vault-switcher').addEventListener('click', () => {
  clearTabs();
  showWelcome({ renderRecentVaultsList: renderVaultsList });
});

// ─── Welcome screen buttons ───────────────────────────────────────────────────
document.getElementById('btn-open').addEventListener('click', () =>
  handleOpenVaultDialog({ buildFileTree: callbacks.buildFileTree, renderRecentVaultsList: renderVaultsList })
);
document.getElementById('btn-create').addEventListener('click', () =>
  handleCreateVault({ buildFileTree: callbacks.buildFileTree, renderRecentVaultsList: renderVaultsList })
);

// ─── Settings ─────────────────────────────────────────────────────────────────
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-overlay')) closeSettings();
});

// ─── Search ───────────────────────────────────────────────────────────────────
let searchTimeout = null;
document.getElementById('search-box').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#file-tree .tree-item:not(.folder)').forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }, 150);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
initContextMenu(callbacks);
initSettings({ getVaultPath: () => state.currentVaultPath, saveVaultConfig, loadVaultConfig });
initTabs({
  openFile: handleOpenFile,
  saveVaultConfig,
  loadVaultConfig,
  getVaultPath: () => state.currentVaultPath,
});
initPalette({ openFile: handleOpenFile });
initCommands({ newFile, callbacks });
initShortcuts({ newFile, openFile: handleOpenFile });
initResize();
initStatusBar();

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  const cfg = await loadGlobalConfig();
  state.recentVaults = cfg.recentVaults || [];
  renderVaultsList(state.recentVaults);
  if (state.recentVaults.length > 0) {
    const last = state.recentVaults[0];
    if (await exists(last)) await handleOpenVault(last);
  }
}

boot();