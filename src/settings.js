import { BUILT_IN_THEMES, applyTheme, loadCustomThemes, saveCustomTheme, deleteCustomTheme } from './themes.js';
import { showModal } from './modal.js';
import { reloadEditor } from './editor.js';
import { readTextFile } from '@tauri-apps/plugin-fs';

let _vaultPath   = null;
let _saveConfig  = null;
let _loadConfig  = null;
let currentThemeId = 'dark';

export function initSettings({ getVaultPath, saveVaultConfig, loadVaultConfig }) {
  _saveConfig = saveVaultConfig;
  _loadConfig = loadVaultConfig;
}

export function setVaultPath(vaultPath) { _vaultPath = vaultPath; }
export function getCurrentThemeId() { return currentThemeId; }

export async function loadAndApplyTheme(vaultPath, config) {
  _vaultPath = vaultPath;
  const themeId = config.theme || 'dark';
  currentThemeId = themeId;

  if (BUILT_IN_THEMES[themeId]) {
    applyTheme(BUILT_IN_THEMES[themeId].colors);
  } else {
    // Try to load custom theme
    const custom = await loadCustomThemes(vaultPath);
    const found  = custom.find(t => t._file === themeId);
    if (found) applyTheme(found.colors);
    else applyTheme(BUILT_IN_THEMES.dark.colors);
  }
}

export function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  renderSettingsPage();
}

export function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
}

async function renderSettingsPage() {
  const container = document.getElementById('settings-themes');
  container.innerHTML = '<div class="settings-loading">Loading themes...</div>';

  const customThemes = _vaultPath ? await loadCustomThemes(_vaultPath) : [];

  container.innerHTML = '';

  // ── Built-in themes ──
  const builtInSection = document.createElement('div');
  builtInSection.innerHTML = '<h3 class="settings-section-title">Built-in Themes</h3>';
  const builtInGrid = document.createElement('div');
  builtInGrid.className = 'theme-grid';

  for (const [id, theme] of Object.entries(BUILT_IN_THEMES)) {
    builtInGrid.appendChild(buildThemeCard(id, theme, false));
  }
  builtInSection.appendChild(builtInGrid);
  container.appendChild(builtInSection);

  // ── Custom themes ──
  const customSection = document.createElement('div');
  customSection.innerHTML = '<h3 class="settings-section-title">Custom Themes</h3>';

  if (customThemes.length > 0) {
    const customGrid = document.createElement('div');
    customGrid.className = 'theme-grid';
    for (const theme of customThemes) {
      customGrid.appendChild(buildThemeCard(theme._file, theme, true));
    }
    customSection.appendChild(customGrid);
  } else {
    const empty = document.createElement('p');
    empty.className = 'settings-empty';
    empty.textContent = 'No custom themes yet.';
    customSection.appendChild(empty);
  }

  // New theme button
  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn-secondary settings-new-theme';
  newBtn.textContent = '+ New Custom Theme';
  newBtn.onclick = () => createNewTheme(container);
  customSection.appendChild(newBtn);

  container.appendChild(customSection);
}

function buildThemeCard(id, theme, isCustom) {
  const card = document.createElement('div');
  card.className = 'theme-card' + (id === currentThemeId ? ' active' : '');
  const c = theme.colors;

  card.innerHTML = `
    <div class="theme-preview" style="background:${c['bg-primary']};border-color:${c['border']}">
      <div class="theme-preview-sidebar" style="background:${c['sidebar-bg']}"></div>
      <div class="theme-preview-content" style="background:${c['bg-editor']}">
        <div class="theme-preview-line" style="background:${c['accent']};width:60%"></div>
        <div class="theme-preview-line" style="background:${c['text-primary']};width:80%;opacity:0.5"></div>
        <div class="theme-preview-line" style="background:${c['text-primary']};width:50%;opacity:0.5"></div>
      </div>
    </div>
    <div class="theme-card-footer">
      <span class="theme-name">${theme.name}</span>
      ${isCustom ? '<button class="theme-delete">🗑️</button>' : ''}
    </div>
  `;

  card.onclick = async () => {
    currentThemeId = id;
    applyTheme(theme.colors);
    if (_vaultPath && _saveConfig) {
      const cfg = await _loadConfig(_vaultPath);
      await _saveConfig(_vaultPath, { ...cfg, theme: id });
    }
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    await reloadEditor(readTextFile);
  };

  if (isCustom) {
    card.querySelector('.theme-delete').onclick = async e => {
      e.stopPropagation();
      const confirmed = await showModal({
        title: 'Delete Theme',
        desc: `Delete "${theme.name}"?`,
        confirmText: 'Delete'
      });
      if (!confirmed) return;
      await deleteCustomTheme(_vaultPath, theme._file);
      renderSettingsPage();
    };
  }

  return card;
}

async function createNewTheme(container) {
  const name = await showModal({
    title: 'New Theme',
    placeholder: 'Theme name',
    confirmText: 'Create'
  });
  if (!name || !_vaultPath) return;

  // Start from current theme as base
  const base = BUILT_IN_THEMES[currentThemeId] || BUILT_IN_THEMES.dark;
  const newTheme = { name, colors: { ...base.colors } };
  await saveCustomTheme(_vaultPath, newTheme);
  renderSettingsPage();
}