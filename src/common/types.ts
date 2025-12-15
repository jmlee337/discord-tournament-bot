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
  bestOf: number;
  completedAt: number | null;
  isDQ: boolean;
  entrant1Id: number;
  entrant1Name: string;
  entrant1Sponsor: string;
  entrant1Score: number;
  entrant2Id: number;
  entrant2Name: string;
  entrant2Sponsor: string;
  entrant2Score: number;
  fullRoundText: string;
  round: number;
  startedAt: number | null;
  state: number;
  updatedAt: number;
  winnerId: number | null;
};

export type StartggPhaseGroup = {
  name: string;
  sets: StartggSet[];
};

export type StartggPhase = {
  name: string;
  phaseGroups: StartggPhaseGroup[];
  phaseOrder: number;
};

export type StartggEvent = {
  name: string;
  phases: StartggPhase[];
};

export type Sets = {
  pending: StartggEvent[];
  completed: StartggEvent[];
};

export type ParticipantSet = StartggSet & {
  isParticipantEntrant1: boolean;
  opponentParticipantIds: number[];
  ownParticipantIds: number[];
};

export type StartggParticipant = {
  id: number;
  connectCode?: string;
  discord?: {
    id: string;
    username: string;
  };
  gamerTag: string;
  prefix: string;
};

export type StartggEntrant = {
  id: number;
  participantsIds: number[];
};

export type StartggTournament = {
  name: string;
  slug: string;
};

export type AdminedTournament = {
  name: string;
  slug: string;
};

export enum IsDiscordServerMember {
  UNKNOWN,
  NO,
  YES,
}

export type DiscordUsername = {
  discordId: string;
  participantId: number;
  gamerTag: string;
  username: string;
  isDiscordServerMember: IsDiscordServerMember;
};

export type DiscordToPing = {
  discordId: string;
  gamerTag: string;
  username: string;
};

export type ConnectCode = {
  connectCode: string;
  gamerTag: string;
  participantId: number;
  prefix: string;
};

export type ParticipantConnections = {
  connectCodes: ConnectCode[];
  discordUsernames: DiscordUsername[];
};

export enum RemoteStatus {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
}

export type RemoteState = {
  err: string;
  status: RemoteStatus;
};

export type Broadcast = {
  id: string;
  connectCode: string;
  gamerTag?: string;
  sets: {
    id: number;
    opponentName: string;
  }[];
  slippiName: string;
};

export type DolphinId =
  | 'spectate-1'
  | 'spectate-2'
  | 'spectate-3'
  | 'spectate-4';

export type Spectating = {
  dolphinId: DolphinId;
  broadcast?: Broadcast;
};

export type DiscordServer = {
  id: string;
  name: string;
  iconUrl: string | null;
};

export type StartingState = {
  connectCodes: ConnectCode[];
  discordStatus: DiscordStatus;
  discordServerId: string;
  discordUsernames: DiscordUsername[];
  remoteState: RemoteState;
  tournament: StartggTournament;
};

// yellow 400
export const HIGHLIGHT_COLOR = '#ffee58';
export type Highlight = {
  start: number;
  end: number;
};

export type DiscordChannel = {
  id: string;
  name: string;
};

export type GameStartInfo = {
  playerType: number;
  characterId: number;
  costumeIndex: number;
  connectCode?: string;
};

export type GameEndInfo = {
  definite: boolean;
  placings: number[];
  playerTypes: number[];
};

export type GetTournamentRet = {
  idToEntrant: Map<number, StartggEntrant>;
  sets: Sets;
  tournament: StartggTournament;
};

export type OverlayId = 1 | 2 | 3 | 4;
