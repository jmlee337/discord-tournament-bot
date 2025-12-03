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
import { getGameEndInfo, getGameStartInfos } from './replay';
import {
  characterIdToMST,
  MSTCharacter,
  MSTGameEndScoreboardInfo,
  MSTNewFileScoreboardInfo,
  MSTSetData,
  MSTSkinColor,
  MSTWL,
} from '../common/mst';
import { gameEndUpdate, newFileUpdate } from './mst';

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
const connectCodeToParticipant = new Map<
  string,
  { entrantId: number; gamerTag: string; prefix: string }
>();
const dolphinIdToFilePath = new Map<string, string>();
let overlayDolphinId: string | undefined;
let entrantIdToPendingSets = new Map<number, StartggSet[]>();

export function initSpectate(newMainWindow: BrowserWindow) {
  remoteErr = '';
  remoteStatus = RemoteStatus.DISCONNECTED;
  if (webSocketClient) {
    webSocketClient.close();
    webSocketClient = null;
  }
  idToBroadcast.clear();
  dolphinIdToSpectating.clear();
  connectCodeMisses.clear();
  connectCodeToParticipant.clear();
  dolphinIdToFilePath.clear();
  overlayDolphinId = '';
  mainWindow = newMainWindow;
}

let enableOverlay = false;
export function setEnableOverlay(newEnableOverlay: boolean) {
  enableOverlay = newEnableOverlay;
}
let updateAutomatically = false;
export function setUpdateAutomatically(newUpdateAutomatically: boolean) {
  updateAutomatically = newUpdateAutomatically;
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
  for (const [candidateCC, partcipant] of connectCodeToParticipant.entries()) {
    const lcCC = candidateCC.toLowerCase();
    if (parts.every((part) => lcCC.includes(part))) {
      connectCodeToParticipant.set(connectCode, partcipant);
      return partcipant;
    }
  }
  connectCodeMisses.add(connectCode);
  return undefined;
}

function getParticipant(connectCode: string) {
  const lcConnectCode = connectCode.toLowerCase();
  let participant = connectCodeToParticipant.get(lcConnectCode);
  if (!participant && !connectCodeMisses.has(lcConnectCode)) {
    participant = matchConnectCode(lcConnectCode);
  }

  return participant;
}

function recalculateAndSendBroadcasts() {
  Array.from(idToBroadcast.entries()).forEach(([broadcastId, broadcast]) => {
    const entrant = getParticipant(broadcast.connectCode);
    if (entrant) {
      const pendingSets = entrantIdToPendingSets.get(entrant.entrantId);
      idToBroadcast.set(broadcastId, {
        ...broadcast,
        gamerTag: entrant.gamerTag,
        sets: pendingSets
          ? pendingSets.map((pendingSet) => ({
              id: pendingSet.id,
              opponentName:
                entrant.entrantId === pendingSet.entrant1Id
                  ? pendingSet.entrant2Name
                  : pendingSet.entrant1Name,
            }))
          : [],
      });
    }
  });
  sendBroadcasts();
}

