import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import AsyncLock from 'async-lock';
import { readFile, writeFile } from 'fs/promises';
import {
  Broadcast,
  ConnectCode,
  DolphinId,
  OverlayId,
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
  MSTPendingSetsScoreboardInfo,
  MSTScoreboardInfo,
  MSTSetData,
  MSTSkinColor,
  MSTWL,
} from '../common/mst';
import { REFRESH_CADENCE_MS } from '../common/constants';
import { getMstOverlay, MSTOverlay } from './mst';

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
  D = 'D',
}

type SpectatingInternal = {
  dolphinId: DolphinId;
  broadcastId: string;
  setId?: number;
  p1ParticipantId?: number;
  p2ParticipantId?: number;
};

function writeSimpleText(
  newFileScoreboardInfo: MSTNewFileScoreboardInfo,
  simpleTextPath: string,
) {
  return writeFile(
    simpleTextPath,
    newFileScoreboardInfo.p1Name && newFileScoreboardInfo.p2Name
      ? `${newFileScoreboardInfo.p1Name} vs ${newFileScoreboardInfo.p2Name}`
      : '',
  );
}

let timeoutId: NodeJS.Timeout | undefined;
const idToBroadcast = new Map<string, Broadcast>();
const dolphinIdToSpectating = new Map<DolphinId, SpectatingInternal>();
const spectatingBroadcastIdToDolphinId = new Map<string, DolphinId>();
let remoteErr = '';
let remoteStatus = RemoteStatus.DISCONNECTED;
let webSocketClient: WebSocket | null = null;
let mainWindow: BrowserWindow | null = null;
const connectCodeMisses = new Set<string>();
const connectCodeToParticipant = new Map<
  string,
  { id: number; gamerTag: string; prefix: string }
>();
const dolphinIdToReplayPath = new Map<DolphinId, string>();
let dolphinIdToSimpleTextPathId = new Map<DolphinId, SimpleTextPathId>();
const dolphinIdToOverlayId = new Map<DolphinId, OverlayId>();
const overlayIdToDolphinId = new Map<OverlayId, DolphinId>();
let participantIdToPendingSets = new Map<number, ParticipantSet[]>();
const gameEndedReplayPaths = new Set<string>();

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
  dolphinIdToSimpleTextPathId = new Map([
    ['spectate-1', SimpleTextPathId.A],
    ['spectate-2', SimpleTextPathId.B],
    ['spectate-3', SimpleTextPathId.C],
    ['spectate-4', SimpleTextPathId.D],
  ]);
  dolphinIdToOverlayId.clear();
  overlayIdToDolphinId.clear();
  participantIdToPendingSets.clear();
  gameEndedReplayPaths.clear();

  mainWindow = newMainWindow;
}

let updateAutomatically = false;
export function setUpdateAutomatically(newUpdateAutomatically: boolean) {
  updateAutomatically = newUpdateAutomatically;
}

