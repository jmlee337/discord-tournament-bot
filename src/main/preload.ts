// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import {
  DiscordConfig,
  DiscordStatus,
  StartggSet,
  StartggTournament,
  StartingState,
} from '../common/types';

const electronHandler = {
  getDiscordConfig: (): Promise<DiscordConfig> =>
    ipcRenderer.invoke('getDiscordConfig'),
  setDiscordConfig: (discordConfig: DiscordConfig): Promise<void> =>
    ipcRenderer.invoke('setDiscordConfig', discordConfig),
  loadCsv: (): Promise<string> => ipcRenderer.invoke('loadCsv'),
  getStartggApiKey: (): Promise<string> =>
    ipcRenderer.invoke('getStartggApiKey'),
  setStartggApiKey: (startggApiKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggApiKey', startggApiKey),
  getTournament: (slug: string): Promise<StartggTournament> =>
    ipcRenderer.invoke('getTournament', slug),
  setEvent: (id: number, name: string): Promise<void> =>
    ipcRenderer.invoke('setEvent', id, name),
  refreshSets: (): Promise<void> => ipcRenderer.invoke('refreshSets'),
  reportSet: (setId: number, winnerId: number, isDQ: boolean): Promise<void> =>
    ipcRenderer.invoke('reportSet', setId, winnerId, isDQ),
  getStartingState: (): Promise<StartingState> =>
    ipcRenderer.invoke('getStartingState'),
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
  onSets: (callback: (event: IpcRendererEvent, sets: StartggSet[]) => void) => {
    ipcRenderer.removeAllListeners('sets');
    ipcRenderer.on('sets', callback);
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
