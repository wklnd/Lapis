import { BUILT_IN_THEMES, applyTheme, loadCustomThemes, saveCustomTheme, deleteCustomTheme } from './themes.js';
import { showModal } from './modal.js';
import { reloadEditor } from './editor.js';
import { readTextFile } from '@tauri-apps/plugin-fs';

let _vaultPath     = null;
let _saveConfig    = null;
let _loadConfig    = null;
let currentThemeId = 'light';
let activeTab      = 'general';

export function initSettings({ getVaultPath, saveVaultConfig, loadVaultConfig }) {
    _saveConfig = saveVaultConfig;
    _loadConfig = loadVaultConfig;
}

export function setVaultPath(vaultPath) { _vaultPath = vaultPath; }
export function getCurrentThemeId() { return currentThemeId; }

export async function loadAndApplyTheme(vaultPath, config) {
    _vaultPath = vaultPath;
    const themeId  = config.theme || 'light';
    currentThemeId = themeId;
    const fontSize = localStorage.getItem('lapis-font-size') || '16';
    document.documentElement.style.setProperty('--editor-font-size', fontSize + 'px');
    if (BUILT_IN_THEMES[themeId]) {
        applyTheme(BUILT_IN_THEMES[themeId].colors);
    } else {
        const custom = await loadCustomThemes(vaultPath);
        const found  = custom.find(t => t._file === themeId);
        if (found) applyTheme(found.colors);
        else applyTheme(BUILT_IN_THEMES.light.colors);
    }
}

export function openSettings() {
    document.getElementById('settings-overlay').classList.add('open');
    renderSettings();
}

export function closeSettings() {
    document.getElementById('settings-overlay').classList.remove('open');
}

// ─── Main render ──────────────────────────────────────────────────────────────
async function renderSettings() {
    const overlay = document.getElementById('settings-overlay');

    // Build the full panel if it doesn't exist yet
    if (!overlay.querySelector('.sp-layout')) {
        overlay.innerHTML = buildShell();
        overlay.querySelector('.sp-close').addEventListener('click', closeSettings);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeSettings(); });
    }

    // Wire up nav
    overlay.querySelectorAll('.sp-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            activeTab = item.dataset.tab;
            overlay.querySelectorAll('.sp-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderTab(activeTab);
        });
    });

    // Set active nav item
    overlay.querySelectorAll('.sp-nav-item').forEach(i => {
        i.classList.toggle('active', i.dataset.tab === activeTab);
    });

    await renderTab(activeTab);
}

function buildShell() {
    const tabs = [
        { id: 'general',    label: 'General'    },
        { id: 'editor',     label: 'Editor'     },
        { id: 'files',      label: 'Files'      },
        { id: 'appearance', label: 'Appearance' },
        { id: 'hotkeys',    label: 'Hotkeys'    },
        { id: 'links',      label: 'Links'      },
        { id: 'about',      label: 'About'      },
    ];

    return `
        <div class="sp-layout">
            <div class="sp-sidebar">
                <div class="sp-sidebar-title">Settings</div>
                <nav class="sp-nav">
                    ${tabs.map(t => `<div class="sp-nav-item" data-tab="${t.id}">${t.label}</div>`).join('')}
                </nav>
            </div>
            <div class="sp-body">
                <div class="sp-body-header">
                    <span class="sp-body-title"></span>
                    <button class="sp-close">✕</button>
                </div>
                <div class="sp-content"></div>
            </div>
        </div>
    `;
}

async function renderTab(tab) {
    const overlay  = document.getElementById('settings-overlay');
    const content  = overlay.querySelector('.sp-content');
    const title    = overlay.querySelector('.sp-body-title');
    content.innerHTML = '';

    const cfg = (_vaultPath && _loadConfig) ? await _loadConfig(_vaultPath) : {};

    const tabs = {
        general:    { label: 'General',    fn: () => renderGeneral(content) },
        editor:     { label: 'Editor',     fn: () => renderEditor(content, cfg) },
        files:      { label: 'Files',      fn: () => renderFiles(content, cfg) },
        appearance: { label: 'Appearance', fn: () => renderAppearance(content) },
        hotkeys:    { label: 'Hotkeys',    fn: () => renderHotkeys(content) },
        links:      { label: 'Links',      fn: () => renderLinks(content) },
        about:     { label: 'About',      fn: () => renderAbout(content) },
    };

    title.textContent = tabs[tab]?.label || '';
    await tabs[tab]?.fn();
}

