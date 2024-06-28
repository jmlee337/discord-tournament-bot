// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron';

const electronHandler = {
  getStartggKey: (): Promise<string> => ipcRenderer.invoke('getStartggApiKey'),
  setStartggKey: (startggKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggApiKey', startggKey),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
