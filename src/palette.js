import { allFiles } from './filetree.js';

let _openFile = null;
let _commands = [];
let selectedIdx = 0;
let filtered = [];
let mode = 'files'; // 'files' or 'commands'

export function initPalette({ openFile }) {
  _openFile = openFile;

  const overlay = document.getElementById('palette-overlay');
  const input   = document.getElementById('palette-input');

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closePalette();
  });

  input.addEventListener('input', () => {
    const val = input.value;
    if (val.startsWith('>')) {
      mode = 'commands';
      renderCommands(val.slice(1).trim());
    } else {
      mode = 'files';
      renderResults(val.trim());
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePalette(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1);
      updateSelection();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      updateSelection();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIdx];
      if (item) item.action();
    }
  });
}

export function registerCommands(commands) {
  _commands = commands;
}

export function openPalette() {
  const overlay = document.getElementById('palette-overlay');
  const input   = document.getElementById('palette-input');
  overlay.classList.add('open');
  input.value = '';
  selectedIdx = 0;
  mode = 'files';
  renderResults('');
  setTimeout(() => input.focus(), 30);
}

export function closePalette() {
  document.getElementById('palette-overlay').classList.remove('open');
}

// ─── File search ──────────────────────────────────────────────────────────────
function fuzzyMatch(query, str) {
  if (!query) return { match: true, highlighted: str, score: 0 };
  const q = query.toLowerCase();
  const s = str.toLowerCase();
  const idx = s.indexOf(q);
  if (idx !== -1) {
    const highlighted =
      str.slice(0, idx) +
      '<mark>' + str.slice(idx, idx + q.length) + '</mark>' +
      str.slice(idx + q.length);
    return { match: true, highlighted, score: 1 + idx * 0.001 };
  }
  let qi = 0, result = '', score = 0;
  for (let i = 0; i < str.length; i++) {
    if (qi < q.length && str[i].toLowerCase() === q[qi]) {
      result += '<mark>' + str[i] + '</mark>';
      score += i;
      qi++;
    } else {
      result += str[i];
    }
  }
  if (qi === q.length) return { match: true, highlighted: result, score: 10 + score * 0.01 };
  return { match: false };
}

function renderResults(query) {
  const container = document.getElementById('palette-results');
  container.innerHTML = '';
  selectedIdx = 0;

  filtered = allFiles
    .map(f => {
      const fm = fuzzyMatch(query, f.name);
      if (!fm.match) return null;
      return {
        ...f,
        highlighted: fm.highlighted,
        score: fm.score,
        action: () => { closePalette(); _openFile(f.path, null); }
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 20);

  filtered.forEach((file, i) => {
    const el = document.createElement('div');
    el.className = 'palette-item' + (i === 0 ? ' selected' : '');
    el.innerHTML = `
      <span class="palette-item-name">${file.highlighted}</span>
      <span class="palette-item-path">${file.path}</span>
    `;
    el.addEventListener('mousedown', e => { e.preventDefault(); file.action(); });
    el.addEventListener('mouseenter', () => { selectedIdx = i; updateSelection(); });
    container.appendChild(el);
  });
}

// ─── Command search ───────────────────────────────────────────────────────────
function renderCommands(query) {
  const container = document.getElementById('palette-results');
  container.innerHTML = '';
  selectedIdx = 0;

  const q = query.toLowerCase();
  filtered = _commands
    .filter(cmd => !q || cmd.label.toLowerCase().includes(q))
    .map(cmd => ({ ...cmd, action: () => { closePalette(); cmd.action(); } }))
    .slice(0, 20);

  filtered.forEach((cmd, i) => {
    const el = document.createElement('div');
    el.className = 'palette-item' + (i === 0 ? ' selected' : '');
    el.innerHTML = `
      <span class="palette-item-name">${cmd.icon || ''} ${cmd.label}</span>
      ${cmd.shortcut ? `<span class="palette-item-path">${cmd.shortcut}</span>` : ''}
    `;
    el.addEventListener('mousedown', e => { e.preventDefault(); cmd.action(); });
    el.addEventListener('mouseenter', () => { selectedIdx = i; updateSelection(); });
    container.appendChild(el);
  });
}

function updateSelection() {
  document.querySelectorAll('.palette-item').forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIdx);
  });
  const selected = document.querySelector('.palette-item.selected');
  if (selected) selected.scrollIntoView({ block: 'nearest' });
}