import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { JSX, useEffect, useState } from 'react';
import { Refresh } from '@mui/icons-material';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Settings from './Settings';
import {
  AdminedTournament,
  DiscordStatus,
  HIGHLIGHT_COLOR,
  Highlight,
  LinkedParticipant,
  Sets,
  StartggPhase,
  StartggSet,
  StartggTournament,
} from '../common/types';
import Report from './Report';
import Reset from './Reset';
import ParticipantLinks from './ParticipantLinks';
import SearchBar from './SearchBar';
import TournamentEvent from './TournamentEvent';

type SetWithHighlight = {
  highlights: Highlight[];
  set: StartggSet;
};

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
  const [errors, setErrors] = useState<string[]>([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const showErrorDialog = (messages: string[]) => {
    setErrors(messages);
    setErrorDialogOpen(true);
  };

  // settings
  const [gotSettings, setGotSettings] = useState(false);
  const [discordApplicationId, setDiscordApplicationId] = useState('');
  const [discordCommandDq, setDiscordCommandDq] = useState(true);
  const [discordToken, setDiscordToken] = useState('');
  const [startggApiKey, setStartggApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  // starting state
  const [discordStatus, setDiscordStatus] = useState(DiscordStatus.NONE);
  const [eventDescription, setEventDescription] = useState('');
  const [linkedParticipants, setLinkedParticipants] = useState<
    LinkedParticipant[]
  >([]);
  const [sets, setSets] = useState<Sets>({ pending: [], completed: [] });
  const [tournament, setTournament] = useState<StartggTournament>({
    name: '',
    slug: '',
    events: [],
  });
  const [tournaments, setTournaments] = useState<AdminedTournament[]>([]);
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const discordCommandDqPromise = window.electron.getDiscordCommandDq();
      const discordConfigPromise = window.electron.getDiscordConfig();
      const startggApiKeyPromise = window.electron.getStartggApiKey();
      const startingStatePromise = window.electron.getStartingState();

      // req network
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const tournamentsPromise = window.electron.getTournaments();

      setAppVersion(await appVersionPromise);
      setDiscordApplicationId((await discordConfigPromise).applicationId);
      setDiscordCommandDq(await discordCommandDqPromise);
      setDiscordToken((await discordConfigPromise).token);
      setStartggApiKey(await startggApiKeyPromise);
      setDiscordStatus((await startingStatePromise).discordStatus);
      const tournamentName = (await startingStatePromise).tournament.name;
      const { eventName } = await startingStatePromise;
      if (tournamentName && eventName) {
        setEventDescription(`${tournamentName}, ${eventName}`);
      }
      setLinkedParticipants((await startingStatePromise).linkedParticipants);
      setSets((await startingStatePromise).sets);
      setTournament((await startingStatePromise).tournament);

      // req network
      const messages: string[] = [];
      try {
        setLatestAppVersion(await latestAppVersionPromise);
      } catch {
        messages.push('Unable to check for updates.');
      }
      try {
        setTournaments(await tournamentsPromise);
      } catch {
        messages.push('Unable to fetch admined tournaments.');
      }
      if (messages.length > 0) {
        messages.push('Are you connected to the internet?');
        showErrorDialog(messages);
      }

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

  const [linkedParticipantsOpen, setLinkedParticipantsOpen] = useState(false);
  const [searchSubstr, setSearchSubstr] = useState('');
  const [refreshingSets, setRefreshingSets] = useState(false);
  const [selectedSet, setSelectedSet] = useState<StartggSet>(EMPTY_STARTGG_SET);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);
  const [resetSelectedSet, setResetSelectedSet] =
    useState<StartggSet>(EMPTY_STARTGG_SET);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const mapStartggPhasePredicate = (phase: StartggPhase, pending: boolean) => {
    const prefix = pending ? 'pending' : 'completed';
    const phaseGroups: JSX.Element[] = [];
    phase.phaseGroups.forEach((phaseGroup) => {
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
      if (groupSets.length > 0) {
        phaseGroups.push(
          <Box key={`${prefix}${phase.name}${phaseGroup.name}`}>
            <Typography variant="h6">
              {phase.name}, {phaseGroup.name}
            </Typography>
            <Stack direction="row" gap="8px" flexWrap="wrap">
              {groupSets.map((setWithHighlight) => (
                <ListItemButton
                  key={`${prefix}${setWithHighlight.set.id}`}
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
          </Box>,
        );
      }
    });
    return phaseGroups;
  };
  const pendingPhases: JSX.Element[] = [];
  sets.pending.forEach((phase) => {
    pendingPhases.push(...mapStartggPhasePredicate(phase, true));
  });
  const completedPhases: JSX.Element[] = [];
  sets.completed.forEach((phase) => {
    completedPhases.push(...mapStartggPhasePredicate(phase, false));
  });

  return (
    <>
      <TournamentEvent
        tournaments={tournaments}
        tournament={tournament}
        setTournament={setTournament}
        eventDescription={eventDescription}
        setEventDescription={setEventDescription}
        setLinkedParticipants={setLinkedParticipants}
        showErrorDialog={showErrorDialog}
      />
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
      <Stack direction="row" alignItems="center" justifyContent="end">
        <Settings
          discordApplicationId={discordApplicationId}
          setDiscordApplicationId={setDiscordApplicationId}
          discordCommandDq={discordCommandDq}
          setDiscordCommandDq={setDiscordCommandDq}
          discordToken={discordToken}
          setDiscordToken={setDiscordToken}
          startggApiKey={startggApiKey}
          setStartggApiKey={setStartggApiKey}
          appVersion={appVersion}
          latestAppVersion={latestAppVersion}
          gotSettings={gotSettings}
        />
        <ParticipantLinks
          open={linkedParticipantsOpen}
          setOpen={setLinkedParticipantsOpen}
          linkedParticipants={linkedParticipants}
        />
        <SearchBar
          searchSubstr={searchSubstr}
          setSearchSubstr={setSearchSubstr}
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
                  } catch (e: any) {
                    const message = e instanceof Error ? e.message : e;
                    showErrorDialog([message]);
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
        {pendingPhases.length > 0 && (
          <>
            <Typography variant="h5">Pending</Typography>
            <Stack>{pendingPhases}</Stack>
          </>
        )}
        {completedPhases.length > 0 && (
          <>
            <Typography variant="h5">Completed</Typography>
            <Stack>{completedPhases}</Stack>
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
      <Dialog
        open={errorDialogOpen}
        onClose={() => {
          setErrors([]);
          setErrorDialogOpen(false);
        }}
      >
        <DialogTitle>Error!</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You may want to copy or screenshot this error:
          </DialogContentText>
          <Alert severity="error">{errors.join(' ')}</Alert>
        </DialogContent>
      </Dialog>
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
