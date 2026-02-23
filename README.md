<p align="center">
  <img src="media/logo.png" alt="Lapis Logo" width="800">
</p>


A minimal markdown editor built with Tauri. Fast to open, stays out of your way.
---

## Why

Most markdown editors are either too heavy (Obsidian, Notion) or too bare-bones. Lapis goal is to sit in the middle, it renders markdown as you type, keeps your files as plain `.md` files on disk, and ships as a ~10MB binary.

---

## Features

- **Live rendering** — headings, bold, italic, lists, blockquotes and horizontal rules render inline. Click to edit the raw markdown.
- **Vaults** — a vault is just a folder. Open any folder, Lapis tracks it.
- **Tabs** — open multiple files, tabs reopen on next launch.
- **Command palette** — `Ctrl+P` to open files, `>` to run commands.
- **Themes** — dark, light, sepia, high contrast. Custom themes via JSON in your vault.
- **Resizable sidebar** — drag the edge, it remembers the width.
- **Status bar** — word count and character count as you write.

---

## Shortcuts

| | |
|---|---|
| `Ctrl+P` | Command palette |
| `Ctrl+N` | New file |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |

---

## Getting started

You'll need [Rust](https://rustup.rs/) and Node.js installed.

```bash
git clone https://github.com/yourname/lapis
cd lapis
npm install
npm run tauri dev
```

To build a release binary:

```bash
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

---

## Custom themes

Drop a `.json` file into `.lapis/themes/` inside your vault:

```json
{
  "name": "My Theme",
  "colors": {
    "bg-primary":   "#1a1a2e",
    "bg-secondary": "#12121f",
    "bg-tertiary":  "#15152a",
    "bg-editor":    "#1e1e1e",
    "text-primary": "#d4d4d4",
    "text-muted":   "#666666",
    "accent":       "#a78bfa",
    "border":       "#2a2a3e",
    "sidebar-bg":   "#12121f"
  }
}
```

Or create one from Settings inside the app.

---

## Stack

- [Tauri 2](https://tauri.app/) — native shell, no Electron
- [CodeMirror 6](https://codemirror.net/) — editor
- Vanilla JS + Vite — no framework

---

## License

MIT