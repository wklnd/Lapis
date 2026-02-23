import { readDir, rename, writeTextFile } from '@tauri-apps/plugin-fs';

export let allFiles = [];

// Remember which folders are open across rebuilds
const openFolders = new Set();

// Drag state
let draggedPath = null;
let isDragging  = false;

// ─── Public: build the whole tree ────────────────────────────────────────────
export async function buildFileTree(vaultPath, callbacks) {
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
    // Only handle if we didn't drop on a folder or file item
    if (e.target !== tree) return;
    const vp = vaultPath.replace(/\\/g, '/');
    const fileName = draggedPath.replace(/\\/g, '/').split('/').pop();
    const dest = vp + '/' + fileName;
    await moveFile(draggedPath, dest, callbacks);
  }, { once: false });

  await renderEntries(entries, tree, vaultPath, callbacks);
}

// ─── Recursive render ─────────────────────────────────────────────────────────
async function renderEntries(entries, container, basePath, callbacks) {
  const sorted = [...entries]
    .filter(e => !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

  const frag = document.createDocumentFragment();
  const promises = [];

  for (const entry of sorted) {
    const fullPath = basePath.replace(/\\/g, '/') + '/' + entry.name;

    if (entry.isDirectory) {
      const { el, childContainer, promise } = buildFolder(fullPath, entry.name, callbacks);
      frag.appendChild(el);
      frag.appendChild(childContainer);
      if (promise) promises.push(promise);
    } else {
      if (!entry.name.endsWith('.md') && !entry.name.endsWith('.txt')) continue;
      allFiles.push({ name: entry.name, path: fullPath });
      frag.appendChild(buildFile(fullPath, entry.name, callbacks));
    }
  }

  container.appendChild(frag);
  await Promise.all(promises);
}

// ─── Build a folder element ───────────────────────────────────────────────────
function buildFolder(fullPath, name, callbacks) {
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
    openFolders.add(fullPath); // keep folder open after drop
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

  // Load children immediately
  let promise = null;
  promise = readDir(fullPath).then(subEntries => {
    return renderEntries(subEntries, childContainer, fullPath, callbacks);
  }).catch(e => console.error('readDir failed for', fullPath, e));

  return { el, childContainer, promise };
}

// ─── Build a file element ─────────────────────────────────────────────────────
function buildFile(fullPath, name, callbacks) {
  const item = document.createElement('div');
  item.className = 'tree-item file';
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
  list.innerHTML = '';
  recentFiles.slice(0, 5).forEach(fp => {
    const name = fp.replace(/\\/g, '/').split('/').pop();
    const el = document.createElement('div');
    el.className = 'recent-sidebar-item';
    el.textContent = name;
    el.title = fp;
    el.onclick = () => callbacks.openFile(fp, null);
    list.appendChild(el);
  });
}