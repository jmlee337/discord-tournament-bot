import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { FormEvent, useEffect, useState } from 'react';
import { EventAvailable, Refresh, TaskAlt } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputBase,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Settings from './Settings';
import { DiscordStatus, StartggSet, StartggTournament } from '../common/types';
import Report from './Report';

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
  const [sets, setSets] = useState<StartggSet[]>([]);
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
    }
  }

  const [refreshingSets, setRefreshingSets] = useState(false);
  const [selectedSet, setSelectedSet] = useState<StartggSet>({
    id: 0,
    entrant1Id: 0,
    entrant1Name: '',
    entrant2Id: 0,
    entrant2Name: '',
    fullRoundText: '',
  });
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);

  return (
    <>
      <Stack direction="row" alignItems="center">
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
      <Stack direction="row" gap="8px" flexWrap="wrap">
        {sets.map((set) => (
          <ListItemButton
            key={set.id}
            style={{ flexGrow: 0 }}
            onClick={() => {
              setSelectedSet(set);
              setReportingDialogOpen(true);
            }}
          >
            <Stack>
              <Typography variant="caption">{set.fullRoundText}</Typography>
              <Typography variant="body2">{set.entrant1Name}</Typography>
              <Typography variant="body2">{set.entrant2Name}</Typography>
            </Stack>
          </ListItemButton>
        ))}
        <Report
          open={reportingDialogOpen}
          setOpen={setReportingDialogOpen}
          set={selectedSet}
        />
      </Stack>
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
