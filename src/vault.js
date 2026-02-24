import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { appLocalDataDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { showModal } from './modal.js';
import { destroyEditor } from './editor.js';

export const state = {
  currentVaultPath: null,
  currentFilePath: null,
  recentVaults: [],
  recentFiles: [],
};

export async function loadGlobalConfig() {
  try {
    const dir = await appLocalDataDir();
    if (await exists(dir + 'lapis-global.json'))
      return JSON.parse(await readTextFile(dir + 'lapis-global.json'));
  } catch {}
  return { recentVaults: [] };
}

export async function saveGlobalConfig(cfg) {
  try {
    const dir = await appLocalDataDir();
    await writeTextFile(dir + 'lapis-global.json', JSON.stringify(cfg));
  } catch(e) { console.error(e); }
}

export async function loadVaultConfig(vaultPath) {
  try {
    return JSON.parse(await readTextFile(vaultPath + '/.lapis/config.json'));
  } catch {}
  return { recentFiles: [] };
}

export async function saveVaultConfig(vaultPath, cfg) {
  //console.log('saveVaultConfig called with:', cfg); 
  try {
    const d = vaultPath + '/.lapis';
    if (!(await exists(d))) await mkdir(d);
    await writeTextFile(d + '/config.json', JSON.stringify(cfg));
  } catch(e) { console.error(e); }
}

export async function openVault(vaultPath, { buildFileTree, renderRecentVaultsList }) {
  state.currentVaultPath = vaultPath.replace(/\\/g, '/');
  state.recentVaults = [vaultPath, ...state.recentVaults.filter(v => v !== vaultPath)].slice(0, 5);
  await saveGlobalConfig({ recentVaults: state.recentVaults });

  const cfg = await loadVaultConfig(vaultPath);
  state.recentFiles = cfg.recentFiles || [];

  document.getElementById('welcome').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('vault-name').textContent = vaultPath.replace(/\\/g, '/').split('/').pop();

  await buildFileTree(vaultPath);
}

export function showWelcome({ renderRecentVaultsList }) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('welcome').style.display = '';
  destroyEditor();
  state.currentVaultPath = null;
  state.currentFilePath = null;
  renderRecentVaultsList(state.recentVaults);
}

// openVaultCb is passed in from main.js to avoid circular imports
export function renderRecentVaultsList(recentVaults, openVaultCb) {
  const container = document.getElementById('recent-vaults');
  if (!recentVaults.length) { container.innerHTML = ''; return; }
  container.innerHTML = '<h3>Recent Vaults</h3>';
  recentVaults.forEach(vp => {
    const name = vp.replace(/\\/g, '/').split('/').pop();
    const el = document.createElement('div');
    el.className = 'recent-vault-card';
    el.innerHTML = `
      <div class="vault-info">
        <strong>${name}</strong>
        <span>${vp}</span>
      </div>
      <span class="vault-arrow">→</span>
      <span class="vault-remove" title="Remove from list">✕</span>
    `;

    const openCb = () => openVaultCb && openVaultCb(vp);
    el.querySelector('.vault-info').onclick  = openCb;
    el.querySelector('.vault-arrow').onclick = openCb;
    el.querySelector('.vault-remove').onclick = async e => {
      e.stopPropagation();
      state.recentVaults = state.recentVaults.filter(v => v !== vp);
      await saveGlobalConfig({ recentVaults: state.recentVaults });
      renderRecentVaultsList(state.recentVaults, openVaultCb);
    };
    container.appendChild(el);
  });
}

export async function handleCreateVault(callbacks) {
  const selected = await open({ directory: true, multiple: false, title: 'Choose location' });
  if (!selected) return;
  const name = await showModal({ title: 'New Vault', placeholder: 'Vault name', confirmText: 'Create' });
  if (!name) return;
  const vaultPath = selected + '/' + name;
  await mkdir(vaultPath);
  await openVault(vaultPath, callbacks);
}

export async function handleOpenVaultDialog(callbacks) {
  const selected = await open({ directory: true, multiple: false, title: 'Open Vault' });
  if (selected) await openVault(selected, callbacks);
}