import { readTextFile, readFile, writeTextFile, exists, readDir } from '@tauri-apps/plugin-fs';
import { state, saveVaultConfig, loadVaultConfig } from './vault.js';
import { openTab } from './tabs.js';
import { openImageViewer } from './images.js';
import { isImage } from './filetree.js';
import { openFile as _openFile } from './editor.js';
import { showModal } from './modal.js';
import { callbacks } from './main.js';

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

import { BUILT_IN_TEMPLATES, applyTemplateMacros } from './templates.js';

// ─── New file ─────────────────────────────────────────────────────────────────
export async function newFileIn(basePath) {
    // Build template options
    const options = BUILT_IN_TEMPLATES.map(t => ({ label: t.label, value: 'builtin:' + t.label }));
    const templatesDir = state.currentVaultPath + '/.lapis/templates';
    if (await exists(templatesDir)) {
        const entries = await readDir(templatesDir);
        entries
            .filter(e => !e.isDirectory && e.name.endsWith('.md'))
            .forEach(t => options.push({ label: t.name.replace(/\.md$/, ''), value: templatesDir + '/' + t.name }));
    }

    const result = await showModal({
        title: 'New File',
        placeholder: 'filename',
        inputLabel: 'Name',
        selectLabel: 'Template',
        options,
        confirmText: 'Create',
    });
    if (!result || !result.name) return;

    let content = '';
    if (result.template.startsWith('builtin:')) {
        const tpl = BUILT_IN_TEMPLATES.find(t => t.label === result.template.slice(8));
        content = tpl ? applyTemplateMacros(tpl.content) : '';
    } else if (result.template) {
        content = applyTemplateMacros(await readTextFile(result.template));
    }

    const filePath = basePath.replace(/\\/g, '/') + '/' + result.name + '.md';
    await writeTextFile(filePath, content);
    await callbacks.buildFileTree(state.currentVaultPath);
    await handleOpenFile(filePath, null);
}

export async function newFile() {
    return newFileIn(state.currentVaultPath);
}