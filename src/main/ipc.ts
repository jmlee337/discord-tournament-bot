import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import {
  BrowserWindow,
  IpcMainInvokeEvent,
  app,
  clipboard,
  dialog,
  ipcMain,
} from 'electron';
import Store from 'electron-store';
import { readFile } from 'fs/promises';
import { parse } from 'papaparse';
import {
  CSV_DISCORD_KEY,
  CsvParticipant,
  DiscordConfig,
  DiscordStatus,
  StartggSet,
  StartggTournament,
  StartingState,
} from '../common/types';
import { getEventEntrants, getEventSets, getTournament } from './startgg';

export default function setupIPCs(mainWindow: BrowserWindow) {
  const store = new Store();
  let discordConfig = store.has('discordConfig')
    ? (store.get('discordConfig') as DiscordConfig)
    : { applicationId: '', token: '' };
  let discordRegisteredVersion = store.has('discordRegisteredVersion')
    ? (store.get('discordRegisteredVersion') as string)
    : '';
  let startggApiKey = store.has('startggApiKey')
    ? (store.get('startggApiKey') as string)
    : '';

  const discordUsernameToParticipantId = new Map<string, number>();
  const participantIdToEntrantId = new Map<number, number>();
  const entrantIdToSet = new Map<number, StartggSet>();

  /**
   * Discord
   */
  let client: Client | null = null;
  let discordStatus = DiscordStatus.NONE;
  const updateDiscordStatus = (newDiscordStatus: DiscordStatus) => {
    discordStatus = newDiscordStatus;
    mainWindow.webContents.send('discordStatus', newDiscordStatus);
  };
  const registerSlashCommands = async () => {
    if (!discordConfig.token || !discordConfig.applicationId) {
      throw new Error(
        'need discord token and application id to register slash commands',
      );
    }
    const body = [
      new SlashCommandBuilder()
        .setName('reportset')
        .setDescription('report the result of your set.')
        .toJSON(),
    ];
    try {
      await new REST()
        .setToken(discordConfig.token)
        .put(Routes.applicationCommands(discordConfig.applicationId), {
          body,
        });
      const version = app.getVersion();
      store.set('discordRegisteredVersion', version);
      discordRegisteredVersion = version;
      updateDiscordStatus(DiscordStatus.READY);
    } catch {
      updateDiscordStatus(DiscordStatus.BAD_APPLICATION_ID);
    }
  };
  const maybeStartDiscordClient = async () => {
    if (
      discordConfig.applicationId &&
      discordConfig.token &&
      discordUsernameToParticipantId.size > 0 &&
      participantIdToEntrantId.size > 0
    ) {
      if (client) {
        await client.destroy();
      }
      updateDiscordStatus(DiscordStatus.STARTING);
      client = new Client({ intents: [GatewayIntentBits.Guilds] });
      client.once(Events.ClientReady, async () => {
        if (discordRegisteredVersion !== app.getVersion()) {
          await registerSlashCommands();
        } else {
          updateDiscordStatus(DiscordStatus.READY);
        }
      });
      client.on(Events.InteractionCreate, (interaction) => {
        if (!interaction.isChatInputCommand()) {
          return;
        }
        interaction.reply(interaction.commandName);
      });
      try {
        await client.login(discordConfig.token);
      } catch {
        updateDiscordStatus(DiscordStatus.BAD_TOKEN);
      }
    }
  };

  ipcMain.removeHandler('getDiscordConfig');
  ipcMain.handle('getDiscordConfig', () => discordConfig);

  ipcMain.removeHandler('setDiscordConfig');
  ipcMain.handle(
    'setDiscordConfig',
    (event: IpcMainInvokeEvent, newDiscordConfig: DiscordConfig) => {
      const changed =
        JSON.stringify(discordConfig) !== JSON.stringify(newDiscordConfig);
      store.set('discordConfig', newDiscordConfig);
      discordConfig = newDiscordConfig;
      if (changed) {
        maybeStartDiscordClient();
      }
    },
  );

  /**
   * start.gg
   */
  ipcMain.removeHandler('getStartggApiKey');
  ipcMain.handle('getStartggApiKey', () => startggApiKey);

  ipcMain.removeHandler('setStartggApiKey');
  ipcMain.handle(
    'setStartggApiKey',
    (event: IpcMainInvokeEvent, newStartggApiKey: string) => {
      store.set('startggApiKey', newStartggApiKey);
      startggApiKey = newStartggApiKey;
    },
  );

  ipcMain.removeHandler('loadCsv');
  ipcMain.handle('loadCsv', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return '';
    }

    const [csvPath] = openDialogRes.filePaths;
    const csvString = (await readFile(csvPath))
      .toString()
      .replace(/Join .* on Discord!/, CSV_DISCORD_KEY);
    const results = parse(csvString, { header: true });
    if (results.errors.length > 0) {
      throw new Error(results.errors.map((error) => error.message).join('\n'));
    }

    const isParticipant = (value: unknown): value is CsvParticipant =>
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      'Id' in value &&
      typeof (value as CsvParticipant).Id === 'string' &&
      CSV_DISCORD_KEY in value &&
      typeof (value as CsvParticipant)[CSV_DISCORD_KEY] === 'string';
    const participants = results.data.filter(isParticipant);
    if (participants.length === 0) {
      return '';
    }

    participants.forEach((participant) => {
      discordUsernameToParticipantId.set(
        participant.JoinOnDiscord,
        parseInt(participant.Id, 10),
      );
    });
    if (client === null) {
      maybeStartDiscordClient();
    }
    return csvPath;
  });

  let tournament: StartggTournament = {
    name: '',
    slug: '',
    events: [],
  };
  ipcMain.removeHandler('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event: IpcMainInvokeEvent, slug: string) => {
      tournament = await getTournament(slug);
      return tournament;
    },
  );

  let eventId = 0;
  let eventName = '';
  let timeout: NodeJS.Timeout | null = null;
  const updateEntrantIdToSet = (sets: StartggSet[]) => {
    entrantIdToSet.clear();
    sets.forEach((set) => {
      entrantIdToSet.set(set.entrant1Id, set);
      entrantIdToSet.set(set.entrant2Id, set);
    });
  };
  const refresh = async () => {
    try {
      updateEntrantIdToSet(await getEventSets(eventId, startggApiKey));
    } catch {
      // empty
    } finally {
      timeout = setTimeout(refresh, 60000);
    }
  };

  ipcMain.removeHandler('setEventId');
  ipcMain.handle(
    'setEvent',
    async (event: IpcMainInvokeEvent, id: number, name: string) => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg API key');
      }
      const entrantsPromise = getEventEntrants(id);
      const setsPromise = getEventSets(id, startggApiKey);

      // await both, we don't want to proceed if either throws
      const entrants = await entrantsPromise;
      const sets = await setsPromise;

      // all clear to clear maps and update
      participantIdToEntrantId.clear();
      entrants.forEach((entrant) => {
        entrant.participantIds.forEach((participantId) => {
          participantIdToEntrantId.set(participantId, entrant.id);
        });
      });
      updateEntrantIdToSet(sets);

      eventId = id;
      eventName = name;
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(refresh, 60000);

      if (client === null) {
        maybeStartDiscordClient();
      }
    },
  );

  ipcMain.removeHandler('getStartingState');
  ipcMain.handle(
    'getStartingState',
    (): StartingState => ({
      discordStatus,
      eventName,
      tournament,
    }),
  );

  ipcMain.removeHandler('getVersion');
  ipcMain.handle('getVersion', () => app.getVersion());

  ipcMain.removeHandler('getLatestVersion');
  ipcMain.handle('getLatestVersion', async () => {
    const response = await fetch(
      'https://api.github.com/repos/jmlee337/discord-tournament-bot/releases',
    );
    const json = await response.json();
    return Array.isArray(json) && json.length > 0 ? json[0].tag_name : '';
  });

  ipcMain.removeHandler('copyToClipboard');
  ipcMain.handle(
    'copyToClipboard',
    (event: IpcMainInvokeEvent, text: string) => {
      clipboard.writeText(text);
    },
  );
}
