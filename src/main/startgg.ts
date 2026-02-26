import Bottleneck from 'bottleneck';
import {
  AdminedTournament,
  GetTournamentRet,
  ReportStartggSet,
  StartggEntrant,
  StartggEvent,
  StartggParticipant,
  StartggPhase,
  StartggPhaseGroup,
  StartggSet,
} from '../common/types';

async function wrappedFetch(
  input: URL | RequestInfo,
  init?: RequestInit | undefined,
): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    if (
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504
    ) {
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          const retryResponse = await fetch(input, init);
          if (!retryResponse.ok) {
            reject(
              new Error(
                `${retryResponse.status} - ${retryResponse.statusText}`,
              ),
            );
          } else {
            resolve(retryResponse);
          }
        }, 1000);
      });
    }
    let keyErr = '';
    if (response.status === 400) {
      keyErr = ' ***start.gg token invalid!***';
    } else if (response.status === 401) {
      keyErr = ' ***start.gg token expired!***';
    }
    throw new Error(`${response.status} - ${response.statusText}.${keyErr}`);
  }

  return response;
}

let limiter: Bottleneck;
export function initStartgg() {
  if (limiter) {
    return;
  }

  limiter = new Bottleneck({
    reservoir: 80,
    reservoirRefreshAmount: 80,
    reservoirRefreshInterval: 60000,
  });
}

async function fetchGql(key: string, query: string, variables: any) {
  if (!limiter) {
    throw new Error('start.gg not initialized');
  }

  const response = await limiter.schedule(() =>
    wrappedFetch('https://api.start.gg/gql/alpha', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    }),
  );
  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

const GET_TOURNAMENTS_QUERY = `
  query TournamentsQuery {
    currentUser {
      tournaments(query: {perPage: 500, filter: {tournamentView: "admin"}}) {
        nodes {
          hasOnlineEvents
          name
          slug
        }
      }
    }
  }
`;
export async function getTournaments(key: string): Promise<AdminedTournament> {
  const data = await fetchGql(key, GET_TOURNAMENTS_QUERY, {});
  return data.currentUser.tournaments.nodes
    .filter((tournament: any) => tournament.hasOnlineEvents)
    .map((tournament: any) => ({
      slug: tournament.slug.slice(11),
      name: tournament.name,
    }));
}

const idToParticipant = new Map<number, StartggParticipant>();
type ApiParticipant = {
  id: number;
  connectedAccounts: { slippi?: { value?: string | null } | null } | null;
  gamerTag: string;
  prefix: string | null;
  requiredConnections:
    | {
        type: string;
        externalId: string;
        externalUsername: string;
      }[]
    | null;
};
const TOURNAMENT_PARTICIPANTS_QUERY = `
  query TournamentParticipants($page: Int, $slug: String) {
    tournament(slug: $slug) {
      participants(query: {page: $page, perPage: 512}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          connectedAccounts
          gamerTag
          prefix
          requiredConnections {
            type
            externalId
            externalUsername
          }
        }
      }
    }
  }
`;
export async function getTournamentParticipants(slug: string, key: string) {
  let page = 1;
  let nextData;
  const participants: StartggParticipant[] = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    nextData = await fetchGql(key, TOURNAMENT_PARTICIPANTS_QUERY, {
      page,
      slug,
    });
    const apiParticipants = nextData.tournament.participants
      .nodes as ApiParticipant[];
    const newParticipants = apiParticipants.map((apiParticipant) => {
      const startggParticipant: StartggParticipant = {
        id: apiParticipant.id,
        connectCode:
          apiParticipant.connectedAccounts?.slippi?.value || undefined,
        gamerTag: apiParticipant.gamerTag,
        prefix: apiParticipant.prefix ?? '',
      };
      if (apiParticipant.requiredConnections) {
        const discords = apiParticipant.requiredConnections
          .filter((rc) => rc.type === 'DISCORD')
          .map((rc) => ({
            id: rc.externalId,
            username: rc.externalUsername,
          }));
        if (discords.length > 0) {
          [startggParticipant.discord] = discords;
        }
      }
      return startggParticipant;
    });
    participants.push(...newParticipants);
    page += 1;
  } while (page <= nextData.tournament.participants.pageInfo.totalPages);
  participants.forEach((participant) => {
    idToParticipant.set(participant.id, participant);
  });
  return participants;
}

