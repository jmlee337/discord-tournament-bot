import {
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
        ? ' ***start.gg API key invalid or expired!***'
        : '';
    throw new Error(`${response.status} - ${response.statusText}.${keyErr}`);
  }

  return response;
}

export async function getTournament(slug: string): Promise<StartggTournament> {
  const response = await wrappedFetch(
    `https://api.smash.gg/tournament/${slug}?expand%5B%5D=event`,
  );
  const json = await response.json();
  return {
    name: json.entities.tournament.name,
    slug: json.entities.tournament.slug,
    events: json.entities.event.map(
      (event: any): StartggEvent => ({
        id: event.id,
        name: event.name,
      }),
    ),
  };
}

// 985241
export async function getEventEntrants(id: number) {
  const response = await wrappedFetch(
    `https://api.smash.gg/event/${id}?expand[]=entrants`,
  );
  const json = await response.json();
  const entrants = json.entities.entrants as any[];
  return entrants.map(
    (entrant: any): StartggEntrant => ({
      id: entrant.id,
      participantIds: entrant.participantIds,
    }),
  );
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

type ApiSet = {
  id: number;
  fullRoundText: string;
  slots: {
    entrant: {
      id: number;
      name: string;
    } | null;
  }[];
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
          (set.slots[0].entrant && set.slots[1].entrant) ||
          updatedSets.has(set.id),
      )
      .map((set) => updatedSets.get(set.id) || apiSetToStartggSet(set));
    sets.push(...newSets);

    page += 1;
  } while (page <= nextData.event.sets.pageInfo.totalPages);
  return sets;
}
