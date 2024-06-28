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
