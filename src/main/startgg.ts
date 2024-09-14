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
    const keyErr =
      response.status === 400
        ? ' ***start.gg token invalid or expired!***'
        : '';
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
    `https://api.smash.gg/tournament/${slug}?expand[]=event`,
  );
  const json = (await response.json()) as TournamentJSON;
  return {
    name: json.entities.tournament.name,
    slug: json.entities.tournament.slug.slice(11),
    events: json.entities.event.map(
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
      state: number;
    }[];
  };
};
type ApiPhase = {
  id: number;
  name: string;
};
type ApiPhaseGroup = {
  id: number;
  displayIdentifier: string;
  phase: ApiPhase;
};
type ApiSet = {
  id: number;
  completedAt: number | null;
  displayScore: string;
  fullRoundText: string;
  phaseGroup: ApiPhaseGroup;
  slots: {
    entrant: {
      id: number;
      name: string;
    } | null;
  }[];
  state: number;
  winnerId: number | null;
};
function apiSetToStartggSet(set: ApiSet): StartggSet {
  return {
    id: set.id,
    completedAt: set.completedAt,
    isDQ: set.displayScore === 'DQ',
    entrant1Id: set.slots[0].entrant!.id,
    entrant1Name: set.slots[0].entrant!.name,
    entrant2Id: set.slots[1].entrant!.id,
    entrant2Name: set.slots[1].entrant!.name,
    fullRoundText: set.fullRoundText,
    winnerId: set.winnerId,
  };
}

// 1008143
const EVENT_SETS_QUERY = `
  query EventSetsQuery($id: ID, $phaseIds: [ID], $page: Int) {
    event(id: $id) {
      sets(
        page: $page
        perPage: 124
        sortType: CALL_ORDER
        filters: {hideEmpty: true, phaseIds: $phaseIds}
      ) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          completedAt
          displayScore
          fullRoundText
          phaseGroup {
            id
            displayIdentifier
            phase {
              id
              name
            }
          }
          slots {
            entrant {
              id
              name
            }
          }
          state
          winnerId
        }
      }
    }
  }
`;
export async function getEventSets(
  event: StartggEvent,
  setIdToCompletedAt: Map<number, number>,
  key: string,
): Promise<Sets> {
  const response = await wrappedFetch(
    `https://api.smash.gg/${event.slug}?expand[]=phase`,
  );
  const json = (await response.json()) as EventJSON;
  const phaseIds = json.entities.phase
    .filter((phase) => phase.state === 2)
    .map((phase) => phase.id);

  const pendingPhases = new Map<number, StartggPhase>();
  const completedPhases = new Map<number, StartggPhase>();
  const pendingPhaseGroups = new Map<number, StartggPhaseGroup>();
  const completedPhaseGroups = new Map<number, StartggPhaseGroup>();
  let page = 1;
  let nextData;
  // eslint-disable-next-line no-constant-condition
  do {
    // eslint-disable-next-line no-await-in-loop
    nextData = await fetchGql(key, EVENT_SETS_QUERY, {
      id: event.id,
      phaseIds,
      page,
    });
    const apiSets = nextData.event.sets.nodes as ApiSet[];
    apiSets
      .filter((apiSet) => apiSet.slots[0].entrant && apiSet.slots[1].entrant)
      .forEach((apiSet) => {
        let isCompleted = apiSet.state === 3;
        const reportedTimestampS = setIdToCompletedAt.get(apiSet.id);
        if (reportedTimestampS) {
          if (apiSet.completedAt && apiSet.completedAt >= reportedTimestampS) {
            setIdToCompletedAt.delete(apiSet.id);
          } else {
            isCompleted = true;
          }
        }

        const apiPhaseGroup = apiSet.phaseGroup;
        const apiPhase = apiSet.phaseGroup.phase;
        const startggSet = apiSetToStartggSet(apiSet);
        if (isCompleted) {
          if (!completedPhases.has(apiPhase.id)) {
            completedPhases.set(apiPhase.id, {
              name: apiPhase.name,
              phaseGroups: [],
            });
          }
          if (!completedPhaseGroups.has(apiPhaseGroup.id)) {
            const startggPhaseGroup: StartggPhaseGroup = {
              name: `Pool ${apiPhaseGroup.displayIdentifier}`,
              sets: [],
            };
            completedPhaseGroups.set(apiPhaseGroup.id, startggPhaseGroup);
            completedPhases
              .get(apiPhase.id)!
              .phaseGroups.push(startggPhaseGroup);
          }
          completedPhaseGroups.get(apiPhaseGroup.id)!.sets.push(startggSet);
        } else {
          if (!pendingPhases.has(apiPhase.id)) {
            pendingPhases.set(apiPhase.id, {
              name: apiPhase.name,
              phaseGroups: [],
            });
          }
          if (!pendingPhaseGroups.has(apiPhaseGroup.id)) {
            const startggPhaseGroup: StartggPhaseGroup = {
              name: `Pool ${apiPhaseGroup.displayIdentifier}`,
              sets: [],
            };
            pendingPhaseGroups.set(apiPhaseGroup.id, startggPhaseGroup);
            pendingPhases.get(apiPhase.id)!.phaseGroups.push(startggPhaseGroup);
          }
          pendingPhaseGroups.get(apiPhaseGroup.id)!.sets.push(startggSet);
        }
      });
    page += 1;
  } while (page <= nextData.event.sets.pageInfo.totalPages);
  return {
    pending: Array.from(pendingPhases.entries())
      .sort(([aId], [bId]) => aId - bId)
      .map(([, startggPhase]) => {
        startggPhase.phaseGroups.sort((pgA, pgB) =>
          pgA.name.localeCompare(pgB.name),
        );
        return startggPhase;
      }),
    completed: Array.from(completedPhases.entries())
      .sort(([aId], [bId]) => aId - bId)
      .map(([, startggPhase]) => {
        startggPhase.phaseGroups.sort((pgA, pgB) =>
          pgA.name.localeCompare(pgB.name),
        );
        return startggPhase;
      }),
  };
}

