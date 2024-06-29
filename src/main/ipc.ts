import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  ipcMain,
} from 'electron';
import Store from 'electron-store';
import {
  DiscordConfig,
  DiscordStatus,
  StartggSet,
  StartggTournament,
  StartingState,
} from '../common/types';
import {
  getEventEntrants,
  getEventSets,
  getTournament,
  reportSet,
} from './startgg';

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

  /**
   * Needed for both Discord and start.gg
   */
  const discordIdToEntrantId = new Map<string, number>();
  const entrantIdToDiscordIds = new Map<number, string[]>();
  const entrantIdToSet = new Map<number, StartggSet>();
  let eventId = 0;
  let sets: StartggSet[] = [];
  const updateEntrantIdToSet = (newSets: StartggSet[]) => {
    entrantIdToSet.clear();
    newSets.forEach((newSet) => {
      entrantIdToSet.set(newSet.entrant1Id, newSet);
      entrantIdToSet.set(newSet.entrant2Id, newSet);
    });
    mainWindow.webContents.send('sets', newSets);
    sets = newSets;
  };

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
      discordIdToEntrantId.size > 0
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
      client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) {
          return;
        }
        if (interaction.commandName === 'reportset') {
          const entrantId = discordIdToEntrantId.get(interaction.user.id);
          if (!entrantId) {
            interaction.reply({
              content: 'new bracket who dis',
              ephemeral: true,
            });
            return;
          }
          const set = entrantIdToSet.get(entrantId);
          if (!set) {
            interaction.reply({ content: 'No set to report', ephemeral: true });
          } else {
            const won = new ButtonBuilder()
              .setCustomId(set.entrant1Id.toString(10))
              .setLabel(`${set.entrant1Name} won the set`)
              .setStyle(ButtonStyle.Primary);
            const lost = new ButtonBuilder()
              .setCustomId(set.entrant2Id.toString(10))
              .setLabel(`${set.entrant2Name} won the set`)
              .setStyle(ButtonStyle.Success);
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              won,
              lost,
            );
            const response = await interaction.reply({
              content: `${set.fullRoundText}: ${set.entrant1Name} vs ${set.entrant2Name}`,
              components: [row],
            });

            const validDiscordIds = new Set<string>();
            const forEachPredicate = (discordId: string) => {
              validDiscordIds.add(discordId);
            };
            entrantIdToDiscordIds
              .get(set.entrant1Id)
              ?.forEach(forEachPredicate);
            entrantIdToDiscordIds
              .get(set.entrant2Id)
              ?.forEach(forEachPredicate);
            try {
              const confirmation = await response.awaitMessageComponent({
                time: 15000,
                filter: (confI) => validDiscordIds.has(confI.user.id),
              });
              const winnerId = parseInt(confirmation.customId, 10);
              let updatedSets: Map<number, StartggSet>;
              try {
                updatedSets = await reportSet(
                  { setId: set.id, winnerId, isDQ: false },
                  startggApiKey,
                );
              } catch {
                confirmation.update({
                  content: 'Failed to report to start.gg',
                  components: [],
                });
                return;
              }
              try {
                updateEntrantIdToSet(
                  await getEventSets(
                    eventId,
                    startggApiKey,
                    set.id,
                    updatedSets,
                  ),
                );
              } catch {
                // empty
              }
              const winnerName =
                set.entrant1Id === winnerId
                  ? set.entrant1Name
                  : set.entrant2Name;
              const loserName =
                set.entrant1Id === winnerId
                  ? set.entrant2Name
                  : set.entrant1Name;
              confirmation.update({
                content: `Reported win for ${winnerName} (vs ${loserName}) in ${set.fullRoundText}`,
                components: [],
              });
            } catch {
              interaction.editReply({ content: 'Timed out', components: [] });
            }
          }
        } else {
          interaction.reply(interaction.commandName);
        }
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

  let eventName = '';
  ipcMain.removeHandler('setEventId');
  ipcMain.handle(
    'setEvent',
    async (event: IpcMainInvokeEvent, id: number, name: string) => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg API key');
      }
      const entrantsPromise = getEventEntrants(id, startggApiKey);
      const setsPromise = getEventSets(id, startggApiKey);

      // await both, we don't want to proceed if either throws
      const entrants = await entrantsPromise;
      const newSets = await setsPromise;

      // all clear to clear maps and update
      discordIdToEntrantId.clear();
      entrantIdToDiscordIds.clear();
      entrants.forEach((entrant) => {
        entrantIdToDiscordIds.set(entrant.id, entrant.discordIds);
        entrant.discordIds.forEach((discordId) => {
          discordIdToEntrantId.set(discordId, entrant.id);
        });
      });
      updateEntrantIdToSet(newSets);

      eventId = id;
      eventName = name;
      if (client === null) {
        maybeStartDiscordClient();
      }
    },
  );

  ipcMain.removeHandler('refreshSets');
  ipcMain.handle('refreshSets', async () => {
    if (!startggApiKey) {
      throw new Error('Please set start.gg API key');
    }

    updateEntrantIdToSet(await getEventSets(eventId, startggApiKey));
  });

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    async (
      event: IpcMainInvokeEvent,
      setId: number,
      winnerId: number,
      isDQ: boolean,
    ) => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      const updatedSets = await reportSet(
        { setId, winnerId, isDQ },
        startggApiKey,
      );
      updateEntrantIdToSet(
        await getEventSets(eventId, startggApiKey, setId, updatedSets),
      );
    },
  );

  ipcMain.removeHandler('getStartingState');
  ipcMain.handle(
    'getStartingState',
    (): StartingState => ({
      discordStatus,
      eventName,
      sets,
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
