import { showModal } from './modal.js';
import { getEditorView } from './editor.js';

let ctxMenu;
let subMenu;
let hideTimer = null;

// ─── Insert at cursor ─────────────────────────────────────────────────────────
function insertAtCursor(text, cursorOffset = null) {
    const view = getEditorView();
    if (!view) return;
    const { from } = view.state.selection.main;
    view.dispatch({
        changes: { from, insert: text },
        selection: { anchor: from + (cursorOffset !== null ? cursorOffset : text.length) },
    });
    view.focus();
}

// ─── Insert handlers ──────────────────────────────────────────────────────────
function insertCodeBlock() {
    insertAtCursor('```\n\n```', 4);
}

async function insertTable() {
    const input = await showModal({
        title: 'Insert Table',
        desc: 'Columns x Rows (e.g. 3x3)',
        placeholder: '3x3',
        confirmText: 'Insert',
        defaultValue: '3x3',
    });
    if (input === null) return;
    const [rawCols, rawRows] = (input || '3x3').split('x');
    const cols = Math.max(1, parseInt(rawCols) || 3);
    const rows = Math.max(1, parseInt(rawRows) || 3);

    const header = '| ' + Array(cols).fill('Header').map((h, i) => `${h} ${i + 1}`).join(' | ') + ' |';
    const sep    = '| ' + Array(cols).fill('---').join(' | ') + ' |';
    const row    = '| ' + Array(cols).fill('Cell').join(' | ') + ' |';
    const body   = Array(rows).fill(row).join('\n');
    insertAtCursor('\n' + header + '\n' + sep + '\n' + body + '\n');
}

async function insertImage() {
    const alt = await showModal({
        title: 'Insert Image',
        desc: 'Alt text',
        placeholder: 'image description',
        confirmText: 'Next',
    });
    if (alt === null) return;
    const url = await showModal({
        title: 'Insert Image',
        desc: 'Image URL or path',
        placeholder: 'https:// or .lapis/assets/',
        confirmText: 'Insert',
    });
    if (url === null) return;
    insertAtCursor(`![${alt}](${url})`);
}

async function insertLink() {
    const text = await showModal({
        title: 'Insert Link',
        desc: 'Link text',
        placeholder: 'display text',
        confirmText: 'Next',
    });
    if (text === null) return;
    const url = await showModal({
        title: 'Insert Link',
        desc: 'URL',
        placeholder: 'https://',
        confirmText: 'Insert',
    });
    if (url === null) return;
    insertAtCursor(`[${text}](${url})`);
}

function insertHorizontalRule() {
    insertAtCursor('\n\n---\n\n');
}

function insertBlockquote() {
    insertAtCursor('> ');
}

// ─── Submenu positioning ──────────────────────────────────────────────────────
function positionSubMenu() {
    const mainRect = ctxMenu.getBoundingClientRect();
    const insertEl = ctxMenu.querySelector('#ectx-open-insert');
    const insertRect = insertEl.getBoundingClientRect();
    const subWidth = 180;
    const subHeight = subMenu.offsetHeight || 220;

    let x = mainRect.right + 4;
    if (x + subWidth > window.innerWidth) x = mainRect.left - subWidth - 4;

    let y = insertRect.top;
    if (y + subHeight > window.innerHeight) y = window.innerHeight - subHeight - 8;

    subMenu.style.left = x + 'px';
    subMenu.style.top  = y + 'px';
}

function showSubMenu() {
    clearTimeout(hideTimer);
    subMenu.style.display = 'block';
    positionSubMenu();
    ctxMenu.querySelector('#ectx-open-insert').classList.add('active');
}

function scheduleHide() {
    hideTimer = setTimeout(() => {
        subMenu.style.display = 'none';
        ctxMenu.querySelector('#ectx-open-insert').classList.remove('active');
    }, 120);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initEditorContextMenu() {
    // Main menu
    ctxMenu = document.createElement('div');
    ctxMenu.id = 'editor-context-menu';
    ctxMenu.innerHTML = `
        <div class="ctx-item" id="ectx-open-insert">Insert <span class="ctx-chevron">›</span></div>
        <div class="ctx-divider"></div>
        <div class="ctx-item" id="ectx-save-pdf">Save as PDF</div>
    `;
    document.body.appendChild(ctxMenu);

    // Insert submenu
    subMenu = document.createElement('div');
    subMenu.id = 'editor-insert-submenu';
    subMenu.innerHTML = `
        <div class="ctx-item" id="ectx-code-block">Code Block</div>
        <div class="ctx-item" id="ectx-table">Table</div>
        <div class="ctx-item" id="ectx-image">Image</div>
        <div class="ctx-item" id="ectx-link">Link</div>
        <div class="ctx-item" id="ectx-blockquote">Blockquote</div>
        <div class="ctx-item" id="ectx-hr">Horizontal Rule</div>
    `;
    document.body.appendChild(subMenu);

    // Hover wiring
    const insertTrigger = ctxMenu.querySelector('#ectx-open-insert');
    insertTrigger.addEventListener('mouseenter', showSubMenu);
    insertTrigger.addEventListener('mouseleave', scheduleHide);
    subMenu.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    subMenu.addEventListener('mouseleave', scheduleHide);

    const editorRoot = document.getElementById('editor-root');
    editorRoot.addEventListener('contextmenu', e => {
        e.preventDefault();
        showEditorMenu(e);
    });

    document.addEventListener('click', hideContextMenu);

    subMenu.querySelector('#ectx-code-block').addEventListener('mousedown', () => { hideContextMenu(); insertCodeBlock(); });
    subMenu.querySelector('#ectx-table').addEventListener('mousedown',      () => { hideContextMenu(); insertTable(); });
    subMenu.querySelector('#ectx-image').addEventListener('mousedown',      () => { hideContextMenu(); insertImage(); });
    subMenu.querySelector('#ectx-link').addEventListener('mousedown',       () => { hideContextMenu(); insertLink(); });
    subMenu.querySelector('#ectx-blockquote').addEventListener('mousedown', () => { hideContextMenu(); insertBlockquote(); });
    subMenu.querySelector('#ectx-hr').addEventListener('mousedown',         () => { hideContextMenu(); insertHorizontalRule(); });
    ctxMenu.querySelector('#ectx-save-pdf').addEventListener('mousedown',   () => {
        hideContextMenu();
        document.dispatchEvent(new CustomEvent('lapis:exportPDF'));
    });
}

export function showEditorMenu(e) {
    subMenu.style.display = 'none';
    ctxMenu.querySelector('#ectx-open-insert').classList.remove('active');
    const menuWidth  = 180;
    const menuHeight = 80;
    const x = Math.min(e.clientX, window.innerWidth  - menuWidth);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight);
    ctxMenu.style.left    = x + 'px';
    ctxMenu.style.top     = y + 'px';
    ctxMenu.style.display = 'block';
}

function hideContextMenu() {
    clearTimeout(hideTimer);
    ctxMenu.style.display = 'none';
    subMenu.style.display = 'none';
    ctxMenu.querySelector('#ectx-open-insert').classList.remove('active');
}