import { exists, readDir, readTextFile, writeTextFile, mkdir, remove } from '@tauri-apps/plugin-fs';

export const BUILT_IN_THEMES = {
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
      'accent':        '#26619c',
      'border':        '#ddd',
      'sidebar-bg':    '#f0f0f0',
    }
  },
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
  },
  'gruvbox-dark': {
    name: 'Gruvbox Dark',
    built_in: true,
    colors: {
      'bg-primary':    '#282828',   // dark0
      'bg-secondary':  '#32302f',   // dark1
      'bg-tertiary':   '#3c3836',   // dark2
      'bg-editor':     '#1d2021',   // darker base
      'text-primary':  '#ebdbb2',   // light1
      'text-muted':    '#a89984',   // gray
      'accent':        '#fabd2f',   // yellow
      'border':        '#504945',   // dark4
      'sidebar-bg':    '#282828',
    }
  },
  'gruvbox-light': {
    name: 'Gruvbox Light',
    built_in: true,
    colors: {
    'bg-primary':    '#fbf1c7',   // light0
    'bg-secondary':  '#f2e5bc',   // light1
    'bg-tertiary':   '#ebdbb2',   // light2
    'bg-editor':     '#f9f5d7',   // softer writing surface
    'text-primary':  '#3c3836',   // dark2
    'text-muted':    '#7c6f64',   // gray
    'accent':        '#d79921',   // warm yellow
    'border':        '#bdae93',
    'sidebar-bg':    '#f2e5bc',
  }
},
  'vaporwave': {
    name: 'Vaporwave',
    built_in: true,
    colors: {
      'bg-primary':    '#1a1333',
      'bg-secondary':  '#21194a',
      'bg-tertiary':   '#2b1f66',
      'bg-editor':     '#140f2b',
      'text-primary':  '#f8f8ff',
      'text-muted':    '#b8b4ff',
      'accent':        '#ff71ce',  // neon pink
      'border':        '#3d2c7a',
      'sidebar-bg':    '#1a1333',
    }
},
'soft-dark': {
  name: 'Soft Dark',
  built_in: true,
  colors: {
    'bg-primary':    '#1e1f24',
    'bg-secondary':  '#24262c',
    'bg-tertiary':   '#2c2f36',
    'bg-editor':     '#1a1c21',
    'text-primary':  '#e6e6e6',
    'text-muted':    '#9aa0a6',
    'accent':        '#5ea1ff',  // calm blue
    'border':        '#343740',
    'sidebar-bg':    '#1e1f24',
  }
},
'soft-light': {
  name: 'Soft Light',
  built_in: true,
  colors: {
    'bg-primary':    '#f5f6f8',
    'bg-secondary':  '#eceef2',
    'bg-tertiary':   '#e2e5ea',
    'bg-editor':     '#ffffff',
    'text-primary':  '#2b2f36',
    'text-muted':    '#6b7280',
    'accent':        '#3b82f6',
    'border':        '#d6d9df',
    'sidebar-bg':    '#eceef2',
  }
},
'helios': {
  name: 'Helios',
  built_in: false,
  colors: {
    'bg-primary':    '#fdf6e3', 
    'bg-secondary':  '#f6e8c9',  
    'bg-tertiary':   '#edd9a3', 
    'bg-editor':     '#fffdf7',  
    'text-primary':  '#3a2f1f', 
    'text-muted':    '#8b7355',
    'accent':        '#e6a817',  
    'border':        '#e2c98a', 
    'sidebar-bg':    '#f6e8c9',
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