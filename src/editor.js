import { EditorView, basicSetup } from 'codemirror';
import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { markDirty, markClean } from './tabs.js';

// ─── HR Widget ────────────────────────────────────────────────────────────────
class HRWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-hr-line';
    return el;
  }
  ignoreEvent() { return false; }
}

let editorView    = null;
let saveTimeout   = null;
let currentFilePath = null;

// ─── Cursor helper ────────────────────────────────────────────────────────────
function cursorOnLine(view, line) {
  for (let r of view.state.selection.ranges)
    if (view.state.doc.lineAt(r.head).number === line.number) return true;
  return false;
}

// ─── Markdown Decorations ─────────────────────────────────────────────────────
const markdownDecorations = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(u) {
    if (u.docChanged || u.selectionSet || u.viewportChanged)
      this.decorations = this.build(u.view);
  }
  build(view) {
    const builder = new RangeSetBuilder();
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const text = line.text;
      const here = cursorOnLine(view, line);

      // Headings
      const hm = text.match(/^(#{1,6})\s/);
      if (hm && !here) {
        const sz = ['2em','1.7em','1.4em','1.2em','1.1em','1em'][hm[1].length - 1];
        builder.add(line.from, line.to, Decoration.mark({
          attributes: { style: `font-size:${sz};font-weight:bold;color:var(--text-primary);` }
        }));
        builder.add(line.from, line.from + hm[1].length + 1, Decoration.mark({
          attributes: { style: 'display:none;' }
        }));
      }

      if (!here) {
        let m;
        // Bold
        const br = /\*\*(.+?)\*\*/g;
        while ((m = br.exec(text)) !== null) {
          const s = line.from + m.index, e = s + m[0].length;
          builder.add(s,   s+2, Decoration.mark({ attributes: { style: 'display:none;' } }));
          builder.add(s+2, e-2, Decoration.mark({ attributes: { style: 'font-weight:bold;color:var(--text-primary);' } }));
          builder.add(e-2, e,   Decoration.mark({ attributes: { style: 'display:none;' } }));
        }
        // Italic
        const ir = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
        while ((m = ir.exec(text)) !== null) {
          const s = line.from + m.index, e = s + m[0].length;
          builder.add(s,   s+1, Decoration.mark({ attributes: { style: 'display:none;' } }));
          builder.add(s+1, e-1, Decoration.mark({ attributes: { style: 'font-style:italic;color:var(--text-primary);' } }));
          builder.add(e-1, e,   Decoration.mark({ attributes: { style: 'display:none;' } }));
        }
      }

      // Blockquotes
      if (text.startsWith('> ') && !here) {
        builder.add(line.from, line.from+2, Decoration.mark({ attributes: { style: 'display:none;' } }));
        builder.add(line.from, line.to, Decoration.mark({
          attributes: { style: 'border-left:3px solid var(--border);padding-left:1em;color:var(--text-muted);font-style:italic;' }
        }));
      }

      // Lists
      if ((text.startsWith('- ') || text.startsWith('* ')) && !here) {
        builder.add(line.from, line.from+2, Decoration.mark({ attributes: { style: 'display:none;' } }));
        builder.add(line.from, line.to, Decoration.mark({
          attributes: { style: 'display:list-item;list-style-type:disc;margin-left:1.5em;color:var(--text-primary);' }
        }));
      }

      // Horizontal rule
      if (text.trim() === '---' && !here) {
        builder.add(line.from, line.to, Decoration.replace({ widget: new HRWidget() }));
      }
    }
    return builder.finish();
  }
}, { decorations: v => v.decorations });

// ─── Build extensions (shared between openFile and reloadEditor) ──────────────
function buildExtensions(filePath) {
  return [
    basicSetup,
    markdown(),
    buildEditorTheme(),
    buildHighlightStyle(),
    markdownDecorations,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        markDirty(filePath);
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await writeTextFile(filePath, update.state.doc.toString());
          markClean(filePath);
        }, 300);
      }
    }),
  ];
}

