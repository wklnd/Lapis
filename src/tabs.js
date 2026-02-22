// ─── Tab state ────────────────────────────────────────────────────────────────
const tabs = [];        // [{ path, name, dirty }]
let activeTab = null;   // path

let _openFileCb   = null;
let _saveConfigCb = null;
let _getVaultPath = null;
let _loadConfigCb = null;

export function initTabs({ openFile, saveVaultConfig, loadVaultConfig, getVaultPath }) {
  _openFileCb   = openFile;
  _saveConfigCb = saveVaultConfig;
  _loadConfigCb = loadVaultConfig;
  _getVaultPath = getVaultPath;
}

// ─── Open a tab ───────────────────────────────────────────────────────────────
export function openTab(filePath) {
  const existing = tabs.find(t => t.path === filePath);
  if (existing) {
    setActiveTab(filePath);
    return;
  }
  const name = filePath.replace(/\\/g, '/').split('/').pop();
  tabs.push({ path: filePath, name, dirty: false });
  setActiveTab(filePath);
  persistTabs();
}

// ─── Close a tab ──────────────────────────────────────────────────────────────
export function closeTab(filePath) {
  const idx = tabs.findIndex(t => t.path === filePath);
  if (idx === -1) return;
  tabs.splice(idx, 1);
  renderTabs();

  if (activeTab === filePath) {
    if (tabs.length === 0) {
      activeTab = null;
      document.getElementById('editor-root').style.display = 'none';
      document.getElementById('no-file').style.display = '';
    } else {
      const next = tabs[Math.min(idx, tabs.length - 1)];
      setActiveTab(next.path);
      _openFileCb(next.path, null);
    }
  }
  persistTabs();
}

// ─── Set active tab ───────────────────────────────────────────────────────────
export function setActiveTab(filePath) {
  activeTab = filePath;
  renderTabs();
}

export function getActiveTab() { return activeTab; }
export function getAllTabs()   { return [...tabs]; }

// ─── Mark tab dirty/clean ─────────────────────────────────────────────────────
export function markDirty(filePath) {
  const tab = tabs.find(t => t.path === filePath);
  if (tab && !tab.dirty) {
    tab.dirty = true;
    renderTabs();
  }
}

export function markClean(filePath) {
  const tab = tabs.find(t => t.path === filePath);
  if (tab && tab.dirty) {
    tab.dirty = false;
    renderTabs();
  }
}

// ─── Render tab bar ───────────────────────────────────────────────────────────
function renderTabs() {
  const bar = document.getElementById('tab-bar');
  bar.innerHTML = '';

  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' +
      (tab.path === activeTab ? ' active' : '') +
      (tab.dirty ? ' dirty' : '');
    el.dataset.path = tab.path;
    el.title = tab.path;
    el.innerHTML = `
      <span class="tab-dirty"></span>
      <span class="tab-name">${tab.name}</span>
      <button class="tab-close" title="Close">✕</button>
    `;

    // Click to switch
    el.addEventListener('click', e => {
      if (e.target.classList.contains('tab-close')) return;
      if (tab.path !== activeTab) {
        setActiveTab(tab.path);
        _openFileCb(tab.path, null);
      }
    });

    // Middle click to close
    el.addEventListener('mousedown', e => {
      if (e.button === 1) {
        e.preventDefault();
        closeTab(tab.path);
      }
    });

    // X button
    el.querySelector('.tab-close').addEventListener('click', e => {
      e.stopPropagation();
      closeTab(tab.path);
    });

    bar.appendChild(el);
  });

  // Scroll active tab into view
  const activeEl = bar.querySelector('.tab.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ─── Persist tabs to vault config ─────────────────────────────────────────────
async function persistTabs() {
  const vaultPath = _getVaultPath();
  if (!vaultPath || !_saveConfigCb || !_loadConfigCb) return;
  try {
    const cfg = await _loadConfigCb(vaultPath);
    await _saveConfigCb(vaultPath, {
      ...cfg,
      openTabs: tabs.map(t => t.path),
      activeTab,
    });
  } catch(e) { console.error('persistTabs failed:', e); }
}

// ─── Restore tabs from vault config ──────────────────────────────────────────
export async function restoreTabs(vaultPath, openFileCb) {
  if (!_loadConfigCb) return;
  try {
    const cfg = await _loadConfigCb(vaultPath);
    const savedTabs   = cfg.openTabs  || [];
    const savedActive = cfg.activeTab || null;
    for (const path of savedTabs) {
      const name = path.replace(/\\/g, '/').split('/').pop();
      tabs.push({ path, name, dirty: false });
    }
    renderTabs();
    if (savedActive && tabs.find(t => t.path === savedActive)) {
      setActiveTab(savedActive);
      await openFileCb(savedActive, null);
    } else if (tabs.length > 0) {
      setActiveTab(tabs[0].path);
      await openFileCb(tabs[0].path, null);
    }
  } catch(e) { console.error('restoreTabs failed:', e); }
}

// ─── Clear tabs (on vault switch) ─────────────────────────────────────────────
export function clearTabs() {
  tabs.length = 0;
  activeTab = null;
  renderTabs();
}