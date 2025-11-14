// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import {
  AdminedTournament,
  DiscordConfig,
  DiscordStatus,
  DiscordUsername,
  ParticipantConnections,
  Sets,
  StartggEvent,
  StartggSet,
  StartggTournament,
  StartingState,
} from '../common/types';

const electronHandler = {
  getDiscordConfig: (): Promise<DiscordConfig> =>
    ipcRenderer.invoke('getDiscordConfig'),
  setDiscordConfig: (discordConfig: DiscordConfig): Promise<void> =>
    ipcRenderer.invoke('setDiscordConfig', discordConfig),
  getDiscordCommandDq: (): Promise<boolean> =>
    ipcRenderer.invoke('getDiscordCommandDq'),
  setDiscordCommandDq: (discordCommandDq: boolean): Promise<void> =>
    ipcRenderer.invoke('setDiscordCommandDq', discordCommandDq),
  getStartggApiKey: (): Promise<string> =>
    ipcRenderer.invoke('getStartggApiKey'),
  setStartggApiKey: (startggApiKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggApiKey', startggApiKey),
  getTournaments: (): Promise<AdminedTournament[]> =>
    ipcRenderer.invoke('getTournaments'),
  getTournament: (slug: string): Promise<StartggTournament> =>
    ipcRenderer.invoke('getTournament', slug),
  setEvent: (event: StartggEvent): Promise<ParticipantConnections> =>
    ipcRenderer.invoke('setEvent', event),
  refreshSets: (): Promise<void> => ipcRenderer.invoke('refreshSets'),
  reportSet: (setId: number, winnerId: number, isDQ: boolean): Promise<void> =>
    ipcRenderer.invoke('reportSet', setId, winnerId, isDQ),
  resetSet: (setId: number): Promise<void> =>
    ipcRenderer.invoke('resetSet', setId),
  swapWinner: (set: StartggSet): Promise<void> =>
    ipcRenderer.invoke('swapWinner', set),
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
  onSets: (callback: (event: IpcRendererEvent, sets: Sets) => void) => {
    ipcRenderer.removeAllListeners('sets');
    ipcRenderer.on('sets', callback);
  },
  // exposed for dev only
  registerSlashCommands: (): Promise<void> =>
    ipcRenderer.invoke('registerSlashCommands'),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
