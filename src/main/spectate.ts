import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import {
  Broadcast,
  ConnectCode,
  RemoteState,
  RemoteStatus,
  Spectating,
  StartggSet,
} from '../common/types';
import getGameStartInfo from './replay';
import {
  characterIdToMST,
  MSTCharacter,
  MSTPortColor,
  MSTScoreboardInfo,
  MSTSkinColor,
} from '../common/mst';

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
const connectCodeToEntrant = new Map<
  string,
  { id: number; gamerTag: string }
>();
let tournamentName = '';
let entrantIdToPendingSets = new Map<number, StartggSet[]>();

export function initSpectate(newMainWindow: BrowserWindow) {
  if (webSocketClient) {
    webSocketClient.close();
    webSocketClient = null;
  }
  idToBroadcast.clear();
  dolphinIdToSpectating.clear();
  connectCodeMisses.clear();
  connectCodeToEntrant.clear();
  tournamentName = '';
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
  for (const [candidateCC, entrant] of connectCodeToEntrant.entries()) {
    const lcCC = candidateCC.toLowerCase();
    if (parts.every((part) => lcCC.includes(part))) {
      connectCodeToEntrant.set(connectCode, entrant);
      return entrant;
    }
  }
  connectCodeMisses.add(connectCode);
  return undefined;
}

function getEntrant(connectCode: string) {
  const lcConnectCode = connectCode.toLowerCase();
  let entrant = connectCodeToEntrant.get(lcConnectCode);
  if (!entrant && !connectCodeMisses.has(lcConnectCode)) {
    entrant = matchConnectCode(lcConnectCode);
  }

  return entrant;
}

function recalculateAndSendBroadcasts() {
  Array.from(idToBroadcast.entries()).forEach(([broadcastId, broadcast]) => {
    const entrant = getEntrant(broadcast.connectCode);
    if (entrant) {
      const pendingSets = entrantIdToPendingSets.get(entrant.id);
      idToBroadcast.set(broadcastId, {
        ...broadcast,
        gamerTag: entrant.gamerTag,
        set:
          pendingSets && pendingSets.length === 1
            ? {
                id: pendingSets[0].id,
                names: `${pendingSets[0].entrant1Name} vs ${pendingSets[0].entrant2Name}`,
                score: `${pendingSets[0].entrant1Score} - ${pendingSets[0].entrant2Score}`,
              }
            : undefined,
      });
    }
  });
  sendBroadcasts();
}

export function setTournamentName(newTournamentName: string) {
  tournamentName = newTournamentName;
}

export function setConnectCodes(connectCodes: ConnectCode[]) {
  connectCodeMisses.clear();
  connectCodes.forEach(({ connectCode, entrantId, gamerTag }) => {
    connectCodeToEntrant.set(connectCode.toLowerCase(), {
      id: entrantId,
      gamerTag,
    });
  });
  recalculateAndSendBroadcasts();
}

export function setEntrantIdToPendingSets(
  newEntrantIdToPendingSets: Map<number, StartggSet[]>,
) {
  entrantIdToPendingSets = newEntrantIdToPendingSets;
  recalculateAndSendBroadcasts();
}