// ─── Setting helpers ──────────────────────────────────────────────────────────
function section(title) {
    const el = document.createElement('div');
    el.className = 'sp-section';
    el.innerHTML = `<div class="sp-section-title">${title}</div>`;
    return el;
}

function row(label, desc, control) {
    const el = document.createElement('div');
    el.className = 'sp-row';
    el.innerHTML = `
        <div class="sp-row-left">
            <div class="sp-row-label">${label}</div>
            ${desc ? `<div class="sp-row-desc">${desc}</div>` : ''}
        </div>
        <div class="sp-row-control"></div>
    `;
    el.querySelector('.sp-row-control').appendChild(control);
    return el;
}

function makeSlider({ min, max, step = 1, value, unit = '', onInput }) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-slider';
    wrap.innerHTML = `
        <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
        <span class="sp-slider-val">${value}${unit}</span>
    `;
    const input = wrap.querySelector('input');
    const label = wrap.querySelector('.sp-slider-val');
    input.addEventListener('input', () => {
        label.textContent = input.value + unit;
        onInput(input.value);
    });
    return wrap;
}

function makeToggle({ checked, onChange }) {
    const wrap = document.createElement('label');
    wrap.className = 'sp-toggle';
    wrap.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} /><span class="sp-toggle-track"><span class="sp-toggle-thumb"></span></span>`;
    wrap.querySelector('input').addEventListener('change', e => onChange(e.target.checked));
    return wrap;
}

function makeSelect({ options, value, onChange }) {
    const sel = document.createElement('select');
    sel.className = 'sp-select';
    options.forEach(({ label, value: v }) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = label;
        if (v === value) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
}

async function saveCfg(patch) {
    if (!_vaultPath || !_saveConfig || !_loadConfig) return;
    const cfg = await _loadConfig(_vaultPath);
    await _saveConfig(_vaultPath, { ...cfg, ...patch });
}

// ─── GENERAL ─────────────────────────────────────────────────────────────────
function renderGeneral(content) {
    const about = section('About');
    const infoEl = document.createElement('div');
    infoEl.className = 'sp-about';
    infoEl.innerHTML = `
        <div class="sp-about-logo">LogoHere</div>
        <div class="sp-about-name">Lapis</div>
        <div class="sp-about-version">Version 0.1.0</div>
        <div class="sp-about-desc">A minimal markdown editor with vault support.</div>
        <div class="sp-about-links">
            <span class="sp-about-tag">Built with Tauri + CodeMirror</span>
        </div>
    `;
    about.appendChild(infoEl);
    content.appendChild(about);
}

// ─── EDITOR ──────────────────────────────────────────────────────────────────
async function renderEditor(content, cfg) {
    const sec = section('Editor');

    // Font size
    const savedSize = parseInt(localStorage.getItem('lapis-font-size') || '16');
    sec.appendChild(row('Font Size', 'Editor text size in pixels',
        makeSlider({
            min: 12, max: 28, step: 1, value: savedSize, unit: 'px',
            onInput: val => {
                document.documentElement.style.setProperty('--editor-font-size', val + 'px');
                const cm = document.querySelector('.cm-editor');
                if (cm) cm.style.fontSize = val + 'px';
                localStorage.setItem('lapis-font-size', val);
            }
        })
    ));

    // Font family
    const fontFamilies = [
        { label: 'System Default', value: 'system' },
        { label: 'Serif',          value: 'Georgia, serif' },
        { label: 'Monospace',      value: 'monospace' },
        { label: 'iA Writer',      value: "'iA Writer Quattro', Georgia, serif" },
    ];
    const savedFont = localStorage.getItem('lapis-font-family') || 'system';
    sec.appendChild(row('Font Family', 'Editor typeface',
        makeSelect({
            options: fontFamilies,
            value: savedFont,
            onChange: async val => {
                const family = val === 'system' ? 'inherit' : val;
                document.documentElement.style.setProperty('--editor-font-family', family);
                localStorage.setItem('lapis-font-family', val);
                await reloadEditor(readTextFile);  // add this
            }
        })
    ));

    // Line height
    const savedLH = localStorage.getItem('lapis-line-height') || '1.7';
    sec.appendChild(row('Line Height', 'Spacing between lines',
        makeSlider({
            min: 1.2, max: 2.5, step: 0.1, value: savedLH, unit: '',
            onInput: val => {
                document.documentElement.style.setProperty('--editor-line-height', val);
                localStorage.setItem('lapis-line-height', val);
            }
        })
    ));

    // Word wrap
    const wrapEnabled = cfg.wordWrap !== false;
    sec.appendChild(row('Word Wrap', 'Wrap long lines in the editor',
        makeToggle({
            checked: wrapEnabled,
            onChange: async val => {
                await saveCfg({ wordWrap: val });
                await reloadEditor(readTextFile);
            }
        })
    ));

    // Spell check
    const spellCheck = cfg.spellCheck || false;
    sec.appendChild(row('Spell Check', 'Underline misspelled words',
        makeToggle({
            checked: spellCheck,
            onChange: async val => {
                await saveCfg({ spellCheck: val });
                const cm = document.querySelector('.cm-content');
                if (cm) cm.spellcheck = val;
            }
        })
    ));

    content.appendChild(sec);
}

// ─── FILES ───────────────────────────────────────────────────────────────────
async function renderFiles(content, cfg) {
    const sec = section('Files');

    // Show hidden files
    sec.appendChild(row('Show Hidden Files', 'Show files and folders starting with a dot',
        makeToggle({
            checked: cfg.showHidden || false,
            onChange: async val => {
                await saveCfg({ showHidden: val });
                // Rebuild file tree
                const evt = new CustomEvent('lapis:rebuildTree');
                document.dispatchEvent(evt);
            }
        })
    ));

    // Auto save delay
    const savedDelay = cfg.autoSaveDelay ?? 300;
    sec.appendChild(row('Auto Save Delay', 'Milliseconds before saving after you stop typing',
        makeSlider({
            min: 100, max: 3000, step: 100, value: savedDelay, unit: 'ms',
            onInput: async val => {
                await saveCfg({ autoSaveDelay: parseInt(val) });
            }
        })
    ));

    // Default file extension
    sec.appendChild(row('Default Extension', 'Extension used when creating new files',
        makeSelect({
            options: [
                { label: '.md  (Markdown)', value: 'md' },
                { label: '.txt (Plain text)', value: 'txt' },
            ],
            value: cfg.defaultExtension || 'md',
            onChange: async val => {
                await saveCfg({ defaultExtension: val });
            }
        })
    ));

    content.appendChild(sec);
}

// ─── APPEARANCE ───────────────────────────────────────────────────────────────
async function renderAppearance(content) {
    const customThemes = _vaultPath ? await loadCustomThemes(_vaultPath) : [];

    const builtInSec = section('Built-in Themes');
    const builtInGrid = document.createElement('div');
    builtInGrid.className = 'theme-grid';
    for (const [id, theme] of Object.entries(BUILT_IN_THEMES)) {
        builtInGrid.appendChild(buildThemeCard(id, theme, false));
    }
    builtInSec.appendChild(builtInGrid);
    content.appendChild(builtInSec);

    const customSec = section('Custom Themes');
    if (customThemes.length > 0) {
        const customGrid = document.createElement('div');
        customGrid.className = 'theme-grid';
        for (const theme of customThemes) {
            customGrid.appendChild(buildThemeCard(theme._file, theme, true));
        }
        customSec.appendChild(customGrid);
    } else {
        const empty = document.createElement('p');
        empty.className = 'sp-empty';
        empty.textContent = 'No custom themes yet.';
        customSec.appendChild(empty);
    }

    const newBtn = document.createElement('button');
    newBtn.className = 'btn btn-secondary';
    newBtn.textContent = '+ New Custom Theme';
    newBtn.style.marginTop = '12px';
    newBtn.onclick = () => createNewTheme();
    customSec.appendChild(newBtn);

    content.appendChild(customSec);
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
            ${isCustom ? '<button class="theme-delete">✕</button>' : ''}
        </div>
    `;

    card.onclick = async () => {
        currentThemeId = id;
        applyTheme(theme.colors);
        await saveCfg({ theme: id });
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        await reloadEditor(readTextFile);
    };

    if (isCustom) {
        card.querySelector('.theme-delete').onclick = async e => {
            e.stopPropagation();
            const confirmed = await showModal({ title: 'Delete Theme', desc: `Delete "${theme.name}"?`, confirmText: 'Delete' });
            if (!confirmed) return;
            await deleteCustomTheme(_vaultPath, theme._file);
            renderTab('appearance');
        };
    }

    return card;
}

