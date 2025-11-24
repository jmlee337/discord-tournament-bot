import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import {
  Broadcast,
  ConnectCode,
  RemoteState,
  RemoteStatus,
  Spectating,
} from '../common/types';

type RemoteBroadcast = {
  id: string;
  name: string;
  broadcaster: {
    uid: string;
    name: string;
  };
};

type RemoteSpectate = {
  broadcastId: string;
  dolphinId: string;
};

type SpectatingInternal = {
  dolphinId: string;
  broadcastId: string;
  spectating: boolean;
};

const idToBroadcast = new Map<string, Broadcast>();
const dolphinIdToSpectating = new Map<string, SpectatingInternal>();
let remoteErr = '';
let remoteStatus = RemoteStatus.DISCONNECTED;
let webSocketClient: WebSocket | null = null;
let mainWindow: BrowserWindow | null = null;
const connectCodeMisses = new Set<string>();
const connectCodeToGamerTag = new Map<string, string>();

export function initSpectate(newMainWindow: BrowserWindow) {
  if (webSocketClient) {
    webSocketClient.close();
    webSocketClient = null;
  }
  idToBroadcast.clear();
  dolphinIdToSpectating.clear();
  connectCodeMisses.clear();
  connectCodeToGamerTag.clear();
  mainWindow = newMainWindow;
}

export function getRemoteState() {
  const remoteState: RemoteState = {
    err: remoteErr,
    status: remoteStatus,
  };
  return remoteState;
}

function sendState() {
  mainWindow?.webContents.send('remoteState', getRemoteState());
}

export function getSpectating(): Spectating[] {
  const arr = Array.from(dolphinIdToSpectating.values());
  let i = 0;
  while (arr.length < 4) {
    i += 1;
    const dolphinId = `spectate-${i}`;
    if (!dolphinIdToSpectating.has(dolphinId)) {
      arr.push({ dolphinId, broadcastId: '', spectating: false });
    }
  }
  return arr
    .sort((a, b) => a.dolphinId.localeCompare(b.dolphinId))
    .map((spectating) => ({
      dolphinId: spectating.dolphinId,
      broadcast: idToBroadcast.get(spectating.broadcastId),
      spectating: spectating.spectating,
    }));
}

function sendSpectating() {
  mainWindow?.webContents.send('spectating', getSpectating());
}

export function getBroadcasts() {
  return Array.from(idToBroadcast.values()).sort((a, b) =>
    (a.gamerTag ?? a.slippiName).localeCompare(b.gamerTag ?? b.slippiName),
  );
}

function sendBroadcasts() {
  mainWindow?.webContents.send('broadcasts', getBroadcasts());
  sendSpectating();
}

function matchConnectCode(connectCode: string) {
  const parts = connectCode.split('#');
  if (parts.length !== 2) {
    throw new Error(`Unexepected connect code format: ${connectCode}`);
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const [candidateCC, gamerTag] of connectCodeToGamerTag.values()) {
    const lcCC = candidateCC.toLowerCase();
    if (parts.every((part) => lcCC.includes(part))) {
      connectCodeToGamerTag.set(connectCode, gamerTag);
      return gamerTag;
    }
  }
  connectCodeMisses.add(connectCode);
  return undefined;
}

export function setConnectCodes(connectCodes: ConnectCode[]) {
  connectCodeMisses.clear();
  connectCodes.forEach(({ connectCode, gamerTag }) => {
    connectCodeToGamerTag.set(connectCode.toLowerCase(), gamerTag);
  });
  Array.from(idToBroadcast.entries()).forEach(([broadcastId, broadcast]) => {
    const lcConnectCode = broadcast.connectCode.toLowerCase();
    let gamerTag = connectCodeToGamerTag.get(lcConnectCode);
    if (!gamerTag && !connectCodeMisses.has(lcConnectCode)) {
      gamerTag = matchConnectCode(lcConnectCode);
    }
    if (gamerTag) {
      idToBroadcast.set(broadcastId, {
        ...broadcast,
        gamerTag,
      });
    }
  });
  sendBroadcasts();
}

