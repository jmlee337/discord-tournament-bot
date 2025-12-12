import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  Collection,
  ComponentType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  GuildMember,
  InteractionResponse,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextChannel,
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
import { access, constants } from 'fs/promises';
import {
  ConnectCode,
  DiscordChannel,
  DiscordConfig,
  DiscordServer,
  DiscordStatus,
  DiscordToPing,
  DiscordUsername,
  DolphinId,
  GetTournamentRet,
  IsDiscordServerMember,
  OverlayId,
  ParticipantConnections,
  ParticipantSet,
  ReportStartggSet,
  Sets,
  StartggParticipant,
  StartggSet,
  StartggTournament,
  StartingState,
} from '../common/types';
import {
  getNotCheckedInParticipantIds,
  getTournamentParticipants,
  getTournaments,
  getTournamentSets,
  initStartgg,
  reportSet,
  reportSets,
  resetSet,
  swapWinner,
} from './startgg';
import {
  connect,
  getBroadcasts,
  getDolphinIdToOverlayId,
  getRemoteState,
  getSpectating,
  initSpectate,
  refreshBroadcasts,
  setConnectCodes,
  setDolphinOverlayId,
  setParticipantIdToPendingSets,
  setSimpleTextPathA,
  setSimpleTextPathB,
  setSimpleTextPathC,
  setSimpleTextPathD,
  setUpdateAutomatically,
  startSpectating,
  stopSpectating,
} from './spectate';
import {
  deleteMstOverlay,
  forEachMstOverlay,
  getMstOverlay,
  getMstOverlaysLength,
  getScoreboardInfoJSONPath,
  initMST,
  MSTOverlay,
  setEnableSggSponsors,
  setEnableSkinColor,
  setMstOverlay,
  setRequestGetTournamentSets,
} from './mst';
import { MSTManualUpdateScoreboardInfo } from '../common/mst';
import { REFRESH_CADENCE_MS } from '../common/constants';

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

function getOpponentName(set: ParticipantSet) {
  return set.isParticipantEntrant1 ? set.entrant2Name : set.entrant1Name;
}

function updateIsDiscordServerMember(
  discordUsernames: DiscordUsername[],
  members: Collection<string, GuildMember>,
) {
  discordUsernames.forEach((discordUsername) => {
    discordUsername.isDiscordServerMember = members.has(
      discordUsername.discordId,
    )
      ? IsDiscordServerMember.YES
      : IsDiscordServerMember.NO;
  });
}

