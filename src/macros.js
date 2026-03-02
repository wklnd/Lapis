import { EditorView } from 'codemirror';

// ─── Macro definitions ────────────────────────────────────────────────────────
// Each entry: { pattern: string, description: string, expand: () => string }
export const MACROS = [
    // ── Date & Time ──────────────────────────────────────────────────────────
    {
        pattern: 'DATE',
        description: 'Current date (YYYY-MM-DD)',
        expand: () => {
            return new Date().toISOString().slice(0, 10);
        },
    },
    {
        pattern: 'DATE_SHORT',
        description: 'Short date (DD/MM/YYYY)',
        expand: () => {
            const d = new Date();
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        },
    },
    {
        pattern: 'DATE_LONG',
        description: 'Long date (e.g. Monday, March 3 2026)',
        expand: () => {
            return new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            });
        },
    },
    {
        pattern: 'TIME',
        description: 'Current time (HH:MM)',
        expand: () => {
            const d = new Date();
            return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
    },
    {
        pattern: 'TIME_FULL',
        description: 'Current time with seconds (HH:MM:SS)',
        expand: () => {
            const d = new Date();
            return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        },
    },
    {
        pattern: 'DATETIME',
        description: 'Date and time (YYYY-MM-DD HH:MM)',
        expand: () => {
            const d = new Date();
            return `${d.toISOString().slice(0, 10)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
    },
    {
        pattern: 'TIMESTAMP',
        description: 'Unix timestamp (seconds)',
        expand: () => String(Math.floor(Date.now() / 1000)),
    },

    // ── Calendar ─────────────────────────────────────────────────────────────
    {
        pattern: 'WEEKDAY',
        description: 'Day of the week (e.g. Monday)',
        expand: () => new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    },
    {
        pattern: 'WEEKDAY_SHORT',
        description: 'Abbreviated day (e.g. Mon)',
        expand: () => new Date().toLocaleDateString('en-US', { weekday: 'short' }),
    },
    {
        pattern: 'WEEK',
        description: 'ISO week number (e.g. 10)',
        expand: () => {
            const d   = new Date();
            const jan = new Date(d.getFullYear(), 0, 1);
            return String(Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7));
        },
    },
    {
        pattern: 'MONTH',
        description: 'Full month name (e.g. March)',
        expand: () => new Date().toLocaleDateString('en-US', { month: 'long' }),
    },
    {
        pattern: 'MONTH_SHORT',
        description: 'Abbreviated month (e.g. Mar)',
        expand: () => new Date().toLocaleDateString('en-US', { month: 'short' }),
    },
    {
        pattern: 'MONTH_NUM',
        description: 'Month as number (e.g. 03)',
        expand: () => pad(new Date().getMonth() + 1),
    },
    {
        pattern: 'YEAR',
        description: 'Current four-digit year (e.g. 2026)',
        expand: () => String(new Date().getFullYear()),
    },
    {
        pattern: 'YEAR_SHORT',
        description: 'Two-digit year (e.g. 26)',
        expand: () => String(new Date().getFullYear()).slice(2),
    },
    {
        pattern: 'DAY',
        description: 'Day of month as number (e.g. 03)',
        expand: () => pad(new Date().getDate()),
    },

    // ── Random / utility ─────────────────────────────────────────────────────
    {
        pattern: 'UUID',
        description: 'Random UUID v4',
        expand: () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = (Math.random() * 16) | 0;
                return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });
        },
    },
    {
        pattern: 'RANDOM',
        description: 'Random integer 0–9999',
        expand: () => String(Math.floor(Math.random() * 10000)),
    },
    {
        pattern: 'CURSOR',
        description: 'Marks the desired cursor position after expansion (used in templates)',
        expand: () => '', // special — handled by template engine, no-op at typing time
    },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

// ─── Apply macros to a string (used by templates) ────────────────────────────
export function expandMacros(text) {
    let result = text;
    for (const macro of MACROS) {
        result = result.replaceAll(`{{${macro.pattern}}}`, macro.expand());
    }
    return result;
}

// ─── macroExpansionExtension ───────────────────────────────────────────────────────
export const macroExpansionExtension = EditorView.updateListener.of(update => {
    if (!update.docChanged) return;

    const view  = update.view;
    const state = view.state;
    const pos   = state.selection.main.head;
    const line  = state.doc.lineAt(pos);
    const text  = line.text;

    const pattern = /\{\{([A-Z_]+)\}\}/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const macro = MACROS.find(m => m.pattern === match[1]);
        if (!macro || macro.pattern === 'CURSOR') continue;

        const from  = line.from + match.index;
        const to    = from + match[0].length;
        const value = macro.expand();

        view.dispatch({
            changes: { from, to, insert: value },
            selection: { anchor: from + value.length },
        });
        return; // one expansion per keystroke to avoid cascade
    }
});
