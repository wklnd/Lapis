import { readDir, rename, writeTextFile } from '@tauri-apps/plugin-fs';

export let allFiles = [];

// Remember which folders are open across rebuilds
const openFolders = new Set();

// Drag state
let draggedPath = null;
let isDragging  = false;

// ─── Image detection (module scope so all functions can use it) ───────────────
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
export function isImage(name) {
    return IMAGE_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));
}

// ─── Public: build the whole tree ────────────────────────────────────────────
export async function buildFileTree(vaultPath, callbacks, showHidden = false) {
    allFiles = [];
    const tree = document.getElementById('file-tree');

    let entries;
    try {
        entries = await readDir(vaultPath);
    } catch(e) {
        console.error('readDir failed:', e);
        return;
    }

    tree.innerHTML = '';

    // Root drop zone — drop here to move file to vault root
    tree.addEventListener('pointerup', async e => {
        if (!isDragging || !draggedPath) return;
        if (e.target !== tree) return;
        const vp = vaultPath.replace(/\\/g, '/');
        const fileName = draggedPath.replace(/\\/g, '/').split('/').pop();
        const dest = vp + '/' + fileName;
        await moveFile(draggedPath, dest, callbacks);
    }, { once: false });

    await renderEntries(entries, tree, vaultPath, callbacks, showHidden);
}

// ─── Recursive render ─────────────────────────────────────────────────────────
async function renderEntries(entries, container, basePath, callbacks, showHidden = false) {
    const sorted = [...entries]
        .filter(e => showHidden || !e.name.startsWith('.'))
        .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

    const frag     = document.createDocumentFragment();
    const promises = [];

    for (const entry of sorted) {
        const fullPath = basePath.replace(/\\/g, '/') + '/' + entry.name;

        if (entry.isDirectory) {
            const { el, childContainer, promise } = buildFolder(fullPath, entry.name, callbacks, showHidden);
            frag.appendChild(el);
            frag.appendChild(childContainer);
            if (promise) promises.push(promise);
        } else {
            // Always show .md, .txt, and images. When showHidden: show everything.
            if (!showHidden && !entry.name.endsWith('.md') && !entry.name.endsWith('.txt') && !isImage(entry.name)) continue;
            allFiles.push({ name: entry.name, path: fullPath });
            frag.appendChild(buildFile(fullPath, entry.name, callbacks));
        }
    }

    container.appendChild(frag);
    await Promise.all(promises);
}

// ─── Build a folder element ───────────────────────────────────────────────────
function buildFolder(fullPath, name, callbacks, showHidden = false) {
    const isOpen = openFolders.has(fullPath);

    const el = document.createElement('div');
    el.className = 'tree-item folder';
    el.dataset.path = fullPath;
    el.innerHTML = `<span class="folder-arrow">${isOpen ? '▾' : '▸'}</span>${name}`;

    const childContainer = document.createElement('div');
    childContainer.className = 'tree-folder-children';
    childContainer.style.display = isOpen ? '' : 'none';

    // ── Drop target ──
    el.addEventListener('pointerenter', () => {
        if (isDragging) el.classList.add('drag-over');
    });
    el.addEventListener('pointerleave', () => {
        el.classList.remove('drag-over');
    });
    el.addEventListener('pointerup', async e => {
        e.stopPropagation();
        el.classList.remove('drag-over');
        if (!isDragging || !draggedPath) return;
        const fileName = draggedPath.replace(/\\/g, '/').split('/').pop();
        const dest = fullPath + '/' + fileName;
        openFolders.add(fullPath);
        await moveFile(draggedPath, dest, callbacks);
    });

    // ── Click to expand/collapse ──
    el.addEventListener('click', async () => {
        if (isDragging) return;
        const isCurrentlyOpen = childContainer.style.display !== 'none';
        if (isCurrentlyOpen) {
            childContainer.style.display = 'none';
            el.querySelector('.folder-arrow').textContent = '▸';
            openFolders.delete(fullPath);
        } else {
            childContainer.style.display = '';
            el.querySelector('.folder-arrow').textContent = '▾';
            openFolders.add(fullPath);
        }
    });

    // ── Context menu ──
    el.addEventListener('contextmenu', e => callbacks.showContextMenu(e, fullPath, true));

    // Load children — pass showHidden through!
    const promise = readDir(fullPath).then(subEntries => {
        return renderEntries(subEntries, childContainer, fullPath, callbacks, showHidden);
    }).catch(e => console.error('readDir failed for', fullPath, e));

    return { el, childContainer, promise };
}

// ─── Build a file element ─────────────────────────────────────────────────────
function buildFile(fullPath, name, callbacks) {
    const item = document.createElement('div');
    item.className = 'tree-item file';
    if (isImage(name)) item.classList.add('image-file');
    item.dataset.path = fullPath;
    item.textContent = name;

    const currentFile = (callbacks.getCurrentFilePath() || '').replace(/\\/g, '/');
    if (fullPath === currentFile) item.classList.add('active');

    // ── Pointer drag ──
    item.addEventListener('pointerdown', e => {
        e.preventDefault();
        draggedPath = fullPath;
        isDragging  = false;

        const onMove = () => {
            if (!isDragging) {
                isDragging = true;
                item.style.opacity = '0.4';
                item.style.pointerEvents = 'none';
            }
        };

        const onUp = () => {
            setTimeout(() => {
                isDragging  = false;
                draggedPath = null;
                item.style.opacity = '';
                item.style.pointerEvents = '';
            }, 50);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup',   onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup',   onUp);
    });

    // ── Click to open ──
    item.addEventListener('click', () => {
        if (!isDragging) callbacks.openFile(fullPath, item);
    });

    // ── Context menu ──
    item.addEventListener('contextmenu', e => callbacks.showContextMenu(e, fullPath, false));

    return item;
}

// ─── Move file helper ─────────────────────────────────────────────────────────
async function moveFile(src, dest, callbacks) {
    const s = src.replace(/\\/g, '/');
    const d = dest.replace(/\\/g, '/');
    if (s === d) return;
    try {
        await rename(s, d);
        if ((callbacks.getCurrentFilePath() || '').replace(/\\/g, '/') === s) {
            callbacks.onDelete(s);
        }
        await callbacks.buildFileTree(callbacks.getCurrentVaultPath());
    } catch(e) {
        console.error('moveFile failed:', e);
    }
}

// ─── Recent sidebar ───────────────────────────────────────────────────────────
export function renderRecentSidebar(recentFiles) {
    const list = document.getElementById('recent-sidebar-list');
    if (!list) return;
    list.innerHTML = '';
    recentFiles.slice(0, 5).forEach(fp => {
        const name = fp.replace(/\\/g, '/').split('/').pop();
        const el = document.createElement('div');
        el.className = 'recent-sidebar-item';
        el.textContent = name;
        el.title = fp;
        list.appendChild(el);
    });
}