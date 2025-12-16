import { readFile, writeFile } from 'fs/promises';
import { BrowserWindow } from 'electron';
import path from 'path';
import {
  EMPTY_SCOREBOARD_INFO,
  MSTCharacter,
  MSTCharacterToSkinColors,
  MSTGameEndScoreboardInfo,
  MSTManualUpdateScoreboardInfo,
  MSTNewFileScoreboardInfo,
  MSTPendingSetsScoreboardInfo,
  MSTScoreboardInfo,
} from '../common/mst';
import { OverlayId } from '../common/types';

// global
export function getScoreboardInfoJSONPath(resourcesPath: string) {
  return path.join(resourcesPath, 'Texts', 'ScoreboardInfo.json');
}

// local
let mainWindow: BrowserWindow | undefined;

let requestGetTournamentSets: (() => void) | undefined;
export function setRequestGetTournamentSets(
  newRequestGetTournamentSets: () => void,
) {
  requestGetTournamentSets = newRequestGetTournamentSets;
}

let enableSkinColor = false;
export function setEnableSkinColor(newEnableSkinColor: boolean) {
  enableSkinColor = newEnableSkinColor;
}

let enableSggSponsors = false;
export function setEnableSggSponsors(newEnableSggSponsors: boolean) {
  enableSggSponsors = newEnableSggSponsors;
}

// instance
export class MSTOverlay {
  private id: OverlayId;

  private enableSggRound: boolean;

  private resourcesPath: string;

  private scoreboardInfo: MSTScoreboardInfo;

  constructor(id: OverlayId, enableSggRound: boolean, resourcesPath: string) {
    this.id = id;
    this.enableSggRound = enableSggRound;
    this.resourcesPath = resourcesPath;
    this.scoreboardInfo = EMPTY_SCOREBOARD_INFO;
  }

  public async setResourcesPath(newResourcesPath: string, canUpdate: boolean) {
    const changed = this.resourcesPath !== newResourcesPath;
    this.resourcesPath = newResourcesPath;
    if (canUpdate && changed) {
      try {
        mainWindow?.webContents.send(
          `scoreboardInfo${this.id}`,
          await this.readScoreboardInfo(),
        );
      } catch {
        // just catch
      }
    }
  }

  public setEnableSggRound(newEnableSggRound: boolean) {
    this.enableSggRound = newEnableSggRound;
  }

  public async readScoreboardInfo() {
    if (!this.resourcesPath) {
      return EMPTY_SCOREBOARD_INFO;
    }

    const json = await readFile(getScoreboardInfoJSONPath(this.resourcesPath), {
      encoding: 'utf8',
    });
    this.scoreboardInfo = JSON.parse(json);

    if (
      this.scoreboardInfo.p1Character === MSTCharacter.ZELDA &&
      this.scoreboardInfo.p1Skin.startsWith('Sheik')
    ) {
      this.scoreboardInfo.p1Character = MSTCharacter.SHEIK;
    }
    if (
      this.scoreboardInfo.p2Character === MSTCharacter.ZELDA &&
      this.scoreboardInfo.p2Skin.startsWith('Sheik')
    ) {
      this.scoreboardInfo.p2Character = MSTCharacter.SHEIK;
    }
    return { ...this.scoreboardInfo };
  }

  public async tournamentNameUpdate(newTournamentName: string) {
    this.scoreboardInfo.tournamentName = newTournamentName;
    await this.writeScoreboardInfo();
  }

