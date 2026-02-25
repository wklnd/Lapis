// ─── Global Search Class ──────────────────────────────────────────────────────
import { allFiles } from './filetree.js';

export class GlobalSearch {
  constructor(readTextFile, handleOpenFile) {
    this.readTextFile  = readTextFile;
    this.openFile      = handleOpenFile;
    this.searchOverlay = document.getElementById('search-overlay');
    this.searchInput   = document.getElementById('global-search-input');
    this.searchResults = document.getElementById('search-result');
    this.currentQuery  = '';
    this.selectedIdx   = 0;
    this.visibleItems  = [];
    this.init();
  }

  init() {
    this.searchOverlay.style.display = 'none';

    // Close on backdrop click
    this.searchOverlay.addEventListener('click', e => {
      if (e.target === this.searchOverlay) this.close();
    });

    // Global escape key
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
    });

    // Arrow / Enter navigation
    this.searchInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIdx = Math.min(this.selectedIdx + 1, this.visibleItems.length - 1);
        this.updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIdx = Math.max(this.selectedIdx - 1, 0);
        this.updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = this.visibleItems[this.selectedIdx];
        if (item) {
          this.openFile(item.path, null);
          this.close();
        }
      }
    });

    // Real-time search
    this.searchInput.addEventListener('input', async e => {
      const query = e.target.value.trim();
      this.currentQuery = query;
      this.selectedIdx  = 0;
      this.visibleItems = [];

      if (!query) {
        this.reset();
        return;
      }

      // Clear once before starting a fresh search
      this.searchResults.innerHTML = '';
      await this.searchVault(query);
    });
  }

  // ── Open / Close ─────────────────────────────────────────────────────────────
  open() {
    this.searchOverlay.style.display = 'flex';
    this.searchInput.focus();
  }

  close() {
    this.searchOverlay.style.display = 'none';
    this.reset();
  }

  reset() {
    this.currentQuery  = '';
    this.selectedIdx   = 0;
    this.visibleItems  = [];
    this.searchInput.value = '';
    this.searchResults.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.88em;">
        Type to search across all files…
      </div>`;
  }

  // ── Keyboard selection highlight ──────────────────────────────────────────────
  updateSelection() {
    document.querySelectorAll('.search-file').forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIdx);
    });
    const sel = document.querySelector('.search-file.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  // ── Escape special regex chars ────────────────────────────────────────────────
  escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── Render a single file result ───────────────────────────────────────────────
  renderFileResult(file, matches, query) {
    const idx     = this.visibleItems.length;
    const escaped = this.escapeRegExp(query);
    const regex   = new RegExp(`(${escaped})`, 'gi');

    const fileDiv = document.createElement('div');
    fileDiv.classList.add('search-file');
    fileDiv.dataset.path = file.path;

    this.visibleItems.push(file);

    fileDiv.addEventListener('click', () => {
      this.openFile(file.path, null);
      this.close();
    });

    fileDiv.addEventListener('mouseenter', () => {
      this.selectedIdx = idx;
      this.updateSelection();
    });

    // File name
    const nameDiv = document.createElement('div');
    nameDiv.textContent = file.name;

    // File path
    const pathDiv = document.createElement('div');
    pathDiv.textContent = file.path;

    fileDiv.appendChild(nameDiv);
    fileDiv.appendChild(pathDiv);

    // Match lines
    matches.forEach(match => {
      const lineDiv = document.createElement('div');
      lineDiv.style.cssText = `
        padding: 3px 0 3px 12px;
        font-size: 0.8em;
        color: var(--text-muted);
        border-left: 2px solid var(--border);
        margin: 3px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      const highlighted = match.text.replace(regex, '<span class="highlight">$1</span>');
      lineDiv.innerHTML = `<span style="color:var(--accent);margin-right:6px;font-variant-numeric:tabular-nums">${match.lineNumber}</span>${highlighted}`;
      fileDiv.appendChild(lineDiv);
    });

    this.searchResults.appendChild(fileDiv);

    // Auto-select first result
    if (this.visibleItems.length === 1) {
      fileDiv.classList.add('selected');
    }
  }

  // ── Core search ───────────────────────────────────────────────────────────────
  async searchVault(query) {
    const IMAGE_EXTS = new Set(['.png','.jpg','.jpeg','.gif','.bmp','.webp','.svg','.ico','.tiff']);
    const lowerQuery = query.toLowerCase();
    let foundAny     = false;

    // Snapshot allFiles so mutations during tree build don't affect this search
    const files = [...allFiles];

    for (const file of files) {
      if (this.currentQuery !== query) return;

      const ext = file.path.slice(file.path.lastIndexOf('.')).toLowerCase();
      if (IMAGE_EXTS.has(ext)) continue;

      try {
        const content = await this.readTextFile(file.path);
        if (this.currentQuery !== query) return;

        const matches = [];
        content.split('\n').forEach((line, i) => {
          if (line.toLowerCase().includes(lowerQuery)) {
            matches.push({ lineNumber: i + 1, text: line.trim() });
          }
        });

        if (matches.length > 0) {
          foundAny = true;
          this.renderFileResult(file, matches, query);
        }
      } catch {
        // skip
      }
    }

    if (this.currentQuery !== query) return;

    if (!foundAny) {
      this.searchResults.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.88em;">
          No results for "<strong style="color:var(--text-primary)">${query}</strong>"
        </div>`;
    }
  }
}