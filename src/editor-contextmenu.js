import { showModal } from './modal.js';

let ctxMenu;
let ctxTarget = null;

export function initEditorContextMenu() {
    ctxMenu = document.createElement('div');
    ctxMenu.id = 'context-menu';
    ctxMenu.innerHTML = `

    <div class="ctx-item" id="ctx-item">Test</div>
    <div class="ctx-item" id="ctx-item">Test</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item" id="ctx-test">Test</div>
    <div class="ctx-item" id="ctx-test">Test</div>
    <div class="ctx-item" id="ctx-test">Test</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item" id="ctx-save-pdf">Save as PDF</div>
    `;
    document.body.appendChild(ctxMenu);

    const editorRoot = document.getElementById('editor-root');

    editorRoot.addEventListener('contextmenu', e => {
        e.preventDefault();
        ctxTarget = 'test';
        showEditorMenu(e);
    });

    document.addEventListener('click', hideContextMenu);

    document.getElementById('ctx-test').addEventListener('mousedown', async () => {
        hideContextMenu();
    });

    document.getElementById('ctx-save-pdf').addEventListener('mousedown', () => {
    hideContextMenu();
    document.dispatchEvent(new CustomEvent('lapis:exportPDF'));
});
}

export function showEditorMenu(e) {
    const x = Math.min(e.clientX, window.innerWidth - 150);
    const y = Math.min(e.clientY, window.innerHeight - 50);
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';
    ctxMenu.style.display = 'block';
}

function hideContextMenu() {
    ctxMenu.style.display = 'none';
}