type EventJSON = {
  id: number;
  isOnline: boolean;
  name: string;
  state: number;
};
type TournamentJSON = {
  entities: {
    event: EventJSON[];
    tournament: {
      name: string;
      slug: string;
    };
  };
};
type EntrantJSON = {
  id: number;
  participantIds: number[];
};
type GroupJSON = {
  id: number;
  displayIdentifier: string;
  state: number;
};
type PhaseJSON = {
  id: number;
  name: string;
  phaseOrder: number;
  state: number;
};
type SetJSON = {
  id: number;
  eventId: number;
  phaseId: number;
  phaseGroupId: number;
  bestOf: number;
  completedAt: number | null;
  entrant1Id: number | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Score: number | null;
  fullRoundText: string;
  round: number;
  startedAt: number | null;
  state: number;
  unreachable: boolean;
  updatedAt: number;
  winnerId: number | null;
};
function phaseSortPred(a: StartggPhase, b: StartggPhase) {
  return a.phaseOrder - b.phaseOrder;
}
function groupSortPred(a: StartggPhaseGroup, b: StartggPhaseGroup) {
  if (a.name.length === b.name.length) {
    return a.name.localeCompare(b.name);
  }
  return a.name.length - b.name.length;
}
function setSortPred(a: StartggSet, b: StartggSet) {
  if (a.round > 0 && b.round > 0) {
    return a.round - b.round;
  }
  if (a.round < 0 && b.round < 0) {
    return b.round - a.round;
  }
  if (a.round > 0 && b.round < 0) {
    return -1;
  }
  if (a.round < 0 && b.round > 0) {
    return 1;
  }
  throw new Error('unreachable');
}