const idToSimpleTextPath = new Map([
  [SimpleTextPathId.A, ''],
  [SimpleTextPathId.B, ''],
  [SimpleTextPathId.C, ''],
  [SimpleTextPathId.D, ''],
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
export function setSimpleTextPathD(simpleTextPath: string) {
  idToSimpleTextPath.set(SimpleTextPathId.D, simpleTextPath);
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

function getValidDolphinId(maybeDolphinId: any): DolphinId | null {
  if (
    maybeDolphinId === 'spectate-1' ||
    maybeDolphinId === 'spectate-2' ||
    maybeDolphinId === 'spectate-3' ||
    maybeDolphinId === 'spectate-4'
  ) {
    return maybeDolphinId;
  }
  return null;
}

function getSimpleTextPath(dolphinId: DolphinId) {
  const simpleTextPathId = dolphinIdToSimpleTextPathId.get(dolphinId);
  if (simpleTextPathId) {
    const simpleTextPath = idToSimpleTextPath.get(simpleTextPathId);
    return simpleTextPath;
  }
  return undefined;
}

function getDolphinIds(): DolphinId[] {
  return ['spectate-1', 'spectate-2', 'spectate-3', 'spectate-4'];
}

export function getSpectating() {
  return getDolphinIds().map((dolphinId): Spectating => {
    const spectatingInternal = dolphinIdToSpectating.get(dolphinId);
    if (spectatingInternal) {
      let broadcast = idToBroadcast.get(spectatingInternal.broadcastId);
      if (!broadcast) {
        broadcast = {
          id: spectatingInternal.broadcastId,
          connectCode: '',
          sets: [],
          slippiName: '',
        };
      }
      return {
        dolphinId,
        broadcast,
        lastReplaySetId: spectatingInternal.setId,
      };
    }
    return {
      dolphinId,
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

function getIntersectingSet(
  p1ParticipantId: number,
  p2ParticipantId: number,
  setId: number | undefined,
) {
  const p1PendingSets = participantIdToPendingSets.get(p1ParticipantId);
  const p2PendingSets = participantIdToPendingSets.get(p2ParticipantId);
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
      const setChanged = p1Set.id !== setId;

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
      const pendingSetsScoreboardInfo: MSTPendingSetsScoreboardInfo & {
        setId: number;
      } = {
        setId: p1Set.id,
        setChanged,
        p1Name: p1Set.isParticipantEntrant1
          ? p1Set.entrant1Name
          : p1Set.entrant2Name,
        p1Team: p1Set.isParticipantEntrant1
          ? p1Set.entrant1Sponsor
          : p1Set.entrant2Sponsor,
        p1Score: p1Set.isParticipantEntrant1
          ? p1Set.entrant1Score
          : p1Set.entrant2Score,
        p1WL,
        p2Name: p1Set.isParticipantEntrant1
          ? p1Set.entrant2Name
          : p1Set.entrant1Name,
        p2Team: p1Set.isParticipantEntrant1
          ? p1Set.entrant2Sponsor
          : p1Set.entrant1Sponsor,
        p2Score: p1Set.isParticipantEntrant1
          ? p1Set.entrant2Score
          : p1Set.entrant1Score,
        p2WL,
        bestOf: p1Set.bestOf === 5 ? 'Bo5' : 'Bo3',
        round: p1Set.fullRoundText,
      };
      return pendingSetsScoreboardInfo;
    }
  }
  return null;
}

export function setParticipantIdToPendingSets(
  newParticipantIdToPendingSets: Map<number, ParticipantSet[]>,
) {
  participantIdToPendingSets = newParticipantIdToPendingSets;
  recalculateAndSendBroadcasts();

  Array.from(dolphinIdToSpectating.values()).forEach((spectating) => {
    if (
      spectating.p1ParticipantId === undefined ||
      spectating.p2ParticipantId === undefined
    ) {
      return;
    }

    const pendingSetsScoreboardInfo = getIntersectingSet(
      spectating.p1ParticipantId,
      spectating.p2ParticipantId,
      spectating.setId,
    );
    if (pendingSetsScoreboardInfo) {
      spectating.setId = pendingSetsScoreboardInfo.setId;
      if (updateAutomatically) {
        const overlayId = dolphinIdToOverlayId.get(spectating.dolphinId);
        if (overlayId) {
          const mstOverlay = getMstOverlay(overlayId);
          if (mstOverlay) {
            mstOverlay
              .pendingSetsUpdate(pendingSetsScoreboardInfo)
              .catch(() => {
                // just catch
              });
          }
        }
      }
      if (pendingSetsScoreboardInfo.setChanged) {
        const simpleTextPath = getSimpleTextPath(spectating.dolphinId);
        if (simpleTextPath) {
          writeFile(
            simpleTextPath,
            `${pendingSetsScoreboardInfo.p1Name} vs ${pendingSetsScoreboardInfo.p2Name}`,
          ).catch(() => {
            // just catch
          });
        }
      }
    }
  });
}

async function processNewReplay(dolphinId: DolphinId, replayPath: string) {
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

  const p1ParticipantId = mstInfos[0].participant?.id;
  const p2ParticipantId = mstInfos[1].participant?.id;
  const spectating = dolphinIdToSpectating.get(dolphinId);
  if (!spectating) {
    throw new Error('unreachable');
  }

  let setId: number | undefined;
  let setData: MSTSetData | undefined;
  if (p1ParticipantId && p2ParticipantId) {
    const pendingSetsScoreboardInfo = getIntersectingSet(
      p1ParticipantId,
      p2ParticipantId,
      spectating.setId,
    );
    if (pendingSetsScoreboardInfo) {
      setId = pendingSetsScoreboardInfo.setId;
      p1Name = pendingSetsScoreboardInfo.p1Name;
      p1Team = pendingSetsScoreboardInfo.p1Team;
      p2Name = pendingSetsScoreboardInfo.p2Name;
      p2Team = pendingSetsScoreboardInfo.p2Team;
      setData = pendingSetsScoreboardInfo;
    }
  }

  const participantsChanged =
    p1ParticipantId !== spectating.p1ParticipantId ||
    p2ParticipantId !== spectating.p2ParticipantId;
  spectating.p1ParticipantId = p1ParticipantId;
  spectating.p2ParticipantId = p2ParticipantId;

  const setChanged = setId !== spectating.setId;
  spectating.setId = setId;

  const newFileScoreboardInfo: MSTNewFileScoreboardInfo = {
    participantsChanged,
    setChanged,
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

async function processFinishedReplay(replayPath: string) {
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

async function maybeClearSimpleTextTitle(dolphinId: DolphinId) {
  const simpleTextPathId = dolphinIdToSimpleTextPathId.get(dolphinId);
  if (simpleTextPathId) {
    const simpleTextPath = idToSimpleTextPath.get(simpleTextPathId);
    if (simpleTextPath) {
      try {
        await writeFile(simpleTextPath, '');
      } catch {
        // just catch
      }
    }
  }
}

export function getDolphinIdToOverlayId() {
  return dolphinIdToOverlayId;
}

export async function setDolphinOverlayId(
  dolphinId: DolphinId,
  overlayId: OverlayId,
) {
  const oldSimpleTextPathId = dolphinIdToSimpleTextPathId.get(dolphinId);
  if (!oldSimpleTextPathId) {
    throw new Error(`simple text path not found for ${dolphinId}`);
  }

  let oldOverlayScoreboardInfo: MSTScoreboardInfo | undefined;
  let oldOverlay: MSTOverlay | undefined;
  const oldOverlayId = dolphinIdToOverlayId.get(dolphinId);
  if (oldOverlayId) {
    oldOverlay = getMstOverlay(oldOverlayId);
    if (oldOverlay) {
      oldOverlayScoreboardInfo = await oldOverlay.readScoreboardInfo();
    }
  }

  let oldSimpleText = '';
  const oldSimpleTextPath = idToSimpleTextPath.get(oldSimpleTextPathId);
  if (oldSimpleTextPath) {
    oldSimpleText = await readFile(oldSimpleTextPath, { encoding: 'utf8' });
  }

  const newOverlay = getMstOverlay(overlayId);
  if (!newOverlay) {
    throw new Error(`no overlay for id: ${overlayId}`);
  }

  const dolphinToReplaceId = overlayIdToDolphinId.get(overlayId);
  if (dolphinToReplaceId) {
    const newSimpleTextPathId =
      dolphinIdToSimpleTextPathId.get(dolphinToReplaceId);
    if (!newSimpleTextPathId) {
      throw new Error(`simple text path not found for ${newSimpleTextPathId}`);
    }

    // Swap simple texts
    dolphinIdToSimpleTextPathId.set(dolphinId, newSimpleTextPathId);
    dolphinIdToSimpleTextPathId.set(dolphinToReplaceId, oldSimpleTextPathId);
    let newSimpleText = '';
    const newSimpleTextPath = idToSimpleTextPath.get(newSimpleTextPathId);
    if (newSimpleTextPath) {
      newSimpleText = await readFile(newSimpleTextPath, { encoding: 'utf8' });
      await writeFile(newSimpleTextPath, oldSimpleText);
    }
    if (oldSimpleTextPath) {
      await writeFile(oldSimpleTextPath, newSimpleText);
    }

    // Transfer overlay to dolphinToReplace
    if (oldOverlayId) {
      dolphinIdToOverlayId.set(dolphinToReplaceId, oldOverlayId);
      overlayIdToDolphinId.set(oldOverlayId, dolphinToReplaceId);
      const newOverlayScoreboardInfo = await newOverlay.readScoreboardInfo();
      oldOverlay?.manualUpdate(newOverlayScoreboardInfo);
    } else {
      dolphinIdToOverlayId.delete(dolphinToReplaceId);
    }
  }

  // Transfer overlay to dolphin
  dolphinIdToOverlayId.set(dolphinId, overlayId);
  overlayIdToDolphinId.set(overlayId, dolphinId);
  if (oldOverlayScoreboardInfo) {
    newOverlay.manualUpdate(oldOverlayScoreboardInfo);
  }

  return getDolphinIdToOverlayId();
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
                const validDolphinId = getValidDolphinId(spectate.dolphinId);
                if (validDolphinId) {
                  dolphinIdToSpectating.set(validDolphinId, {
                    dolphinId: validDolphinId,
                    broadcastId: spectate.broadcastId,
                  });
                  spectatingBroadcastIdToDolphinId.set(
                    spectate.broadcastId,
                    validDolphinId,
                  );
                }
              },
            );
            sendSpectating();
            return;
          case 'dolphin-closed-event': {
            const validDolphinId = getValidDolphinId(message.dolphinId);
            if (validDolphinId) {
              dolphinIdToReplayPath.delete(validDolphinId);

              const broadcastId =
                dolphinIdToSpectating.get(validDolphinId)?.broadcastId;
              if (broadcastId) {
                spectatingBroadcastIdToDolphinId.delete(broadcastId);
              }
              maybeClearSimpleTextTitle(validDolphinId);
              dolphinIdToSpectating.delete(validDolphinId);
              sendSpectating();
            }
            return;
          }
          case 'game-end-event': {
            const validDolphinId = getValidDolphinId(message.dolphinId);
            if (validDolphinId) {
              const overlayId = dolphinIdToOverlayId.get(validDolphinId);
              if (overlayId) {
                const mstOverlay = getMstOverlay(overlayId);
                if (mstOverlay && updateAutomatically) {
                  const replayPath = dolphinIdToReplayPath.get(validDolphinId);
                  lock.acquire(validDolphinId, async (release) => {
                    if (replayPath && !gameEndedReplayPaths.has(replayPath)) {
                      try {
                        const gameEndScoreboardInfo =
                          await processFinishedReplay(replayPath);
                        if (gameEndScoreboardInfo) {
                          await mstOverlay.gameEndUpdate(gameEndScoreboardInfo);
                        }
                        gameEndedReplayPaths.add(replayPath);
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
              }

              if (!dolphinIdToSpectating.has(validDolphinId)) {
                dolphinIdToSpectating.set(validDolphinId, {
                  dolphinId: validDolphinId,
                  broadcastId: message.broadcastId,
                });
                spectatingBroadcastIdToDolphinId.set(
                  message.broadcastId,
                  validDolphinId,
                );
                sendSpectating();
              }
            }
            return;
          }
          case 'new-file-event': {
            const validDolphinId = getValidDolphinId(message.dolphinId);
            if (validDolphinId) {
              dolphinIdToReplayPath.set(validDolphinId, message.filePath);

              (async () => {
                let newFileScoreboardInfo: MSTNewFileScoreboardInfo | null =
                  null;
                try {
                  newFileScoreboardInfo = await processNewReplay(
                    validDolphinId,
                    message.filePath,
                  );
                } catch {
                  // just catch
                }
                if (newFileScoreboardInfo) {
                  const promises: Promise<void>[] = [];
                  if (updateAutomatically) {
                    const overlayId = dolphinIdToOverlayId.get(validDolphinId);
                    if (overlayId) {
                      const mstOverlay = getMstOverlay(overlayId);
                      if (mstOverlay) {
                        promises.push(
                          mstOverlay.newFileUpdate(newFileScoreboardInfo),
                        );
                      }
                    }
                  }
                  if (
                    newFileScoreboardInfo.participantsChanged ||
                    newFileScoreboardInfo.setChanged
                  ) {
                    const simpleTextPath = getSimpleTextPath(validDolphinId);
                    if (simpleTextPath) {
                      promises.push(
                        writeSimpleText(newFileScoreboardInfo, simpleTextPath),
                      );
                    }
                  }
                  await Promise.allSettled(promises);
                }
              })();

              if (!dolphinIdToSpectating.has(validDolphinId)) {
                dolphinIdToSpectating.set(validDolphinId, {
                  dolphinId: validDolphinId,
                  broadcastId: message.broadcastId,
                });
                spectatingBroadcastIdToDolphinId.set(
                  message.broadcastId,
                  validDolphinId,
                );
              }
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
          case 'spectate-broadcast-response': {
            const validDolphinId = getValidDolphinId(message.dolphinId);
            if (validDolphinId) {
              dolphinIdToSpectating.set(validDolphinId, {
                dolphinId: validDolphinId,
                broadcastId: message.broadcastId,
              });
              spectatingBroadcastIdToDolphinId.set(
                message.broadcastId,
                validDolphinId,
              );
              sendSpectating();
            }
            return;
          }
          case 'stop-broadcast-response': {
            const dolphinId = spectatingBroadcastIdToDolphinId.get(
              message.broadcastId,
            );
            if (dolphinId) {
              maybeClearSimpleTextTitle(dolphinId);
              dolphinIdToReplayPath.delete(dolphinId);
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