export async function processReplay(filePath: string) {
  const gameStartInfos = await getGameStartInfo(filePath);
  const infosWithPlayers = gameStartInfos.filter(
    (gameStartInfo) => gameStartInfo.playerType === 0,
  );
  if (infosWithPlayers.length !== 2) {
    return null;
  }

  const mstInfos = infosWithPlayers.map(
    (
      gameStartInfo,
      i,
    ): {
      portColor: MSTPortColor;
      character: MSTCharacter;
      skinColor: MSTSkinColor;
      entrant?: { id: number; gamerTag: string };
    } => {
      let portColor: MSTPortColor = 'CPU';
      switch (i) {
        case 0:
          portColor = 'Red';
          break;
        case 1:
          portColor = 'Blue';
          break;
        case 2:
          portColor = 'Yellow';
          break;
        case 3:
          portColor = 'Green';
          break;
        default:
          throw new Error('unreachable');
      }
      const mst = characterIdToMST.get(gameStartInfo.characterId);
      if (!mst) {
        return {
          portColor,
          character: MSTCharacter.RANDOM,
          skinColor: 'Default',
          entrant: gameStartInfo.connectCode
            ? getEntrant(gameStartInfo.connectCode)
            : undefined,
        };
      }

      let skinColor = mst.skinColors[gameStartInfo.costumeIndex];
      if (!skinColor) {
        skinColor = 'Default';
      }
      return {
        portColor,
        character: mst.character,
        skinColor,
        entrant: gameStartInfo.connectCode
          ? getEntrant(gameStartInfo.connectCode)
          : undefined,
      };
    },
  );

  const scoreboardInfo: MSTScoreboardInfo = {
    p1Name: mstInfos[0].entrant?.gamerTag ?? '',
    p1Team: '',
    p1Character: mstInfos[0].character,
    p1Skin: mstInfos[0].skinColor,
    p1Color: mstInfos[0].portColor,
    p1Score: 0, // TODO
    p1WL: 'Nada', // TODO
    p2Name: mstInfos[1].entrant?.gamerTag ?? '',
    p2Team: '',
    p2Character: mstInfos[1].character,
    p2Skin: mstInfos[1].skinColor,
    p2Color: mstInfos[1].portColor,
    p2Score: 0, // TODO
    p2WL: 'Nada', // TODO
    bestOf: 'Bo3', // TODO
    round: '', // TODO
    tournamentName,
    caster1Name: '', // TODO
    caster1Twitter: '', // TODO
    caster1Twitch: '', // TODO
    caster2Name: '', // TODO
    caster2Twitter: '', // TODO
    caster2Twitch: '', // TODO
    allowIntro: false,
  };
  return scoreboardInfo;
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
            // some mock broadcasts for demo
            /*
            idToBroadcast.set('abc', {
              id: 'abc',
              connectCode: 'ANCO#203',
              slippiName: 'Anconoid',
            });
            idToBroadcast.set('bcd', {
              id: 'bcd',
              connectCode: 'LEFT#925',
              slippiName: 'dandrew',
            });
            idToBroadcast.set('cde', {
              id: 'cde',
              connectCode: 'BTW#894',
              slippiName: "I'm Michael BTW",
            });
            idToBroadcast.set('def', {
              id: 'def',
              connectCode: 'KING#870',
              slippiName: 'Kingpoyothefirst',
            });
            idToBroadcast.set('efg', {
              id: 'efg',
              connectCode: 'LOWH#158',
              slippiName: 'Lowercase hero',
            });
            idToBroadcast.set('fgh', {
              id: 'fgh',
              connectCode: 'PREG#16',
              slippiName: 'Pregnando',
            });
            idToBroadcast.set('ghi', {
              id: 'ghi',
              connectCode: 'RACK#181',
              slippiName: 'Rainey',
            });
            idToBroadcast.set('hij', {
              id: 'hij',
              connectCode: 'SLIM#667',
              slippiName: 'Slimy',
            });
            idToBroadcast.set('ijk', {
              id: 'ijk',
              connectCode: 'NICO#215',
              slippiName: 'Nico',
            });
            idToBroadcast.set('jkl', {
              id: 'jkl',
              connectCode: 'STNC#139',
              slippiName: 'st. nicolas',
            });
            */

            (message.broadcasts as RemoteBroadcast[]).forEach((broadcast) => {
              const connectCode = broadcast.name;
              const entrant = getEntrant(connectCode);
              const pendingSets = entrant
                ? entrantIdToPendingSets.get(entrant.id)
                : undefined;
              idToBroadcast.set(broadcast.id, {
                id: broadcast.id,
                connectCode,
                gamerTag: entrant?.gamerTag,
                set:
                  pendingSets && pendingSets.length === 1
                    ? {
                        id: pendingSets[0].id,
                        names: `${pendingSets[0].entrant1Name} vs ${pendingSets[0].entrant2Name}`,
                        score: `${pendingSets[0].entrant1Score} - ${pendingSets[0].entrant2Score}`,
                      }
                    : undefined,
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
