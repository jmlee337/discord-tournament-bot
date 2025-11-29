import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { BrowserWindow } from 'electron';
import { EMPTY_SCOREBOARD_INFO, MSTNewFileScoreboardInfo } from '../common/mst';
import { StartggSet } from '../common/types';

let mainWindow: BrowserWindow | undefined;
let p1EntrantId: number | undefined;
let p2EntrantId: number | undefined;
let setId: number | undefined;
let scoreboardInfo = EMPTY_SCOREBOARD_INFO;

export function initMST(window: BrowserWindow) {
  mainWindow = window;
  p1EntrantId = undefined;
  p2EntrantId = undefined;
  setId = undefined;
  scoreboardInfo = EMPTY_SCOREBOARD_INFO;
}

let enable = false;
let resourcesPath = '';
export async function readScoreboardInfo() {
  if (!enable || !resourcesPath) {
    return EMPTY_SCOREBOARD_INFO;
  }

  const json = await readFile(
    path.join(resourcesPath, 'Texts', 'ScoreboardInfo.json'),
    { encoding: 'utf8' },
  );
  scoreboardInfo = JSON.parse(json);
  return scoreboardInfo;
}

export function setEnableMST(newEnable: boolean) {
  const positiveEdge = !enable && newEnable;
  enable = newEnable;
  if (positiveEdge && resourcesPath) {
    mainWindow?.webContents.send('scoreboardInfo', readScoreboardInfo());
  }
}

export function setResourcesPath(newResourcesPath: string, canUpdate: boolean) {
  const changed = resourcesPath !== newResourcesPath;
  resourcesPath = newResourcesPath;
  if (enable && changed && canUpdate) {
    mainWindow?.webContents.send('scoreboardInfo', readScoreboardInfo());
  }
}

export function setTournamentName(newTournamentName: string) {
  scoreboardInfo.tournamentName = newTournamentName;
}

async function writeScoreboardInfo() {
  if (!enable || !resourcesPath) {
    return;
  }

  await writeFile(
    path.join(resourcesPath, 'Texts', 'ScoreboardInfo.json'),
    JSON.stringify(scoreboardInfo, undefined, 2),
  );
  mainWindow?.webContents.send('scoreboardInfo', scoreboardInfo);
}

export async function newFileUpdate(
  newFileScoreboardInfo: MSTNewFileScoreboardInfo,
) {
  p1EntrantId = newFileScoreboardInfo.p1EntrantId;
  p2EntrantId = newFileScoreboardInfo.p2EntrantId;
  if (newFileScoreboardInfo.setId === undefined) {
    // request sgg refresh
  }

  const setChanged = newFileScoreboardInfo.setId !== setId;
  if (setChanged) {
    setId = newFileScoreboardInfo.setId;
  }

  scoreboardInfo.p1Character = newFileScoreboardInfo.p1Character;
  scoreboardInfo.p1Skin = newFileScoreboardInfo.p1Skin;
  scoreboardInfo.p1Color = newFileScoreboardInfo.p1Color;
  scoreboardInfo.p2Character = newFileScoreboardInfo.p2Character;
  scoreboardInfo.p2Skin = newFileScoreboardInfo.p2Skin;
  scoreboardInfo.p2Color = newFileScoreboardInfo.p2Color;

  if (newFileScoreboardInfo.p1Name) {
    scoreboardInfo.p1Name = newFileScoreboardInfo.p1Name;
  }
  if (
    newFileScoreboardInfo.p1Score !== undefined &&
    (setChanged || newFileScoreboardInfo.p1Score > scoreboardInfo.p1Score)
  ) {
    scoreboardInfo.p1Score = newFileScoreboardInfo.p1Score;
  }
  if (newFileScoreboardInfo.p1WL) {
    scoreboardInfo.p1WL = newFileScoreboardInfo.p1WL;
  }
  if (newFileScoreboardInfo.p2Name) {
    scoreboardInfo.p2Name = newFileScoreboardInfo.p2Name;
  }
  if (
    newFileScoreboardInfo.p2Score !== undefined &&
    (setChanged || newFileScoreboardInfo.p2Score > scoreboardInfo.p2Score)
  ) {
    scoreboardInfo.p2Score = newFileScoreboardInfo.p2Score;
  }
  if (newFileScoreboardInfo.p2WL) {
    scoreboardInfo.p2WL = newFileScoreboardInfo.p2WL;
  }
  if (newFileScoreboardInfo.bestOf) {
    scoreboardInfo.bestOf = newFileScoreboardInfo.bestOf;
  }
  if (newFileScoreboardInfo.round) {
    scoreboardInfo.round = newFileScoreboardInfo.round;
  }

  await writeScoreboardInfo();
}

async function pendingSetUpdate(
  set: StartggSet,
  localP1EntrantId: number | undefined,
  localP2EntrantId: number | undefined,
) {
  scoreboardInfo.bestOf = set.bestOf === 5 ? 'Bo5' : 'Bo3';
  scoreboardInfo.round = set.fullRoundText;

  const p1IsEntrant1 =
    localP1EntrantId !== undefined
      ? set.entrant1Id === localP1EntrantId
      : set.entrant2Id === localP2EntrantId;
  scoreboardInfo.p1Name = p1IsEntrant1 ? set.entrant1Name : set.entrant2Name;
  scoreboardInfo.p1Score = p1IsEntrant1 ? set.entrant1Score : set.entrant2Score;
  scoreboardInfo.p1WL =
    !p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'Nada';
  scoreboardInfo.p2Name = p1IsEntrant1 ? set.entrant2Name : set.entrant1Name;
  scoreboardInfo.p2Score = p1IsEntrant1 ? set.entrant2Score : set.entrant1Score;
  scoreboardInfo.p2WL =
    p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'Nada';

  await writeScoreboardInfo();
}

export async function pendingSetsUpdate(
  entrantIdToPendingSets: Map<number, StartggSet[]>,
) {
  if (p1EntrantId === undefined && p2EntrantId === undefined) {
    return;
  }

  const idToPendingSet = new Map<number, StartggSet>();
  const idToIntersectionSet = new Map<number, StartggSet>();
  [p1EntrantId, p2EntrantId]
    .filter((entrantId) => entrantId !== undefined)
    .forEach((entrantId) => {
      const pendingSets = entrantIdToPendingSets.get(entrantId);
      if (pendingSets) {
        pendingSets.forEach((pendingSet) => {
          if (idToPendingSet.has(pendingSet.id)) {
            idToIntersectionSet.set(pendingSet.id, pendingSet);
          } else {
            idToPendingSet.set(pendingSet.id, pendingSet);
          }
        });
      }
    });

  if (idToIntersectionSet.size > 1) {
    return;
  }

  if (idToIntersectionSet.size === 1) {
    await pendingSetUpdate(
      Array.from(idToIntersectionSet.values())[0],
      p1EntrantId,
      p2EntrantId,
    );
  } else if (idToPendingSet.size === 1) {
    await pendingSetUpdate(
      Array.from(idToPendingSet.values())[0],
      p1EntrantId,
      p2EntrantId,
    );
  }
}
