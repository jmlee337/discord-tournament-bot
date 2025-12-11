import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import AsyncLock from 'async-lock';
import { writeFile } from 'fs/promises';
import {
  Broadcast,
  ConnectCode,
  ParticipantSet,
  RemoteState,
  RemoteStatus,
  Spectating,
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
import { REFRESH_CADENCE_MS } from '../common/constants';

const lock = new AsyncLock();

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

enum SimpleTextPathId {
  A = 'A',
  B = 'B',
  C = 'C',
}

type SpectatingInternal = {
  dolphinId: string;
  broadcastId: string;
  spectating: boolean;
};

let timeoutId: NodeJS.Timeout | undefined;
const idToBroadcast = new Map<string, Broadcast>();
const dolphinIdToSpectating = new Map<string, SpectatingInternal>();
const spectatingBroadcastIdToDolphinId = new Map<string, string>();
let remoteErr = '';
let remoteStatus = RemoteStatus.DISCONNECTED;
let webSocketClient: WebSocket | null = null;
let mainWindow: BrowserWindow | null = null;
const connectCodeMisses = new Set<string>();
const connectCodeToParticipant = new Map<
  string,
  { id: number; gamerTag: string; prefix: string }
>();
const dolphinIdToReplayPath = new Map<string, string>();
const dolphinIdToSimpleTextPathId = new Map<string, SimpleTextPathId>();
let overlayDolphinId = '';
let participantIdToPendingSets = new Map<number, ParticipantSet[]>();

export function initSpectate(newMainWindow: BrowserWindow) {
  remoteErr = '';
  remoteStatus = RemoteStatus.DISCONNECTED;
  if (webSocketClient) {
    webSocketClient.close();
    webSocketClient = null;
  }
  clearTimeout(timeoutId);
  timeoutId = undefined;

  idToBroadcast.clear();
  dolphinIdToSpectating.clear();
  spectatingBroadcastIdToDolphinId.clear();
  connectCodeMisses.clear();
  connectCodeToParticipant.clear();
  dolphinIdToReplayPath.clear();
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

const idToSimpleTextPath = new Map([
  [SimpleTextPathId.A, ''],
  [SimpleTextPathId.B, ''],
  [SimpleTextPathId.C, ''],
]);
export function setSimpleTextPathA(simpleTextPath: string) {
  idToSimpleTextPath.set(SimpleTextPathId.A, simpleTextPath);
}
export function setSimpleTextPathB(simpleTextPath: string) {
  idToSimpleTextPath.set(SimpleTextPathId.B, simpleTextPath);
}
export function setSimpleTextPathC(simpleTextPath: string) {
  idToSimpleTextPath.set(SimpleTextPathId.C, simpleTextPath);
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

function getDolphinIds() {
  return ['spectate-1', 'spectate-2', 'spectate-3', 'spectate-4'];
}

export function getSpectating() {
  return getDolphinIds().map((dolphinId): Spectating => {
    const spectatingInternal = dolphinIdToSpectating.get(dolphinId);
    if (spectatingInternal) {
      return {
        dolphinId,
        broadcast: idToBroadcast.get(spectatingInternal.broadcastId),
        spectating: spectatingInternal.spectating,
      };
    }
    return {
      dolphinId,
      broadcast: undefined,
      spectating: false,
    };
  });
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
    const participant = getParticipant(broadcast.connectCode);
    if (participant) {
      const pendingSets = participantIdToPendingSets.get(participant.id);
      idToBroadcast.set(broadcastId, {
        ...broadcast,
        gamerTag: participant.gamerTag,
        sets: pendingSets
          ? pendingSets.map((pendingSet) => ({
              id: pendingSet.id,
              opponentName: pendingSet.isParticipantEntrant1
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
  connectCodes.forEach(({ connectCode, gamerTag, participantId, prefix }) => {
    connectCodeToParticipant.set(connectCode.toLowerCase(), {
      id: participantId,
      gamerTag,
      prefix,
    });
  });
  recalculateAndSendBroadcasts();
}

export function setParticipantIdToPendingSets(
  newParticipantIdToPendingSets: Map<number, ParticipantSet[]>,
) {
  participantIdToPendingSets = newParticipantIdToPendingSets;
  recalculateAndSendBroadcasts();
}

export async function processNewReplay(replayPath: string) {
  const gameStartInfos = await getGameStartInfos(replayPath);
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
      participant?: { id: number; gamerTag: string; prefix: string };
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
    ? participantIdToPendingSets.get(mstInfos[0].participant.id)
    : undefined;
  const p2PendingSets = mstInfos[1].participant
    ? participantIdToPendingSets.get(mstInfos[1].participant.id)
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
      const [p1Set] = intersectionSets;
      p1Name = p1Set.isParticipantEntrant1
        ? p1Set.entrant1Name
        : p1Set.entrant2Name;
      p1Team = p1Set.isParticipantEntrant1
        ? p1Set.entrant1Sponsor
        : p1Set.entrant2Sponsor;
      p2Name = p1Set.isParticipantEntrant1
        ? p1Set.entrant2Name
        : p1Set.entrant1Name;
      p2Team = p1Set.isParticipantEntrant1
        ? p1Set.entrant2Sponsor
        : p1Set.entrant1Sponsor;

      let p1WL: MSTWL | undefined;
      let p2WL: MSTWL | undefined;
      if (p1Set.fullRoundText === 'Grand Final Reset') {
        p1WL = 'L';
        p2WL = 'L';
      } else if (p1Set.fullRoundText === 'Grand Final') {
        p1WL =
          !p1Set.isParticipantEntrant1 && p1Set.fullRoundText === 'Grand Final'
            ? 'L'
            : 'W';
        p2WL =
          p1Set.isParticipantEntrant1 && p1Set.fullRoundText === 'Grand Final'
            ? 'L'
            : 'W';
      }
      setData = {
        setId: p1Set.id,
        bestOf: p1Set.bestOf === 5 ? 'Bo5' : 'Bo3',
        round: p1Set.fullRoundText,
        p1Score: p1Set.isParticipantEntrant1
          ? p1Set.entrant1Score
          : p1Set.entrant2Score,
        p1WL,
        p2Score: p1Set.isParticipantEntrant1
          ? p1Set.entrant2Score
          : p1Set.entrant1Score,
        p2WL,
      };
    }
  }

  const newFileScoreboardInfo: MSTNewFileScoreboardInfo = {
    p1ParticipantId: mstInfos[0].participant?.id,
    p2ParticipantId: mstInfos[1].participant?.id,
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
  return newFileScoreboardInfo;
}

export async function processFinishedReplay(replayPath: string) {
  const gameEndInfo = await getGameEndInfo(replayPath);
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
  return gameEndScoreboardInfo;
}

export function getOverlayDolphinId() {
  return overlayDolphinId;
}

export async function setOverlayDolphinId(newOverlayDolphinId: string) {
  const dolphinIds = getDolphinIds();
  const index = dolphinIds.indexOf(newOverlayDolphinId);
  if (index === -1) {
    throw new Error(`invalid dolphinId: ${newOverlayDolphinId}`);
  }

  const changed = newOverlayDolphinId !== overlayDolphinId;

  if (overlayDolphinId) {
    const simpleTextPathId =
      dolphinIdToSimpleTextPathId.get(newOverlayDolphinId);
    if (simpleTextPathId) {
      dolphinIdToSimpleTextPathId.delete(newOverlayDolphinId);
      dolphinIdToSimpleTextPathId.set(overlayDolphinId, simpleTextPathId);

      const replayPath = dolphinIdToReplayPath.get(overlayDolphinId);
      const simpleTextPath = idToSimpleTextPath.get(simpleTextPathId);
      if (simpleTextPath) {
        try {
          if (replayPath) {
            const newFileScoreboardInfo = await processNewReplay(replayPath);
            if (newFileScoreboardInfo) {
              await writeFile(
                simpleTextPath,
                newFileScoreboardInfo.p1Name && newFileScoreboardInfo.p2Name
                  ? `${newFileScoreboardInfo.p1Name} vs ${newFileScoreboardInfo.p2Name}`
                  : '',
              );
            }
          } else {
            await writeFile(simpleTextPath, '');
          }
        } catch {
          // just catch
        }
      }
    }
  } else {
    dolphinIds.splice(index, 1);
    const simpleTextPathIds = Object.values(SimpleTextPathId);
    if (dolphinIds.length !== simpleTextPathIds.length) {
      throw new Error('simpleTextDolphinIds/simpleTextPathIds length mismatch');
    }

    await Promise.all(
      dolphinIds.map(async (dolphinId, i) => {
        dolphinIdToSimpleTextPathId.set(dolphinId, simpleTextPathIds[i]);
        const replayPath = dolphinIdToReplayPath.get(dolphinId);
        const simpleTextPath = idToSimpleTextPath.get(simpleTextPathIds[i]);
        if (simpleTextPath) {
          try {
            if (replayPath) {
              const newFileScoreboardInfo = await processNewReplay(replayPath);
              if (newFileScoreboardInfo) {
                await writeFile(
                  simpleTextPath,
                  newFileScoreboardInfo.p1Name && newFileScoreboardInfo.p2Name
                    ? `${newFileScoreboardInfo.p1Name} vs ${newFileScoreboardInfo.p2Name}`
                    : '',
                );
              }
            } else {
              await writeFile(simpleTextPath, '');
            }
          } catch {
            // just catch
          }
        }
      }),
    );
  }

  overlayDolphinId = newOverlayDolphinId;

  if (enableOverlay && updateAutomatically && changed) {
    const replayPath = dolphinIdToReplayPath.get(overlayDolphinId);
    if (replayPath) {
      try {
        const newFileScoreboardInfo = await processNewReplay(replayPath);
        if (newFileScoreboardInfo) {
          await newFileUpdate(newFileScoreboardInfo);
        }
      } catch {
        // just catch
      }
    }
  }
}

function refreshBroadcastsInternal() {
  if (!webSocketClient || remoteStatus !== RemoteStatus.CONNECTED) {
    throw new Error('not connected');
  }

  mainWindow?.webContents.send('refreshingBroadcasts', true);
  webSocketClient.send(JSON.stringify({ op: 'list-broadcasts-request' }));
}

function setRefreshBroadcastsTimeout() {
  timeoutId = setTimeout(() => {
    try {
      refreshBroadcastsInternal();
      setRefreshBroadcastsTimeout();
    } catch {
      // just catch
    }
  }, REFRESH_CADENCE_MS);
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
      refreshBroadcastsInternal();
      setRefreshBroadcastsTimeout();
    })
    .on('error', (error) => {
      clearTimeout(timeoutId);
      timeoutId = undefined;

      webSocketClient?.removeAllListeners();
      webSocketClient = null;

      idToBroadcast.clear();
      sendBroadcasts();

      dolphinIdToSpectating.clear();
      spectatingBroadcastIdToDolphinId.clear();
      sendSpectating();

      remoteErr = error.message;
      remoteStatus = RemoteStatus.DISCONNECTED;
      sendState();
    })
    .on('close', () => {
      clearTimeout(timeoutId);
      timeoutId = undefined;

      webSocketClient?.removeAllListeners();
      webSocketClient = null;

      idToBroadcast.clear();
      sendBroadcasts();

      dolphinIdToSpectating.clear();
      spectatingBroadcastIdToDolphinId.clear();
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
          if (message.op === 'list-broadcasts-response') {
            mainWindow?.webContents.send('refreshingBroadcasts', false);
          }
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
                spectatingBroadcastIdToDolphinId.set(
                  spectate.broadcastId,
                  spectate.dolphinId,
                );
              },
            );
            sendSpectating();
            return;
          case 'dolphin-closed-event': {
            dolphinIdToReplayPath.delete(message.dolphinId);

            const broadcastId = dolphinIdToSpectating.get(message.dolphinId)
              ?.broadcastId;
            if (broadcastId) {
              spectatingBroadcastIdToDolphinId.delete(broadcastId);
            }
            const simpleTextPathId = dolphinIdToSimpleTextPathId.get(
              message.dolphinId,
            );
            if (simpleTextPathId) {
              const simpleTextPath = idToSimpleTextPath.get(simpleTextPathId);
              if (simpleTextPath) {
                writeFile(simpleTextPath, '').catch(() => {
                  // just catch
                });
              }
            }
            dolphinIdToSpectating.delete(message.dolphinId);
            sendSpectating();
            return;
          }
          case 'game-end-event':
            if (
              enableOverlay &&
              updateAutomatically &&
              overlayDolphinId === message.dolphinId
            ) {
              lock.acquire(message.dolphinId, async (release) => {
                const replayPath = dolphinIdToReplayPath.get(message.dolphinId);
                if (replayPath) {
                  try {
                    const gameEndScoreboardInfo =
                      await processFinishedReplay(replayPath);
                    if (gameEndScoreboardInfo) {
                      await gameEndUpdate(gameEndScoreboardInfo);
                    }
                    dolphinIdToReplayPath.delete(message.dolphinId);
                  } catch {
                    // just catch
                  } finally {
                    release();
                  }
                } else {
                  release();
                }
              });
            }

            if (!dolphinIdToSpectating.has(message.dolphinId)) {
              dolphinIdToSpectating.set(message.dolphinId, {
                dolphinId: message.dolphinId,
                broadcastId: message.broadcastId,
                spectating: true,
              });
              spectatingBroadcastIdToDolphinId.set(
                message.broadcastId,
                message.dolphinId,
              );
              sendSpectating();
            }
            return;
          case 'new-file-event': {
            dolphinIdToReplayPath.set(message.dolphinId, message.filePath);

            const simpleTextPathId = dolphinIdToSimpleTextPathId.get(
              message.dolphinId,
            );
            const simpleTextPath = simpleTextPathId
              ? idToSimpleTextPath.get(simpleTextPathId)
              : undefined;
            if (
              enableOverlay &&
              updateAutomatically &&
              (overlayDolphinId === message.dolphinId || simpleTextPath)
            ) {
              (async () => {
                try {
                  const newFileScoreboardInfo = await processNewReplay(
                    message.filePath,
                  );
                  if (newFileScoreboardInfo) {
                    if (overlayDolphinId === message.dolphinId) {
                      await newFileUpdate(newFileScoreboardInfo);
                    } else if (simpleTextPath) {
                      await writeFile(
                        simpleTextPath,
                        newFileScoreboardInfo.p1Name &&
                          newFileScoreboardInfo.p2Name
                          ? `${newFileScoreboardInfo.p1Name} vs ${newFileScoreboardInfo.p2Name}`
                          : '',
                      );
                    }
                  }
                } catch {
                  // just catch
                }
              })();
            }

            if (!dolphinIdToSpectating.has(message.dolphinId)) {
              dolphinIdToSpectating.set(message.dolphinId, {
                dolphinId: message.dolphinId,
                broadcastId: message.broadcastId,
                spectating: true,
              });
              spectatingBroadcastIdToDolphinId.set(
                message.broadcastId,
                message.dolphinId,
              );
              sendSpectating();
            }
            return;
          }
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
              const participant = getParticipant(connectCode);
              const pendingSets = participant
                ? participantIdToPendingSets.get(participant.id)
                : undefined;
              idToBroadcast.set(broadcast.id, {
                id: broadcast.id,
                connectCode,
                gamerTag: participant?.gamerTag,
                sets: pendingSets
                  ? pendingSets.map((pendingSet) => ({
                      id: pendingSet.id,
                      opponentName: pendingSet.isParticipantEntrant1
                        ? pendingSet.entrant2Name
                        : pendingSet.entrant1Name,
                    }))
                  : [],
                slippiName: broadcast.broadcaster.name,
              });
            });
            sendBroadcasts();
            mainWindow?.webContents.send('refreshingBroadcasts', false);
            return;
          case 'spectate-broadcast-response':
            dolphinIdToSpectating.set(message.dolphinId, {
              dolphinId: message.dolphinId,
              broadcastId: message.broadcastId,
              spectating: true,
            });
            spectatingBroadcastIdToDolphinId.set(
              message.broadcastId,
              message.dolphinId,
            );
            sendSpectating();
            return;
          case 'stop-broadcast-response': {
            const dolphinId = spectatingBroadcastIdToDolphinId.get(
              message.broadcastId,
            );
            if (dolphinId) {
              const simpleTextPathId =
                dolphinIdToSimpleTextPathId.get(dolphinId);
              if (simpleTextPathId) {
                const simpleTextPath = idToSimpleTextPath.get(simpleTextPathId);
                if (simpleTextPath) {
                  writeFile(simpleTextPath, '').catch(() => {
                    // just catch
                  });
                }
              }
              dolphinIdToSpectating.delete(dolphinId);
            }
            spectatingBroadcastIdToDolphinId.delete(message.broadcastId);
            sendSpectating();
            break;
          }
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
  clearTimeout(timeoutId);
  if (!webSocketClient || remoteStatus !== RemoteStatus.CONNECTED) {
    throw new Error('not connected');
  }

  refreshBroadcastsInternal();
  setRefreshBroadcastsTimeout();
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

export function stopSpectating(broadcastId: string) {
  if (!webSocketClient || remoteStatus !== RemoteStatus.CONNECTED) {
    throw new Error('not connected');
  }

  webSocketClient.send(
    JSON.stringify({ op: 'stop-broadcast-request', broadcastId }),
  );
}