const idToSet = new Map<number, StartggSet>();
const setIdToBestOf = new Map<number, number>();
export async function getTournamentSets(
  slug: string,
): Promise<GetTournamentRet> {
  const tournamentResponse = await wrappedFetch(
    `https://api.start.gg/tournament/${slug}?expand[]=event`,
  );
  const tournamentJson = (await tournamentResponse.json()) as TournamentJSON;
  const eventIds: number[] = [];
  const idToEvent = new Map<number, EventJSON>();
  tournamentJson.entities.event
    .filter((event) => event.isOnline && event.state !== 1)
    .forEach((event) => {
      eventIds.push(event.id);
      idToEvent.set(event.id, event);
    });

  const idToEntrant = new Map<number, StartggEntrant>();
  const entrantIdToNameAndSponsor = new Map<
    number,
    { name: string; sponsor: string }
  >();
  const groupIds: number[] = [];
  const idToGroup = new Map<number, GroupJSON>();
  const phaseIds: number[] = [];
  const idToPhase = new Map<number, PhaseJSON>();
  await Promise.all(
    eventIds.map(async (eventId) => {
      const eventResponse = await wrappedFetch(
        `https://api.start.gg/event/${eventId}?expand[]=phase&expand[]=groups&expand[]=entrants`,
      );
      const eventJson = (await eventResponse.json()) as {
        entities: {
          entrants: EntrantJSON[];
          groups: GroupJSON[];
          phase: PhaseJSON[];
        };
      };
      eventJson.entities.entrants.forEach((entrant) => {
        idToEntrant.set(entrant.id, {
          id: entrant.id,
          participantsIds: entrant.participantIds,
        });
        const participants: StartggParticipant[] = [];
        entrant.participantIds.forEach((participantId) => {
          const participant = idToParticipant.get(participantId);
          if (participant) {
            participants.push(participant);
          }
        });
        entrantIdToNameAndSponsor.set(entrant.id, {
          name: participants
            .map((participant) => participant.gamerTag)
            .join(' / '),
          sponsor: participants
            .map((participant) => participant.prefix)
            .join(' / '),
        });
      });
      eventJson.entities.groups
        .filter((group) => group.state !== 1)
        .forEach((group) => {
          groupIds.push(group.id);
          idToGroup.set(group.id, group);
        });
      eventJson.entities.phase
        .filter((phase) => phase.state !== 1)
        .forEach((phase) => {
          phaseIds.push(phase.id);
          idToPhase.set(phase.id, phase);
        });
    }),
  );

  const pendingSets: SetJSON[] = [];
  const completedSets: SetJSON[] = [];
  if (eventIds.length > 0 && phaseIds.length > 0 && groupIds.length > 0) {
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url = `https://api.start.gg/sets/tournament/${slug}?page=${page}&per_page=100&filter={"eventId":[${eventIds.join(
        ',',
      )}],"phaseId":[${phaseIds.join(',')}],"phaseGroupId":[${groupIds.join(
        ',',
      )}]}&isAdmin=true&expand[]=setTask&bustCache=true`;
      // eslint-disable-next-line no-await-in-loop
      const setsResponse = await wrappedFetch(url);
      // eslint-disable-next-line no-await-in-loop
      const pageJson = await setsResponse.json();

      if (Array.isArray(pageJson.items?.entities?.sets)) {
        const setsJson = pageJson.items.entities.sets as SetJSON[];
        setsJson.forEach((set) => {
          setIdToBestOf.set(set.id, set.bestOf);
        });
        setsJson
          .filter((set) => set.entrant1Id && set.entrant2Id && !set.unreachable)
          .forEach((set) => {
            if (set.state === 3) {
              completedSets.push(set);
            } else {
              pendingSets.push(set);
            }
          });
      }

      if (
        !Number.isInteger(pageJson.total_count) ||
        pageJson.total_count <= page * 100
      ) {
        break;
      }
      page += 1;
    }
  }

  const toStartggSet = (set: SetJSON): StartggSet => {
    const existingSet = idToSet.get(set.id);
    if (existingSet && existingSet.updatedAt > set.updatedAt) {
      return existingSet;
    }

    const { name: entrant1Name, sponsor: entrant1Sponsor } =
      entrantIdToNameAndSponsor.get(set.entrant1Id!)!;
    const { name: entrant2Name, sponsor: entrant2Sponsor } =
      entrantIdToNameAndSponsor.get(set.entrant2Id!)!;

    const newSet: StartggSet = {
      id: set.id,
      bestOf: set.bestOf,
      completedAt: set.completedAt,
      isDQ: set.entrant1Score === -1 || set.entrant2Score === -1,
      entrant1Id: set.entrant1Id!,
      entrant1Name,
      entrant1Sponsor,
      entrant1Score: set.entrant1Score || 0,
      entrant2Id: set.entrant2Id!,
      entrant2Name,
      entrant2Sponsor,
      entrant2Score: set.entrant2Score || 0,
      fullRoundText: set.fullRoundText,
      round: set.round,
      startedAt: set.startedAt,
      state: set.state,
      updatedAt: set.updatedAt,
      winnerId: set.winnerId,
    };
    idToSet.set(set.id, newSet);
    return newSet;
  };

  const idToCompletedPhaseGroup = new Map<number, StartggPhaseGroup>();
  const idToCompletedPhase = new Map<
    number,
    { name: string; phaseOrder: number; phaseGroupIds: Set<number> }
  >();
  const idToCompletedEvent = new Map<
    number,
    {
      id: number;
      name: string;
      phaseIds: Set<number>;
    }
  >();
  completedSets.forEach((set) => {
    let phaseGroup = idToCompletedPhaseGroup.get(set.phaseGroupId);
    if (!phaseGroup) {
      phaseGroup = {
        name: idToGroup.get(set.phaseGroupId)!.displayIdentifier,
        sets: [],
      };
      idToCompletedPhaseGroup.set(set.phaseGroupId, phaseGroup);
    }
    phaseGroup.sets.push(toStartggSet(set));

    let phase = idToCompletedPhase.get(set.phaseId);
    if (!phase) {
      const phaseJSON = idToPhase.get(set.phaseId)!;
      phase = {
        name: phaseJSON.name,
        phaseOrder: phaseJSON.phaseOrder,
        phaseGroupIds: new Set(),
      };
      idToCompletedPhase.set(set.phaseId, phase);
    }
    phase.phaseGroupIds.add(set.phaseGroupId);

    let event = idToCompletedEvent.get(set.eventId);
    if (!event) {
      const eventJSON = idToEvent.get(set.eventId)!;
      event = {
        id: eventJSON.id,
        name: eventJSON.name,
        phaseIds: new Set(),
      };
      idToCompletedEvent.set(set.eventId, event);
    }
    event.phaseIds.add(set.phaseId);
  });
  const completedEvents = Array.from(idToCompletedEvent.values()).map(
    (event): StartggEvent => {
      const phases = Array.from(event.phaseIds.keys()).map(
        (phaseId): StartggPhase => {
          const phase = idToCompletedPhase.get(phaseId)!;
          const phaseGroups = Array.from(phase.phaseGroupIds.keys()).map(
            (phaseGroupId): StartggPhaseGroup => {
              const phaseGroup = idToCompletedPhaseGroup.get(phaseGroupId)!;
              phaseGroup.sets.sort(setSortPred);
              return phaseGroup;
            },
          );
          phaseGroups.sort(groupSortPred);
          return {
            name: phase.name,
            phaseOrder: phase.phaseOrder,
            phaseGroups,
          };
        },
      );
      phases.sort(phaseSortPred);
      return {
        id: event.id,
        name: event.name,
        phases,
      };
    },
  );

  const idToPendingPhaseGroup = new Map<number, StartggPhaseGroup>();
  const idToPendingPhase = new Map<
    number,
    { name: string; phaseOrder: number; phaseGroupIds: Set<number> }
  >();
  const idToPendingEvent = new Map<
    number,
    {
      id: number;
      name: string;
      phaseIds: Set<number>;
    }
  >();
  pendingSets.forEach((set) => {
    let phaseGroup = idToPendingPhaseGroup.get(set.phaseGroupId);
    if (!phaseGroup) {
      phaseGroup = {
        name: idToGroup.get(set.phaseGroupId)!.displayIdentifier,
        sets: [],
      };
      idToPendingPhaseGroup.set(set.phaseGroupId, phaseGroup);
    }
    phaseGroup.sets.push(toStartggSet(set));

    let phase = idToPendingPhase.get(set.phaseId);
    if (!phase) {
      const phaseJSON = idToPhase.get(set.phaseId)!;
      phase = {
        name: phaseJSON.name,
        phaseOrder: phaseJSON.phaseOrder,
        phaseGroupIds: new Set(),
      };
      idToPendingPhase.set(set.phaseId, phase);
    }
    phase.phaseGroupIds.add(set.phaseGroupId);

    let event = idToPendingEvent.get(set.eventId);
    if (!event) {
      const eventJSON = idToEvent.get(set.eventId)!;
      event = {
        id: eventJSON.id,
        name: eventJSON.name,
        phaseIds: new Set(),
      };
      idToPendingEvent.set(set.eventId, event);
    }
    event.phaseIds.add(set.phaseId);
  });
  const pendingEvents = Array.from(idToPendingEvent.values()).map(
    (event): StartggEvent => {
      const phases = Array.from(event.phaseIds.keys()).map(
        (phaseId): StartggPhase => {
          const phase = idToPendingPhase.get(phaseId)!;
          const phaseGroups = Array.from(phase.phaseGroupIds.keys()).map(
            (phaseGroupId): StartggPhaseGroup => {
              const phaseGroup = idToPendingPhaseGroup.get(phaseGroupId)!;
              phaseGroup.sets.sort(setSortPred);
              return phaseGroup;
            },
          );
          phaseGroups.sort(groupSortPred);
          return {
            name: phase.name,
            phaseOrder: phase.phaseOrder,
            phaseGroups,
          };
        },
      );
      phases.sort(phaseSortPred);
      return {
        id: event.id,
        name: event.name,
        phases,
      };
    },
  );

  return {
    idToEntrant,
    sets: {
      completed: completedEvents,
      pending: pendingEvents,
    },
    tournament: {
      slug,
      name: tournamentJson.entities.tournament.name,
    },
  };
}

