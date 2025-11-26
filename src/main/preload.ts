// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import {
  AdminedTournament,
  Broadcast,
  Discord,
  DiscordChannel,
  DiscordConfig,
  DiscordStatus,
  ParticipantConnections,
  RemoteState,
  Sets,
  Spectating,
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
  getDiscordCommandReport: (): Promise<boolean> =>
    ipcRenderer.invoke('getDiscordCommandReport'),
  setDiscordCommandReport: (discordCommandReport: boolean): Promise<void> =>
    ipcRenderer.invoke('setDiscordCommandReport', discordCommandReport),
  getDiscordCommandReset: (): Promise<boolean> =>
    ipcRenderer.invoke('getDiscordCommandReset'),
  setDiscordCommandReset: (discordCommandReset: boolean): Promise<void> =>
    ipcRenderer.invoke('setDiscordCommandReset', discordCommandReset),
  getRemotePort: (): Promise<number> => ipcRenderer.invoke('getRemotePort'),
  setRemotePort: (remotePort: number): Promise<void> =>
    ipcRenderer.invoke('setRemotePort', remotePort),
  connectRemote: (): Promise<void> => ipcRenderer.invoke('connectRemote'),
  refreshBroadcasts: (): Promise<void> =>
    ipcRenderer.invoke('refreshBroadcasts'),
  startSpectating: (broadcastId: string, dolphinId: string): Promise<void> =>
    ipcRenderer.invoke('startSpectating', broadcastId, dolphinId),
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
  getDiscordCheckinPings: (): Promise<{
    channels: DiscordChannel[];
    discords: Discord[];
  }> => ipcRenderer.invoke('getDiscordCheckinPings'),
  pingDiscords: (channelId: string, discordIds: string[]): Promise<void> =>
    ipcRenderer.invoke('pingDiscords', channelId, discordIds),
  getStartingState: (): Promise<StartingState> =>
    ipcRenderer.invoke('getStartingState'),
  getStartingSets: (): Promise<Sets> => ipcRenderer.invoke('getStartingSets'),
  getStartingRemote: (): Promise<{
    broadcasts: Broadcast[];
    spectating: Spectating[];
  }> => ipcRenderer.invoke('getStartingRemote'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
  onBroadcasts: (
    callback: (event: IpcRendererEvent, broadcasts: Broadcast[]) => void,
  ) => {
    ipcRenderer.removeAllListeners('broadcasts');
    ipcRenderer.on('broadcasts', callback);
  },
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
  onRemoteState: (
    callback: (event: IpcRendererEvent, remoteState: RemoteState) => void,
  ) => {
    ipcRenderer.removeAllListeners('remoteState');
    ipcRenderer.on('remoteState', callback);
  },
  onSpectating: (
    callback: (event: IpcRendererEvent, spectating: Spectating[]) => void,
  ) => {
    ipcRenderer.removeAllListeners('spectating');
    ipcRenderer.on('spectating', callback);
  },
  // exposed for dev only
  registerSlashCommands: (): Promise<void> =>
    ipcRenderer.invoke('registerSlashCommands'),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