// ─── Theme ────────────────────────────────────────────────────────────────────
export function buildEditorTheme() {
  const s   = getComputedStyle(document.documentElement);
  const get = v => s.getPropertyValue('--' + v).trim();
  return EditorView.theme({
    '&':                       { background: get('bg-editor'),  color: get('text-primary') },
    '.cm-content':             { paddingLeft: '40px', caretColor: get('accent') },
    '.cm-gutters':             { display: 'none' },
    '.cm-activeLine':          { background: 'transparent' },
    '.cm-cursor':              { borderLeftColor: get('accent') },
    '.cm-selectionBackground': { background: get('accent') + '44 !important' },
    '.cm-line':                { color: get('text-primary') },
    '.cm-scroller':            { fontFamily: 'inherit' },
    '.cm-focused':             { outline: 'none' },
    '.cm-editor':              { background: get('bg-editor') },
  }, { dark: true });
}

// ─── Syntax highlight style ───────────────────────────────────────────────────
export function buildHighlightStyle() {
  const s   = getComputedStyle(document.documentElement);
  const get = v => s.getPropertyValue('--' + v).trim();
  const text   = get('text-primary');
  const accent = get('accent');
  const muted  = get('text-muted');
  return syntaxHighlighting(HighlightStyle.define([
    { tag: tags.heading1,              color: text,   fontWeight: 'bold', fontSize: '2em'   },
    { tag: tags.heading2,              color: text,   fontWeight: 'bold', fontSize: '1.7em' },
    { tag: tags.heading3,              color: text,   fontWeight: 'bold', fontSize: '1.4em' },
    { tag: tags.heading,               color: text,   fontWeight: 'bold' },
    { tag: tags.strong,                color: text,   fontWeight: 'bold' },
    { tag: tags.emphasis,              color: text,   fontStyle: 'italic' },
    { tag: tags.link,                  color: accent, textDecoration: 'underline' },
    { tag: tags.url,                   color: accent },
    { tag: tags.monospace,             color: accent },
    { tag: tags.quote,                 color: muted,  fontStyle: 'italic' },
    { tag: tags.punctuation,           color: muted  },
    { tag: tags.processingInstruction, color: muted  },
    { tag: tags.contentSeparator,      color: muted  },
    { tag: tags.meta,                  color: muted  },
    { tag: tags.comment,               color: muted,  fontStyle: 'italic' },
    { tag: tags.string,                color: text   },
    { tag: tags.keyword,               color: accent },
  ]));
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function getEditorView() { return editorView; }

export function destroyEditor() {
  if (editorView) { editorView.destroy(); editorView = null; }
}

export async function reloadEditor(readTextFile) {
  if (!currentFilePath) return;
  const root    = document.getElementById('editor-root');
  const content = await readTextFile(currentFilePath);
  destroyEditor();
  root.innerHTML = '';
  editorView = new EditorView({
    doc: content,
    extensions: buildExtensions(currentFilePath),
    parent: root,
  });
}

export async function openFile(filePath, itemEl, { readTextFile, recentFiles, currentVaultPath, saveVaultConfig }) {
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
  if (itemEl) itemEl.classList.add('active');

  currentFilePath = filePath;
  const content   = await readTextFile(filePath);

  document.getElementById('no-file').style.display = 'none';
  const root = document.getElementById('editor-root');
  root.style.display = 'block';
  root.innerHTML = '';
  destroyEditor();

  editorView = new EditorView({
    doc: content,
    extensions: buildExtensions(filePath),
    parent: root,
  });

  recentFiles.unshift(filePath);
  const deduped = [...new Set(recentFiles)].slice(0, 8);
  recentFiles.length = 0;
  recentFiles.push(...deduped);
  saveVaultConfig(currentVaultPath, { recentFiles });
}