  public async newFileUpdate(newFileScoreboardInfo: MSTNewFileScoreboardInfo) {
    this.scoreboardInfo.p1Character = newFileScoreboardInfo.p1Character;
    this.scoreboardInfo.p1Skin = newFileScoreboardInfo.p1Skin;
    this.scoreboardInfo.p2Character = newFileScoreboardInfo.p2Character;
    this.scoreboardInfo.p2Skin = newFileScoreboardInfo.p2Skin;

    if (newFileScoreboardInfo.p1Name) {
      this.scoreboardInfo.p1Name = newFileScoreboardInfo.p1Name;
    } else if (
      newFileScoreboardInfo.setChanged ||
      newFileScoreboardInfo.participantsChanged
    ) {
      this.scoreboardInfo.p1Name = '';
    }
    if (newFileScoreboardInfo.p2Name) {
      this.scoreboardInfo.p2Name = newFileScoreboardInfo.p2Name;
    } else if (
      newFileScoreboardInfo.setChanged ||
      newFileScoreboardInfo.participantsChanged
    ) {
      this.scoreboardInfo.p2Name = '';
    }
    if (enableSggSponsors) {
      if (newFileScoreboardInfo.p1Team) {
        this.scoreboardInfo.p1Team = newFileScoreboardInfo.p1Team;
      } else if (
        newFileScoreboardInfo.setChanged ||
        newFileScoreboardInfo.participantsChanged
      ) {
        this.scoreboardInfo.p1Team = '';
      }
      if (newFileScoreboardInfo.p2Team) {
        this.scoreboardInfo.p2Team = newFileScoreboardInfo.p2Team;
      } else if (
        newFileScoreboardInfo.setChanged ||
        newFileScoreboardInfo.participantsChanged
      ) {
        this.scoreboardInfo.p2Team = '';
      }
    } else {
      this.scoreboardInfo.p1Team = '';
      this.scoreboardInfo.p2Team = '';
    }

    if (newFileScoreboardInfo.setData) {
      this.scoreboardInfo.bestOf = newFileScoreboardInfo.setData.bestOf;
      if (this.enableSggRound) {
        this.scoreboardInfo.round = newFileScoreboardInfo.setData.round;
      }
      if (newFileScoreboardInfo.setData.p1WL) {
        this.scoreboardInfo.p1WL = newFileScoreboardInfo.setData.p1WL;
      }
      if (newFileScoreboardInfo.setData.p2WL) {
        this.scoreboardInfo.p2WL = newFileScoreboardInfo.setData.p2WL;
      }
      if (
        newFileScoreboardInfo.setChanged ||
        newFileScoreboardInfo.setData.p1Score > this.scoreboardInfo.p1Score
      ) {
        this.scoreboardInfo.p1Score = newFileScoreboardInfo.setData.p1Score;
      }
      if (
        newFileScoreboardInfo.setChanged ||
        newFileScoreboardInfo.setData.p2Score > this.scoreboardInfo.p2Score
      ) {
        this.scoreboardInfo.p2Score = newFileScoreboardInfo.setData.p2Score;
      }
    } else {
      if (
        newFileScoreboardInfo.setChanged ||
        newFileScoreboardInfo.participantsChanged
      ) {
        this.scoreboardInfo.p1Score = 0;
        this.scoreboardInfo.p2Score = 0;
        if (this.enableSggRound) {
          this.scoreboardInfo.round = '';
        }
      }
      if (requestGetTournamentSets) {
        requestGetTournamentSets();
      }
    }

    await this.writeScoreboardInfo();
  }

  public async pendingSetsUpdate(
    pendingSetsScoreboardInfo: MSTPendingSetsScoreboardInfo,
  ) {
    this.scoreboardInfo.p1Name = pendingSetsScoreboardInfo.p1Name;
    this.scoreboardInfo.p2Name = pendingSetsScoreboardInfo.p2Name;

    if (enableSggSponsors) {
      this.scoreboardInfo.p1Team = pendingSetsScoreboardInfo.p1Team;
      this.scoreboardInfo.p2Team = pendingSetsScoreboardInfo.p2Team;
    } else {
      this.scoreboardInfo.p1Team = '';
      this.scoreboardInfo.p2Team = '';
    }

    if (
      pendingSetsScoreboardInfo.setChanged ||
      pendingSetsScoreboardInfo.p1Score > this.scoreboardInfo.p1Score
    ) {
      this.scoreboardInfo.p1Score = pendingSetsScoreboardInfo.p1Score;
    }
    if (
      pendingSetsScoreboardInfo.setChanged ||
      pendingSetsScoreboardInfo.p2Score > this.scoreboardInfo.p2Score
    ) {
      this.scoreboardInfo.p2Score = pendingSetsScoreboardInfo.p2Score;
    }

    if (pendingSetsScoreboardInfo.p1WL) {
      this.scoreboardInfo.p1WL = pendingSetsScoreboardInfo.p1WL;
    }
    if (pendingSetsScoreboardInfo.p2WL) {
      this.scoreboardInfo.p2WL = pendingSetsScoreboardInfo.p2WL;
    }

    this.scoreboardInfo.bestOf = pendingSetsScoreboardInfo.bestOf;
    if (this.enableSggRound) {
      this.scoreboardInfo.round = pendingSetsScoreboardInfo.round;
    }

    await this.writeScoreboardInfo();
  }

  public async gameEndUpdate(gameEndScoreboardInfo: MSTGameEndScoreboardInfo) {
    if (gameEndScoreboardInfo.p1ScoreIncrement) {
      this.scoreboardInfo.p1Score += 1;
    } else if (gameEndScoreboardInfo.p2ScoreIncrement) {
      this.scoreboardInfo.p2Score += 1;
    }

    await this.writeScoreboardInfo();
  }

