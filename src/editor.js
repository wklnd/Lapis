import { EditorView } from 'codemirror';
import { keymap, highlightActiveLine, ViewPlugin, Decoration, WidgetType } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { RangeSetBuilder } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting, LanguageSupport } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { markDirty, markClean } from './tabs.js';
import { countAndUpdate } from './statusbar.js';

// ─── Manual setup (no line numbers) ──────────────────────────────────────────
const manualSetup = [
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  bracketMatching(),
  closeBrackets(),
  highlightActiveLine(),
];

// ─── HR Widget ────────────────────────────────────────────────────────────────
class HRWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-hr-line';
    return el;
  }
  ignoreEvent() { return false; }
}

// ─── Code block widget ────────────────────────────────────────────────────────
class CodeBlockWidget extends WidgetType {
  constructor(code, lang) {
    super();
    this.code = code;
    this.lang = lang;
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-code-block';

    if (this.lang) {
      const label = document.createElement('span');
      label.className = 'cm-code-lang';
      label.textContent = this.lang;
      wrap.appendChild(label);
    }

    const pre  = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = this.code;

    // Apply syntax highlight colors via spans
    const highlighted = highlightCode(this.code, this.lang);
    if (highlighted) {
      code.innerHTML = highlighted;
    }

    pre.appendChild(code);
    wrap.appendChild(pre);
    return wrap;
  }

  ignoreEvent() { return true; }

  eq(other) {
    return other.code === this.code && other.lang === this.lang;
  }
}