export async function getNotCheckedInParticipantIds(
  slug: string,
  eventIds: number[],
) {
  const participantIds = new Set<number>();
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const setsResponse = await wrappedFetch(
      `https://api.start.gg/sets/tournament/${slug}?page=${page}&per_page=100&filter={"isPlayable":true,"eventId":[${eventIds.join(
        ',',
      )}]}&isAdmin=true&expand[]=setTask&bustCache=true`,
    );
    // eslint-disable-next-line no-await-in-loop
    const setsJson = await setsResponse.json();
    if (Array.isArray(setsJson.items?.entities?.sets)) {
      const pendingSetIds = new Set(
        (setsJson.items.entities.sets as any[])
          .filter((set) => set.state === 1 || set.state === 6)
          .map((set) => set.id),
      );
      if (Array.isArray(setsJson.items.entities.setTask)) {
        (setsJson.items.entities.setTask as any[])
          .filter(
            (setTask) =>
              setTask.type === 1 &&
              setTask.active &&
              !setTask.isCompleted &&
              pendingSetIds.has(setTask.setId),
          )
          .forEach((setTask) => {
            Object.entries(setTask.metadata.checkins).forEach(
              ([participantId, checkedIn]) => {
                if (checkedIn === false) {
                  participantIds.add(Number.parseInt(participantId, 10));
                }
              },
            );
          });
      }
    }

    if (
      !Number.isInteger(setsJson.total_count) ||
      setsJson.total_count <= page * 100
    ) {
      break;
    }
    page += 1;
  }

  return Array.from(participantIds.keys());
}

const GQL_SET_INNER = `
  id
  completedAt
  displayScore
  fullRoundText
  round
  slots {
    entrant {
      id
      participants {
        gamerTag
        prefix
      }
    }
    standing {
      stats {
        score {
          value
        }
      }
    }
  }
  state
  startedAt
  updatedAt
  winnerId
`;
type GqlSet = {
  id: number;
  completedAt: number | null;
  displayScore: string;
  fullRoundText: string;
  round: number;
  slots: {
    entrant: {
      id: number;
      participants: {
        gamerTag: string;
        prefix: string | null;
      }[];
    } | null;
    standing: {
      stats: {
        score: {
          value: number;
        };
      };
    } | null;
  }[];
  state: number;
  startedAt: number | null;
  updatedAt: number;
  winnerId: number | null;
};
function gqlSetFilterPred(set: GqlSet) {
  return set.slots[0].entrant && set.slots[1].entrant;
}

