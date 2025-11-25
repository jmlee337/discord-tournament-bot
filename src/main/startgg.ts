import Bottleneck from 'bottleneck';
import {
  AdminedTournament,
  ReportStartggSet,
  Sets,
  StartggEntrant,
  StartggEvent,
  StartggParticipant,
  StartggPhase,
  StartggPhaseGroup,
  StartggSet,
  StartggTournament,
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
          name
          slug
        }
      }
    }
  }
`;
export async function getTournaments(key: string): Promise<AdminedTournament> {
  const data = await fetchGql(key, GET_TOURNAMENTS_QUERY, {});
  return data.currentUser.tournaments.nodes.map((tournament: any) => ({
    slug: tournament.slug.slice(11),
    name: tournament.name,
  }));
}

type TournamentJSON = {
  entities: {
    event: {
      id: number;
      isOnline: boolean;
      name: string;
      slug: string;
    }[];
    tournament: {
      name: string;
      slug: string;
    };
  };
};
export async function getTournament(slug: string): Promise<StartggTournament> {
  const response = await wrappedFetch(
    `https://api.start.gg/tournament/${slug}?expand[]=event`,
  );
  const json = (await response.json()) as TournamentJSON;
  return {
    name: json.entities.tournament.name,
    slug: json.entities.tournament.slug.slice(11),
    events: json.entities.event
      .filter((event) => event.isOnline)
      .map(
        (event): StartggEvent => ({
          id: event.id,
          name: event.name,
          slug: event.slug,
        }),
      ),
  };
}

type ApiEntrant = {
  id: number;
  participants: {
    id: number;
    connectedAccounts: { slippi?: { value?: string | null } | null } | null;
    gamerTag: string;
    requiredConnections:
      | {
          type: string;
          externalId: string;
          externalUsername: string;
        }[]
      | null;
  }[];
};
const EVENT_ENTRANTS_QUERY = `
  query EventQuery($id: ID, $page: Int) {
    event(id: $id) {
      entrants(query: {page: $page, perPage: 500}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          participants {
            id
            connectedAccounts
            gamerTag
            requiredConnections {
              type
              externalId
              externalUsername
            }
          }
        }
      }
    }
  }
`;
// 985241
// 1166836
export async function getEventEntrants(id: number, key: string) {
  let page = 1;
  let nextData;
  const entrants: StartggEntrant[] = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    nextData = await fetchGql(key, EVENT_ENTRANTS_QUERY, {
      id,
      page,
    });
    const apiSets = nextData.event.entrants.nodes as ApiEntrant[];
    const newEntrants = apiSets.map((entrant): StartggEntrant => {
      return {
        id: entrant.id,
        participants: entrant.participants.map((participant) => {
          const startggParticipant: StartggParticipant = {
            id: participant.id,
            connectCode:
              participant.connectedAccounts?.slippi?.value || undefined,
            gamerTag: participant.gamerTag,
          };
          if (participant.requiredConnections) {
            const discords = participant.requiredConnections
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
        }),
      };
    });
    entrants.push(...newEntrants);

    page += 1;
  } while (page <= nextData.event.entrants.pageInfo.totalPages);
  return entrants;
}

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
        participants: { [key: string]: { gamerTag: string } };
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
export async function getEventSets(event: StartggEvent): Promise<Sets> {
  const eventResponse = await wrappedFetch(
    `https://api.start.gg/${event.slug}?expand[]=phase`,
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
          const entrantIdToName = new Map<number, string>();
          groupJson.entities.entrants.forEach((entrant) => {
            const name = Object.values(entrant.mutations.participants)
              .map((participant) => participant.gamerTag)
              .join(' / ');
            entrantIdToName.set(entrant.id, name);
          });
          const pendingSets: StartggSet[] = [];
          const completedSets: StartggSet[] = [];
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

              const newSet: StartggSet = {
                id: set.id,
                completedAt: set.completedAt,
                isDQ: set.entrant1Score === -1 || set.entrant2Score === -1,
                entrant1Id: set.entrant1Id!,
                entrant1Name: entrantIdToName.get(set.entrant1Id!)!,
                entrant1Score: set.entrant1Score || 0,
                entrant2Id: set.entrant2Id!,
                entrant2Name: entrantIdToName.get(set.entrant2Id!)!,
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
    completedPhases.push(completed);
    pendingPhases.push(pending);
  });
  return {
    completed: completedPhases.sort(phaseSortPred),
    pending: pendingPhases.sort(phaseSortPred),
  };
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
  return {
    id: set.id,
    completedAt: set.completedAt,
    isDQ: set.displayScore === 'DQ',
    entrant1Id: set.slots[0].entrant!.id,
    entrant1Name: set.slots[0]
      .entrant!.participants.map((participant) => participant.gamerTag)
      .join(' / '),
    entrant1Score: set.slots[0].standing?.stats.score.value || 0,
    entrant2Id: set.slots[1].entrant!.id,
    entrant2Name: set.slots[1]
      .entrant!.participants.map((participant) => participant.gamerTag)
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
  const set = gqlSetToStartggSet(data.resetSet);
  idToSet.set(set.id, set);
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
  set${i}: reportBracketSet(setId: $setId${i}, winnerId: $winnerId${i}, isDQ: $isDQ${i}) {
    id
    completedAt
  }`);
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