export function setConnectCodes(connectCodes: ConnectCode[]) {
  connectCodeMisses.clear();
  connectCodes.forEach(({ connectCode, entrantId, gamerTag, prefix }) => {
    connectCodeToParticipant.set(connectCode.toLowerCase(), {
      entrantId,
      gamerTag,
      prefix,
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

export async function processNewReplay(filePath: string) {
  const gameStartInfos = await getGameStartInfos(filePath);
  const emptyInfos = gameStartInfos.filter(
    (gameStartInfo) => gameStartInfo.playerType === 3,
  );
  const playerInfos = gameStartInfos.filter(
    (gameStartInfo) => gameStartInfo.playerType === 0,
  );
  if (emptyInfos.length !== 2 || playerInfos.length !== 2) {
    return null;
  }

  const mstInfos = playerInfos.map(
    (
      gameStartInfo,
    ): {
      character: MSTCharacter;
      skinColor: MSTSkinColor;
      participant?: { entrantId: number; gamerTag: string; prefix: string };
    } => {
      const mst = characterIdToMST.get(gameStartInfo.characterId);
      if (!mst) {
        return {
          character: MSTCharacter.RANDOM,
          skinColor: 'Default',
          participant: gameStartInfo.connectCode
            ? getParticipant(gameStartInfo.connectCode)
            : undefined,
        };
      }

      let skinColor = mst.skinColors[gameStartInfo.costumeIndex];
      if (!skinColor) {
        [skinColor] = mst.skinColors;
      }
      return {
        character: mst.character,
        skinColor,
        participant: gameStartInfo.connectCode
          ? getParticipant(gameStartInfo.connectCode)
          : undefined,
      };
    },
  );
  let p1Name = mstInfos[0].participant?.gamerTag;
  let p1Team = mstInfos[0].participant?.prefix;
  let p2Name = mstInfos[1].participant?.gamerTag;
  let p2Team = mstInfos[1].participant?.prefix;

  let setData: MSTSetData | undefined;
  const p1PendingSets = mstInfos[0].participant
    ? entrantIdToPendingSets.get(mstInfos[0].participant.entrantId)
    : undefined;
  const p2PendingSets = mstInfos[1].participant
    ? entrantIdToPendingSets.get(mstInfos[1].participant.entrantId)
    : undefined;
  if (
    p1PendingSets &&
    p1PendingSets.length > 0 &&
    p2PendingSets &&
    p2PendingSets.length > 0
  ) {
    const intersectionSets = p1PendingSets.filter((pendingSet) =>
      p2PendingSets.find(
        (otherPendingSet) => pendingSet.id === otherPendingSet.id,
      ),
    );
    if (intersectionSets.length === 1) {
      const [set] = intersectionSets;
      const p1IsEntrant1 = mstInfos[0].participant
        ? set.entrant1Id === mstInfos[0].participant.entrantId
        : set.entrant2Id === mstInfos[1].participant!.entrantId;
      p1Name = p1IsEntrant1 ? set.entrant1Name : set.entrant2Name;
      p1Team = p1IsEntrant1 ? set.entrant1Sponsor : set.entrant2Sponsor;
      p2Name = p1IsEntrant1 ? set.entrant2Name : set.entrant1Name;
      p2Team = p1IsEntrant1 ? set.entrant2Sponsor : set.entrant1Sponsor;

      let p1WL: MSTWL | undefined;
      let p2WL: MSTWL | undefined;
      if (set.fullRoundText === 'Grand Final Reset') {
        p1WL = 'L';
        p2WL = 'L';
      } else if (set.fullRoundText === 'Grand Final') {
        p1WL = !p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'W';
        p2WL = p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'W';
      }
      setData = {
        setId: set.id,
        bestOf: set.bestOf === 5 ? 'Bo5' : 'Bo3',
        round: set.fullRoundText,
        p1Score: p1IsEntrant1 ? set.entrant1Score : set.entrant2Score,
        p1WL,
        p2Score: p1IsEntrant1 ? set.entrant2Score : set.entrant1Score,
        p2WL,
      };
    }
  }

  const newFileScoreboardInfo: MSTNewFileScoreboardInfo = {
    p1EntrantId: mstInfos[0].participant?.entrantId,
    p2EntrantId: mstInfos[1].participant?.entrantId,
    p1Name,
    p1Team,
    p1Character: mstInfos[0].character,
    p1Skin: mstInfos[0].skinColor,
    p2Name,
    p2Team,
    p2Character: mstInfos[1].character,
    p2Skin: mstInfos[1].skinColor,
    setData,
  };
  await newFileUpdate(newFileScoreboardInfo);
  return newFileScoreboardInfo;
}

export async function processFinishedReplay(filePath: string) {
  const gameEndInfo = await getGameEndInfo(filePath);
  if (!gameEndInfo.definite) {
    return null;
  }

  const emptySlots = gameEndInfo.playerTypes.filter(
    (playerType) => playerType === 3,
  );
  const playerSlots = gameEndInfo.playerTypes.filter(
    (playerType) => playerType === 0,
  );
  if (emptySlots.length !== 2 || playerSlots.length !== 2) {
    return null;
  }

  const placings = gameEndInfo.placings.filter(
    (placing) =>
      placing === 0 || placing === 1 || placing === 2 || placing === 3,
  );
  if (placings.length !== 2) {
    return null;
  }

  const gameEndScoreboardInfo: MSTGameEndScoreboardInfo = {
    p1ScoreIncrement: placings[0] === 0,
    p2ScoreIncrement: placings[1] === 0,
  };
  await gameEndUpdate(gameEndScoreboardInfo);
  return gameEndScoreboardInfo;
}

export function getOverlayDolphinId() {
  return overlayDolphinId;
}
export async function setOverlayDolphinId(newOverlayDolphinId: string) {
  const changed = newOverlayDolphinId !== overlayDolphinId;
  overlayDolphinId = newOverlayDolphinId;
  if (enableOverlay && updateAutomatically && changed) {
    const filePath = dolphinIdToFilePath.get(overlayDolphinId);
    if (filePath) {
      await processNewReplay(filePath);
    }
  }
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
            dolphinIdToFilePath.delete(message.dolphinId);
            dolphinIdToSpectating.delete(message.dolphinId);
            sendSpectating();
            return;
          case 'game-end-event':
            if (
              enableOverlay &&
              updateAutomatically &&
              overlayDolphinId === message.dolphinId &&
              dolphinIdToFilePath.has(message.dolphinId)
            ) {
              processFinishedReplay(
                dolphinIdToFilePath.get(message.dolphinId)!,
              ).catch(() => {
                // just catch
              });
            }
            if (!dolphinIdToSpectating.has(message.dolphinId)) {
              dolphinIdToSpectating.set(message.dolphinId, {
                dolphinId: message.dolphinId,
                broadcastId: message.broadcastId,
                spectating: true,
              });
              sendSpectating();
            }
            return;
          case 'new-file-event':
            dolphinIdToFilePath.set(message.dolphinId, message.filePath);
            if (
              enableOverlay &&
              updateAutomatically &&
              overlayDolphinId === message.dolphinId
            ) {
              processNewReplay(message.filePath).catch(() => {
                // just catch
              });
            }
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
              sets: [],
            });
            idToBroadcast.set('bcd', {
              id: 'bcd',
              connectCode: 'LEFT#925',
              slippiName: 'dandrew',
              sets: [],
            });
            idToBroadcast.set('cde', {
              id: 'cde',
              connectCode: 'BTW#894',
              slippiName: "I'm Michael BTW",
              sets: [],
            });
            idToBroadcast.set('def', {
              id: 'def',
              connectCode: 'KING#870',
              slippiName: 'Kingpoyothefirst',
              sets: [],
            });
            idToBroadcast.set('efg', {
              id: 'efg',
              connectCode: 'LOWH#158',
              slippiName: 'Lowercase hero',
              sets: [],
            });
            idToBroadcast.set('fgh', {
              id: 'fgh',
              connectCode: 'PREG#16',
              slippiName: 'Pregnando',
              sets: [],
            });
            idToBroadcast.set('ghi', {
              id: 'ghi',
              connectCode: 'RACK#181',
              slippiName: 'Rainey',
              sets: [],
            });
            idToBroadcast.set('hij', {
              id: 'hij',
              connectCode: 'SLIM#667',
              slippiName: 'Slimy',
              sets: [],
            });
            idToBroadcast.set('ijk', {
              id: 'ijk',
              connectCode: 'NICO#215',
              slippiName: 'Nico',
              sets: [],
            });
            idToBroadcast.set('jkl', {
              id: 'jkl',
              connectCode: 'STNC#139',
              slippiName: 'st. nicolas',
              sets: [],
            });
            idToBroadcast.set('klm', {
              id: 'klm',
              connectCode: 'LEE#337',
              slippiName: 'Nicolet',
              sets: [],
            });
            */

            (message.broadcasts as RemoteBroadcast[]).forEach((broadcast) => {
              const connectCode = broadcast.name;
              const entrant = getParticipant(connectCode);
              const pendingSets = entrant
                ? entrantIdToPendingSets.get(entrant.entrantId)
                : undefined;
              idToBroadcast.set(broadcast.id, {
                id: broadcast.id,
                connectCode,
                gamerTag: entrant?.gamerTag,
                sets: pendingSets
                  ? pendingSets.map((pendingSet) => ({
                      id: pendingSet.id,
                      opponentName:
                        entrant!.entrantId === pendingSet.entrant1Id
                          ? pendingSet.entrant2Name
                          : pendingSet.entrant1Name,
                    }))
                  : [],
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
