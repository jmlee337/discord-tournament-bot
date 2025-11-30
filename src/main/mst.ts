import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { BrowserWindow } from 'electron';
import {
  EMPTY_SCOREBOARD_INFO,
  MSTCharacter,
  MSTCharacterToSkinColors,
  MSTGameEndScoreboardInfo,
  MSTManualUpdateScoreboardInfo,
  MSTNewFileScoreboardInfo,
  MSTScoreboardInfo,
} from '../common/mst';
import { StartggSet } from '../common/types';

let mainWindow: BrowserWindow | undefined;
let p1EntrantId: number | undefined;
let p2EntrantId: number | undefined;
let setId: number | undefined;
let scoreboardInfo = EMPTY_SCOREBOARD_INFO;
let requestGetEventSets: (() => void) | undefined;

export function initMST(window: BrowserWindow) {
  mainWindow = window;
  p1EntrantId = undefined;
  p2EntrantId = undefined;
  setId = undefined;
  scoreboardInfo = EMPTY_SCOREBOARD_INFO;
  requestGetEventSets = undefined;
}

export function setRequestGetEventSets(newRequestEventSets: () => void) {
  requestGetEventSets = newRequestEventSets;
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

export async function setEnableMST(newEnable: boolean, canUpdate: boolean) {
  const positiveEdge = !enable && newEnable;
  enable = newEnable;
  if (canUpdate && positiveEdge && resourcesPath) {
    mainWindow?.webContents.send('scoreboardInfo', await readScoreboardInfo());
  }
}

export async function setResourcesPath(
  newResourcesPath: string,
  canUpdate: boolean,
) {
  const changed = resourcesPath !== newResourcesPath;
  resourcesPath = newResourcesPath;
  if (canUpdate && changed && enable) {
    mainWindow?.webContents.send('scoreboardInfo', await readScoreboardInfo());
  }
}

let enableSkinColor = false;
export function setEnableSkinColor(newEnableSkinColor: boolean) {
  enableSkinColor = newEnableSkinColor;
}

export function setTournamentName(newTournamentName: string) {
  scoreboardInfo.tournamentName = newTournamentName;
}

async function writeScoreboardInfo() {
  if (!enable || !resourcesPath) {
    return;
  }

  if (!enableSkinColor) {
    [scoreboardInfo.p1Skin] = MSTCharacterToSkinColors.get(
      scoreboardInfo.p1Character,
    )!;
    [scoreboardInfo.p2Skin] = MSTCharacterToSkinColors.get(
      scoreboardInfo.p2Character,
    )!;
  }

  let { p1Character } = scoreboardInfo;
  if (p1Character === MSTCharacter.SHEIK) {
    p1Character = MSTCharacter.ZELDA;
  }
  let { p2Character } = scoreboardInfo;
  if (p2Character === MSTCharacter.SHEIK) {
    p2Character = MSTCharacter.ZELDA;
  }

  const writtenScoreboardInfo: MSTScoreboardInfo = {
    ...scoreboardInfo,
    p1Character,
    p2Character,
  };

  await writeFile(
    path.join(resourcesPath, 'Texts', 'ScoreboardInfo.json'),
    JSON.stringify(writtenScoreboardInfo, undefined, 2),
  );
  mainWindow?.webContents.send('scoreboardInfo', scoreboardInfo);
}

// TODO: sponsor
export async function newFileUpdate(
  newFileScoreboardInfo: MSTNewFileScoreboardInfo,
) {
  const entrantsChanged =
    newFileScoreboardInfo.p1EntrantId !== p1EntrantId ||
    newFileScoreboardInfo.p2EntrantId !== p2EntrantId;
  p1EntrantId = newFileScoreboardInfo.p1EntrantId;
  p2EntrantId = newFileScoreboardInfo.p2EntrantId;

  const setChanged = newFileScoreboardInfo.setData?.setId !== setId;
  setId = newFileScoreboardInfo.setData?.setId;

  scoreboardInfo.p1Character = newFileScoreboardInfo.p1Character;
  scoreboardInfo.p1Skin = newFileScoreboardInfo.p1Skin;
  scoreboardInfo.p1Color = newFileScoreboardInfo.p1Color;
  scoreboardInfo.p2Character = newFileScoreboardInfo.p2Character;
  scoreboardInfo.p2Skin = newFileScoreboardInfo.p2Skin;
  scoreboardInfo.p2Color = newFileScoreboardInfo.p2Color;

  if (newFileScoreboardInfo.p1Name) {
    scoreboardInfo.p1Name = newFileScoreboardInfo.p1Name;
  }
  if (newFileScoreboardInfo.p2Name) {
    scoreboardInfo.p2Name = newFileScoreboardInfo.p2Name;
  }

  if (newFileScoreboardInfo.setData) {
    scoreboardInfo.p1WL = newFileScoreboardInfo.setData.p1WL;
    scoreboardInfo.p2WL = newFileScoreboardInfo.setData.p2WL;
    scoreboardInfo.bestOf = newFileScoreboardInfo.setData.bestOf;
    scoreboardInfo.round = newFileScoreboardInfo.setData.round;
    if (
      setChanged ||
      newFileScoreboardInfo.setData.p1Score > scoreboardInfo.p1Score
    ) {
      scoreboardInfo.p1Score = newFileScoreboardInfo.setData.p1Score;
    }
    if (
      setChanged ||
      newFileScoreboardInfo.setData.p2Score > scoreboardInfo.p2Score
    ) {
      scoreboardInfo.p2Score = newFileScoreboardInfo.setData.p2Score;
    }
  } else {
    if (setChanged || entrantsChanged) {
      scoreboardInfo.p1Score = 0;
      scoreboardInfo.p2Score = 0;
    }
    if (requestGetEventSets) {
      requestGetEventSets();
    }
  }

  await writeScoreboardInfo();
}

async function pendingSetUpdate(
  set: StartggSet,
  localP1EntrantId: number | undefined,
  localP2EntrantId: number | undefined,
) {
  const setChanged = set.id !== setId;
  setId = set.id;

  scoreboardInfo.bestOf = set.bestOf === 5 ? 'Bo5' : 'Bo3';
  scoreboardInfo.round = set.fullRoundText;

  const p1IsEntrant1 =
    localP1EntrantId !== undefined
      ? set.entrant1Id === localP1EntrantId
      : set.entrant2Id === localP2EntrantId;
  scoreboardInfo.p1Name = p1IsEntrant1 ? set.entrant1Name : set.entrant2Name;
  scoreboardInfo.p1WL =
    !p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'Nada';
  scoreboardInfo.p2Name = p1IsEntrant1 ? set.entrant2Name : set.entrant1Name;
  scoreboardInfo.p2WL =
    p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'Nada';

  const newP1Score = p1IsEntrant1 ? set.entrant1Score : set.entrant2Score;
  if (setChanged || newP1Score > scoreboardInfo.p1Score) {
    scoreboardInfo.p1Score = newP1Score;
  }
  const newP2Score = p1IsEntrant1 ? set.entrant2Score : set.entrant1Score;
  if (setChanged || newP2Score > scoreboardInfo.p2Score) {
    scoreboardInfo.p2Score = newP2Score;
  }

  await writeScoreboardInfo();
}

// TODO: sponsor
export async function pendingSetsUpdate(
  entrantIdToPendingSets: Map<number, StartggSet[]>,
) {
  if (p1EntrantId === undefined && p2EntrantId === undefined) {
    return;
  }

  const idToPendingSet = new Map<number, StartggSet>();

  // TODO: require intersection
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

export async function gameEndUpdate(
  gameEndScoreboardInfo: MSTGameEndScoreboardInfo,
) {
  if (gameEndScoreboardInfo.p1ScoreIncrement) {
    scoreboardInfo.p1Score += 1;
  } else if (gameEndScoreboardInfo.p2ScoreIncrement) {
    scoreboardInfo.p2Score += 1;
  }

  await writeScoreboardInfo();
}

export async function manualUpdate(
  manualUpdateScoreboardInfo: MSTManualUpdateScoreboardInfo,
) {
  scoreboardInfo.p1Name = manualUpdateScoreboardInfo.p1Name;
  scoreboardInfo.p1Team = manualUpdateScoreboardInfo.p1Team;
  scoreboardInfo.p1Character = manualUpdateScoreboardInfo.p1Character;
  scoreboardInfo.p1Skin = manualUpdateScoreboardInfo.p1Skin;
  scoreboardInfo.p1Score = manualUpdateScoreboardInfo.p1Score;
  scoreboardInfo.p1WL = manualUpdateScoreboardInfo.p1WL;
  scoreboardInfo.p2Name = manualUpdateScoreboardInfo.p2Name;
  scoreboardInfo.p2Team = manualUpdateScoreboardInfo.p2Team;
  scoreboardInfo.p2Character = manualUpdateScoreboardInfo.p2Character;
  scoreboardInfo.p2Skin = manualUpdateScoreboardInfo.p2Skin;
  scoreboardInfo.p2Score = manualUpdateScoreboardInfo.p2Score;
  scoreboardInfo.p2WL = manualUpdateScoreboardInfo.p2WL;
  scoreboardInfo.bestOf = manualUpdateScoreboardInfo.bestOf;
  scoreboardInfo.round = manualUpdateScoreboardInfo.round;
  scoreboardInfo.tournamentName = manualUpdateScoreboardInfo.tournamentName;
  scoreboardInfo.caster1Name = manualUpdateScoreboardInfo.caster1Name;
  scoreboardInfo.caster1Twitter = manualUpdateScoreboardInfo.caster1Twitter;
  scoreboardInfo.caster1Twitch = manualUpdateScoreboardInfo.caster1Twitch;
  scoreboardInfo.caster2Name = manualUpdateScoreboardInfo.caster2Name;
  scoreboardInfo.caster2Twitter = manualUpdateScoreboardInfo.caster2Twitter;
  scoreboardInfo.caster2Twitch = manualUpdateScoreboardInfo.caster2Twitch;

  await writeScoreboardInfo();
}