type ReportedSet = {
  id: number;
  completedAt: number;
};
const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, isDQ: $isDQ) {
      id
      completedAt
    }
  }
`;
export async function reportSet(
  set: ReportStartggSet,
  setIdToCompletedAt: Map<number, number>,
  key: string,
) {
  const data = await fetchGql(key, REPORT_BRACKET_SET_MUTATION, set);
  const reportedSet = (data.reportBracketSet as ReportedSet[]).find(
    (reportBracketSet) => reportBracketSet.id === set.setId,
  );
  if (reportedSet) {
    setIdToCompletedAt.set(reportedSet.id, reportedSet.completedAt);
  }
}

const RESET_SET_MUTATION = `
  mutation ResetSetMutation($id:ID!) {
    resetSet(setId: $id) {
      id
    }
  }
`;
export async function resetSet(id: number, key: string) {
  const data = await fetchGql(key, RESET_SET_MUTATION, { id });
  return data.resetSet.id;
}

const SWAP_WINNER_MUTATION = `
  mutation SwapWinnerMutation($id:ID!, $newWinnerId: ID, $isDQ: Boolean) {
    resetSet(setId: $id) {
      id
    }
    reportBracketSet(setId: $id, winnerId: $newWinnerId, isDQ: $isDQ) {
      id
      completedAt
    }
  }
`;
export async function swapWinner(
  id: number,
  newWinnerId: number,
  isDQ: boolean,
  setIdToCompletedAt: Map<number, number>,
  key: string,
) {
  const data = await fetchGql(key, SWAP_WINNER_MUTATION, {
    id,
    newWinnerId,
    isDQ,
  });
  const reportedSet = (data.reportBracketSet as ReportedSet[]).find(
    (set) => set.id === id,
  );
  if (reportedSet) {
    setIdToCompletedAt.set(reportedSet.id, reportedSet.completedAt);
  }
}

export async function reportSets(
  sets: ReportStartggSet[],
  setIdToCompletedAt: Map<number, number>,
  key: string,
) {
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
  sets.forEach(({ setId }, i) => {
    const reportedSet = (data[`set${i}`] as ReportedSet[]).find(
      (set) => set.id === setId,
    );
    if (reportedSet) {
      setIdToCompletedAt.set(reportedSet.id, reportedSet.completedAt);
    }
  });
}
