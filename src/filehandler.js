import { readTextFile, readFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { state, saveVaultConfig, loadVaultConfig, } from './vault.js';
import { openTab } from './tabs.js';
import { openImageViewer } from './images.js';
import { isImage } from './filetree.js'
import { openFile as _openFile } from './editor.js';


import {callbacks} from './main.js';

// ─── Open file ────────────────────────────────────────────────────────────────
export async function handleOpenFile(filePath, itemEl) {
    state.currentFilePath = filePath;
    callbacks.currentFilePath = filePath;
    await openTab(filePath);

    if (isImage(filePath)) {
        await openImageViewer(filePath);
        return;
    }

    await _openFile(filePath, itemEl, {
        readTextFile,
        recentFiles:      state.recentFiles,
        currentVaultPath: state.currentVaultPath,
        saveVaultConfig,
        loadVaultConfig,
    });
}

// ─── New file ─────────────────────────────────────────────────────────────────
export async function newFile() {
    const name = await showModal({ title: 'New File', placeholder: 'filename', confirmText: 'Create' });
    if (!name) return;
    const filePath = state.currentVaultPath + '/' + name + '.md';
    await writeTextFile(filePath, '');
    await callbacks.buildFileTree(state.currentVaultPath);
    await handleOpenFile(filePath, null);
}