import { remove, rename, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { showModal } from './modal.js';

let ctxTarget   = null;
let ctxIsFolder = false;
let _callbacks  = null;

const ctxMenu      = document.getElementById('context-menu');
const ctxNewFile   = document.getElementById('ctx-new-file');
const ctxNewFolder = document.getElementById('ctx-new-folder');
const ctxRename    = document.getElementById('ctx-rename');
const ctxCopyPath  = document.getElementById('ctx-copy-path');
const ctxDelete    = document.getElementById('ctx-delete');
const ctxMakeACopy   = document.getElementById('ctx-make-a-copy'); // @TODO for future


export function initContextMenu(callbacks) {
  _callbacks = callbacks;

  document.addEventListener('click', hideContextMenu);

  // Right-click on empty tree space = create in vault root
  document.getElementById('file-tree').addEventListener('contextmenu', e => {
    if (e.target === document.getElementById('file-tree')) {
      e.preventDefault();
      ctxTarget   = callbacks.getCurrentVaultPath();
      ctxIsFolder = true;
      showMenu(e, true, true); // isRoot = true
    }
  });


  ctxNewFile.addEventListener('mousedown', async () => {
    const base = ctxTarget || _callbacks.getCurrentVaultPath();
    const name = await showModal({ title: 'New File', placeholder: 'filename', confirmText: 'Create' });
    if (!name) return;
    const filePath = base + '/' + name + '.md';
    await writeTextFile(filePath, '');
    await _callbacks.buildFileTree(_callbacks.getCurrentVaultPath());
    await _callbacks.openFile(filePath, null);
  });

    ctxNewFolder.addEventListener('mousedown', async () => {
    const base = (ctxTarget || _callbacks.getCurrentVaultPath()).replace(/\\/g, '/');
    const name = await showModal({ title: 'New Folder', placeholder: 'folder name', confirmText: 'Create' });
    if (!name) return;
    const folderPath = base + '/' + name;
    try {
        await mkdir(folderPath);
    } catch(e) {
        // Ignore "already exists" error
        if (!e.message.includes('183') && !e.message.includes('already exists')) {
        console.error('mkdir failed:', e);
        return;
        }
    }
    const vaultPath = _callbacks.getCurrentVaultPath().replace(/\\/g, '/');
    await _callbacks.buildFileTree(vaultPath);
    });

  ctxRename.addEventListener('mousedown', async () => {
    if (!ctxTarget) return;
    const parts    = ctxTarget.replace(/\\/g, '/').split('/');
    const oldName  = parts.pop();
    const parent   = parts.join('/');
    const ext      = ctxIsFolder ? '' : '.md';
    const defVal   = ctxIsFolder ? oldName : oldName.replace(/\.md$/, '');
    const newName  = await showModal({
      title: ctxIsFolder ? 'Rename Folder' : 'Rename File',
      placeholder: 'new name',
      defaultValue: defVal,
      confirmText: 'Rename'
    });
    if (!newName) return;
    await rename(ctxTarget, parent + '/' + newName + ext);
    await _callbacks.buildFileTree(_callbacks.getCurrentVaultPath());
  });

  ctxCopyPath.addEventListener('mousedown', () => {
    if (ctxTarget) navigator.clipboard.writeText(ctxTarget);
  });

  ctxDelete.addEventListener('mousedown', async () => {
    if (!ctxTarget) return;
    const name = ctxTarget.replace(/\\/g, '/').split('/').pop();
    const confirmed = await showModal({
      title: ctxIsFolder ? 'Delete Folder' : 'Delete File',
      desc: `Delete "${name}"? This cannot be undone.`,
      confirmText: 'Delete'
    });
    if (!confirmed) return;
    await remove(ctxTarget, { recursive: true });
    await _callbacks.buildFileTree(_callbacks.getCurrentVaultPath());
    _callbacks.onDelete(ctxTarget);
  });
}

export function showContextMenu(e, path, isFolder) {
  e.preventDefault();
  e.stopPropagation();
  ctxTarget   = path;
  ctxIsFolder = isFolder;
  showMenu(e, isFolder, false);
}

function showMenu(e, isFolder, isRoot) {

    const items = [ctxNewFile, ctxNewFolder, ctxRename, ctxCopyPath, ctxDelete];
    items.forEach(el => el.style.display = 'none');
    document.querySelectorAll('.ctx-divider').forEach(div => div.style.display = 'none');

    ctxNewFile.style.display   = isFolder ? '' : 'none';
    ctxNewFolder.style.display = isFolder ? '' : 'none';
    ctxRename.style.display    = isRoot   ? 'none' : '';
    ctxCopyPath.style.display  = isFolder ? 'none' : '';
    ctxDelete.style.display    = isRoot   ? 'none' : '';

    document.querySelectorAll('.ctx-divider').forEach(div => {
        let prev = div.previousElementSibling;
        let next = div.nextElementSibling;

        while(prev && prev.style.display === 'none') prev = prev.previousElementSibling;
        while(next && next.style.display === 'none') next = next.nextElementSibling;

        div.style.display = (prev && next) ? '' : 'none';
    });

    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 160);
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top  = y + 'px';
    ctxMenu.classList.add('open');
}

function hideContextMenu() { ctxMenu.classList.remove('open'); }