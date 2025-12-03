import { readFile, writeFile } from 'fs/promises';
import { BrowserWindow } from 'electron';
import path from 'path';
import {
  EMPTY_SCOREBOARD_INFO,
  matchesGrandFinal,
  MSTCharacter,
  MSTCharacterToSkinColors,
  MSTGameEndScoreboardInfo,
  MSTManualUpdateScoreboardInfo,
  MSTNewFileScoreboardInfo,
  MSTScoreboardInfo,
  MSTWL,
} from '../common/mst';
import { StartggSet } from '../common/types';

export function getScoreboardInfoJSONPath(resourcesPath: string) {
  return path.join(resourcesPath, 'Texts', 'ScoreboardInfo.json');
}

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

  const json = await readFile(getScoreboardInfoJSONPath(resourcesPath), {
    encoding: 'utf8',
  });
  scoreboardInfo = JSON.parse(json);

  if (
    scoreboardInfo.p1Character === MSTCharacter.ZELDA &&
    scoreboardInfo.p1Skin.startsWith('Sheik')
  ) {
    scoreboardInfo.p1Character = MSTCharacter.SHEIK;
  }
  if (
    scoreboardInfo.p2Character === MSTCharacter.ZELDA &&
    scoreboardInfo.p2Skin.startsWith('Sheik')
  ) {
    scoreboardInfo.p2Character = MSTCharacter.SHEIK;
  }
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

let enableSggSponsors = false;
export function setEnableSggSponsors(newEnableSggSponsors: boolean) {
  enableSggSponsors = newEnableSggSponsors;
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

  const low = 0;
  const high = scoreboardInfo.bestOf === 'Bo5' ? 3 : 2;
  scoreboardInfo.p1Score = Math.min(
    Math.max(scoreboardInfo.p1Score, low),
    high,
  );
  scoreboardInfo.p2Score = Math.min(
    Math.max(scoreboardInfo.p2Score, low),
    high,
  );

  let p1WL: MSTWL = 'Nada';
  let p2WL: MSTWL = 'Nada';
  if (matchesGrandFinal(scoreboardInfo.round)) {
    ({ p1WL } = scoreboardInfo);
    ({ p2WL } = scoreboardInfo);
  }

  const writtenScoreboardInfo: MSTScoreboardInfo = {
    ...scoreboardInfo,
    p1Character,
    p1WL,
    p2Character,
    p2WL,
  };

  await writeFile(
    getScoreboardInfoJSONPath(resourcesPath),
    JSON.stringify(writtenScoreboardInfo, undefined, 2),
  );
  mainWindow?.webContents.send('scoreboardInfo', scoreboardInfo);
}

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
  scoreboardInfo.p2Character = newFileScoreboardInfo.p2Character;
  scoreboardInfo.p2Skin = newFileScoreboardInfo.p2Skin;

  if (newFileScoreboardInfo.p1Name) {
    scoreboardInfo.p1Name = newFileScoreboardInfo.p1Name;
  } else if (setChanged || entrantsChanged) {
    scoreboardInfo.p1Name = '';
  }
  if (newFileScoreboardInfo.p2Name) {
    scoreboardInfo.p2Name = newFileScoreboardInfo.p2Name;
  } else if (setChanged || entrantsChanged) {
    scoreboardInfo.p2Name = '';
  }
  if (enableSggSponsors) {
    if (newFileScoreboardInfo.p1Team) {
      scoreboardInfo.p1Team = newFileScoreboardInfo.p1Team;
    } else if (setChanged || entrantsChanged) {
      scoreboardInfo.p1Team = '';
    }
    if (newFileScoreboardInfo.p2Team) {
      scoreboardInfo.p2Team = newFileScoreboardInfo.p2Team;
    } else if (setChanged || entrantsChanged) {
      scoreboardInfo.p2Team = '';
    }
  } else {
    scoreboardInfo.p1Team = '';
    scoreboardInfo.p2Team = '';
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
      scoreboardInfo.p1WL = 'Nada';
      scoreboardInfo.p2Score = 0;
      scoreboardInfo.p2WL = 'Nada';
      scoreboardInfo.round = '';
    }
    if (requestGetEventSets) {
      requestGetEventSets();
    }
  }

  await writeScoreboardInfo();
}

export async function pendingSetsUpdate(
  entrantIdToPendingSets: Map<number, StartggSet[]>,
) {
  if (p1EntrantId === undefined || p2EntrantId === undefined) {
    return;
  }

  const p1PendingSets = entrantIdToPendingSets.get(p1EntrantId);
  const p2PendingSets = entrantIdToPendingSets.get(p2EntrantId);
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
      const setChanged = set.id !== setId;
      setId = set.id;

      scoreboardInfo.bestOf = set.bestOf === 5 ? 'Bo5' : 'Bo3';
      scoreboardInfo.round = set.fullRoundText;

      const p1IsEntrant1 =
        p1EntrantId !== undefined
          ? set.entrant1Id === p1EntrantId
          : set.entrant2Id === p2EntrantId;
      scoreboardInfo.p1Name = p1IsEntrant1
        ? set.entrant1Name
        : set.entrant2Name;
      scoreboardInfo.p1WL =
        !p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'Nada';
      scoreboardInfo.p2Name = p1IsEntrant1
        ? set.entrant2Name
        : set.entrant1Name;
      scoreboardInfo.p2WL =
        p1IsEntrant1 && set.fullRoundText === 'Grand Final' ? 'L' : 'Nada';

      if (enableSggSponsors) {
        scoreboardInfo.p1Team = p1IsEntrant1
          ? set.entrant1Sponsor
          : set.entrant2Sponsor;
        scoreboardInfo.p2Team = p1IsEntrant1
          ? set.entrant2Sponsor
          : set.entrant1Sponsor;
      } else {
        scoreboardInfo.p1Team = '';
        scoreboardInfo.p2Team = '';
      }

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
  scoreboardInfo.p1Color = manualUpdateScoreboardInfo.p1Color;
  scoreboardInfo.p1Score = manualUpdateScoreboardInfo.p1Score;
  scoreboardInfo.p1WL = manualUpdateScoreboardInfo.p1WL;
  scoreboardInfo.p2Name = manualUpdateScoreboardInfo.p2Name;
  scoreboardInfo.p2Team = manualUpdateScoreboardInfo.p2Team;
  scoreboardInfo.p2Character = manualUpdateScoreboardInfo.p2Character;
  scoreboardInfo.p2Skin = manualUpdateScoreboardInfo.p2Skin;
  scoreboardInfo.p2Color = manualUpdateScoreboardInfo.p2Color;
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