  public async manualUpdate(
    manualUpdateScoreboardInfo: MSTManualUpdateScoreboardInfo,
  ) {
    this.scoreboardInfo.p1Name = manualUpdateScoreboardInfo.p1Name;
    this.scoreboardInfo.p1Team = manualUpdateScoreboardInfo.p1Team;
    this.scoreboardInfo.p1Character = manualUpdateScoreboardInfo.p1Character;
    this.scoreboardInfo.p1Skin = manualUpdateScoreboardInfo.p1Skin;
    this.scoreboardInfo.p1Color = manualUpdateScoreboardInfo.p1Color;
    this.scoreboardInfo.p1Score = manualUpdateScoreboardInfo.p1Score;
    this.scoreboardInfo.p1WL = manualUpdateScoreboardInfo.p1WL;
    this.scoreboardInfo.p2Name = manualUpdateScoreboardInfo.p2Name;
    this.scoreboardInfo.p2Team = manualUpdateScoreboardInfo.p2Team;
    this.scoreboardInfo.p2Character = manualUpdateScoreboardInfo.p2Character;
    this.scoreboardInfo.p2Skin = manualUpdateScoreboardInfo.p2Skin;
    this.scoreboardInfo.p2Color = manualUpdateScoreboardInfo.p2Color;
    this.scoreboardInfo.p2Score = manualUpdateScoreboardInfo.p2Score;
    this.scoreboardInfo.p2WL = manualUpdateScoreboardInfo.p2WL;
    this.scoreboardInfo.bestOf = manualUpdateScoreboardInfo.bestOf;
    this.scoreboardInfo.round = manualUpdateScoreboardInfo.round;
    this.scoreboardInfo.tournamentName =
      manualUpdateScoreboardInfo.tournamentName;
    this.scoreboardInfo.caster1Name = manualUpdateScoreboardInfo.caster1Name;
    this.scoreboardInfo.caster1Twitter =
      manualUpdateScoreboardInfo.caster1Twitter;
    this.scoreboardInfo.caster1Twitch =
      manualUpdateScoreboardInfo.caster1Twitch;
    this.scoreboardInfo.caster2Name = manualUpdateScoreboardInfo.caster2Name;
    this.scoreboardInfo.caster2Twitter =
      manualUpdateScoreboardInfo.caster2Twitter;
    this.scoreboardInfo.caster2Twitch =
      manualUpdateScoreboardInfo.caster2Twitch;

    await this.writeScoreboardInfo();
  }

  async writeScoreboardInfo() {
    if (!this.resourcesPath) {
      return;
    }

    if (!enableSkinColor) {
      [this.scoreboardInfo.p1Skin] = MSTCharacterToSkinColors.get(
        this.scoreboardInfo.p1Character,
      )!;
      [this.scoreboardInfo.p2Skin] = MSTCharacterToSkinColors.get(
        this.scoreboardInfo.p2Character,
      )!;
    }

    let { p1Character } = this.scoreboardInfo;
    if (p1Character === MSTCharacter.SHEIK) {
      p1Character = MSTCharacter.ZELDA;
    }
    let { p2Character } = this.scoreboardInfo;
    if (p2Character === MSTCharacter.SHEIK) {
      p2Character = MSTCharacter.ZELDA;
    }

    const low = 0;
    const high = this.scoreboardInfo.bestOf === 'Bo5' ? 3 : 2;
    this.scoreboardInfo.p1Score = Math.min(
      Math.max(this.scoreboardInfo.p1Score, low),
      high,
    );
    this.scoreboardInfo.p2Score = Math.min(
      Math.max(this.scoreboardInfo.p2Score, low),
      high,
    );

    const writtenScoreboardInfo: MSTScoreboardInfo = {
      ...this.scoreboardInfo,
      p1Character,
      p2Character,
    };

    await writeFile(
      getScoreboardInfoJSONPath(this.resourcesPath),
      JSON.stringify(writtenScoreboardInfo, undefined, 2),
    );
    mainWindow?.webContents.send(
      `scoreboardInfo${this.id}`,
      this.scoreboardInfo,
    );
  }
}

const idToMstOverlay = new Map<OverlayId, MSTOverlay>();
export function initMST(window: BrowserWindow) {
  mainWindow = window;
  idToMstOverlay.clear();
}

export function getMstOverlaysLength() {
  return idToMstOverlay.size;
}

export function getMstOverlay(id: OverlayId) {
  return idToMstOverlay.get(id);
}

export function setMstOverlay(id: OverlayId, mstOverlay: MSTOverlay) {
  idToMstOverlay.set(id, mstOverlay);
}

export function deleteMstOverlay(id: OverlayId) {
  idToMstOverlay.delete(id);
}

export function forEachMstOverlay(
  forEachPred: (mstOverlay: MSTOverlay) => void,
) {
  Array.from(idToMstOverlay.values()).forEach(forEachPred);
}
