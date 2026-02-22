import { registerCommands } from './palette.js';
import { openSettings } from './settings.js';
import { showWelcome, renderRecentVaultsList, handleCreateVault, handleOpenVaultDialog } from './vault.js';
import { clearTabs } from './tabs.js';

export function initCommands({ newFile, callbacks }) {
  registerCommands([
    { label: 'New File',      shortcut: 'Ctrl+N', action: newFile },
    { label: 'Open Vault',    shortcut: '',        action: () => handleOpenVaultDialog({ buildFileTree: callbacks.buildFileTree, renderRecentVaultsList }) },
    { label: 'Create Vault',  shortcut: '',        action: () => handleCreateVault({ buildFileTree: callbacks.buildFileTree, renderRecentVaultsList }) },
    { label: 'Switch Vault',  shortcut: '',        action: () => { clearTabs(); showWelcome({ renderRecentVaultsList }); } },
    { label: 'Open Settings', shortcut: '',        action: openSettings },
    //{ label: 'Close Lapis',   shortcut: 'Ctrl+Q', action: () => window.close() },
  ]);
}