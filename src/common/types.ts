export const CSV_DISCORD_KEY = 'JoinOnDiscord';
export type CsvParticipant = {
  Id: string;
  JoinOnDiscord: string;
};

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
  entrant1Id: number;
  entrant1Name: string;
  entrant2Id: number;
  entrant2Name: string;
  fullRoundText: string;
};

export type StartggEntrant = {
  id: number;
  participantIds: number[];
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
  csvPath: string;
  discordStatus: DiscordStatus;
  eventName: string;
  sets: StartggSet[];
  tournament: StartggTournament;
};
