import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { FormEvent, useEffect, useState } from 'react';
import { Clear, EventAvailable, Refresh, TaskAlt } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  InputBase,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Settings from './Settings';
import {
  DiscordStatus,
  Sets,
  StartggPhase,
  StartggSet,
  StartggTournament,
} from '../common/types';
import Report from './Report';
import Reset from './Reset';

type Highlight = {
  start: number;
  end: number;
};

type SetWithHighlight = {
  highlights: Highlight[];
  set: StartggSet;
};

// yellow 400
const HIGHLIGHT_COLOR = '#ffee58';

const EMPTY_STARTGG_SET: StartggSet = {
  id: 0,
  isDQ: false,
  entrant1Id: 0,
  entrant1Name: '',
  entrant2Id: 0,
  entrant2Name: '',
  fullRoundText: '',
  winnerId: null,
};

function Hello() {
  // settings
  const [gotSettings, setGotSettings] = useState(false);
  const [discordApplicationId, setDiscordApplicationId] = useState('');
  const [discordToken, setDiscordToken] = useState('');
  const [discordStatus, setDiscordStatus] = useState(DiscordStatus.NONE);
  const [startggApiKey, setStartggApiKey] = useState('');
  const [tournament, setTournament] = useState<StartggTournament>({
    name: '',
    slug: '',
    events: [],
  });
  const [eventDescription, setEventDescription] = useState('');
  const [sets, setSets] = useState<Sets>({ pending: [], completed: [] });
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const discordConfigPromise = window.electron.getDiscordConfig();
      const startggApiKeyPromise = window.electron.getStartggApiKey();
      const startingStatePromise = window.electron.getStartingState();
      setAppVersion(await appVersionPromise);
      setLatestAppVersion(await latestAppVersionPromise);
      setDiscordApplicationId((await discordConfigPromise).applicationId);
      setDiscordToken((await discordConfigPromise).token);
      setStartggApiKey(await startggApiKeyPromise);
      setDiscordStatus((await startingStatePromise).discordStatus);
      const tournamentName = (await startingStatePromise).tournament.name;
      const { eventName } = await startingStatePromise;
      if (tournamentName && eventName) {
        setEventDescription(`${tournamentName}, ${eventName}`);
      }
      setSets((await startingStatePromise).sets);
      setTournament((await startingStatePromise).tournament);
      setGotSettings(true);
    };
    inner();
  }, []);

  useEffect(() => {
    window.electron.onDiscordStatus((event, newDiscordStatus) => {
      setDiscordStatus(newDiscordStatus);
    });
    window.electron.onSets((event, newSets) => {
      setSets(newSets);
    });
  });

  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const getStartggTournamentOnSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    const target = event.target as typeof event.target & {
      slug: { value: string };
    };
    const newSlug = target.slug.value;
    event.preventDefault();
    event.stopPropagation();
    if (newSlug) {
      setGettingTournament(true);
      try {
        const newTournament = await window.electron.getTournament(newSlug);
        setTournament(newTournament);
        if (newTournament.events.length === 1) {
          const newEvent = newTournament.events[0];
          await window.electron.setEvent(newEvent.id, newEvent.name);
          setEventDescription(`${newTournament.name}, ${newEvent.name}`);
          setTournamentDialogOpen(false);
        }
      } catch {
        // empty
      } finally {
        setGettingTournament(false);
      }
    }
  };

  let discordNotStartedExplanation;
  if (discordStatus === DiscordStatus.NONE) {
    if (!discordApplicationId) {
      discordNotStartedExplanation = (
        <Alert severity="warning" style={{ flexGrow: 1 }}>
          Please set Discord application id
        </Alert>
      );
    } else if (!discordToken) {
      discordNotStartedExplanation = (
        <Alert severity="warning" style={{ flexGrow: 1 }}>
          Please set Discord token
        </Alert>
      );
    } else if (tournament.events.length === 0) {
      discordNotStartedExplanation = (
        <Alert severity="warning" style={{ flexGrow: 1 }}>
          Please select tournament and event
        </Alert>
      );
    } else if (!eventDescription) {
      discordNotStartedExplanation = (
        <Alert severity="warning" style={{ flexGrow: 1 }}>
          Please select event
        </Alert>
      );
    } else {
      discordNotStartedExplanation = (
        <Alert severity="warning" style={{ flexGrow: 1 }}>
          Selected event has no entrants with Discord connected
        </Alert>
      );
    }
  }

  const [searchSubstr, setSearchSubstr] = useState('');
  const [refreshingSets, setRefreshingSets] = useState(false);
  const [selectedSet, setSelectedSet] = useState<StartggSet>(EMPTY_STARTGG_SET);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);
  const [resetSelectedSet, setResetSelectedSet] =
    useState<StartggSet>(EMPTY_STARTGG_SET);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const mapStartggPhasePredicate = (phase: StartggPhase, pending: boolean) => {
    const prefix = pending ? 'pending' : 'completed';
    return phase.phaseGroups.map((phaseGroup) => {
      const groupSets: SetWithHighlight[] = [];
      phaseGroup.sets.forEach((set) => {
        if (!searchSubstr) {
          groupSets.push({ highlights: [], set });
        } else {
          const highlights: Highlight[] = [];
          let include = false;
          const includeStr = searchSubstr.toLowerCase();
          const start1 = set.entrant1Name.toLowerCase().indexOf(includeStr);
          if (start1 >= 0) {
            include = true;
            highlights[0] = { start: start1, end: start1 + includeStr.length };
          }
          const start2 = set.entrant2Name.toLowerCase().indexOf(includeStr);
          if (start2 >= 0) {
            include = true;
            highlights[1] = { start: start2, end: start2 + includeStr.length };
          }
          if (include) {
            groupSets.push({ highlights, set });
          }
        }
      });
      return (
        <Box key={`${prefix}${phase.name}${phaseGroup.name}`}>
          <Typography variant="h6">
            {phase.name}, {phaseGroup.name}
          </Typography>
          <Stack direction="row" gap="8px" flexWrap="wrap">
            {groupSets.map((setWithHighlight) => (
              <ListItemButton
                key={setWithHighlight.set.id}
                style={{ flexGrow: 0 }}
                onClick={() => {
                  if (pending) {
                    setSelectedSet(setWithHighlight.set);
                    setReportingDialogOpen(true);
                  } else {
                    setResetSelectedSet(setWithHighlight.set);
                    setResetDialogOpen(true);
                  }
                }}
              >
                <Stack>
                  <Typography variant="caption">
                    {setWithHighlight.set.fullRoundText}
                  </Typography>
                  {setWithHighlight.highlights[0] ? (
                    <Typography variant="body2">
                      <span>
                        {setWithHighlight.set.entrant1Name.substring(
                          0,
                          setWithHighlight.highlights[0].start,
                        )}
                      </span>
                      <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                        {setWithHighlight.set.entrant1Name.substring(
                          setWithHighlight.highlights[0].start,
                          setWithHighlight.highlights[0].end,
                        )}
                      </span>
                      <span>
                        {setWithHighlight.set.entrant1Name.substring(
                          setWithHighlight.highlights[0].end,
                        )}
                      </span>
                    </Typography>
                  ) : (
                    <Typography variant="body2">
                      {setWithHighlight.set.entrant1Name}
                    </Typography>
                  )}
                  {setWithHighlight.highlights[1] ? (
                    <Typography variant="body2">
                      <span>
                        {setWithHighlight.set.entrant2Name.substring(
                          0,
                          setWithHighlight.highlights[1].start,
                        )}
                      </span>
                      <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                        {setWithHighlight.set.entrant2Name.substring(
                          setWithHighlight.highlights[1].start,
                          setWithHighlight.highlights[1].end,
                        )}
                      </span>
                      <span>
                        {setWithHighlight.set.entrant2Name.substring(
                          setWithHighlight.highlights[1].end,
                        )}
                      </span>
                    </Typography>
                  ) : (
                    <Typography variant="body2">
                      {setWithHighlight.set.entrant2Name}
                    </Typography>
                  )}
                </Stack>
              </ListItemButton>
            ))}
          </Stack>
        </Box>
      );
    });
  };

  return (
    <>
      <Stack direction="row" alignItems="center" paddingBottom="8px">
        <InputBase
          disabled
          size="small"
          value={eventDescription || 'Select start.gg event...'}
          style={{ flexGrow: 1 }}
        />
        <Tooltip arrow title="Select start.gg event">
          <IconButton
            onClick={async () => {
              setTournamentDialogOpen(true);
            }}
          >
            <EventAvailable />
          </IconButton>
        </Tooltip>
        <Dialog
          open={tournamentDialogOpen}
          onClose={() => {
            setTournamentDialogOpen(false);
          }}
        >
          <DialogTitle>Set start.gg tournament and event</DialogTitle>
          <DialogContent>
            <form
              onSubmit={getStartggTournamentOnSubmit}
              style={{
                alignItems: 'center',
                display: 'flex',
                gap: '8px',
                marginTop: '8px',
              }}
            >
              <TextField
                autoFocus
                label="Tournament Slug"
                name="slug"
                placeholder={tournament.slug || 'super-smash-con-2023'}
                size="small"
                variant="outlined"
              />
              <Button
                disabled={gettingTournament}
                endIcon={
                  gettingTournament ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TaskAlt />
                  )
                }
                type="submit"
                variant="contained"
              >
                Set
              </Button>
            </form>
            <Stack>
              <DialogContentText>{tournament.name}</DialogContentText>
              {tournament.events.map((event) => (
                <ListItemButton
                  key={event.id}
                  onClick={async () => {
                    try {
                      setGettingTournament(true);
                      await window.electron.setEvent(event.id, event.name);
                      setEventDescription(`${tournament.name}, ${event.name}`);
                      setTournamentDialogOpen(false);
                    } finally {
                      setGettingTournament(false);
                    }
                  }}
                >
                  <ListItemText>{event.name}</ListItemText>
                </ListItemButton>
              ))}
            </Stack>
          </DialogContent>
        </Dialog>
      </Stack>
      <Stack direction="row" alignItems="center">
        {discordStatus === DiscordStatus.NONE && discordNotStartedExplanation}
        {discordStatus === DiscordStatus.BAD_TOKEN && (
          <Alert severity="error" style={{ flexGrow: 1 }}>
            Discord Bot Token Error!
          </Alert>
        )}
        {discordStatus === DiscordStatus.BAD_APPLICATION_ID && (
          <Alert severity="error" style={{ flexGrow: 1 }}>
            Discord Bot Application Id Error!
          </Alert>
        )}
        {discordStatus === DiscordStatus.STARTING && (
          <Alert severity="info" style={{ flexGrow: 1 }}>
            Discord Bot Starting...
          </Alert>
        )}
        {discordStatus === DiscordStatus.READY && (
          <Alert severity="success" style={{ flexGrow: 1 }}>
            Discord Bot Running
          </Alert>
        )}
      </Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="end"
        padding="8px 0"
      >
        <Settings
          discordApplicationId={discordApplicationId}
          setDiscordApplicationId={setDiscordApplicationId}
          discordToken={discordToken}
          setDiscordToken={setDiscordToken}
          startggApiKey={startggApiKey}
          setStartggApiKey={setStartggApiKey}
          appVersion={appVersion}
          latestAppVersion={latestAppVersion}
          gotSettings={gotSettings}
        />
        <TextField
          label="Search"
          onChange={(event) => {
            setSearchSubstr(event.target.value);
          }}
          size="small"
          value={searchSubstr}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Clear search">
                  <IconButton onClick={() => setSearchSubstr('')}>
                    <Clear />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
        {refreshingSets ? (
          <CircularProgress size="24px" style={{ margin: '9px' }} />
        ) : (
          <Tooltip
            arrow
            title={refreshingSets ? 'Refreshing sets...' : 'Refresh sets'}
          >
            <div>
              <IconButton
                disabled={!eventDescription}
                onClick={async () => {
                  try {
                    setRefreshingSets(true);
                    await window.electron.refreshSets();
                  } catch {
                    // empty
                  } finally {
                    setRefreshingSets(false);
                  }
                }}
              >
                <Refresh />
              </IconButton>
            </div>
          </Tooltip>
        )}
      </Stack>
      <Stack>
        {sets.pending.length > 0 && (
          <>
            <Typography variant="h5">Pending</Typography>
            <Stack>
              {sets.pending.map((phase) =>
                mapStartggPhasePredicate(phase, true),
              )}
            </Stack>
          </>
        )}
        {sets.completed.length > 0 && (
          <>
            <Typography variant="h5">Completed</Typography>
            <Stack>
              {sets.completed.map((phase) =>
                mapStartggPhasePredicate(phase, false),
              )}
            </Stack>
          </>
        )}
        <Report
          open={reportingDialogOpen}
          setOpen={setReportingDialogOpen}
          set={selectedSet}
        />
        <Reset
          open={resetDialogOpen}
          setOpen={setResetDialogOpen}
          set={resetSelectedSet}
        />
      </Stack>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
