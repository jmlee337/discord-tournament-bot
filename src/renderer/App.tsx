import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { FormEvent, useEffect, useState } from 'react';
import { Description, EventAvailable } from '@mui/icons-material';
import {
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
} from '@mui/material';
import Settings from './Settings';
import { DiscordStatus, StartggTournament } from '../common/types';

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
      setDiscordStatus((await startingStatePromise).discordStatus);
      setStartggApiKey(await startggApiKeyPromise);
      setTournament((await startingStatePromise).tournament);

      const tournamentName = (await startingStatePromise).tournament.name;
      const { eventName } = await startingStatePromise;
      if (tournamentName && eventName) {
        setEventDescription(`${tournamentName}, ${eventName}`);
      }
      setGotSettings(true);
    };
    inner();
  }, []);

  useEffect(() => {
    window.electron.onDiscordStatus((event, newDiscordStatus) => {
      setDiscordStatus(newDiscordStatus);
    });
  });

  const [csvPath, setCsvPath] = useState('');
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
      } catch (e: any) {
        /** TODO */
      } finally {
        setGettingTournament(false);
      }
    }
  };

  return (
    <>
      <Stack direction="row">
        <InputBase
          disabled
          size="small"
          value={csvPath || 'Load .csv...'}
          style={{ flexGrow: 1 }}
        />
        <Tooltip arrow title="Load .csv">
          <IconButton
            onClick={async () => {
              const newCsvPath = await window.electron.loadCsv();
              if (newCsvPath) {
                setCsvPath(newCsvPath);
              }
            }}
          >
            <Description />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row">
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
              {gettingTournament ? (
                <CircularProgress size="24px" style={{ marginLeft: '8px' }} />
              ) : (
                <Button type="submit">Set!</Button>
              )}
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
      {discordStatus === DiscordStatus.STARTING && 'Discord Bot Starting...'}
      {discordStatus === DiscordStatus.BAD_TOKEN && 'Discord Bot Token Error!'}
      {discordStatus === DiscordStatus.BAD_APPLICATION_ID &&
        'Discord Bot Application Id Error!'}
      {discordStatus === DiscordStatus.READY && 'Discord Bot Ready'}
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