export default function setupIPCs(mainWindow: BrowserWindow) {
  initMST(mainWindow);
  initStartgg();
  initSpectate(mainWindow);
  const store = new Store<{
    discordConfig: DiscordConfig;
    discordCommandDq: boolean;
    discordCommandReport: boolean;
    discordCommandReset: boolean;
    discordRegisteredVersion: string;
    enableSkinColor: boolean;
    enableSggRound1: boolean;
    enableSggRound2: boolean;
    enableSggRound3: boolean;
    enableSggRound4: boolean;
    enableSggSponsors: boolean;
    numMSTs: 0 | OverlayId;
    remotePort: number;
    resourcesPath1: string;
    resourcesPath2: string;
    resourcesPath3: string;
    resourcesPath4: string;
    simpleTextPathA: string;
    simpleTextPathB: string;
    simpleTextPathC: string;
    simpleTextPathD: string;
    startggApiKey: string;
    updateAutomatically: boolean;
  }>();
  let discordConfig = store.get('discordConfig', {
    applicationId: '',
    token: '',
  });
  let discordCommandDq = store.get('discordCommandDq', true);
  let discordCommandReport = store.get('discordCommandReport', true);
  let discordCommandReset = store.get('discordCommandReset', true);
  let discordRegisteredVersion = store.get('discordRegisteredVersion', '');
  let enableSkinColor = store.get('enableSkinColor', true);
  let enableSggRound1 = store.get('enableSggRound1', true);
  let enableSggRound2 = store.get('enableSggRound2', true);
  let enableSggRound3 = store.get('enableSggRound3', true);
  let enableSggRound4 = store.get('enableSggRound4', true);
  let enableSggSponsors = store.get('enableSggSponsors', true);
  const initNumMSTs = store.get('numMSTs', 0);
  let remotePort = store.get('remotePort', 49809);
  let resourcesPath1 = store.get('resourcesPath1', '');
  let resourcesPath2 = store.get('resourcesPath2', '');
  let resourcesPath3 = store.get('resourcesPath3', '');
  let resourcesPath4 = store.get('resourcesPath4', '');
  let simpleTextPathA = store.get('simpleTextPathA', '');
  let simpleTextPathB = store.get('simpleTextPathB', '');
  let simpleTextPathC = store.get('simpleTextPathC', '');
  let simpleTextPathD = store.get('simpleTextPathD', '');
  let startggApiKey = store.get('startggApiKey', '');
  let updateAutomatically = store.get('updateAutomatically', true);

  // spectate
  setSimpleTextPathA(simpleTextPathA);
  setSimpleTextPathB(simpleTextPathB);
  setSimpleTextPathC(simpleTextPathC);
  setSimpleTextPathD(simpleTextPathD);
  setUpdateAutomatically(updateAutomatically);

  // mst
  setEnableSkinColor(enableSkinColor);
  setEnableSggSponsors(enableSggSponsors);
  if (initNumMSTs > 0) {
    setMstOverlay(1, new MSTOverlay(1, enableSggRound1, resourcesPath1));
  }
  if (initNumMSTs > 1) {
    setMstOverlay(2, new MSTOverlay(2, enableSggRound2, resourcesPath2));
  }
  if (initNumMSTs > 2) {
    setMstOverlay(3, new MSTOverlay(3, enableSggRound3, resourcesPath3));
  }
  if (initNumMSTs > 3) {
    setMstOverlay(4, new MSTOverlay(4, enableSggRound4, resourcesPath4));
  }

  /**
   * Needed for both Discord and start.gg
   */
  const connectCodes: ConnectCode[] = [];
  let client: Client | null = null;
  const discordIdToParticipant = new Map<
    string,
    { id: number; gamerTag: string }
  >();
  let discordServerId = '';
  const discordUsernames: DiscordUsername[] = [];
  const participantIdToCompletedSets = new Map<number, ParticipantSet[]>();
  const participantIdToPendingSets = new Map<number, ParticipantSet[]>();
  const participantIdToDiscordToPing = new Map<number, DiscordToPing>();
  let sets: Sets = {
    pending: [],
    completed: [],
  };
  let startggTournament: StartggTournament = {
    name: '',
    slug: '',
  };
  const sendParticipants = () => {
    const newParticipantConnections: ParticipantConnections = {
      connectCodes,
      discordUsernames,
    };
    mainWindow.webContents.send('participants', newParticipantConnections);
  };
  const updateParticipantIdToSet = (getTournamentRet: GetTournamentRet) => {
    participantIdToCompletedSets.clear();
    getTournamentRet.sets.completed.forEach((completedEvent) => {
      completedEvent.phases.forEach((completedPhase) => {
        completedPhase.phaseGroups.forEach((completedPhaseGroup) => {
          completedPhaseGroup.sets.forEach((completedSet) => {
            const entrant1ParticipantIds = getTournamentRet.idToEntrant.get(
              completedSet.entrant1Id,
            )?.participantsIds;
            if (
              !entrant1ParticipantIds ||
              entrant1ParticipantIds.length === 0
            ) {
              throw new Error(
                `set ${completedSet.id} can't find participant(s) for entrant: ${completedSet.entrant1Id}`,
              );
            }
            const entrant2ParticipantIds = getTournamentRet.idToEntrant.get(
              completedSet.entrant2Id,
            )?.participantsIds;
            if (
              !entrant2ParticipantIds ||
              entrant2ParticipantIds.length === 0
            ) {
              throw new Error(
                `set ${completedSet.id} can't find participant(s) for entrant: ${completedSet.entrant2Id}`,
              );
            }
            entrant1ParticipantIds.forEach((participantId) => {
              const participantSets =
                participantIdToCompletedSets.get(participantId) ?? [];
              participantSets.push({
                ...completedSet,
                isParticipantEntrant1: true,
                opponentParticipantIds: entrant2ParticipantIds,
                ownParticipantIds: entrant1ParticipantIds,
              });
              participantIdToCompletedSets.set(participantId, participantSets);
            });
            entrant2ParticipantIds.forEach((participantId) => {
              const participantSets =
                participantIdToCompletedSets.get(participantId) ?? [];
              participantSets.push({
                ...completedSet,
                isParticipantEntrant1: false,
                opponentParticipantIds: entrant1ParticipantIds,
                ownParticipantIds: entrant2ParticipantIds,
              });
              participantIdToCompletedSets.set(participantId, participantSets);
            });
          });
        });
      });
    });

    participantIdToPendingSets.clear();
    getTournamentRet.sets.pending.forEach((pendingEvent) => {
      pendingEvent.phases.forEach((pendingPhase) => {
        pendingPhase.phaseGroups.forEach((pendingPhaseGroup) => {
          pendingPhaseGroup.sets.forEach((pendingSet) => {
            const entrant1ParticipantIds = getTournamentRet.idToEntrant.get(
              pendingSet.entrant1Id,
            )?.participantsIds;
            if (
              !entrant1ParticipantIds ||
              entrant1ParticipantIds.length === 0
            ) {
              throw new Error(
                `set ${pendingSet.id} can't find participant(s) for entrant: ${pendingSet.entrant1Id}`,
              );
            }
            const entrant2ParticipantIds = getTournamentRet.idToEntrant.get(
              pendingSet.entrant2Id,
            )?.participantsIds;
            if (
              !entrant2ParticipantIds ||
              entrant2ParticipantIds.length === 0
            ) {
              throw new Error(
                `set ${pendingSet.id} can't find participant(s) for entrant: ${pendingSet.entrant2Id}`,
              );
            }
            entrant1ParticipantIds.forEach((participantId) => {
              const participantSets =
                participantIdToPendingSets.get(participantId) ?? [];
              participantSets.push({
                ...pendingSet,
                isParticipantEntrant1: true,
                opponentParticipantIds: entrant2ParticipantIds,
                ownParticipantIds: entrant1ParticipantIds,
              });
              participantIdToPendingSets.set(participantId, participantSets);
            });
            entrant2ParticipantIds.forEach((participantId) => {
              const participantSets =
                participantIdToPendingSets.get(participantId) ?? [];
              participantSets.push({
                ...pendingSet,
                isParticipantEntrant1: false,
                opponentParticipantIds: entrant1ParticipantIds,
                ownParticipantIds: entrant2ParticipantIds,
              });
              participantIdToPendingSets.set(participantId, participantSets);
            });
          });
        });
      });
    });
    setParticipantIdToPendingSets(participantIdToPendingSets);
    if (updateAutomatically) {
      forEachMstOverlay((mstOverlay) => {
        mstOverlay.pendingSetsUpdate(participantIdToPendingSets).catch(() => {
          // just catch
        });
      });
    }
    mainWindow.webContents.send('sets', getTournamentRet.sets);
    sets = getTournamentRet.sets;
  };
  const updateParticipants = (participants: StartggParticipant[]) => {
    // all clear to clear maps and update
    connectCodes.length = 0;
    discordIdToParticipant.clear();
    participantIdToDiscordToPing.clear();
    discordUsernames.length = 0;

    participants.forEach((participant) => {
      if (participant.connectCode) {
        connectCodes.push({
          connectCode: participant.connectCode,
          gamerTag: participant.gamerTag,
          participantId: participant.id,
          prefix: participant.prefix,
        });
      }
      if (participant.discord) {
        discordIdToParticipant.set(participant.discord.id, {
          id: participant.id,
          gamerTag: participant.gamerTag,
        });
        participantIdToDiscordToPing.set(participant.id, {
          discordId: participant.discord.id,
          gamerTag: participant.gamerTag,
          username: participant.discord.username,
        });
      }
      discordUsernames.push({
        discordId: participant.discord?.id ?? '',
        participantId: participant.id,
        gamerTag: participant.gamerTag,
        username: participant.discord?.username ?? '',
        isDiscordServerMember: IsDiscordServerMember.UNKNOWN,
      });
    });
    connectCodes.sort((a, b) => a.gamerTag.localeCompare(b.gamerTag));
    setConnectCodes(connectCodes);
    discordUsernames.sort((a, b) => a.gamerTag.localeCompare(b.gamerTag));
  };
  const findResettableSet = (participantId: number) => {
    const completedSet = participantIdToCompletedSets
      .get(participantId)
      ?.sort(
        (setA, setB) => (setB.completedAt ?? 0) - (setA.completedAt ?? 0),
      )[0];
    const startedSet = participantIdToPendingSets
      .get(participantId)
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
  const setGetTournamentSetsTimeout = () => {
    timeoutId = setTimeout(async () => {
      try {
        mainWindow.webContents.send('gettingSets', true);
        const newParticipantsPromise = getTournamentParticipants(
          startggTournament.slug,
          startggApiKey,
        );
        const newSetsPromise = getTournamentSets(startggTournament.slug);
        const [newParticipants, newSets] = await Promise.all([
          newParticipantsPromise,
          newSetsPromise,
        ]);

        updateParticipants(newParticipants);
        updateParticipantIdToSet(newSets);

        const guild = client?.guilds.valueOf().get(discordServerId);
        if (guild) {
          updateIsDiscordServerMember(
            discordUsernames,
            guild.members.valueOf(),
          );
        }
        sendParticipants();
      } finally {
        mainWindow.webContents.send('gettingSets', false);
      }
      setGetTournamentSetsTimeout();
    }, REFRESH_CADENCE_MS);
  };
  const preemptGetTournamentSets = async () => {
    clearTimeout(timeoutId);
    try {
      mainWindow.webContents.send('gettingSets', true);
      const newParticipantsPromise = getTournamentParticipants(
        startggTournament.slug,
        startggApiKey,
      );
      const newSetsPromise = getTournamentSets(startggTournament.slug);
      const [newParticipants, newSets] = await Promise.all([
        newParticipantsPromise,
        newSetsPromise,
      ]);

      updateParticipants(newParticipants);
      updateParticipantIdToSet(newSets);

      const guild = client?.guilds.valueOf().get(discordServerId);
      if (guild) {
        updateIsDiscordServerMember(discordUsernames, guild.members.valueOf());
      }
      sendParticipants();
    } finally {
      mainWindow.webContents.send('gettingSets', false);
    }
    setGetTournamentSetsTimeout();
  };
  setRequestGetTournamentSets(() => {
    setImmediate(() => {
      preemptGetTournamentSets();
    });
  });

  /**
   * Discord
   */
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
  const getGuilds = async () => {
    if (!client) {
      return [];
    }

    const guilds = client.guilds.valueOf().filter((guild) => {
      const userId = client?.user?.id;
      if (!userId) {
        return false;
      }

      const guildMember = guild.members.valueOf().get(userId);
      if (!guildMember) {
        return false;
      }

      return guild.channels
        .valueOf()
        .some(
          (channel) =>
            channel.type === ChannelType.GuildText &&
            channel.viewable &&
            channel.isSendable() &&
            channel
              .permissionsFor(guildMember)
              .has(PermissionsBitField.Flags.SendMessages),
        );
    });
    if (guilds.size === 1) {
      const guild = guilds.first()!;
      discordServerId = guild.id;
      mainWindow.webContents.send('discordServerId', discordServerId);
      await guild.members.fetch();
      updateIsDiscordServerMember(discordUsernames, guild.members.valueOf());
      sendParticipants();
    } else if (
      discordServerId &&
      !guilds.some((guild) => guild.id === discordServerId)
    ) {
      discordServerId = '';
      mainWindow.webContents.send('discordServerId', discordServerId);
      discordUsernames.forEach((discordUsername) => {
        discordUsername.isDiscordServerMember = IsDiscordServerMember.UNKNOWN;
      });
      sendParticipants();
    }

    return guilds.map(
      (guild): DiscordServer => ({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL() ?? '',
      }),
    );
  };
  const getParticipantId = (
    interaction: ChatInputCommandInteraction<CacheType>,
  ) => {
    const participantId = discordIdToParticipant.get(interaction.user.id)?.id;
    if (!participantId) {
      interaction.reply({
        content:
          "Sorry, I can't figure out who you are on start.gg. Please make sure you're registered for\n" +
          `\`${startggTournament.name}\`\n` +
          `and that your Discord account \`${interaction.user.tag}\`\n` +
          'is connected here: https://www.start.gg/admin/profile/connected-accounts',
        ephemeral: true,
      });
    }
    return participantId;
  };
  const getParticipantIdAndSets = (
    interaction: ChatInputCommandInteraction<CacheType>,
  ) => {
    const participantId = getParticipantId(interaction);
    if (!participantId) {
      return {};
    }
    return {
      participantId,
      participantSets: participantIdToPendingSets
        .get(participantId)
        ?.sort((setA, setB) =>
          getOpponentName(setA).localeCompare(getOpponentName(setB)),
        ),
    };
  };
  const awaitReportResponse = async (
    embed: EmbedBuilder,
    interaction:
      | ChatInputCommandInteraction<CacheType>
      | StringSelectMenuInteraction<CacheType>,
    response: InteractionResponse<boolean>,
    set: ParticipantSet,
  ) => {
    const validDiscordIds = new Set<string>();
    const forEachPredicate = (participantId: number) => {
      const discord = participantIdToDiscordToPing.get(participantId);
      if (discord) {
        validDiscordIds.add(discord.discordId);
      }
    };
    set.opponentParticipantIds.forEach(forEachPredicate);
    set.ownParticipantIds.forEach(forEachPredicate);
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
        await preemptGetTournamentSets();
        const inner = winnerId === set.entrant1Id ? '[W - L]' : '[L - W]';
        const { displayName } = confirmation.user;
        const { gamerTag } = discordIdToParticipant.get(confirmation.user.id)!;
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
      discordIdToParticipant.size > 0
    ) {
      if (client) {
        await client.destroy();
      }
      updateDiscordStatus(DiscordStatus.STARTING);
      client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
      });
      client.once(Events.ClientReady, async () => {
        if (discordRegisteredVersion !== getExpectedRegisteredVersion()) {
          await registerSlashCommands();
        } else {
          updateDiscordStatus(DiscordStatus.READY);
        }
        const discordServers = await getGuilds();
        mainWindow.webContents.send('discordServers', discordServers);
      });
      client.on(Events.InteractionCreate, async (interaction) => {
        if (
          !interaction.isChatInputCommand() ||
          interaction.guildId !== discordServerId
        ) {
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
          const { participantId, participantSets } =
            getParticipantIdAndSets(interaction);
          if (!participantId) {
            return;
          }
          if (!participantSets || participantSets.length === 0) {
            interaction.reply({ content: 'No pending sets', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setColor(STARTGG_RED)
            .setTitle('Are you sure you want to DQ?')
            .setFields(
              participantSets.slice(0, 25).map((participantSet) => ({
                name: participantSet.fullRoundText,
                value: `vs ${getOpponentName(participantSet)}`,
                inline: true,
              })),
            );
          const numNotShown = participantSets.length - 25;
          if (numNotShown > 0) {
            embed.setFooter({
              text: `${numNotShown} sets not shown (${participantSets.length} total)`,
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
                    participantSets.length > 1
                      ? 'Confirm all DQs'
                      : 'Confirm DQ',
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
                participantSets.map(
                  (participantSet): ReportStartggSet => ({
                    setId: participantSet.id,
                    winnerId: participantSet.isParticipantEntrant1
                      ? participantSet.entrant2Id
                      : participantSet.entrant1Id,
                    isDQ: true,
                  }),
                ),
                startggApiKey,
              );
              await preemptGetTournamentSets();
              const entrantName = participantSets[0].isParticipantEntrant1
                ? participantSets[0].entrant1Name
                : participantSets[0].entrant2Name;
              const titleSuffix =
                participantSets.length > 1
                  ? ` from ${participantSets.length} sets`
                  : '';
              const { displayName } = confirmation.user;
              const { gamerTag } = discordIdToParticipant.get(
                confirmation.user.id,
              )!;
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
          if (!discordCommandReport) {
            interaction.reply({
              content: 'This command is currently disabled',
              ephemeral: true,
            });
            return;
          }
          const { participantId, participantSets } =
            getParticipantIdAndSets(interaction);
          if (!participantId) {
            return;
          }
          if (!participantSets || participantSets.length === 0) {
            interaction.reply({ content: 'No set to report', ephemeral: true });
            return;
          }
          if (participantSets.length === 1) {
            const [set] = participantSets;
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
                      participantSets.map((participantSet) =>
                        new StringSelectMenuOptionBuilder()
                          .setLabel(`vs ${getOpponentName(participantSet)}`)
                          .setValue(participantSet.id.toString(10)),
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
                const participantSet = participantSets.find(
                  (set) => set.id === setId,
                );
                if (participantSet) {
                  const reportSetResponse = await selectSetConfirmation.update({
                    components: [getButtonRow(participantSet)],
                    embeds: [setInitialEmbed(embed, participantSet)],
                  });
                  await awaitReportResponse(
                    embed,
                    selectSetConfirmation,
                    reportSetResponse,
                    participantSet,
                  );
                }
              }
            } catch {
              timeOutInteraction(embed, interaction);
            }
          }
        } else if (interaction.commandName === 'resetset') {
          if (!discordCommandReset) {
            interaction.reply({
              content: 'This command is currently disabled',
              ephemeral: true,
            });
            return;
          }
          const participantId = getParticipantId(interaction);
          if (!participantId) {
            return;
          }

          const set = findResettableSet(participantId);
          let oppSet: StartggSet | undefined;
          if (set) {
            // eslint-disable-next-line no-restricted-syntax
            for (const oppParticipantId of set.opponentParticipantIds) {
              const resettableSet = findResettableSet(oppParticipantId);
              if (resettableSet && resettableSet.id === set.id) {
                oppSet = resettableSet;
                break;
              }
            }
          }
          if (!set || !oppSet) {
            interaction.reply({
              content: 'You do not have any resettable sets.',
              ephemeral: true,
            });
            return;
          }

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

          const initialConfirmDiscordIds = new Set<string>();
          set.ownParticipantIds.forEach((ownParticipantId) => {
            const discord = participantIdToDiscordToPing.get(ownParticipantId);
            if (discord) {
              initialConfirmDiscordIds.add(discord.discordId);
            }
          });
          let confirmation: ButtonInteraction<CacheType>;
          try {
            confirmation =
              await response1.awaitMessageComponent<ComponentType.Button>({
                time: CONFIRMATION_TIMEOUT_MS,
                filter: (confI) => initialConfirmDiscordIds.has(confI.user.id),
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
          set.opponentParticipantIds.forEach((oppParticipantId) => {
            const discord = participantIdToDiscordToPing.get(oppParticipantId);
            if (discord) {
              bilateralConfirmDiscordIds.add(discord.discordId);
            }
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
            await preemptGetTournamentSets();
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

  ipcMain.removeHandler('getDiscordCommandReport');
  ipcMain.handle('getDiscordCommandReport', () => discordCommandReport);

  ipcMain.removeHandler('setDiscordCommandReport');
  ipcMain.handle(
    'setDiscordCommandReport',
    (event: IpcMainInvokeEvent, newDiscordCommandReport: boolean) => {
      store.set('discordCommandReport', newDiscordCommandReport);
      discordCommandReport = newDiscordCommandReport;
    },
  );

  ipcMain.removeHandler('getDiscordCommandReset');
  ipcMain.handle('getDiscordCommandReset', () => discordCommandReset);

  ipcMain.removeHandler('setDiscordCommandReset');
  ipcMain.handle(
    'setDiscordCommandReset',
    (event: IpcMainInvokeEvent, newDiscordCommandReset: boolean) => {
      store.set('discordCommandReset', newDiscordCommandReset);
      discordCommandReset = newDiscordCommandReset;
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

  ipcMain.removeHandler('stopSpectating');
  ipcMain.handle(
    'stopSpectating',
    (event: IpcMainInvokeEvent, broadcastId: string) => {
      stopSpectating(broadcastId);
    },
  );

  ipcMain.removeHandler('getDolphinIdToOverlayId');
  ipcMain.handle('getDolphinIdToOverlayId', () => getDolphinIdToOverlayId());

  ipcMain.removeHandler('setDolphinOverlayId');
  ipcMain.handle(
    'setDolphinOverlayId',
    (event: IpcMainInvokeEvent, dolphinId: DolphinId, overlayId: OverlayId) =>
      setDolphinOverlayId(dolphinId, overlayId),
  );

  ipcMain.removeHandler('getNumMSTs');
  ipcMain.handle('getNumMSTs', () => getMstOverlaysLength());

  ipcMain.removeHandler('setNumMSTs');
  ipcMain.handle(
    'setNumMSTs',
    (event: IpcMainInvokeEvent, newNumMSTs: 0 | OverlayId) => {
      const numMSTs = getMstOverlaysLength();
      if (newNumMSTs === numMSTs) {
        return;
      }

      if (newNumMSTs > numMSTs) {
        if (newNumMSTs > 0) {
          setMstOverlay(1, new MSTOverlay(1, enableSggRound1, resourcesPath1));
        }
        if (newNumMSTs > 1) {
          setMstOverlay(2, new MSTOverlay(2, enableSggRound2, resourcesPath2));
        }
        if (newNumMSTs > 2) {
          setMstOverlay(3, new MSTOverlay(3, enableSggRound3, resourcesPath3));
        }
        if (newNumMSTs > 3) {
          setMstOverlay(4, new MSTOverlay(4, enableSggRound4, resourcesPath4));
        }
      } else {
        if (newNumMSTs < 4) {
          deleteMstOverlay(4);
        }
        if (newNumMSTs < 3) {
          deleteMstOverlay(3);
        }
        if (newNumMSTs < 2) {
          deleteMstOverlay(2);
        }
        if (newNumMSTs < 1) {
          deleteMstOverlay(1);
        }
      }
      store.set('numMSTs', newNumMSTs);
    },
  );

  ipcMain.removeHandler('getResourcesPath1');
  ipcMain.handle('getResourcesPath1', () => resourcesPath1);

  ipcMain.removeHandler('chooseResourcesPath1');
  ipcMain.handle('chooseResourcesPath1', async () => {
    const mstOverlay = getMstOverlay(1);
    if (!mstOverlay) {
      throw new Error('no scorboard 1');
    }

    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return resourcesPath1;
    }
    const [newResourcesPath] = openDialogRes.filePaths;
    if (resourcesPath1 !== newResourcesPath) {
      const scoreboardInfoJSONPath =
        getScoreboardInfoJSONPath(newResourcesPath);
      try {
        // eslint-disable-next-line no-bitwise
        await access(scoreboardInfoJSONPath, constants.R_OK | constants.W_OK);
      } catch (e: any) {
        throw new Error(
          `Invalid Resources folder: cannot access ${scoreboardInfoJSONPath}`,
        );
      }

      store.set('resourcesPath1', newResourcesPath);
      resourcesPath1 = newResourcesPath;
      await mstOverlay.setResourcesPath(resourcesPath1, true);
    }
    return resourcesPath1;
  });

  ipcMain.removeHandler('getResourcesPath2');
  ipcMain.handle('getResourcesPath2', () => resourcesPath2);

  ipcMain.removeHandler('chooseResourcesPath2');
  ipcMain.handle('chooseResourcesPath2', async () => {
    const mstOverlay = getMstOverlay(2);
    if (!mstOverlay) {
      throw new Error('no scorboard 2');
    }

    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return resourcesPath2;
    }
    const [newResourcesPath] = openDialogRes.filePaths;
    if (resourcesPath2 !== newResourcesPath) {
      const scoreboardInfoJSONPath =
        getScoreboardInfoJSONPath(newResourcesPath);
      try {
        // eslint-disable-next-line no-bitwise
        await access(scoreboardInfoJSONPath, constants.R_OK | constants.W_OK);
      } catch (e: any) {
        throw new Error(
          `Invalid Resources folder: cannot access ${scoreboardInfoJSONPath}`,
        );
      }

      store.set('resourcesPath2', newResourcesPath);
      resourcesPath2 = newResourcesPath;
      await mstOverlay.setResourcesPath(resourcesPath2, true);
    }
    return resourcesPath2;
  });

  ipcMain.removeHandler('getResourcesPath3');
  ipcMain.handle('getResourcesPath3', () => resourcesPath3);

  ipcMain.removeHandler('chooseResourcesPath3');
  ipcMain.handle('chooseResourcesPath3', async () => {
    const mstOverlay = getMstOverlay(3);
    if (!mstOverlay) {
      throw new Error('no scorboard 3');
    }

    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return resourcesPath3;
    }
    const [newResourcesPath] = openDialogRes.filePaths;
    if (resourcesPath3 !== newResourcesPath) {
      const scoreboardInfoJSONPath =
        getScoreboardInfoJSONPath(newResourcesPath);
      try {
        // eslint-disable-next-line no-bitwise
        await access(scoreboardInfoJSONPath, constants.R_OK | constants.W_OK);
      } catch (e: any) {
        throw new Error(
          `Invalid Resources folder: cannot access ${scoreboardInfoJSONPath}`,
        );
      }

      store.set('resourcesPath3', newResourcesPath);
      resourcesPath3 = newResourcesPath;
      await mstOverlay.setResourcesPath(resourcesPath3, true);
    }
    return resourcesPath3;
  });

  ipcMain.removeHandler('getResourcesPath4');
  ipcMain.handle('getResourcesPath4', () => resourcesPath4);

  ipcMain.removeHandler('chooseResourcesPath4');
  ipcMain.handle('chooseResourcesPath4', async () => {
    const mstOverlay = getMstOverlay(4);
    if (!mstOverlay) {
      throw new Error('no scorboard 4');
    }

    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return resourcesPath4;
    }
    const [newResourcesPath] = openDialogRes.filePaths;
    if (resourcesPath4 !== newResourcesPath) {
      const scoreboardInfoJSONPath =
        getScoreboardInfoJSONPath(newResourcesPath);
      try {
        // eslint-disable-next-line no-bitwise
        await access(scoreboardInfoJSONPath, constants.R_OK | constants.W_OK);
      } catch (e: any) {
        throw new Error(
          `Invalid Resources folder: cannot access ${scoreboardInfoJSONPath}`,
        );
      }

      store.set('resourcesPath4', newResourcesPath);
      resourcesPath4 = newResourcesPath;
      await mstOverlay.setResourcesPath(resourcesPath4, true);
    }
    return resourcesPath4;
  });

  ipcMain.removeHandler('getUpdateAutomatically');
  ipcMain.handle('getUpdateAutomatically', () => updateAutomatically);

  ipcMain.removeHandler('setUpdateAutomatically');
  ipcMain.handle(
    'setUpdateAutomatically',
    (event: IpcMainInvokeEvent, newUpdateAutomatically: boolean) => {
      store.set('updateAutomatically', newUpdateAutomatically);
      updateAutomatically = newUpdateAutomatically;
      setUpdateAutomatically(updateAutomatically);
    },
  );

  ipcMain.removeHandler('getEnableSkinColor');
  ipcMain.handle('getEnableSkinColor', () => enableSkinColor);

  ipcMain.removeHandler('setEnableSkinColor');
  ipcMain.handle(
    'setEnableSkinColor',
    (event: IpcMainInvokeEvent, newEnableSkinColor: boolean) => {
      store.set('enableSkinColor', newEnableSkinColor);
      enableSkinColor = newEnableSkinColor;
      setEnableSkinColor(enableSkinColor);
    },
  );

  ipcMain.removeHandler('getEnableSggSponsors');
  ipcMain.handle('getEnableSggSponsors', () => enableSggSponsors);

  ipcMain.removeHandler('setEnableSggSponsors');
  ipcMain.handle(
    'setEnableSggSponsors',
    (event: IpcMainInvokeEvent, newEnableSggSponsors: boolean) => {
      store.set('enableSggSponsors', newEnableSggSponsors);
      enableSggSponsors = newEnableSggSponsors;
      setEnableSggSponsors(enableSggSponsors);
    },
  );

  ipcMain.removeHandler('getEnableSggRound1');
  ipcMain.handle('getEnableSggRound1', () => enableSggRound1);

  ipcMain.removeHandler('setEnableSggRound1');
  ipcMain.handle(
    'setEnableSggRound1',
    (event: IpcMainInvokeEvent, newEnableSggRound: boolean) => {
      const mstOverlay = getMstOverlay(1);
      if (!mstOverlay) {
        throw new Error('no scorboard 1');
      }

      store.set('enableSggRound1', newEnableSggRound);
      enableSggRound1 = newEnableSggRound;
      mstOverlay.setEnableSggRound(enableSggRound1);
    },
  );

  ipcMain.removeHandler('getEnableSggRound2');
  ipcMain.handle('getEnableSggRound2', () => enableSggRound2);

  ipcMain.removeHandler('setEnableSggRound2');
  ipcMain.handle(
    'setEnableSggRound2',
    (event: IpcMainInvokeEvent, newEnableSggRound: boolean) => {
      const mstOverlay = getMstOverlay(2);
      if (!mstOverlay) {
        throw new Error('no scorboard 2');
      }

      store.set('enableSggRound2', newEnableSggRound);
      enableSggRound2 = newEnableSggRound;
      mstOverlay.setEnableSggRound(enableSggRound2);
    },
  );

  ipcMain.removeHandler('getEnableSggRound3');
  ipcMain.handle('getEnableSggRound3', () => enableSggRound3);

  ipcMain.removeHandler('setEnableSggRound3');
  ipcMain.handle(
    'setEnableSggRound3',
    (event: IpcMainInvokeEvent, newEnableSggRound: boolean) => {
      const mstOverlay = getMstOverlay(3);
      if (!mstOverlay) {
        throw new Error('no scorboard 3');
      }

      store.set('enableSggRound3', newEnableSggRound);
      enableSggRound3 = newEnableSggRound;
      mstOverlay.setEnableSggRound(enableSggRound3);
    },
  );

  ipcMain.removeHandler('getEnableSggRound4');
  ipcMain.handle('getEnableSggRound4', () => enableSggRound4);

  ipcMain.removeHandler('setEnableSggRound4');
  ipcMain.handle(
    'setEnableSggRound4',
    (event: IpcMainInvokeEvent, newEnableSggRound: boolean) => {
      const mstOverlay = getMstOverlay(4);
      if (!mstOverlay) {
        throw new Error('no scorboard 4');
      }

      store.set('enableSggRound4', newEnableSggRound);
      enableSggRound4 = newEnableSggRound;
      mstOverlay.setEnableSggRound(enableSggRound4);
    },
  );

  ipcMain.removeHandler('getSimpleTextPathA');
  ipcMain.handle('getSimpleTextPathA', () => simpleTextPathA);

  ipcMain.removeHandler('chooseSimpleTextPathA');
  ipcMain.handle('chooseSimpleTextPathA', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      filters: [{ name: 'Text File', extensions: ['txt'] }],
      properties: ['openFile'],
    });
    if (openDialogRes.canceled) {
      return simpleTextPathA;
    }

    const [simpleTextPath] = openDialogRes.filePaths;

    store.set('simpleTextPathA', simpleTextPath);
    simpleTextPathA = simpleTextPath;
    setSimpleTextPathA(simpleTextPath);
    return simpleTextPathA;
  });

  ipcMain.removeHandler('getSimpleTextPathB');
  ipcMain.handle('getSimpleTextPathB', () => simpleTextPathB);

  ipcMain.removeHandler('chooseSimpleTextPathB');
  ipcMain.handle('chooseSimpleTextPathB', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      filters: [{ name: 'Text File', extensions: ['txt'] }],
      properties: ['openFile'],
    });
    if (openDialogRes.canceled) {
      return simpleTextPathB;
    }

    const [simpleTextPath] = openDialogRes.filePaths;

    store.set('simpleTextPathB', simpleTextPath);
    simpleTextPathB = simpleTextPath;
    setSimpleTextPathB(simpleTextPath);
    return simpleTextPathB;
  });

  ipcMain.removeHandler('getSimpleTextPathC');
  ipcMain.handle('getSimpleTextPathC', () => simpleTextPathC);

  ipcMain.removeHandler('chooseSimpleTextPathC');
  ipcMain.handle('chooseSimpleTextPathC', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      filters: [{ name: 'Text File', extensions: ['txt'] }],
      properties: ['openFile'],
    });
    if (openDialogRes.canceled) {
      return simpleTextPathC;
    }

    const [simpleTextPath] = openDialogRes.filePaths;

    store.set('simpleTextPathC', simpleTextPath);
    simpleTextPathC = simpleTextPath;
    setSimpleTextPathC(simpleTextPath);
    return simpleTextPathC;
  });

  ipcMain.removeHandler('getSimpleTextPathD');
  ipcMain.handle('getSimpleTextPathD', () => simpleTextPathD);

  ipcMain.removeHandler('chooseSimpleTextPathD');
  ipcMain.handle('chooseSimpleTextPathD', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      filters: [{ name: 'Text File', extensions: ['txt'] }],
      properties: ['openFile'],
    });
    if (openDialogRes.canceled) {
      return simpleTextPathD;
    }

    const [simpleTextPath] = openDialogRes.filePaths;

    store.set('simpleTextPathD', simpleTextPath);
    simpleTextPathD = simpleTextPath;
    setSimpleTextPathD(simpleTextPath);
    return simpleTextPathD;
  });

  ipcMain.removeHandler('getScoreboardInfo1');
  ipcMain.handle('getScoreboardInfo1', () => {
    const mstOverlay = getMstOverlay(1);
    if (!mstOverlay) {
      throw new Error('no scorboard 1');
    }
    return mstOverlay.readScoreboardInfo();
  });

  ipcMain.removeHandler('setScoreboardInfo1');
  ipcMain.handle(
    'setScoreboardInfo1',
    (
      event: IpcMainInvokeEvent,
      scoreboardInfo: MSTManualUpdateScoreboardInfo,
    ) => {
      const mstOverlay = getMstOverlay(1);
      if (!mstOverlay) {
        throw new Error('no scorboard 1');
      }
      mstOverlay.manualUpdate(scoreboardInfo);
    },
  );

  ipcMain.removeHandler('getScoreboardInfo2');
  ipcMain.handle('getScoreboardInfo2', () => {
    const mstOverlay = getMstOverlay(2);
    if (!mstOverlay) {
      throw new Error('no scorboard 2');
    }
    return mstOverlay.readScoreboardInfo();
  });

  ipcMain.removeHandler('setScoreboardInfo2');
  ipcMain.handle(
    'setScoreboardInfo2',
    (
      event: IpcMainInvokeEvent,
      scoreboardInfo: MSTManualUpdateScoreboardInfo,
    ) => {
      const mstOverlay = getMstOverlay(2);
      if (!mstOverlay) {
        throw new Error('no scorboard 2');
      }
      mstOverlay.manualUpdate(scoreboardInfo);
    },
  );

  ipcMain.removeHandler('getScoreboardInfo3');
  ipcMain.handle('getScoreboardInfo3', () => {
    const mstOverlay = getMstOverlay(3);
    if (!mstOverlay) {
      throw new Error('no scorboard 3');
    }
    return mstOverlay.readScoreboardInfo();
  });

  ipcMain.removeHandler('setScoreboardInfo3');
  ipcMain.handle(
    'setScoreboardInfo3',
    (
      event: IpcMainInvokeEvent,
      scoreboardInfo: MSTManualUpdateScoreboardInfo,
    ) => {
      const mstOverlay = getMstOverlay(3);
      if (!mstOverlay) {
        throw new Error('no scorboard 3');
      }
      mstOverlay.manualUpdate(scoreboardInfo);
    },
  );

  ipcMain.removeHandler('getScoreboardInfo4');
  ipcMain.handle('getScoreboardInfo4', () => {
    const mstOverlay = getMstOverlay(4);
    if (!mstOverlay) {
      throw new Error('no scorboard 4');
    }
    return mstOverlay.readScoreboardInfo();
  });

  ipcMain.removeHandler('setScoreboardInfo4');
  ipcMain.handle(
    'setScoreboardInfo4',
    (
      event: IpcMainInvokeEvent,
      scoreboardInfo: MSTManualUpdateScoreboardInfo,
    ) => {
      const mstOverlay = getMstOverlay(4);
      if (!mstOverlay) {
        throw new Error('no scorboard 4');
      }
      mstOverlay.manualUpdate(scoreboardInfo);
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

  ipcMain.removeHandler('setTournament');
  ipcMain.handle(
    'setTournament',
    async (
      event: IpcMainInvokeEvent,
      slug: string,
    ): Promise<StartggTournament> => {
      if (!startggApiKey) {
        throw new Error('Please set start.gg token');
      }
      clearTimeout(timeoutId);

      try {
        mainWindow.webContents.send('gettingSets', true);
        const participantsPromise = getTournamentParticipants(
          slug,
          startggApiKey,
        );
        const getTournamentRetPromise = getTournamentSets(slug);
        // await both, we don't want to proceed if either throws
        const participants = await participantsPromise;
        const getTournamentRet = await getTournamentRetPromise;
        updateParticipants(participants);
        updateParticipantIdToSet(getTournamentRet);
        startggTournament = getTournamentRet.tournament;
        if (updateAutomatically) {
          forEachMstOverlay((mstOverlay) => {
            mstOverlay
              .tournamentNameUpdate(getTournamentRet.tournament.name)
              .catch(() => {
                // just catch
              });
          });
        }

        setGetTournamentSetsTimeout();
        if (client === null) {
          maybeStartDiscordClient();
        } else if (discordIdToParticipant.size === 0) {
          await client.destroy();
          client = null;
          updateDiscordStatus(DiscordStatus.NONE);
        } else {
          const guild = client.guilds.valueOf().get(discordServerId);
          if (guild) {
            updateIsDiscordServerMember(
              discordUsernames,
              guild.members.valueOf(),
            );
          }
        }
        sendParticipants();
        return startggTournament;
      } finally {
        mainWindow.webContents.send('gettingSets', false);
      }
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
    await preemptGetTournamentSets();
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
      await preemptGetTournamentSets();
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
      await preemptGetTournamentSets();
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
      await preemptGetTournamentSets();
    },
  );

  ipcMain.removeHandler('getDiscordServers');
  ipcMain.handle('getDiscordServers', () => getGuilds());

  ipcMain.removeHandler('setDiscordServerId');
  ipcMain.handle(
    'setDiscordServerId',
    async (event: IpcMainInvokeEvent, newDiscordServerId: string) => {
      const guild = client?.guilds.valueOf().get(newDiscordServerId);
      if (!guild) {
        throw new Error(`Discord server not found: ${newDiscordServerId}`);
      }

      discordServerId = newDiscordServerId;
      mainWindow.webContents.send('discordServerId', discordServerId);
      await guild.members.fetch();
      updateIsDiscordServerMember(discordUsernames, guild.members.valueOf());
      sendParticipants();
    },
  );

  ipcMain.removeHandler('getDiscordCheckinPings');
  ipcMain.handle(
    'getDiscordCheckinPings',
    async (): Promise<{
      channels: DiscordChannel[];
      discords: DiscordToPing[];
    }> => {
      if (!client) {
        throw new Error('Discord bot not running');
      }

      const userId = client.user?.id;
      if (!userId) {
        return {
          channels: [],
          discords: [],
        };
      }
      const guild = client.guilds.valueOf().get(discordServerId);
      if (!guild) {
        return {
          channels: [],
          discords: [],
        };
      }
      const guildMember = guild.members.valueOf().get(userId);
      if (!guildMember) {
        return {
          channels: [],
          discords: [],
        };
      }

      const channels: DiscordChannel[] = guild.channels
        .valueOf()
        .filter(
          (channel) =>
            channel.type === ChannelType.GuildText &&
            channel.viewable &&
            channel.isSendable() &&
            channel
              .permissionsFor(guildMember)
              .has(PermissionsBitField.Flags.SendMessages),
        )
        .sort(
          (a, b) =>
            (a as TextChannel).rawPosition - (b as TextChannel).rawPosition,
        )
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
        }));

      await preemptGetTournamentSets();
      const pendingSets: StartggSet[] = [];
      sets.pending.forEach((event) => {
        event.phases.forEach((phase) => {
          phase.phaseGroups.forEach((group) => {
            pendingSets.push(
              ...group.sets.filter((set) => set.state === 1 || set.state === 6),
            );
          });
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
      const discords: DiscordToPing[] = [];
      Array.from(participantIds).forEach((participantId) => {
        const discord = participantIdToDiscordToPing.get(participantId);
        if (discord) {
          discords.push(discord);
        }
      });
      return {
        channels,
        discords: discords.sort((a, b) => a.gamerTag.localeCompare(b.gamerTag)),
      };
    },
  );

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
      discordServerId,
      discordUsernames,
      remoteState: getRemoteState(),
      tournament: startggTournament,
    }),
  );

  ipcMain.removeHandler('getStartingSets');
  ipcMain.handle('getStartingSets', () => sets);

  ipcMain.removeHandler('getVersion');
  ipcMain.handle('getVersion', () => app.getVersion());

  ipcMain.removeHandler('getLatestVersion');
  ipcMain.handle('getLatestVersion', async () => {
    const response = await fetch(
      'https://api.github.com/repos/jmlee337/discord-tournament-bot/releases/latest',
    );
    const json = await response.json();
    const latestVersion = json.tag_name;
    if (typeof latestVersion !== 'string') {
      return '';
    }
    return latestVersion;
  });

  ipcMain.removeHandler('copyToClipboard');
  ipcMain.handle(
    'copyToClipboard',
    (event: IpcMainInvokeEvent, text: string) => {
      clipboard.writeText(text);
    },
  );
}
