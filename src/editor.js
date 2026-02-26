import { EditorView } from 'codemirror';
import { keymap, highlightActiveLine, ViewPlugin, Decoration, WidgetType } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { RangeSetBuilder } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { markDirty, markClean } from './tabs.js';
import { countAndUpdate } from './statusbar.js';
import { getVaultImageDataUrl } from './images.js';

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

// ─── Table Widget ─────────────────────────────────────────────────────────────
class TableWidget extends WidgetType {
    constructor(rows, hasHeader, from) {
        super();
        this.rows      = rows;
        this.hasHeader = hasHeader;
        this.from      = from;
    }

    toDOM(view) {
        const table = document.createElement('table');
        table.className = 'cm-table';
        table.style.cursor = 'pointer';

        this.rows.forEach((row, i) => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement(i === 0 && this.hasHeader ? 'th' : 'td');
                td.textContent = cell.trim();
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        table.addEventListener('mousedown', e => {
            e.preventDefault();
            view.dispatch({
                selection: { anchor: this.from + 1 },
                scrollIntoView: true,
            });
            view.focus();
        });

        return table;
    }

    ignoreEvent() { return false; }

    eq(other) {
        return JSON.stringify(other.rows) === JSON.stringify(this.rows) &&
               other.hasHeader === this.hasHeader;
    }
}

// ─── Image Widget ─────────────────────────────────────────────────────────────
class ImageWidget extends WidgetType {
    constructor(src, alt, from) {
        super();
        this.src  = src;
        this.alt  = alt;
        this.from = from;
    }

    toDOM(view) {
        const wrap = document.createElement('div');
        wrap.className = 'cm-image-wrap';

        const img = document.createElement('img');
        img.className = 'cm-image';
        img.alt       = this.alt;

        // Patch: Use data URL for .lapis/assets images
        if (this.src.startsWith('.lapis/assets/')) {
            // Try to get vaultPath from view (assume view has .vaultPath property or fallback)
            let vaultPath = null;
            if (view && view.state && view.state.facet) {
                // Custom: try to get from state if available
                vaultPath = view.state.facet('vaultPath');
            }
            // Fallback: try global or window.currentVaultPath if set
            if (!vaultPath && window.currentVaultPath) {
                vaultPath = window.currentVaultPath;
            }
            const filename = this.src.split('/').pop();
            if (vaultPath) {
                getVaultImageDataUrl(vaultPath, filename).then(dataUrl => {
                    if (dataUrl) img.src = dataUrl;
                    else img.alt = '[Image not found]';
                });
            } else {
                img.alt = '[Vault path not set]';
            }
        } else if (this.src.startsWith('http') || this.src.startsWith('data:')) {
            img.src = this.src;
        } else {
            img.src = `https://asset.localhost/${this.src}`;
        }

        img.onerror = () => {
            wrap.innerHTML = `<span class="cm-image-error">Image not found: ${this.alt}</span>`;
        };

        wrap.addEventListener('mousedown', e => {
            e.preventDefault();
            view.dispatch({
                selection: { anchor: this.from + 1 },
                scrollIntoView: true,
            });
            view.focus();
        });

        wrap.appendChild(img);
        return wrap;
    }

    ignoreEvent() { return false; }

    eq(other) {
        return other.src === this.src && other.alt === this.alt;
    }
}

// ─── Code block widget ────────────────────────────────────────────────────────
class CodeBlockWidget extends WidgetType {
    constructor(code, lang, from) {
        super();
        this.code = code;
        this.lang = lang;
        this.from = from;
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
        code.innerHTML = highlightCode(this.code, this.lang);

        pre.appendChild(code);
        wrap.appendChild(pre);

        wrap.addEventListener('mousedown', e => {
            e.preventDefault();
            const v = EditorView.findFromDOM(wrap);
            if (v) {
                // Place cursor on the opening fence line so cursorInRange fires
                const pos = Math.min(this.from + 1, v.state.doc.length);
                v.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
                v.focus();
            }
        });

        return wrap;
    }

    ignoreEvent() { return false; }

