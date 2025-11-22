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
  completedAt: number | null;
  isDQ: boolean;
  entrant1Id: number;
  entrant1Name: string;
  entrant2Id: number;
  entrant2Name: string;
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

export type Sets = {
  pending: StartggPhase[];
  completed: StartggPhase[];
};

export type StartggParticipant = {
  id: number;
  connectCode?: string;
  discord?: {
    id: string;
    username: string;
  };
  gamerTag: string;
};

export type StartggEntrant = {
  id: number;
  participants: StartggParticipant[];
};

export type StartggEvent = {
  id: number;
  name: string;
  slug: string;
};

export type StartggTournament = {
  name: string;
  slug: string;
  events: StartggEvent[];
};

export type AdminedTournament = {
  name: string;
  slug: string;
};

export type DiscordUsername = {
  id: number;
  gamerTag: string;
  username: string;
};

export type ConnectCode = {
  connectCode: string;
  gamerTag: string;
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
  slippiName: string;
};

export type Spectating = {
  broadcastId: string;
  dolphinId: string;
};

export type StartingState = {
  connectCodes: ConnectCode[];
  discordStatus: DiscordStatus;
  discordUsernames: DiscordUsername[];
  eventName: string;
  remoteState: RemoteState;
  tournament: StartggTournament;
};

// yellow 400
export const HIGHLIGHT_COLOR = '#ffee58';
export type Highlight = {
  start: number;
  end: number;
};