export function connect(port: number) {
  if (webSocketClient) {
    return;
  }

  webSocketClient = new WebSocket(`ws://127.0.01:${port}`, 'spectate-protocol')
    .on('open', () => {
      remoteErr = '';
      remoteStatus = RemoteStatus.CONNECTED;
      sendState();
    })
    .on('error', (error) => {
      webSocketClient?.removeAllListeners();
      webSocketClient = null;

      idToBroadcast.clear();
      sendBroadcasts();

      dolphinIdToSpectating.clear();
      sendSpectating();

      remoteErr = error.message;
      remoteStatus = RemoteStatus.DISCONNECTED;
      sendState();
    })
    .on('close', () => {
      webSocketClient?.removeAllListeners();
      webSocketClient = null;

      idToBroadcast.clear();
      sendBroadcasts();

      dolphinIdToSpectating.clear();
      sendSpectating();

      remoteErr = '';
      remoteStatus = RemoteStatus.DISCONNECTED;
      sendState();
    })
    .on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (typeof message.op !== 'string') {
          return;
        }
        if (typeof message.err === 'string') {
          return;
        }
        switch (message.op) {
          case 'spectating-broadcasts-event':
            (message.spectatingBroadcasts as RemoteSpectate[]).forEach(
              (spectate) => {
                dolphinIdToSpectating.set(spectate.dolphinId, {
                  dolphinId: spectate.dolphinId,
                  broadcastId: spectate.broadcastId,
                  spectating: true,
                });
              },
            );
            sendSpectating();
            return;
          case 'dolphin-closed-event':
            dolphinIdToSpectating.delete(message.dolphinId);
            sendSpectating();
            return;
          case 'game-end-event':
          case 'new-file-event':
            if (!dolphinIdToSpectating.has(message.dolphinId)) {
              dolphinIdToSpectating.set(message.dolphinId, {
                dolphinId: message.dolphinId,
                broadcastId: message.broadcastId,
                spectating: true,
              });
              sendSpectating();
            }
            return;
          case 'list-broadcasts-response':
            idToBroadcast.clear();
            (message.broadcasts as RemoteBroadcast[]).forEach((broadcast) => {
              const connectCode = broadcast.name;
              const lcConnectCode = connectCode.toLowerCase();
              let gamerTag = connectCodeToGamerTag.get(lcConnectCode);
              if (!gamerTag && !connectCodeMisses.has(lcConnectCode)) {
                gamerTag = matchConnectCode(lcConnectCode);
              }
              idToBroadcast.set(broadcast.id, {
                id: broadcast.id,
                connectCode,
                gamerTag,
                slippiName: broadcast.broadcaster.name,
              });
            });
            sendBroadcasts();
            return;
          case 'spectate-broadcast-response':
            dolphinIdToSpectating.set(message.dolphinId, {
              dolphinId: message.dolphinId,
              broadcastId: message.broadcastId,
              spectating: true,
            });
            sendSpectating();
            break;
          default:
          // nothing
        }
      } catch {
        // just catch
      }
    });
  remoteErr = '';
  remoteStatus = RemoteStatus.CONNECTING;
  sendState();
}

export function refreshBroadcasts() {
  if (!webSocketClient || remoteStatus !== RemoteStatus.CONNECTED) {
    throw new Error('not connected');
  }

  webSocketClient.send(JSON.stringify({ op: 'list-broadcasts-request' }));
}

export function startSpectating(broadcastId: string, dolphinId: string) {
  if (!webSocketClient || remoteStatus !== RemoteStatus.CONNECTED) {
    throw new Error('not connected');
  }

  webSocketClient.send(
    JSON.stringify({
      op: 'spectate-broadcast-request',
      broadcastId,
      dolphinId,
    }),
  );
}