    eq(other) {
        return other.code === this.code && other.lang === this.lang && other.from === this.from;
    }
    
}

// ─── Syntax highlighters ──────────────────────────────────────────────────────
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

function highlightCode(code, lang) {
    if (!lang) return escapeHtml(code);
    const esc = escapeHtml(code);
    const map = {
        js: javascriptHighlight, javascript: javascriptHighlight,
        ts: javascriptHighlight, typescript: javascriptHighlight,
        python: pythonHighlight, py: pythonHighlight,
        rust: rustHighlight,
        css: cssHighlight,
        html: htmlHighlight,
        json: jsonHighlight,
        bash: bashHighlight, sh: bashHighlight, shell: bashHighlight,
    };
    const fn = map[lang.toLowerCase()];
    return fn ? fn(esc) : esc;
}

let editorView      = null;
let saveTimeout     = null;
let currentFilePath = null;

// ─── Cursor helpers ───────────────────────────────────────────────────────────
function cursorOnLine(view, line) {
    for (const r of view.state.selection.ranges)
        if (view.state.doc.lineAt(r.head).number === line.number) return true;
    return false;
}

function cursorInRange(view, from, to) {
    for (const r of view.state.selection.ranges)
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

        // ── Pre-pass: find and handle table blocks ────────────────────────────
        const tableLines = new Set();
        let i = 1;
        while (i <= doc.lines) {
            const line = doc.line(i);
            const text = line.text.trim();

            if (text.startsWith('|') && text.endsWith('|')) {
                const blockStart = i;
                const blockLines = [];
                let j = i;
                while (j <= doc.lines) {
                    const tl = doc.line(j).text.trim();
                    if (tl.startsWith('|') && tl.endsWith('|')) {
                        blockLines.push({ lineNum: j, text: tl });
                        j++;
                    } else break;
                }

                if (blockLines.length >= 2) {
                    const blockFrom = doc.line(blockStart).from;
                    const blockTo   = doc.line(j - 1).to;
                    const cursorIn  = cursorInRange(view, blockFrom, blockTo);

                    if (cursorIn) {
                        for (const bl of blockLines) {
                            const bl_line = doc.line(bl.lineNum);
                            decos.push({ from: bl_line.from, to: bl_line.to,
                                deco: Decoration.mark({ attributes: { style: 'color:var(--text-primary);font-family:monospace;' } }) });
                            tableLines.add(bl.lineNum);
                        }
                    } else {
                        const rows = [];
                        for (const bl of blockLines) {
                            if (bl.text.match(/^\|[\s\-\|:]+\|$/)) continue;
                            const cells = bl.text
                                .split('|')
                                .filter((_, ci, arr) => ci > 0 && ci < arr.length - 1)
                                .map(c => c.trim());
                            rows.push(cells);
                        }

                        const hasHeader = blockLines.length >= 2 &&
                            blockLines[1].text.match(/^\|[\s\-\|:]+\|$/);

                        if (rows.length > 0) {
                            for (const bl of blockLines) {
                                const bl_line = doc.line(bl.lineNum);
                                decos.push({ from: bl_line.from, to: bl_line.to,
                                    deco: Decoration.mark({ attributes: { style: 'display:none;font-size:0;line-height:0;' } }) });
                                tableLines.add(bl.lineNum);
                            }
                            decos.push({
                                from: doc.line(blockStart).from,
                                to:   doc.line(blockStart).from,
                                deco: Decoration.widget({
                                    widget: new TableWidget(rows, hasHeader, doc.line(blockStart).from),
                                    side: -1,
                                })
                            });
                        }
                    }
                    i = j;
                    continue;
                }
            }
            i++;
        }

        // ── Per-line decorations ──────────────────────────────────────────────
        let inCodeBlock   = false;
        let inCodeLang    = '';
        let codeBlockFrom = -1;
        let codeLines     = [];
        let openFenceLine = -1;

        for (let i = 1; i <= doc.lines; i++) {
            if (tableLines.has(i)) continue;

            const line = doc.line(i);
            const text = line.text;
            const here = cursorOnLine(view, line);

            // ── Fenced code blocks ──
            if (text.trimStart().startsWith('```')) {
                if (!inCodeBlock) {
                    // OPENING FENCE — start collecting
                    inCodeBlock   = true;
                    inCodeLang    = text.trimStart().slice(3).trim().toLowerCase();
                    codeBlockFrom = line.from;
                    codeLines     = [];
                    openFenceLine = i;
                } else {
                    // CLOSING FENCE — decide render vs edit mode
                    const codeBlockTo = line.to;
                    const cursorIn    = cursorInRange(view, codeBlockFrom, codeBlockTo);
                    inCodeBlock = false;

                    if (cursorIn) {
                        // Cursor inside: show all raw lines styled as monospace
                        for (let j = openFenceLine; j <= i; j++) {
                            const cl = doc.line(j);
                            decos.push({
                                from: cl.from,
                                to:   cl.to,
                                deco: Decoration.mark({
                                    attributes: { style: 'font-family:monospace;color:var(--text-muted);background:var(--bg-tertiary);display:block;padding:1px 12px;border-radius:2px;' }
                                })
                            });
                        }
                    } else {
                        // Cursor outside: hide all raw lines and show widget
                        const code = codeLines.join('\n');

                        for (let j = openFenceLine; j <= i; j++) {
                            const cl = doc.line(j);
                            decos.push({
                                from: cl.from,
                                to:   cl.to,
                                deco: Decoration.mark({
                                    attributes: { style: 'display:none;font-size:0;' }
                                })
                            });
                        }

                        decos.push({
                            from: codeBlockFrom,
                            to:   codeBlockFrom,
                            deco: Decoration.widget({
                                widget: new CodeBlockWidget(code, inCodeLang, codeBlockFrom),
                                side: -1,
                            })
                        });
                    }

                    inCodeLang = '';
                    codeLines  = [];
                }
                continue;
            }

            if (inCodeBlock) {
                codeLines.push(text);
                // Never individually hide code body lines here —
                // they are handled in bulk when the closing fence is found
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

                // ── Images ──
                const imgr = /!\[([^\]]*)\]\(([^)]+)\)/g;
                while ((m = imgr.exec(text)) !== null) {
                    const s   = line.from + m.index;
                    const e   = s + m[0].length;
                    const alt = m[1];
                    const src = m[2];
                    decos.push({ from: s, to: e,
                        deco: Decoration.mark({ attributes: { style: 'display:none;' } }) });
                    decos.push({ from: s, to: s,
                        deco: Decoration.widget({
                            widget: new ImageWidget(src, alt, s),
                            side: -1,
                        })
                    });
                }

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

                // ── Links (not images) ──
                const lr = /(?<!!)(\[([^\]]+)\]\(([^)]+)\))/g;
                while ((m = lr.exec(text)) !== null) {
                    const s       = line.from + m.index;
                    const e       = s + m[0].length;
                    const textEnd = s + m[2].length + 2;
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
        }

        // Sort and build
        decos.sort((a, b) => a.from - b.from || a.to - b.to);

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
    const fontFamily   = localStorage.getItem('lapis-font-family') || 'system';
    const resolvedFont = fontFamily === 'system' ? 'inherit' : fontFamily;
    return EditorView.theme({
        '&':                                   { background: get('bg-editor'), color: get('text-primary'), height: '100%', flex: '1' },
        '&.cm-focused':                        { outline: 'none !important' },
        '.cm-scroller':                        { fontFamily: resolvedFont, overflow: 'auto', padding: '40px 60px' },
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
    console.log("Reloading editor...", currentFilePath);
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

export async function openFile(filePath, itemEl, { readTextFile, recentFiles, currentVaultPath, saveVaultConfig, loadVaultConfig }) {
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    if (itemEl) itemEl.classList.add('active');

    currentFilePath = filePath;
    const content   = await readTextFile(filePath);
    // Patch: Set global vault path for image widgets
    if (currentVaultPath) {
        window.currentVaultPath = currentVaultPath;
    }

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
    const existing = await loadVaultConfig(currentVaultPath);
    await saveVaultConfig(currentVaultPath, { ...existing, recentFiles: deduped });
}