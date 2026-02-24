import { readTextFile, readFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { state, openVault, showWelcome, renderRecentVaultsList, handleCreateVault, handleOpenVaultDialog, saveVaultConfig, loadVaultConfig, loadGlobalConfig } from './vault.js';
import { buildFileTree, allFiles} from './filetree.js';
import { openFile as _openFile } from './editor.js';
import { initContextMenu, showContextMenu } from './contextmenu.js';
import { initEditorContextMenu, showEditorMenu } from './editor-contextmenu.js';
import { showModal } from './modal.js';
import { initSettings, openSettings, closeSettings, loadAndApplyTheme, setVaultPath } from './settings.js';
import { initTabs, openTab, clearTabs, restoreTabs } from './tabs.js';
import { initPalette } from './palette.js';
import { initCommands } from './commands.js';
import { initShortcuts } from './shortcuts.js';
import { initResize } from './resize.js';
import { initStatusBar } from './statusbar.js';
import { GlobalSearch } from "./globalsearch.js";

// ─── Vault list helper ────────────────────────────────────────────────────────
function renderVaultsList(vaults) {
    renderRecentVaultsList(vaults, handleOpenVault);
}

// ─── Shared callbacks ─────────────────────────────────────────────────────────
export const callbacks = {
    getCurrentVaultPath: () => state.currentVaultPath,
    getCurrentFilePath:  () => state.currentFilePath,
    buildFileTree: async (vaultPath) => {
        const cfg = await loadVaultConfig(vaultPath);
        return buildFileTree(vaultPath, callbacks, cfg.showHidden || false);
    },
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
document.getElementById('settings-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-overlay')) closeSettings();
});
document.addEventListener('lapis:rebuildTree', () => {
    if (state.currentVaultPath) callbacks.buildFileTree(state.currentVaultPath);
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

// ─── Global Search  ───────────────────────────────────────────────────────────────────
new GlobalSearch(readTextFile, handleOpenFile);

// ─── Init ─────────────────────────────────────────────────────────────────────
initContextMenu(callbacks);
initEditorContextMenu({ getEditorView, showEditorMenu });
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
initImagePaste({ getVaultPath: () => state.currentVaultPath, getEditorView });
initImageDrop({ getVaultPath: () => state.currentVaultPath, getEditorView });

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