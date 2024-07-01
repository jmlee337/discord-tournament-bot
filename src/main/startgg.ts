import {
  ReportStartggSet,
  Sets,
  StartggEntrant,
  StartggEvent,
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

type TournamentJSON = {
  entities: {
    event: {
      id: number;
      name: string;
    }[];
    tournament: {
      name: string;
      slug: string;
    };
  };
};
export async function getTournament(slug: string): Promise<StartggTournament> {
  const response = await wrappedFetch(
    `https://api.smash.gg/tournament/${slug}?expand%5B%5D=event`,
  );
  const json = (await response.json()) as TournamentJSON;
  return {
    name: json.entities.tournament.name,
    slug: json.entities.tournament.slug.slice(11),
    events: json.entities.event.map(
      (event: any): StartggEvent => ({
        id: event.id,
        name: event.name,
      }),
    ),
  };
}

async function fetchGql(key: string, query: string, variables: any) {
  const response = await wrappedFetch('https://api.start.gg/gql/alpha', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

type ApiEntrant = {
  id: number;
  participants: {
    id: number;
    requiredConnections: {
      type: string;
      externalId: string;
    }[];
  }[];
};
const EVENT_ENTRANTS_QUERY = `
  query EventQuery($id: ID, $page: Int) {
    event(id: $id) {
      entrants(query: {page: $page, perPage: 256}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          participants {
            id
            requiredConnections {
              type
              externalId
            }
          }
        }
      }
    }
  }
`;
// 985241
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
      const discordIds: string[] = [];
      entrant.participants.forEach((participant) => {
        const externalIds = participant.requiredConnections
          .filter((rc) => rc.type === 'DISCORD')
          .map((rc) => rc.externalId);
        if (externalIds.length > 0) {
          discordIds.push(externalIds[0]);
        }
      });
      return {
        id: entrant.id,
        discordIds,
      };
    });
    entrants.push(...newEntrants);

    page += 1;
  } while (page <= nextData.event.entrants.pageInfo.totalPages);
  return entrants;
}

type ApiPhaseGroup = {
  id: number;
  displayIdentifier: string;
};
type ApiSet = {
  id: number;
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
type ApiPhase = {
  id: number;
  name: string;
  sets: {
    pageInfo: {
      totalPages: number;
    };
    nodes: ApiSet[];
  };
};
function apiSetToStartggSet(set: ApiSet): StartggSet {
  return {
    id: set.id,
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
  query EventSetsQuery($id: ID, $page: Int) {
    event(id: $id) {
      phases(state: ACTIVE) {
        id
        name
        sets(page: $page, perPage: 142, sortType: CALL_ORDER, filters: {hideEmpty: true}) {
          pageInfo {
            totalPages
          }
          nodes {
            id
            displayScore
            fullRoundText
            phaseGroup {
              id
              displayIdentifier
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
  }
`;
export async function getEventSets(id: number, key: string): Promise<Sets> {
  let page = 1;
  const pendingPhases = new Map<number, StartggPhase>();
  const completedPhases = new Map<number, StartggPhase>();
  const pendingPhaseGroups = new Map<number, StartggPhaseGroup>();
  const completedPhaseGroups = new Map<number, StartggPhaseGroup>();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const nextData = await fetchGql(key, EVENT_SETS_QUERY, {
      id,
      page,
    });
    let totalPages = 0;
    const apiPhases = nextData.event.phases as ApiPhase[];
    apiPhases.forEach((apiPhase) => {
      totalPages = Math.max(totalPages, apiPhase.sets.pageInfo.totalPages);
      apiPhase.sets.nodes.forEach((set) => {
        const startggSet = apiSetToStartggSet(set);
        if (set.state === 3) {
          if (!completedPhases.has(apiPhase.id)) {
            completedPhases.set(apiPhase.id, {
              name: apiPhase.name,
              phaseGroups: [],
            });
          }
          if (!completedPhaseGroups.has(set.phaseGroup.id)) {
            const startggPhaseGroup: StartggPhaseGroup = {
              name: `Pool ${set.phaseGroup.displayIdentifier}`,
              sets: [],
            };
            completedPhaseGroups.set(set.phaseGroup.id, startggPhaseGroup);
            completedPhases
              .get(apiPhase.id)!
              .phaseGroups.push(startggPhaseGroup);
          }
          completedPhaseGroups.get(set.phaseGroup.id)!.sets.push(startggSet);
        } else {
          if (!pendingPhases.has(apiPhase.id)) {
            pendingPhases.set(apiPhase.id, {
              name: apiPhase.name,
              phaseGroups: [],
            });
          }
          if (!pendingPhaseGroups.has(set.phaseGroup.id)) {
            const startggPhaseGroup: StartggPhaseGroup = {
              name: `Pool ${set.phaseGroup.displayIdentifier}`,
              sets: [],
            };
            pendingPhaseGroups.set(set.phaseGroup.id, startggPhaseGroup);
            pendingPhases.get(apiPhase.id)!.phaseGroups.push(startggPhaseGroup);
          }
          pendingPhaseGroups.get(set.phaseGroup.id)!.sets.push(startggSet);
        }
      });
    });
    page += 1;
    if (page > totalPages) {
      break;
    }
  }
  return {
    pending: Array.from(pendingPhases.entries())
      .sort(([aId], [bId]) => aId - bId)
      .map(([, startggPhase]) => startggPhase),
    completed: Array.from(completedPhases.entries())
      .sort(([aId], [bId]) => aId - bId)
      .map(([, startggPhase]) => startggPhase),
  };
}

const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, isDQ: $isDQ) {
      id
      displayScore
      fullRoundText
      phaseGroup {
        id
        displayIdentifier
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
`;
export async function reportSet(set: ReportStartggSet, key: string) {
  const data = await fetchGql(key, REPORT_BRACKET_SET_MUTATION, set);
  const updatedSets = new Map<number, StartggSet>();
  (data.reportBracketSet as ApiSet[])
    .filter(
      (updatedSet) =>
        updatedSet.state !== 3 &&
        updatedSet.slots[0].entrant &&
        updatedSet.slots[1].entrant,
    )
    .map(apiSetToStartggSet)
    .forEach((startggSet) => {
      updatedSets.set(startggSet.id, startggSet);
    });
  return updatedSets;
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
      fullRoundText
      phaseGroup {
        id
        displayIdentifier
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
  const updatedSets = new Map<number, StartggSet>();
  (data.reportBracketSet as ApiSet[])
    .filter(
      (updatedSet) =>
        updatedSet.state !== 3 &&
        updatedSet.slots[0].entrant &&
        updatedSet.slots[1].entrant,
    )
    .map(apiSetToStartggSet)
    .forEach((startggSet) => {
      updatedSets.set(startggSet.id, startggSet);
    });
  return updatedSets;
}
