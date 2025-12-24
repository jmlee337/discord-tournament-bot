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
  return participants;
}

type TournamentJSON = {
  entities: {
    event: {
      id: number;
      isOnline: boolean;
      name: string;
      state: number;
    }[];
    tournament: {
      name: string;
      slug: string;
    };
  };
};
type EventJSON = {
  entities: {
    phase: {
      id: number;
      name: string;
      phaseOrder: number;
      state: number;
    }[];
  };
};
type PhaseJSON = {
  entities: {
    groups: {
      id: number;
      displayIdentifier: string;
    }[];
  };
};
type SetJSON = {
  id: number;
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
type GroupJSON = {
  entities: {
    entrants: {
      id: number;
      mutations: {
        participants: {
          [key: string]: {
            id: number;
            gamerTag: string;
            prefix: string | null;
          };
        };
      };
    }[];
    sets: SetJSON[];
  };
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
  const startedEvents = tournamentJson.entities.event.filter(
    (event) => event.isOnline && event.state !== 1,
  );

  const idToEntrant = new Map<number, StartggEntrant>();
  const startggEvents = await Promise.all(
    startedEvents.map(async (event) => {
      const eventResponse = await wrappedFetch(
        `https://api.start.gg/event/${event.id}?expand[]=phase`,
      );
      const eventJson = (await eventResponse.json()) as EventJSON;
      const startedPhases = eventJson.entities.phase.filter(
        (phase) => phase.state !== 1,
      );

      const startggPhases = await Promise.all(
        startedPhases.map(async (phase) => {
          const phaseResponse = await wrappedFetch(
            `https://api.start.gg/phase/${phase.id}?expand[]=groups`,
          );
          const phaseJson = (await phaseResponse.json()) as PhaseJSON;
          const startggPhaseGroups = await Promise.all(
            phaseJson.entities.groups.map(async (group) => {
              const groupResponse = await wrappedFetch(
                `https://api.start.gg/phase_group/${group.id}?expand[]=sets&expand[]=entrants`,
              );
              const groupJson = (await groupResponse.json()) as GroupJSON;
              const entrantIdToNameAndSponsor = new Map<
                number,
                { name: string; sponsor: string }
              >();
              if (
                Array.isArray(groupJson.entities.entrants) &&
                groupJson.entities.entrants.length > 0
              ) {
                groupJson.entities.entrants.forEach((entrant) => {
                  const participants = Object.values(
                    entrant.mutations.participants,
                  );
                  idToEntrant.set(entrant.id, {
                    id: entrant.id,
                    participantsIds: participants.map(
                      (participant) => participant.id,
                    ),
                  });

                  const name = participants
                    .map((participant) => participant.gamerTag)
                    .join(' / ');
                  const sponsor = participants
                    .filter((participant) => participant.prefix)
                    .map((participant) => participant.prefix!)
                    .join(' / ');
                  entrantIdToNameAndSponsor.set(entrant.id, { name, sponsor });
                });
              }
              const pendingSets: StartggSet[] = [];
              const completedSets: StartggSet[] = [];
              if (
                Array.isArray(groupJson.entities.sets) &&
                groupJson.entities.sets.length > 0
              ) {
                groupJson.entities.sets.forEach((set) => {
                  setIdToBestOf.set(set.id, set.bestOf);
                });
                groupJson.entities.sets
                  .filter(
                    (set) =>
                      !set.unreachable &&
                      Number.isInteger(set.entrant1Id) &&
                      Number.isInteger(set.entrant2Id),
                  )
                  .map((set): StartggSet => {
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
                      isDQ:
                        set.entrant1Score === -1 || set.entrant2Score === -1,
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
                  })
                  .forEach((set) => {
                    if (set.state === 3) {
                      completedSets.push(set);
                    } else {
                      pendingSets.push(set);
                    }
                  });
              }

              const name = `Pool ${group.displayIdentifier}`;
              const completed: StartggPhaseGroup = {
                name,
                sets: completedSets.sort(setSortPred),
              };
              const pending: StartggPhaseGroup = {
                name,
                sets: pendingSets.sort(setSortPred),
              };
              return { completed, pending };
            }),
          );
          const completedPhaseGroups: StartggPhaseGroup[] = [];
          const pendingPhaseGroups: StartggPhaseGroup[] = [];
          startggPhaseGroups.forEach(({ completed, pending }) => {
            if (completed.sets.length > 0) {
              completedPhaseGroups.push(completed);
            }
            if (pending.sets.length > 0) {
              pendingPhaseGroups.push(pending);
            }
          });
          const completed: StartggPhase = {
            name: phase.name,
            phaseGroups: completedPhaseGroups.sort(groupSortPred),
            phaseOrder: phase.phaseOrder,
          };
          const pending: StartggPhase = {
            name: phase.name,
            phaseGroups: pendingPhaseGroups.sort(groupSortPred),
            phaseOrder: phase.phaseOrder,
          };
          return { completed, pending };
        }),
      );

      const completedPhases: StartggPhase[] = [];
      const pendingPhases: StartggPhase[] = [];
      startggPhases.forEach(({ completed, pending }) => {
        if (completed.phaseGroups.length > 0) {
          completedPhases.push(completed);
        }
        if (pending.phaseGroups.length > 0) {
          pendingPhases.push(pending);
        }
      });
      const completed: StartggEvent = {
        name: event.name,
        phases: completedPhases.sort(phaseSortPred),
      };
      const pending: StartggEvent = {
        name: event.name,
        phases: pendingPhases.sort(phaseSortPred),
      };
      return { completed, pending };
    }),
  );

  const completedEvents: StartggEvent[] = [];
  const pendingEvents: StartggEvent[] = [];
  startggEvents.forEach(({ completed, pending }) => {
    completedEvents.push(completed);
    pendingEvents.push(pending);
  });
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

export async function getNotCheckedInParticipantIds(setId: number) {
  const setResponse = await wrappedFetch(
    `https://api.start.gg/set/${setId}?expand[]=setTask`,
  );

  const participantIds: number[] = [];
  const setJson = await setResponse.json();
  const setTasks = setJson.entities?.setTask;
  if (Array.isArray(setTasks)) {
    setTasks
      .filter(
        (setTask) =>
          setTask.type === 1 && setTask.active && !setTask.isCompleted,
      )
      .forEach((checkinTask) => {
        Object.entries(checkinTask.metadata.checkins).forEach(
          ([participantId, checkedIn]) => {
            if (checkedIn === false) {
              participantIds.push(Number.parseInt(participantId, 10));
            }
          },
        );
      });
  }
  return participantIds;
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
