// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron';

const electronHandler = {
  getDiscordToken: (): Promise<string> => ipcRenderer.invoke('getDiscordToken'),
  setDiscordToken: (discordToken: string): Promise<void> =>
    ipcRenderer.invoke('setDiscordToken', discordToken),
  getStartggApiKey: (): Promise<string> =>
    ipcRenderer.invoke('getStartggApiKey'),
  setStartggApiKey: (startggApiKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggApiKey', startggApiKey),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
