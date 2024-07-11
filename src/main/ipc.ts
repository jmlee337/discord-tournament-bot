import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  Client,
  ComponentType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  InteractionResponse,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
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
  LinkedParticipant,
  ReportStartggSet,
  Sets,
  StartggEvent,
  StartggSet,
  StartggTournament,
  StartingState,
} from '../common/types';
import {
  getEventEntrants,
  getEventSets,
  getTournament,
  getTournaments,
  initStartgg,
  reportSet,
  reportSets,
  resetSet,
  swapWinner,
} from './startgg';

const CONFIRMATION_TIMEOUT_MS = 30000;
const STARTGG_BLACK = '#031221';
const STARTGG_BLUE = '#3870e0';
const STARTGG_GREEN = '#22b24c';
const STARTGG_GREY = '#68717a';
const STARTGG_RED = '#e0225b';
function setInitialEmbed(embed: EmbedBuilder, set: StartggSet) {
  return embed
    .setColor(STARTGG_BLUE)
    .setTitle(`${set.entrant1Name} vs ${set.entrant2Name}`)
    .setDescription(set.fullRoundText)
    .setFooter({ text: 'Please click the set winner' });
}

function getButtonRow(set: StartggSet) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(set.entrant1Id.toString(10))
      .setLabel(set.entrant1Name)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(set.entrant2Id.toString(10))
      .setLabel(set.entrant2Name)
      .setStyle(ButtonStyle.Success),
  );
}

function timeOutInteraction(
  embed: EmbedBuilder,
  interaction:
    | ChatInputCommandInteraction<CacheType>
    | StringSelectMenuInteraction<CacheType>,
) {
  interaction.editReply({
    components: [],
    embeds: [
      embed
        .setColor(STARTGG_BLACK)
        .setFooter({ text: 'Timed out. You may try again' }),
    ],
  });
}

function startggPendingConfirmation(
  embed: EmbedBuilder,
  confirmation: ButtonInteraction,
) {
  confirmation.update({
    components: [],
    embeds: [
      embed.setColor(STARTGG_GREY).setFooter({
        text: 'Reporting to start.gg...',
      }),
    ],
  });
}

function startggFailConfirmation(
  embed: EmbedBuilder,
  confirmation: ButtonInteraction,
) {
  confirmation.editReply({
    embeds: [
      embed.setColor(STARTGG_RED).setFooter({
        text: 'Failed to report to start.gg. Please try again',
      }),
    ],
  });
}

function getOpponentName(set: StartggSet, entrantId: number) {
  if (entrantId === set.entrant1Id) {
    return set.entrant2Name;
  }
  if (entrantId === set.entrant2Id) {
    return set.entrant1Name;
  }
  throw new Error('entrantId not in set.');
}

