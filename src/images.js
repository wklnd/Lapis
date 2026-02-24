// @TODO: Issus with images, please look over ram-usage

import { exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { destroyEditor } from './editor';

// ─── Image viewer ─────────────────────────────────────────────────────────────
export async function openImageViewer(filePath) {
    document.getElementById('no-file').style.display = 'none';
    const root = document.getElementById('editor-root');
    root.style.display = 'flex';
    root.innerHTML = '';
    destroyEditor();

    const name = filePath.replace(/\\/g, '/').split('/').pop();
    const ext  = name.split('.').pop().toLowerCase();
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'image/png';

    try {
        const bytes = await readFile(filePath);
        const b64   = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
        const src   = `data:${mime};base64,${b64}`;

        root.innerHTML = `
            <div class="image-viewer">
                <div class="image-viewer-name">${name}</div>
                <img class="image-viewer-img" src="${src}" alt="${name}" />
            </div>
        `;
    } catch(e) {
        root.innerHTML = `<div class="image-viewer"><span style="color:var(--text-muted)">Could not load image: ${name}</span></div>`;
    }
}

// ─── Save image to vault assets ───────────────────────────────────────────────
export async function saveImageToVault(vaultPath, filename, bytes) {
    const assetsDir = vaultPath + '/.lapis/assets';
    if (!(await exists(assetsDir))) {
        await mkdir(assetsDir, { recursive: true });
    }

    // Handle duplicate filenames — append -lapis-N
    const ext  = filename.includes('.') ? '.' + filename.split('.').pop() : '';
    const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename;

    let finalName = filename;
    let counter   = 1;
    while (await exists(assetsDir + '/' + finalName)) {
        finalName = `${base}-lapis-${counter}${ext}`;
        counter++;
    }

    await writeFile(assetsDir + '/' + finalName, bytes);
    return finalName;
}

// ─── Get relative path for markdown ──────────────────────────────────────────
export function getImageMarkdown(filename) {
    return `![${filename}](.lapis/assets/${filename})`;
}

// ─── Handle paste ─────────────────────────────────────────────────────────────
export function initImagePaste({ getVaultPath, getEditorView }) {
    document.addEventListener('paste', async e => {
        const view = getEditorView();
        if (!view || !view.hasFocus) return;

        const vaultPath = getVaultPath();
        if (!vaultPath) return;

        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        if (!imageItem) return;

        e.preventDefault();

        const file  = imageItem.getAsFile();
        if (!file) return;

        const ext      = file.type.split('/')[1] || 'png';
        const filename = `pasted-image.${ext}`;
        const bytes    = new Uint8Array(await file.arrayBuffer());

        try {
            const saved   = await saveImageToVault(vaultPath, filename, bytes);
            const md      = getImageMarkdown(saved);
            const state   = view.state;
            const from    = state.selection.main.from;
            view.dispatch({
                changes: { from, insert: md },
                selection: { anchor: from + md.length },
            });
        } catch(e) {
            console.error('Failed to save pasted image:', e);
        }
    });
}

// ─── Handle drop ──────────────────────────────────────────────────────────────
// @Todo - This part is a frankenstein of various attempts, needs cleanup and testing
export function initImageDrop({ getVaultPath, getEditorView }) {
    document.addEventListener('drop', async e => {
        const view = getEditorView();
        if (!view) return;

        const vaultPath = getVaultPath();
        if (!vaultPath) return;

        const files = Array.from(e.dataTransfer?.files || []);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        e.preventDefault();

        // Get drop position in editor
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });

        for (const file of imageFiles) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            try {
                const saved = await saveImageToVault(vaultPath, file.name, bytes);
                const md    = getImageMarkdown(saved);
                const from  = pos ?? view.state.doc.length;
                view.dispatch({
                    changes: { from, insert: md + '\n' },
                    selection: { anchor: from + md.length + 1 },
                });
            } catch(e) {
                console.error('Failed to save dropped image:', e);
            }
        }
    });

    // Prevent browser default drag behavior
    document.addEventListener('dragover', e => {
        if (Array.from(e.dataTransfer?.items || []).some(i => i.type.startsWith('image/'))) {
            e.preventDefault();
        }
    });
}


// ─── Load image from vault as data URL ─────────────────────────────────────---
export async function getVaultImageDataUrl(vaultPath, filename) {
    const path = `${vaultPath}/.lapis/assets/${filename}`;
    try {
        const bytes = await readFile(path);
        // Guess MIME type from extension
        const ext = filename.split('.').pop().toLowerCase();
        let mime = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        else if (ext === 'gif') mime = 'image/gif';
        else if (ext === 'svg') mime = 'image/svg+xml';
        else if (ext === 'webp') mime = 'image/webp';
        // Convert bytes to base64
        const base64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
        return `data:${mime};base64,${base64}`;
    } catch (e) {
        console.error('Failed to load image as data URL:', e);
        return '';
    }
}

// ─── Patch preview images to use data URLs for vault assets ────────────────
export function patchPreviewImages(container, vaultPath) {
    const imgs = container.querySelectorAll('img');
    imgs.forEach(async img => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('.lapis/assets/')) {
            const filename = src.split('/').pop();
            const dataUrl = await getVaultImageDataUrl(vaultPath, filename);
            if (dataUrl) img.src = dataUrl;
            else img.alt = '[Image not found]';
        }
    });
}