// ─── Simple syntax highlighter for widget rendering ───────────────────────────
function highlightCode(code, lang) {
  if (!lang) return escapeHtml(code);

  const esc = escapeHtml(code);

  const patterns = {
    js: javascriptHighlight,
    javascript: javascriptHighlight,
    ts: javascriptHighlight,
    typescript: javascriptHighlight,
    python: pythonHighlight,
    py: pythonHighlight,
    rust: rustHighlight,
    css: cssHighlight,
    html: htmlHighlight,
    json: jsonHighlight,
    bash: bashHighlight,
    sh: bashHighlight,
    shell: bashHighlight,
  };

  const fn = patterns[lang.toLowerCase()];
  return fn ? fn(esc) : esc;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const kw  = s => `<span style="color:#c678dd">${s}</span>`;
const str = s => `<span style="color:#98c379">${s}</span>`;
const num = s => `<span style="color:#d19a66">${s}</span>`;
const cmt = s => `<span style="color:#5c6370;font-style:italic">${s}</span>`;
const fn_ = s => `<span style="color:#61afef">${s}</span>`;
const typ = s => `<span style="color:#e5c07b">${s}</span>`;
const op  = s => `<span style="color:#56b6c2">${s}</span>`;
const atr = s => `<span style="color:#e06c75">${s}</span>`;

function javascriptHighlight(code) {
  return code
    .replace(/(\/\/.*$)/gm,                          cmt('$1'))
    .replace(/(&quot;.*?&quot;|'.*?'|`.*?`)/g,       str('$1'))
    .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|typeof|instanceof|throw|try|catch|finally|switch|case|break|continue|default|void|delete|in|of|null|undefined|true|false)\b/g, kw('$1'))
    .replace(/\b([A-Z][a-zA-Z]*)\b/g,                typ('$1'))
    .replace(/\b(\d+\.?\d*)\b/g,                     num('$1'))
    .replace(/\b([a-z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,  fn_('$1'));
}

function pythonHighlight(code) {
  return code
    .replace(/(#.*$)/gm,                             cmt('$1'))
    .replace(/(&quot;.*?&quot;|'.*?')/g,             str('$1'))
    .replace(/\b(def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|try|except|finally|with|as|pass|break|continue|raise|yield|lambda|async|await)\b/g, kw('$1'))
    .replace(/\b([A-Z][a-zA-Z]*)\b/g,               typ('$1'))
    .replace(/\b(\d+\.?\d*)\b/g,                    num('$1'))
    .replace(/\b([a-z_][a-zA-Z0-9_]*)\s*(?=\()/g,   fn_('$1'));
}

function rustHighlight(code) {
  return code
    .replace(/(\/\/.*$)/gm,                          cmt('$1'))
    .replace(/(&quot;.*?&quot;)/g,                   str('$1'))
    .replace(/\b(fn|let|mut|const|struct|enum|impl|use|mod|pub|return|if|else|for|while|match|in|self|Self|true|false|None|Some|Ok|Err|async|await|move|ref|type|trait|where|loop|break|continue|as|super|crate)\b/g, kw('$1'))
    .replace(/\b([A-Z][a-zA-Z]*)\b/g,               typ('$1'))
    .replace(/\b(\d+\.?\d*)\b/g,                    num('$1'))
    .replace(/\b([a-z_][a-zA-Z0-9_]*)\s*(?=\()/g,   fn_('$1'));
}

function cssHighlight(code) {
  return code
    .replace(/(\/\*.*?\*\/)/gs,                      cmt('$1'))
    .replace(/(&quot;.*?&quot;|'.*?')/g,             str('$1'))
    .replace(/([a-z-]+)\s*(?=:)/g,                   atr('$1'))
    .replace(/(#[0-9a-fA-F]{3,6})/g,                num('$1'))
    .replace(/\b(\d+\.?\d*)(px|em|rem|%|vh|vw|s|ms)?\b/g, num('$1$2'))
    .replace(/([.#]?[a-zA-Z][a-zA-Z0-9_-]*)\s*(?=\{)/g, fn_('$1'));
}

function htmlHighlight(code) {
  return code
    .replace(/(&lt;!--.*?--&gt;)/gs,                 cmt('$1'))
    .replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)/g,      kw('$1'))
    .replace(/([a-zA-Z-]+)(?=\s*=)/g,               atr('$1'))
    .replace(/(&quot;.*?&quot;)/g,                   str('$1'))
    .replace(/(&gt;)/g,                              kw('$1'));
}

function jsonHighlight(code) {
  return code
    .replace(/(&quot;.*?&quot;)\s*:/g,               `${atr('$1')}:`)
    .replace(/:\s*(&quot;.*?&quot;)/g,               `: ${str('$1')}`)
    .replace(/\b(true|false|null)\b/g,               kw('$1'))
    .replace(/\b(\d+\.?\d*)\b/g,                    num('$1'));
}

function bashHighlight(code) {
  return code
    .replace(/(#.*$)/gm,                             cmt('$1'))
    .replace(/(&quot;.*?&quot;|'.*?')/g,             str('$1'))
    .replace(/\b(cd|ls|mkdir|rm|cp|mv|echo|cat|grep|find|chmod|sudo|apt|npm|cargo|git|curl|wget|export|source|if|then|else|fi|for|do|done|while|case|esac|function|return|exit)\b/g, kw('$1'))
    .replace(/(\$[a-zA-Z_][a-zA-Z0-9_]*)/g,         typ('$1'))
    .replace(/(--?[a-zA-Z][a-zA-Z0-9-]*)/g,         atr('$1'));
}

let editorView      = null;
let saveTimeout     = null;
let currentFilePath = null;

// ─── Cursor helper ────────────────────────────────────────────────────────────
function cursorOnLine(view, line) {
  for (let r of view.state.selection.ranges)
    if (view.state.doc.lineAt(r.head).number === line.number) return true;
  return false;
}

function cursorInRange(view, from, to) {
  for (let r of view.state.selection.ranges)
    if (r.head >= from && r.head <= to) return true;
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
    const doc   = view.state.doc;
    const decos = [];
    let inCodeBlock  = false;
    let inCodeLang   = '';
    let codeStart    = -1;
    let codeLines    = [];
    let codeStartPos = -1;

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const text = line.text;
      const here = cursorOnLine(view, line);

// ── Fenced code blocks ──
if (text.trimStart().startsWith('```')) {
  if (!inCodeBlock) {
    inCodeBlock = true;
    inCodeLang  = text.trimStart().slice(3).trim().toLowerCase();
    // Show opening fence dimmed, never hide it
    decos.push({ from: line.from, to: line.to,
      deco: Decoration.mark({ attributes: { style: 'font-family:monospace;color:var(--text-muted);background:var(--bg-tertiary);display:block;padding:2px 12px;border-radius:6px 6px 0 0;' } }) });
  } else {
    inCodeBlock = false;
    inCodeLang  = '';
    decos.push({ from: line.from, to: line.to,
      deco: Decoration.mark({ attributes: { style: 'font-family:monospace;color:var(--text-muted);background:var(--bg-tertiary);display:block;padding:2px 12px;border-radius:0 0 6px 6px;' } }) });
  }
  continue;
}

if (inCodeBlock) {
  const langColors = {
    js: '#e5c07b', javascript: '#e5c07b',
    ts: '#4ec9b0', typescript: '#4ec9b0',
    python: '#dcdcaa', py: '#dcdcaa',
    rust: '#ce9178',
    css: '#d7ba7d',
    html: '#f28b82',
    json: '#ce9178',
    bash: '#98c379', sh: '#98c379', shell: '#98c379',
  };
  const color = langColors[inCodeLang] || 'var(--accent)';
  decos.push({ from: line.from, to: line.to,
    deco: Decoration.mark({ attributes: { style: `font-family:monospace;color:${color};background:var(--bg-tertiary);display:block;padding:2px 12px;` } }) });
  continue;
}

      if (inCodeBlock) {
        codeLines.push(text);
        if (!here) {
          decos.push({ from: line.from, to: line.to, deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
        }
        continue;
      }

      // ── Headings ──
      const hm = text.match(/^(#{1,6})\s/);
      if (hm && !here) {
        const sz = ['2em','1.7em','1.4em','1.2em','1.1em','1em'][hm[1].length - 1];
        decos.push({ from: line.from, to: line.to,
          deco: Decoration.mark({ attributes: { style: `font-size:${sz};font-weight:bold;color:var(--text-primary);` } }) });
        decos.push({ from: line.from, to: line.from + hm[1].length + 1,
          deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
      }

      if (!here) {
        let m;

        // ── Bold ──
        const br = /\*\*(.+?)\*\*/g;
        while ((m = br.exec(text)) !== null) {
          const s = line.from + m.index, e = s + m[0].length;
          decos.push({ from: s,   to: s+2, deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
          decos.push({ from: s+2, to: e-2, deco: Decoration.mark({ attributes: { style: 'font-weight:bold;color:var(--text-primary);' } }) });
          decos.push({ from: e-2, to: e,   deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
        }

        // ── Italic ──
        const ir = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
        while ((m = ir.exec(text)) !== null) {
          const s = line.from + m.index, e = s + m[0].length;
          decos.push({ from: s,   to: s+1, deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
          decos.push({ from: s+1, to: e-1, deco: Decoration.mark({ attributes: { style: 'font-style:italic;color:var(--text-primary);' } }) });
          decos.push({ from: e-1, to: e,   deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
        }

        // ── Inline code ──
        const cr = /`([^`]+)`/g;
        while ((m = cr.exec(text)) !== null) {
          const s = line.from + m.index, e = s + m[0].length;
          decos.push({ from: s,   to: s+1, deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
          decos.push({ from: s+1, to: e-1, deco: Decoration.mark({ attributes: { style: 'background:var(--bg-tertiary);color:var(--accent);font-family:monospace;padding:1px 5px;border-radius:3px;' } }) });
          decos.push({ from: e-1, to: e,   deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
        }

        // ── Links ──
        const lr = /\[([^\]]+)\]\(([^)]+)\)/g;
        while ((m = lr.exec(text)) !== null) {
          const s       = line.from + m.index, e = s + m[0].length;
          const textEnd = s + m[1].length + 2;
          decos.push({ from: s,         to: s+1,       deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
          decos.push({ from: s+1,       to: textEnd-1, deco: Decoration.mark({ attributes: { style: 'color:var(--accent);text-decoration:underline;cursor:pointer;' } }) });
          decos.push({ from: textEnd-1, to: e,         deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
        }
      }

      // ── Blockquotes ──
      if (text.startsWith('> ') && !here) {
        decos.push({ from: line.from, to: line.from+2,
          deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
        decos.push({ from: line.from, to: line.to,
          deco: Decoration.mark({ attributes: { style: 'border-left:3px solid var(--border);padding-left:1em;color:var(--text-muted);font-style:italic;' } }) });
      }

      // ── Lists ──
      if ((text.startsWith('- ') || text.startsWith('* ')) && !here) {
        decos.push({ from: line.from, to: line.from+2,
          deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
        decos.push({ from: line.from, to: line.to,
          deco: Decoration.mark({ attributes: { style: 'display:list-item;list-style-type:disc;margin-left:1.5em;color:var(--text-primary);' } }) });
      }

      // ── Horizontal rule ──
      if (text.trim() === '---' && !here) {
        decos.push({ from: line.from, to: line.to,
          deco: Decoration.replace({ widget: new HRWidget() }) });
      }
      // Task list (custom)
      // @todo

      // Tables
      // @todo

    }

    // Handle unclosed code block at end of doc — render lines as-is
    // (no widget, just leave them styled)

    // Sort by position — required by RangeSetBuilder
    decos.sort((a, b) => a.from - b.from || a.to - b.to);

    // Add non-overlapping decorations
    const builder = new RangeSetBuilder();
    let lastTo = -1;
    for (const { from, to, deco } of decos) {
      if (from >= lastTo) {
        try {
          builder.add(from, to, deco);
          lastTo = to;
        } catch(e) {
          // skip conflicting decoration
        }
      }
    }

    return builder.finish();
  }
}, { decorations: v => v.decorations });

// ─── Code block CSS ───────────────────────────────────────────────────────────
export function injectCodeBlockStyles() {
  if (document.getElementById('lapis-code-styles')) return;
  const style = document.createElement('style');
  style.id = 'lapis-code-styles';
  style.textContent = `
    .cm-code-block {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin: 8px 0;
      overflow: hidden;
      font-family: monospace;
      font-size: 0.9em;
      position: relative;
    }
    .cm-code-lang {
      display: block;
      padding: 4px 12px;
      font-size: 0.75em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cm-code-block pre {
      margin: 0;
      padding: 12px;
      overflow-x: auto;
      line-height: 1.6;
    }
    .cm-code-block code {
      font-family: monospace;
      white-space: pre;
    }
  `;
  document.head.appendChild(style);
}

// ─── Build extensions ─────────────────────────────────────────────────────────
function buildExtensions(filePath) {
  return [
    manualSetup,
    markdown(),
    buildEditorTheme(),
    buildHighlightStyle(),
    markdownDecorations,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        markDirty(filePath);
        const text = update.state.doc.toString();
        countAndUpdate(filePath, text);
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await writeTextFile(filePath, text);
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
    '&':                                   { background: get('bg-editor'), color: get('text-primary'), height: '100%', flex: '1' },
    '&.cm-focused':                        { outline: 'none !important' },
    '.cm-scroller':                        { fontFamily: 'inherit', overflow: 'auto', padding: '40px 60px' },
    '.cm-content':                         { caretColor: get('accent'), maxWidth: '720px', margin: '0 auto', paddingBottom: '200px' },
    '.cm-line':                            { color: get('text-primary'), padding: '0' },
    '.cm-cursor':                          { borderLeftColor: get('accent') },
    '.cm-gutters':                         { display: 'none !important' },
    '.cm-activeLine':                      { background: 'transparent !important' },
    '.cm-activeLineGutter':                { background: 'transparent !important' },
    '.cm-selectionBackground':             { background: get('accent') + '33 !important' },
    '.cm-focused .cm-selectionBackground': { background: get('accent') + '33 !important' },
    '.cm-editor':                          { background: get('bg-editor'), height: '100%' },
    '.cm-tooltip':                         { background: get('bg-secondary'), border: '1px solid ' + get('border') },
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
  root.style.display = 'flex';
  root.innerHTML = '';
  destroyEditor();

  injectCodeBlockStyles();

  editorView = new EditorView({
    doc: content,
    extensions: buildExtensions(filePath),
    parent: root,
  });

  countAndUpdate(filePath, content);
  recentFiles.unshift(filePath);
  const deduped = [...new Set(recentFiles)].slice(0, 8);
  recentFiles.length = 0;
  recentFiles.push(...deduped);
  saveVaultConfig(currentVaultPath, { recentFiles });
}