export default function setupIPCs(mainWindow: BrowserWindow) {
  initStartgg();
  const store = new Store();
  let discordConfig = store.has('discordConfig')
    ? (store.get('discordConfig') as DiscordConfig)
    : { applicationId: '', token: '' };
  let discordCommandDq = store.has('discordCommandDq')
    ? (store.get('discordCommandDq') as boolean)
    : true;
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
  const discordIdToGamerTag = new Map<string, string>();
  const entrantIdToDiscordIds = new Map<number, string[]>();
  const entrantIdToSets = new Map<number, StartggSet[]>();
  let startggEvent: StartggEvent = {
    id: 0,
    name: '',
    slug: '',
  };
  let sets: Sets = {
    pending: [],
    completed: [],
  };
  let tournament: StartggTournament = {
    name: '',
    slug: '',
    events: [],
  };
  const setIdToCompletedAt = new Map<number, number>();
  const updateEntrantIdToSet = (newSets: Sets) => {
    entrantIdToSets.clear();
    newSets.pending.forEach((pendingPhase) => {
      pendingPhase.phaseGroups.forEach((pendingPhaseGroup) => {
        pendingPhaseGroup.sets.forEach((pendingSet) => {
          const entrant1Sets = entrantIdToSets.get(pendingSet.entrant1Id) || [];
          entrant1Sets.push(pendingSet);
          entrantIdToSets.set(pendingSet.entrant1Id, entrant1Sets);
          const entrant2Sets = entrantIdToSets.get(pendingSet.entrant2Id) || [];
          entrant2Sets.push(pendingSet);
          entrantIdToSets.set(pendingSet.entrant2Id, entrant2Sets);
        });
      });
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
  const getExpectedRegisteredVersion = () =>
    `${discordConfig.applicationId}${discordConfig.token}${app.getVersion()}`;
  const registerSlashCommands = async () => {
    if (!discordConfig.applicationId || !discordConfig.token) {
      throw new Error(
        'need discord token and application id to register slash commands',
      );
    }
    const body = [
      new SlashCommandBuilder()
        .setName('dq')
        .setDescription('forfeit your pending set(s).')
        .toJSON(),
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
      const newRegisteredVersion = getExpectedRegisteredVersion();
      store.set('discordRegisteredVersion', newRegisteredVersion);
      discordRegisteredVersion = newRegisteredVersion;
      updateDiscordStatus(DiscordStatus.READY);
    } catch {
      updateDiscordStatus(DiscordStatus.BAD_APPLICATION_ID);
    }
  };
  const getEntrantIdAndSets = (
    interaction: ChatInputCommandInteraction<CacheType>,
  ): { entrantId?: number; entrantSets?: StartggSet[] } => {
    const entrantId = discordIdToEntrantId.get(interaction.user.id);
    if (!entrantId) {
      interaction.reply({
        content:
          "Sorry, I can't figure out who you are on start.gg. Please make sure you're registered for\n" +
          `\`${tournament.name}, ${startggEvent.name}\`\n` +
          `and that your Discord account \`${interaction.user.tag}\`\n` +
          'is connected here: https://www.start.gg/admin/profile/connected-accounts',
        ephemeral: true,
      });
      return {};
    }
    return {
      entrantId,
      entrantSets: entrantIdToSets
        .get(entrantId)
        ?.filter((set) => !setIdToCompletedAt.has(set.id))
        .sort((setA, setB) =>
          getOpponentName(setA, entrantId).localeCompare(
            getOpponentName(setB, entrantId),
          ),
        ),
    };
  };
  const awaitReportResponse = async (
    embed: EmbedBuilder,
    interaction:
      | ChatInputCommandInteraction<CacheType>
      | StringSelectMenuInteraction<CacheType>,
    response: InteractionResponse<boolean>,
    set: StartggSet,
  ) => {
    const validDiscordIds = new Set<string>();
    const forEachPredicate = (discordId: string) => {
      validDiscordIds.add(discordId);
    };
    entrantIdToDiscordIds.get(set.entrant1Id)?.forEach(forEachPredicate);
    entrantIdToDiscordIds.get(set.entrant2Id)?.forEach(forEachPredicate);
    try {
      const confirmation =
        await response.awaitMessageComponent<ComponentType.Button>({
          time: CONFIRMATION_TIMEOUT_MS,
          filter: (confI) => validDiscordIds.has(confI.user.id),
        });
      startggPendingConfirmation(embed, confirmation);
      const winnerId = parseInt(confirmation.customId, 10);
      try {
        await reportSet(
          { setId: set.id, winnerId, isDQ: false },
          setIdToCompletedAt,
          startggApiKey,
        );
        const inner = winnerId === set.entrant1Id ? '[W - L]' : '[L - W]';
        const { displayName } = confirmation.user;
        const gamerTag = discordIdToGamerTag.get(confirmation.user.id)!;
        const suffix = displayName
          .toLowerCase()
          .includes(gamerTag.toLowerCase())
          ? ''
          : ` (${gamerTag})`;
        confirmation.editReply({
          components: [],
          embeds: [
            embed
              .setColor(STARTGG_GREEN)
              .setTitle(`${set.entrant1Name}  ${inner}  ${set.entrant2Name}`)
              .setFooter({
                text: `Reported by ${displayName}${suffix}`,
              }),
          ],
        });
      } catch {
        startggFailConfirmation(embed, confirmation);
      }
    } catch {
      timeOutInteraction(embed, interaction);
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
        if (discordRegisteredVersion !== getExpectedRegisteredVersion()) {
          await registerSlashCommands();
        } else {
          updateDiscordStatus(DiscordStatus.READY);
        }
      });
      client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) {
          return;
        }
        if (interaction.commandName === 'dq') {
          if (!discordCommandDq) {
            interaction.reply({
              content: 'This command is currently disabled',
              ephemeral: true,
            });
            return;
          }
          const { entrantId, entrantSets } = getEntrantIdAndSets(interaction);
          if (!entrantId) {
            return;
          }
          if (!entrantSets || entrantSets.length === 0) {
            interaction.reply({ content: 'No pending sets', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setColor(STARTGG_RED)
            .setTitle('Are you sure you want to DQ?')
            .setFields(
              entrantSets.slice(0, 25).map((entrantSet) => ({
                name: entrantSet.fullRoundText,
                value: `vs ${getOpponentName(entrantSet, entrantId)}`,
                inline: true,
              })),
            );
          const numNotShown = entrantSets.length - 25;
          if (numNotShown > 0) {
            embed.setFooter({
              text: `${numNotShown} sets not shown (${entrantSets.length} total)`,
            });
          }
          const response = await interaction.reply({
            embeds: [embed],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('cancel')
                  .setLabel('Cancel')
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId('confirm')
                  .setLabel(
                    entrantSets.length > 1 ? 'Confirm all DQs' : 'Confirm DQ',
                  )
                  .setStyle(ButtonStyle.Danger),
              ),
            ],
          });
          try {
            const confirmation =
              await response.awaitMessageComponent<ComponentType.Button>({
                time: CONFIRMATION_TIMEOUT_MS,
                filter: (confI) => confI.user.id === interaction.user.id,
              });
            if (confirmation.customId === 'cancel') {
              confirmation.update({
                components: [],
                embeds: [
                  new EmbedBuilder()
                    .setColor(STARTGG_BLACK)
                    .setTitle('DQ Cancelled'),
                ],
              });
              return;
            }
            startggPendingConfirmation(embed, confirmation);
            try {
              await reportSets(
                entrantSets.map(
                  (entrantSet): ReportStartggSet => ({
                    setId: entrantSet.id,
                    winnerId:
                      entrantId === entrantSet.entrant1Id
                        ? entrantSet.entrant2Id
                        : entrantSet.entrant1Id,
                    isDQ: true,
                  }),
                ),
                setIdToCompletedAt,
                startggApiKey,
              );
              const entrantName =
                entrantId === entrantSets[0].entrant1Id
                  ? entrantSets[0].entrant1Name
                  : entrantSets[0].entrant2Name;
              const titleSuffix =
                entrantSets.length > 1
                  ? ` from ${entrantSets.length} sets`
                  : '';
              const { displayName } = confirmation.user;
              const gamerTag = discordIdToGamerTag.get(confirmation.user.id)!;
              const footerSuffix = displayName
                .toLowerCase()
                .includes(gamerTag.toLowerCase())
                ? ''
                : ` (${gamerTag})`;
              confirmation.editReply({
                embeds: [
                  embed
                    .setColor(STARTGG_GREEN)
                    .setTitle(`${entrantName} DQed${titleSuffix}`)
                    .setFooter({
                      text: `Requested by ${displayName}${footerSuffix}`,
                    }),
                ],
              });
            } catch {
              startggFailConfirmation(embed, confirmation);
            }
          } catch {
            timeOutInteraction(embed, interaction);
          }
        } else if (interaction.commandName === 'reportset') {
          const { entrantId, entrantSets } = getEntrantIdAndSets(interaction);
          if (!entrantId) {
            return;
          }
          if (!entrantSets || entrantSets.length === 0) {
            interaction.reply({ content: 'No set to report', ephemeral: true });
            return;
          }
          if (entrantSets.length === 1) {
            const [set] = entrantSets;
            const embed = setInitialEmbed(new EmbedBuilder(), set);
            const response = await interaction.reply({
              components: [getButtonRow(set)],
              embeds: [embed],
            });
            await awaitReportResponse(embed, interaction, response, set);
          } else {
            const embed = new EmbedBuilder()
              .setColor(STARTGG_BLUE)
              .setTitle(
                `${interaction.user.displayName} selecting set to report...`,
              );
            const response = await interaction.reply({
              components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId('asdf')
                    .setPlaceholder('Which set would you like to report?')
                    .addOptions(
                      entrantSets.map((entrantSet) =>
                        new StringSelectMenuOptionBuilder()
                          .setLabel(
                            `vs ${getOpponentName(entrantSet, entrantId)}`,
                          )
                          .setValue(entrantSet.id.toString(10)),
                      ),
                    ),
                ),
              ],
              embeds: [embed],
            });
            try {
              const selectSetConfirmation =
                await response.awaitMessageComponent({
                  time: CONFIRMATION_TIMEOUT_MS,
                  filter: (confI) => confI.user.id === interaction.user.id,
                });
              if (selectSetConfirmation.isStringSelectMenu()) {
                const setId = parseInt(selectSetConfirmation.values[0], 10);
                const entrantSet = entrantSets.find((set) => set.id === setId);
                if (entrantSet) {
                  const reportSetResponse = await selectSetConfirmation.update({
                    components: [getButtonRow(entrantSet)],
                    embeds: [setInitialEmbed(embed, entrantSet)],
                  });
                  await awaitReportResponse(
                    embed,
                    selectSetConfirmation,
                    reportSetResponse,
                    entrantSet,
                  );
                }
              }
            } catch {
              timeOutInteraction(embed, interaction);
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

  ipcMain.removeHandler('getDiscordCommandDq');
  ipcMain.handle('getDiscordCommandDq', () => discordCommandDq);

  ipcMain.removeHandler('setDiscordCommandDq');
  ipcMain.handle(
    'setDiscordCommandDq',
    (event: IpcMainInvokeEvent, newDiscordCommandDq: boolean) => {
      store.set('discordCommandDq', newDiscordCommandDq);
      discordCommandDq = newDiscordCommandDq;
    },
  );

  // for dev only
  ipcMain.removeHandler('registerSlashCommands');
  ipcMain.handle('registerSlashCommands', () => registerSlashCommands());

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

  ipcMain.removeHandler('getTournaments');
  ipcMain.handle('getTournaments', async () =>
    startggApiKey ? getTournaments(startggApiKey) : [],
  );

  ipcMain.removeHandler('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event: IpcMainInvokeEvent, slug: string) => {
      tournament = await getTournament(slug);
      return tournament;
    },
  );

  let timeoutId: NodeJS.Timeout | undefined;
  const setGetEventSetsTimeout = () => {
    timeoutId = setTimeout(async () => {
      updateEntrantIdToSet(
        await getEventSets(startggEvent, setIdToCompletedAt, startggApiKey),
      );
      setGetEventSetsTimeout();
    }, 30000);
  };
  const linkedParticipants: LinkedParticipant[] = [];
  ipcMain.removeHandler('setEvent');
  ipcMain.handle(
    'setEvent',
    async (event: IpcMainInvokeEvent, newEvent: StartggEvent) => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg token');
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const entrantsPromise = getEventEntrants(newEvent.id, startggApiKey);
      const setsPromise = getEventSets(
        newEvent,
        setIdToCompletedAt,
        startggApiKey,
      );

      // await both, we don't want to proceed if either throws
      const entrants = await entrantsPromise;
      const newSets = await setsPromise;

      // all clear to clear maps and update
      discordIdToEntrantId.clear();
      discordIdToGamerTag.clear();
      entrantIdToDiscordIds.clear();
      linkedParticipants.length = 0;
      entrants.forEach((entrant) => {
        entrantIdToDiscordIds.set(
          entrant.id,
          entrant.participants
            .filter((participant) => participant.discord)
            .map((participant) => participant.discord!.id),
        );
        entrant.participants.forEach((participant) => {
          linkedParticipants.push({
            id: participant.id,
            gamerTag: participant.gamerTag,
            username: participant.discord?.username || '',
          });
          if (participant.discord) {
            discordIdToEntrantId.set(participant.discord.id, entrant.id);
            discordIdToGamerTag.set(
              participant.discord.id,
              participant.gamerTag,
            );
          }
        });
      });
      updateEntrantIdToSet(newSets);

      startggEvent = newEvent;
      setGetEventSetsTimeout();
      if (client === null) {
        maybeStartDiscordClient();
      }
      return linkedParticipants.sort((lpA, lpB) =>
        lpA.gamerTag.localeCompare(lpB.gamerTag),
      );
    },
  );

  ipcMain.removeHandler('refreshSets');
  ipcMain.handle('refreshSets', async () => {
    if (!startggApiKey) {
      throw new Error('Please set start.gg token');
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    updateEntrantIdToSet(
      await getEventSets(startggEvent, setIdToCompletedAt, startggApiKey),
    );
    setGetEventSetsTimeout();
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
        throw new Error('Please set start.gg token');
      }

      await reportSet(
        { setId, winnerId, isDQ },
        setIdToCompletedAt,
        startggApiKey,
      );
    },
  );

  ipcMain.removeHandler('resetSet');
  ipcMain.handle(
    'resetSet',
    async (event: IpcMainInvokeEvent, setId: number) => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg token');
      }

      await resetSet(setId, startggApiKey);
    },
  );

  ipcMain.removeHandler('swapWinner');
  ipcMain.handle(
    'swapWinner',
    async (event: IpcMainInvokeEvent, set: StartggSet) => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg token');
      }
      if (!set.winnerId) {
        throw new Error('Set does not have a winner');
      }

      await swapWinner(
        set.id,
        set.winnerId === set.entrant1Id ? set.entrant2Id : set.entrant1Id,
        set.isDQ,
        setIdToCompletedAt,
        startggApiKey,
      );
    },
  );

  ipcMain.removeHandler('getStartingState');
  ipcMain.handle(
    'getStartingState',
    (): StartingState => ({
      discordStatus,
      eventName: startggEvent.name,
      linkedParticipants,
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
