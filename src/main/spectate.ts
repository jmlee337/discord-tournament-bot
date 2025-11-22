import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import {
  Broadcast,
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

let broadcasts: Broadcast[] = [];
const dolphinIdToSpectating = new Map<string, Spectating>();
let remoteErr = '';
let remoteStatus = RemoteStatus.DISCONNECTED;
let webSocketClient: WebSocket | null = null;
let mainWindow: BrowserWindow | null = null;

export function initSpectate(newMainWindow: BrowserWindow) {
  if (webSocketClient) {
    webSocketClient.close();
    webSocketClient = null;
  }
  broadcasts = [];
  dolphinIdToSpectating.clear();
  mainWindow = newMainWindow;
}

export function getRemoteState() {
  const remoteState: RemoteState = {
    err: remoteErr,
    status: remoteStatus,
  };
  return remoteState;
}

export function getBroadcasts() {
  return broadcasts;
}

export function getSpectating() {
  const arr = Array.from(dolphinIdToSpectating.values());
  let i = 0;
  while (arr.length < 4) {
    i += 1;
    const dolphinId = `spectate-${i}`;
    if (!dolphinIdToSpectating.has(dolphinId)) {
      arr.push({ dolphinId, broadcastId: '' });
    }
  }
  return arr.sort((a, b) => a.dolphinId.localeCompare(b.dolphinId));
}

function sendSpectating() {
  mainWindow?.webContents.send('spectating', getSpectating());
}

function sendState() {
  mainWindow?.webContents.send('remoteState', getRemoteState());
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
      remoteErr = error.message;
      remoteStatus = RemoteStatus.DISCONNECTED;
      sendState();
    })
    .on('close', () => {
      webSocketClient?.removeAllListeners();
      webSocketClient = null;
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
            (message.spectatingBroadcasts as Spectating[]).forEach(
              (spectating) => {
                dolphinIdToSpectating.set(spectating.dolphinId, spectating);
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
                broadcastId: message.broadcastId,
                dolphinId: message.dolphinId,
              });
              sendSpectating();
            }
            return;
          case 'list-broadcasts-response':
            broadcasts = (message.broadcasts as RemoteBroadcast[])
              .map(
                (broadcast): Broadcast => ({
                  id: broadcast.id,
                  name: broadcast.broadcaster.name,
                  connectCode: broadcast.name,
                }),
              )
              .sort((a, b) => a.name.localeCompare(b.name));
            mainWindow?.webContents.send('broadcasts', broadcasts);
            return;
          case 'spectate-broadcast-response':
            dolphinIdToSpectating.set(message.dolphinId, {
              broadcastId: message.broadcastId,
              dolphinId: message.dolphinId,
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
