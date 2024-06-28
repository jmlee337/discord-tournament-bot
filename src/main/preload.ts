// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import { DiscordConfig, DiscordStatus } from '../common/types';

const electronHandler = {
  loadCsv: (): Promise<string> => ipcRenderer.invoke('loadCsv'),
  getDiscordConfig: (): Promise<DiscordConfig> =>
    ipcRenderer.invoke('getDiscordConfig'),
  setDiscordConfig: (discordConfig: DiscordConfig): Promise<void> =>
    ipcRenderer.invoke('setDiscordConfig', discordConfig),
  getStartggApiKey: (): Promise<string> =>
    ipcRenderer.invoke('getStartggApiKey'),
  setStartggApiKey: (startggApiKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggApiKey', startggApiKey),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
  onDiscordStatus: (
    callback: (event: IpcRendererEvent, discordStatus: DiscordStatus) => void,
  ) => {
    ipcRenderer.removeAllListeners('discordStatus');
    ipcRenderer.on('discordStatus', callback);
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
