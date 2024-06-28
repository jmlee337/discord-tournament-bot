export enum DiscordStatus {
  NONE,
  BAD_TOKEN,
  BAD_CLIENT_ID,
  READY,
}

export type DiscordConfig = {
  applicationId: string;
  token: string;
};
