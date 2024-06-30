import {
  ReportStartggSet,
  StartggEntrant,
  StartggEvent,
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

type ApiSet = {
  id: number;
  fullRoundText: string;
  slots: {
    entrant: {
      id: number;
      name: string;
    } | null;
  }[];
  state?: number;
};
function apiSetToStartggSet(set: ApiSet): StartggSet {
  return {
    id: set.id,
    entrant1Id: set.slots[0].entrant!.id,
    entrant1Name: set.slots[0].entrant!.name,
    entrant2Id: set.slots[1].entrant!.id,
    entrant2Name: set.slots[1].entrant!.name,
    fullRoundText: set.fullRoundText,
  };
}

// 985241
const EVENT_SETS_QUERY = `
  query EventSetsQuery($id: ID, $page: Int) {
    event(id: $id) {
      sets(page: $page, perPage: 199, filters: {hideEmpty: true, state: [1, 2, 6]}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          fullRoundText
          slots {
            entrant {
              id
              name
            }
          }
        }
      }
    }
  }
`;
export async function getEventSets(
  id: number,
  key: string,
  completedId?: number,
  updatedSets: Map<number, StartggSet> = new Map(),
) {
  let page = 1;
  let nextData;
  const sets: StartggSet[] = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    nextData = await fetchGql(key, EVENT_SETS_QUERY, {
      id,
      page,
    });
    const apiSets = nextData.event.sets.nodes as ApiSet[];
    const newSets = apiSets
      .filter(
        (set) =>
          set.id !== completedId &&
          ((set.slots[0].entrant && set.slots[1].entrant) ||
            updatedSets.has(set.id)),
      )
      .map((set) => updatedSets.get(set.id) || apiSetToStartggSet(set));
    sets.push(...newSets);

    page += 1;
  } while (page <= nextData.event.sets.pageInfo.totalPages);
  return sets;
}

const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, isDQ: $isDQ) {
      id
      fullRoundText
      slots {
        entrant {
          id
          name
        }
      }
      state
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
