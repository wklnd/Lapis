import { exists, readDir, readTextFile, writeTextFile, mkdir, remove } from '@tauri-apps/plugin-fs';

export const BUILT_IN_THEMES = {
  dark: {
    name: 'Dark',
    built_in: true,
    colors: {
      'bg-primary':    '#1a1a2e',
      'bg-secondary':  '#12121f',
      'bg-tertiary':   '#15152a',
      'bg-editor':     '#1e1e1e',
      'text-primary':  '#d4d4d4',
      'text-muted':    '#666',
      'accent':        '#26619c',
      'border':        '#2a2a3e',
      'sidebar-bg':    '#12121f',
    }
  },
  light: {
    name: 'Light',
    built_in: true,
    colors: {
      'bg-primary':    '#ffffff',
      'bg-secondary':  '#f5f5f5',
      'bg-tertiary':   '#ebebeb',
      'bg-editor':     '#ffffff',
      'text-primary':  '#1a1a1a',
      'text-muted':    '#888',
      'accent':        '#7c3aed',
      'border':        '#ddd',
      'sidebar-bg':    '#f0f0f0',
    }
  },
  sepia: {
    name: 'Sepia',
    built_in: true,
    colors: {
      'bg-primary':    '#f4efe6',
      'bg-secondary':  '#ede8df',
      'bg-tertiary':   '#e8e0d0',
      'bg-editor':     '#f8f3ea',
      'text-primary':  '#3d2b1f',
      'text-muted':    '#a08060',
      'accent':        '#b5620a',
      'border':        '#d4c9b0',
      'sidebar-bg':    '#ede8df',
    }
  },
  'high-contrast': {
    name: 'High Contrast',
    built_in: true,
    colors: {
      'bg-primary':    '#000000',
      'bg-secondary':  '#0a0a0a',
      'bg-tertiary':   '#111111',
      'bg-editor':     '#000000',
      'text-primary':  '#ffffff',
      'text-muted':    '#aaaaaa',
      'accent':        '#ffff00',
      'border':        '#ffffff',
      'sidebar-bg':    '#0a0a0a',
    }
  }
};

export function applyTheme(colors) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty('--' + key, value);
  }
}

export async function loadCustomThemes(vaultPath) {
  if (!vaultPath) return [];
  const themesDir = vaultPath.replace(/\\/g, '/') + '/.lapis/themes';
  try {
    if (!(await exists(themesDir))) return [];
    const files = await readDir(themesDir);
    const themes = [];
    for (const f of files) {
      if (!f.name.endsWith('.json')) continue;
      try {
        const raw = await readTextFile(themesDir + '/' + f.name);
        const theme = JSON.parse(raw);
        theme._file = f.name;
        themes.push(theme);
      } catch(e) { console.warn('bad theme file', f.name, e); }
    }
    return themes;
  } catch(e) { return []; }
}

export async function saveCustomTheme(vaultPath, theme) {
  const themesDir = vaultPath.replace(/\\/g, '/') + '/.lapis/themes';
  if (!(await exists(themesDir))) await mkdir(themesDir, { recursive: true });
  const fileName = theme.name.toLowerCase().replace(/\s+/g, '-') + '.json';
  await writeTextFile(themesDir + '/' + fileName, JSON.stringify(theme, null, 2));
  return fileName;
}

export async function deleteCustomTheme(vaultPath, fileName) {
  const path = vaultPath.replace(/\\/g, '/') + '/.lapis/themes/' + fileName;
  await remove(path);
}