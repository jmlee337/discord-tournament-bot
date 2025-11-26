import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChannelType,
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
  ConnectCode,
  Discord,
  DiscordChannel,
  DiscordConfig,
  DiscordStatus,
  DiscordUsername,
  ParticipantConnections,
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
  getNotCheckedInParticipantIds,
  getTournament,
  getTournaments,
  initStartgg,
  reportSet,
  reportSets,
  resetSet,
  swapWinner,
} from './startgg';
import {
  connect,
  getBroadcasts,
  getRemoteState,
  getSpectating,
  initSpectate,
  refreshBroadcasts,
  setConnectCodes,
  setEntrantIdToPendingSets,
  startSpectating,
} from './spectate';

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
  initSpectate(mainWindow);
  const store = new Store<{
    discordConfig: DiscordConfig;
    discordCommandDq: boolean;
    discordRegisteredVersion: string;
    remotePort: number;
    startggApiKey: string;
  }>();
  let discordConfig = store.get('discordConfig', {
    applicationId: '',
    token: '',
  });
  let discordCommandDq = store.get('discordCommandDq', true);
  let discordRegisteredVersion = store.get('discordRegisteredVersion', '');
  let remotePort = store.get('remotePort', 49809);
  let startggApiKey = store.get('startggApiKey', '');

  /**
   * Needed for both Discord and start.gg
   */
  const connectCodes: ConnectCode[] = [];
  const discordIdToEntrantId = new Map<string, number>();
  const discordIdToGamerTag = new Map<string, string>();
  const entrantIdToDiscordIds = new Map<number, string[]>();
  const entrantIdToCompletedSets = new Map<number, StartggSet[]>();
  const entrantIdToPendingSets = new Map<number, StartggSet[]>();
  const participantIdToDiscord = new Map<number, Discord>();
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
  const updateEntrantIdToSet = (newSets: Sets) => {
    entrantIdToCompletedSets.clear();
    newSets.completed.forEach((completedPhase) => {
      completedPhase.phaseGroups.forEach((completedPhaseGroup) => {
        completedPhaseGroup.sets.forEach((completedSet) => {
          const entrant1Sets =
            entrantIdToCompletedSets.get(completedSet.entrant1Id) || [];
          entrant1Sets.push(completedSet);
          entrantIdToCompletedSets.set(completedSet.entrant1Id, entrant1Sets);
          const entrant2Sets =
            entrantIdToCompletedSets.get(completedSet.entrant2Id) || [];
          entrant2Sets.push(completedSet);
          entrantIdToCompletedSets.set(completedSet.entrant2Id, entrant2Sets);
        });
      });
    });

    entrantIdToPendingSets.clear();
    newSets.pending.forEach((pendingPhase) => {
      pendingPhase.phaseGroups.forEach((pendingPhaseGroup) => {
        pendingPhaseGroup.sets.forEach((pendingSet) => {
          const entrant1Sets =
            entrantIdToPendingSets.get(pendingSet.entrant1Id) || [];
          entrant1Sets.push(pendingSet);
          entrantIdToPendingSets.set(pendingSet.entrant1Id, entrant1Sets);
          const entrant2Sets =
            entrantIdToPendingSets.get(pendingSet.entrant2Id) || [];
          entrant2Sets.push(pendingSet);
          entrantIdToPendingSets.set(pendingSet.entrant2Id, entrant2Sets);
        });
      });
    });
    setEntrantIdToPendingSets(entrantIdToPendingSets);
    mainWindow.webContents.send('sets', newSets);
    sets = newSets;
  };
  const findResettableSet = (entrantId: number) => {
    const completedSet = entrantIdToCompletedSets
      .get(entrantId)
      ?.sort(
        (setA, setB) => (setB.completedAt ?? 0) - (setA.completedAt ?? 0),
      )[0];
    const startedSet = entrantIdToPendingSets
      .get(entrantId)
      ?.filter((set) => set.startedAt)
      .sort((setA, setB) => setB.startedAt! - setA.startedAt!)[0];
    // prioritize startedSet for RR. If one set was completed more
    // recently than another pending set was started, it's likely the
    // completed set was a DQ or something along those lines and the
    // pending set is what the user wants. In other bracket types this
    // scenario cannot occur.
    if (startedSet) {
      return startedSet;
    }
    if (completedSet) {
      return completedSet;
    }
    return undefined;
  };

  let timeoutId: NodeJS.Timeout | undefined;
  const setGetEventSetsTimeout = () => {
    timeoutId = setTimeout(async () => {
      updateEntrantIdToSet(await getEventSets(startggEvent));
      setGetEventSetsTimeout();
    }, 30000);
  };
  const resetGetEventSetsTimeout = () => {
    clearTimeout(timeoutId);
    setGetEventSetsTimeout();
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
      new SlashCommandBuilder()
        .setName('resetset')
        .setDescription('reset your most recent set.')
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
  const getEntrantId = (
    interaction: ChatInputCommandInteraction<CacheType>,
  ): number | undefined => {
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
    }
    return entrantId;
  };
  const getEntrantIdAndSets = (
    interaction: ChatInputCommandInteraction<CacheType>,
  ): { entrantId?: number; entrantSets?: StartggSet[] } => {
    const entrantId = getEntrantId(interaction);
    if (!entrantId) {
      return {};
    }
    return {
      entrantId,
      entrantSets: entrantIdToPendingSets
        .get(entrantId)
        ?.sort((setA, setB) =>
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
          startggApiKey,
        );
        updateEntrantIdToSet(await getEventSets(startggEvent));
        resetGetEventSetsTimeout();
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
                    .setTitle('DQ cancelled'),
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
                startggApiKey,
              );
              updateEntrantIdToSet(await getEventSets(startggEvent));
              resetGetEventSetsTimeout();
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
        } else if (interaction.commandName === 'resetset') {
          const entrantId = getEntrantId(interaction);
          if (!entrantId) {
            return;
          }

          const set = findResettableSet(entrantId);
          let oppSet: StartggSet | undefined;
          if (set) {
            const oppEntrantId =
              set.entrant1Id === entrantId ? set.entrant2Id : set.entrant1Id;
            oppSet = findResettableSet(oppEntrantId);
          }
          if (!set || !oppSet || oppSet !== set) {
            interaction.reply({
              content: 'You do not have any resettable sets.',
              ephemeral: true,
            });
            return;
          }

          const initialConfirmValidDiscordIds = new Set<string>();
          entrantIdToDiscordIds.get(entrantId)?.forEach((discordId) => {
            initialConfirmValidDiscordIds.add(discordId);
          });

          const embed = new EmbedBuilder()
            .setColor(STARTGG_RED)
            .setTitle(`${set.entrant1Name} vs ${set.entrant2Name}`)
            .setDescription(set.fullRoundText)
            .setFooter({ text: 'Are you sure you want to reset?' });
          const response1 = await interaction.reply({
            embeds: [embed],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('cancel')
                  .setLabel('Cancel')
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId('reset')
                  .setLabel('Reset')
                  .setStyle(ButtonStyle.Danger),
              ),
            ],
          });

          let confirmation: ButtonInteraction<CacheType>;
          try {
            confirmation =
              await response1.awaitMessageComponent<ComponentType.Button>({
                time: CONFIRMATION_TIMEOUT_MS,
                filter: (confI) => confI.user.id === interaction.user.id,
              });
            if (confirmation.customId === 'cancel') {
              confirmation.update({
                components: [],
                embeds: [
                  new EmbedBuilder()
                    .setColor(STARTGG_BLACK)
                    .setTitle('Reset cancelled'),
                ],
              });
              return;
            }
          } catch {
            timeOutInteraction(embed, interaction);
            return;
          }

          const bilateralConfirmDiscordIds = new Set<string>();
          const oppEntrantId =
            entrantId === set.entrant1Id ? set.entrant2Id : set.entrant1Id;
          entrantIdToDiscordIds.get(oppEntrantId)?.forEach((discordId) => {
            bilateralConfirmDiscordIds.add(discordId);
          });
          if (bilateralConfirmDiscordIds.size > 0) {
            const oppTags = Array.from(bilateralConfirmDiscordIds.values())
              .map((discordId) => `<@${discordId}>`)
              .join(' or ');
            const response2 = await confirmation.update({
              content: `${oppTags}, please confirm within ${
                CONFIRMATION_TIMEOUT_MS / 1000
              } seconds`,
            });

            try {
              confirmation =
                await response2.awaitMessageComponent<ComponentType.Button>({
                  time: CONFIRMATION_TIMEOUT_MS,
                  filter: (confI) =>
                    bilateralConfirmDiscordIds.has(confI.user.id),
                });
              if (confirmation.customId === 'cancel') {
                confirmation.update({
                  components: [],
                  embeds: [
                    new EmbedBuilder()
                      .setColor(STARTGG_BLACK)
                      .setTitle('Reset cancelled'),
                  ],
                });
                return;
              }
            } catch {
              timeOutInteraction(embed, interaction);
              return;
            }
          }

          confirmation.update({
            content: '',
            components: [],
            embeds: [
              embed.setColor(STARTGG_GREY).setFooter({
                text: 'Reporting to start.gg...',
              }),
            ],
          });
          try {
            await resetSet(set.id, startggApiKey);
            updateEntrantIdToSet(await getEventSets(startggEvent));
            resetGetEventSetsTimeout();
            confirmation.editReply({
              embeds: [
                embed.setColor(STARTGG_GREEN).setFooter({
                  text: `Set reset`,
                }),
              ],
            });
          } catch {
            startggFailConfirmation(embed, confirmation);
          }
        } else {
          interaction.reply({
            content: interaction.commandName,
            ephemeral: true,
          });
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
   * remote
   */
  ipcMain.removeHandler('getRemotePort');
  ipcMain.handle('getRemotePort', () => remotePort);

  ipcMain.removeHandler('setRemotePort');
  ipcMain.handle(
    'setRemotePort',
    (event: IpcMainInvokeEvent, newRemotePort: number) => {
      store.set('remotePort', newRemotePort);
      remotePort = newRemotePort;
    },
  );

  ipcMain.removeHandler('getStartingRemote');
  ipcMain.handle('getStartingRemote', () => ({
    broadcasts: getBroadcasts(),
    spectating: getSpectating(),
  }));

  ipcMain.removeHandler('connectRemote');
  ipcMain.handle('connectRemote', () => {
    connect(remotePort);
  });

  ipcMain.removeHandler('refreshBroadcasts');
  ipcMain.handle('refreshBroadcasts', () => {
    refreshBroadcasts();
  });

  ipcMain.removeHandler('startSpectating');
  ipcMain.handle(
    'startSpectating',
    (event: IpcMainInvokeEvent, broadcastId: string, dolphinId: string) => {
      startSpectating(broadcastId, dolphinId);
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

  const discordUsernames: DiscordUsername[] = [];
  ipcMain.removeHandler('setEvent');
  ipcMain.handle(
    'setEvent',
    async (
      event: IpcMainInvokeEvent,
      newEvent: StartggEvent,
    ): Promise<ParticipantConnections> => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg token');
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const entrantsPromise = getEventEntrants(newEvent.id, startggApiKey);
      const setsPromise = getEventSets(newEvent);

      // await both, we don't want to proceed if either throws
      const entrants = await entrantsPromise;
      const newSets = await setsPromise;

      // all clear to clear maps and update
      connectCodes.length = 0;
      discordIdToEntrantId.clear();
      discordIdToGamerTag.clear();
      entrantIdToDiscordIds.clear();
      participantIdToDiscord.clear();
      discordUsernames.length = 0;
      entrants.forEach((entrant) => {
        entrantIdToDiscordIds.set(
          entrant.id,
          entrant.participants
            .filter((participant) => participant.discord)
            .map((participant) => participant.discord!.id),
        );
        entrant.participants.forEach((participant) => {
          if (participant.connectCode) {
            connectCodes.push({
              connectCode: participant.connectCode,
              entrantId: entrant.id,
              gamerTag: participant.gamerTag,
            });
          }
          if (participant.discord) {
            discordIdToEntrantId.set(participant.discord.id, entrant.id);
            discordIdToGamerTag.set(
              participant.discord.id,
              participant.gamerTag,
            );
            participantIdToDiscord.set(participant.id, {
              id: participant.id,
              discordId: participant.discord.id,
              gamerTag: participant.gamerTag,
              username: participant.discord.username,
            });
          }
          discordUsernames.push({
            id: participant.id,
            gamerTag: participant.gamerTag,
            username: participant.discord?.username || '',
          });
        });
      });
      updateEntrantIdToSet(newSets);

      startggEvent = newEvent;
      resetGetEventSetsTimeout();
      if (client === null) {
        maybeStartDiscordClient();
      } else if (discordIdToEntrantId.size === 0) {
        await client.destroy();
        client = null;
        updateDiscordStatus(DiscordStatus.NONE);
      }
      connectCodes.sort((a, b) => a.gamerTag.localeCompare(b.gamerTag));
      setConnectCodes(connectCodes);
      return {
        connectCodes,
        discordUsernames: discordUsernames.sort((a, b) =>
          a.gamerTag.localeCompare(b.gamerTag),
        ),
      };
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
    updateEntrantIdToSet(await getEventSets(startggEvent));
    resetGetEventSetsTimeout();
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

      await reportSet({ setId, winnerId, isDQ }, startggApiKey);
      updateEntrantIdToSet(await getEventSets(startggEvent));
      resetGetEventSetsTimeout();
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
      updateEntrantIdToSet(await getEventSets(startggEvent));
      resetGetEventSetsTimeout();
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
        startggApiKey,
      );
      updateEntrantIdToSet(await getEventSets(startggEvent));
      resetGetEventSetsTimeout();
    },
  );

  ipcMain.removeHandler('getDiscordCheckinPings');
  ipcMain.handle('getDiscordCheckinPings', async () => {
    if (!client) {
      throw new Error('Discord bot not running');
    }

    const channels: DiscordChannel[] = client.channels
      .valueOf()
      .filter(
        (channel) =>
          channel.type === ChannelType.GuildText && channel.isSendable(),
      )
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
      }));

    updateEntrantIdToSet(await getEventSets(startggEvent));
    const pendingSets: StartggSet[] = [];
    sets.pending.forEach((phase) => {
      phase.phaseGroups.forEach((group) => {
        pendingSets.push(
          ...group.sets.filter((set) => set.state === 1 || set.state === 6),
        );
      });
    });
    const participantIds = new Set<number>();
    await Promise.all(
      pendingSets.map(async (set) => {
        (await getNotCheckedInParticipantIds(set.id)).forEach(
          (participantId) => {
            participantIds.add(participantId);
          },
        );
      }),
    );
    const discords: Discord[] = [];
    Array.from(participantIds).forEach((participantId) => {
      const discord = participantIdToDiscord.get(participantId);
      if (discord) {
        discords.push(discord);
      }
    });
    return {
      channels,
      discords: discords.sort((a, b) => a.gamerTag.localeCompare(b.gamerTag)),
    };
  });

  ipcMain.removeHandler('pingDiscords');
  ipcMain.handle(
    'pingDiscords',
    async (
      event: IpcMainInvokeEvent,
      channelId: string,
      discordIds: string[],
    ) => {
      if (!client) {
        throw new Error('Discord bot not running');
      }
      if (discordIds.length === 0) {
        throw new Error('No discordIds provided');
      }

      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        throw new Error(`No channel found for id: ${channelId}`);
      }
      if (channel.type !== ChannelType.GuildText || !channel.isSendable()) {
        throw new Error(
          `Cannot send text messages in channel with id: ${channelId}`,
        );
      }

      const tags = discordIds.map((discordId) => `<@${discordId}>`).join(' ');
      const msg =
        discordIds.length === 1 ? 'your set is up!' : 'your sets are up!';
      channel.send(`${tags} ${msg}`);
    },
  );

  ipcMain.removeHandler('getStartingState');
  ipcMain.handle(
    'getStartingState',
    (): StartingState => ({
      connectCodes,
      discordStatus,
      discordUsernames,
      eventName: startggEvent.name,
      remoteState: getRemoteState(),
      tournament,
    }),
  );

  ipcMain.removeHandler('getStartingSets');
  ipcMain.handle('getStartingSets', () => sets);

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