function gqlSetToStartggSet(set: GqlSet): StartggSet {
  const entrant1Participants = set.slots[0].entrant!.participants;
  const entrant2Participants = set.slots[1].entrant!.participants;
  return {
    id: set.id,
    bestOf: setIdToBestOf.get(set.id)!,
    completedAt: set.completedAt,
    isDQ: set.displayScore === 'DQ',
    entrant1Id: set.slots[0].entrant!.id,
    entrant1Name: entrant1Participants
      .map((participant) => participant.gamerTag)
      .join(' / '),
    entrant1Sponsor: entrant1Participants
      .map((participant) => participant.prefix ?? '')
      .join(' / '),
    entrant1Score: set.slots[0].standing?.stats.score.value || 0,
    entrant2Id: set.slots[1].entrant!.id,
    entrant2Name: entrant2Participants
      .map((participant) => participant.gamerTag)
      .join(' / '),
    entrant2Sponsor: entrant2Participants
      .map((participant) => participant.prefix ?? '')
      .join(' / '),
    entrant2Score: set.slots[1].standing?.stats.score.value || 0,
    fullRoundText: set.fullRoundText,
    round: set.round,
    startedAt: set.startedAt,
    state: set.state,
    updatedAt: set.updatedAt,
    winnerId: set.winnerId,
  };
}
const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, isDQ: $isDQ) {${GQL_SET_INNER}}
  }
`;
export async function reportSet(set: ReportStartggSet, key: string) {
  const data = await fetchGql(key, REPORT_BRACKET_SET_MUTATION, set);
  (data.reportBracketSet as GqlSet[])
    .filter(gqlSetFilterPred)
    .map(gqlSetToStartggSet)
    .forEach((sggSet) => {
      idToSet.set(sggSet.id, sggSet);
    });
}

const RESET_SET_MUTATION = `
  mutation ResetSetMutation($id:ID!) {
    resetSet(setId: $id) {${GQL_SET_INNER}}
  }
`;
export async function resetSet(id: number, key: string) {
  const data = await fetchGql(key, RESET_SET_MUTATION, { id });
  if (gqlSetFilterPred(data.resetSet)) {
    const set = gqlSetToStartggSet(data.resetSet);
    idToSet.set(set.id, set);
  }
}

const SWAP_WINNER_MUTATION = `
  mutation SwapWinnerMutation($id:ID!, $newWinnerId: ID, $isDQ: Boolean) {
    resetSet(setId: $id) {
      id
    }
    reportBracketSet(setId: $id, winnerId: $newWinnerId, isDQ: $isDQ)  {${GQL_SET_INNER}}
  }
`;
export async function swapWinner(
  id: number,
  newWinnerId: number,
  isDQ: boolean,
  key: string,
) {
  const data = await fetchGql(key, SWAP_WINNER_MUTATION, {
    id,
    newWinnerId,
    isDQ,
  });
  (data.reportBracketSet as GqlSet[])
    .filter(gqlSetFilterPred)
    .map(gqlSetToStartggSet)
    .forEach((set) => {
      idToSet.set(set.id, set);
    });
}

export async function reportSets(sets: ReportStartggSet[], key: string) {
  const outer: string[] = [];
  const inner: string[] = [];
  const variables: any = {};
  sets.forEach((set, i) => {
    outer.push(`$setId${i}: ID!, $winnerId${i}: ID, $isDQ${i}: Boolean`);
    inner.push(`
  set${i}: reportBracketSet(setId: $setId${i}, winnerId: $winnerId${i}, isDQ: $isDQ${i}) {${GQL_SET_INNER}}`);
    variables[`setId${i}`] = set.setId;
    variables[`winnerId${i}`] = set.winnerId;
    variables[`isDQ${i}`] = set.isDQ;
  });
  const query = `mutation ReportSetsMutation(${outer.join(
    ', ',
  )}) {${inner.join()}
}`;
  const data = await fetchGql(key, query, variables);
  sets.forEach((unused, i) => {
    (data[`set${i}`] as GqlSet[])
      .filter(gqlSetFilterPred)
      .map(gqlSetToStartggSet)
      .forEach((set) => {
        idToSet.set(set.id, set);
      });
  });
}
