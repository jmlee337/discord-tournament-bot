import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { BrowserWindow } from 'electron';
import { EMPTY_SCOREBOARD_INFO, MSTNewFileScoreboardInfo } from '../common/mst';

let mainWindow: BrowserWindow | undefined;
let scoreboardInfo = EMPTY_SCOREBOARD_INFO;

export function initMST(window: BrowserWindow) {
  mainWindow = window;
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
    'utf8',
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

export function setResourcesPath(newResourcesPath: string) {
  resourcesPath = newResourcesPath;
  if (enable && resourcesPath) {
    mainWindow?.webContents.send('scoreboardInfo', readScoreboardInfo());
  }
}

async function writeScoreboardInfo() {
  if (!enable || !resourcesPath) {
    return;
  }

  mainWindow?.webContents.send('scoreboardInfo', scoreboardInfo);
  await writeFile(
    path.join(resourcesPath, 'Texts', 'ScoreboardInfo.json'),
    JSON.stringify(scoreboardInfo, undefined, 2),
  );
}

export async function newFileUpdate(
  newFileScoreboardInfo: MSTNewFileScoreboardInfo,
) {
  scoreboardInfo.p1Character = newFileScoreboardInfo.p1Character;
  scoreboardInfo.p1Skin = newFileScoreboardInfo.p1Skin;
  scoreboardInfo.p1Color = newFileScoreboardInfo.p1Color;
  scoreboardInfo.p2Character = newFileScoreboardInfo.p2Character;
  scoreboardInfo.p2Skin = newFileScoreboardInfo.p2Skin;
  scoreboardInfo.p2Color = newFileScoreboardInfo.p2Color;

  if (newFileScoreboardInfo.p1Name) {
    scoreboardInfo.p1Name = newFileScoreboardInfo.p1Name;
  }
  // TODO: always overwrite score if set changed
  if (
    newFileScoreboardInfo.p1Score &&
    newFileScoreboardInfo.p1Score > scoreboardInfo.p1Score
  ) {
    scoreboardInfo.p1Score = newFileScoreboardInfo.p1Score;
  }
  if (newFileScoreboardInfo.p1WL) {
    scoreboardInfo.p1WL = newFileScoreboardInfo.p1WL;
  }
  if (newFileScoreboardInfo.p2Name) {
    scoreboardInfo.p2Name = newFileScoreboardInfo.p2Name;
  }
  // TODO: always overwrite score if set changed
  if (
    newFileScoreboardInfo.p2Score &&
    newFileScoreboardInfo.p2Score > scoreboardInfo.p2Score
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
  if (newFileScoreboardInfo.tournamentName) {
    scoreboardInfo.tournamentName = newFileScoreboardInfo.tournamentName;
  }

  await writeScoreboardInfo();
}