async function createNewTheme() {
    const name = await showModal({ title: 'New Theme', placeholder: 'Theme name', confirmText: 'Create' });
    if (!name || !_vaultPath) return;
    const base     = BUILT_IN_THEMES[currentThemeId] || BUILT_IN_THEMES.light;
    const newTheme = { name, colors: { ...base.colors } };
    await saveCustomTheme(_vaultPath, newTheme);
    renderTab('appearance');
}

// ─── HOTKEYS ─────────────────────────────────────────────────────────────────
function renderHotkeys(content) {
    const hotkeys = [
        { label: 'New File',          keys: ['Ctrl', 'N']       },
        { label: 'Open Command Palette', keys: ['Ctrl', 'P']    },
        { label: 'Bold',              keys: ['Ctrl', 'B']       },
        { label: 'Save',              keys: ['Ctrl', 'S']       },
        { label: 'Close Tab',         keys: ['Ctrl', 'W']       },
        { label: 'Switch Tab Left',   keys: ['Ctrl', 'Shift', 'Tab'] },
        { label: 'Switch Tab Right',  keys: ['Ctrl', 'Tab']     },
        { label: 'Open Settings',     keys: ['Ctrl', ',']       },
        { label: 'Toggle Hidden Files', keys: ['—']             },
    ];

    const sec = section('Keyboard Shortcuts');
    const table = document.createElement('div');
    table.className = 'sp-hotkeys';

    hotkeys.forEach(({ label, keys }) => {
        const row = document.createElement('div');
        row.className = 'sp-hotkey-row';
        row.innerHTML = `
            <span class="sp-hotkey-label">${label}</span>
            <span class="sp-hotkey-keys">${keys.map(k => `<kbd>${k}</kbd>`).join('')}</span>
        `;
        table.appendChild(row);
    });

    sec.appendChild(table);
    content.appendChild(sec);
}

// ─── LINKS ───────────────────────────────────────────────────────────────────
function renderLinks(content) {
    const sec = section('Links');
    const placeholder = document.createElement('div');
    placeholder.className = 'sp-empty';
    placeholder.textContent = 'Link settings coming soon.';
    sec.appendChild(placeholder);
    content.appendChild(sec);
}

// ─── GENERAL ─────────────────────────────────────────────────────────────────
function renderAbout(content) {
    const about = section('About');
    const infoEl = document.createElement('div');
    infoEl.className = 'sp-about';
    infoEl.innerHTML = `
        <div class="sp-about-desc"> Lapis was built as a subsidiary project to Obsidian, designed to be a minimal and lightning-fast markdown editor for users who just want to write without distractions. It is built with Tauri and CodeMirror</div>
    
        `;
    about.appendChild(infoEl);
    content.appendChild(about);
}