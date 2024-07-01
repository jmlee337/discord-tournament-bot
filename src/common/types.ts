export enum DiscordStatus {
  NONE,
  STARTING,
  BAD_TOKEN,
  BAD_APPLICATION_ID,
  READY,
}

export type DiscordConfig = {
  applicationId: string;
  token: string;
};

export type ReportStartggSet = {
  setId: number;
  winnerId: number;
  isDQ: boolean;
};

export type StartggSet = {
  id: number;
  isDQ: boolean;
  entrant1Id: number;
  entrant1Name: string;
  entrant2Id: number;
  entrant2Name: string;
  fullRoundText: string;
  winnerId: number | null;
};

export type StartggPhaseGroup = {
  name: string;
  sets: StartggSet[];
};

export type StartggPhase = {
  name: string;
  phaseGroups: StartggPhaseGroup[];
};

export type Sets = {
  pending: StartggPhase[];
  completed: StartggPhase[];
};

export type StartggEntrant = {
  id: number;
  discordIds: string[];
};

export type StartggEvent = {
  id: number;
  name: string;
};

export type StartggTournament = {
  name: string;
  slug: string;
  events: StartggEvent[];
};

export type StartingState = {
  discordStatus: DiscordStatus;
  eventName: string;
  sets: Sets;
  tournament: StartggTournament;
};
