import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { useEffect, useState } from 'react';
import { Refresh } from '@mui/icons-material';
import {
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import Settings from './Settings';
import {
  AdminedTournament,
  DiscordStatus,
  DiscordUsername,
  StartggTournament,
  ConnectCode,
} from '../common/types';
import DiscordUsernames from './DiscordUsernames';
import SearchBar from './SearchBar';
import TournamentEvent from './TournamentEvent';
import ConnectCodes from './ConnectCodes';
import Bracket from './Bracket';

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
  const [connectCodes, setConnectCodes] = useState<ConnectCode[]>([]);
  const [discordStatus, setDiscordStatus] = useState(DiscordStatus.NONE);
  const [eventDescription, setEventDescription] = useState('');
  const [discordUsernames, setDiscordUsernames] = useState<DiscordUsername[]>(
    [],
  );
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
      setDiscordUsernames((await startingStatePromise).discordUsernames);
      setTournament((await startingStatePromise).tournament);

      // req network
      const messages: string[] = [];
      try {
        setLatestAppVersion(await latestAppVersionPromise);
      } catch (e: any) {
        messages.push(
          `Unable to check for updates: ${e instanceof Error ? e.message : e}`,
        );
      }
      try {
        setTournaments(await tournamentsPromise);
      } catch (e: any) {
        messages.push(
          `Unable to fetch admined tournaments: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
      if (messages.length > 0) {
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

  const [searchSubstr, setSearchSubstr] = useState('');
  const [refreshingSets, setRefreshingSets] = useState(false);

  return (
    <>
      <TournamentEvent
        tournaments={tournaments}
        tournament={tournament}
        setTournament={setTournament}
        eventDescription={eventDescription}
        setEventDescription={setEventDescription}
        setConnectCodes={setConnectCodes}
        setDiscordUsernames={setDiscordUsernames}
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
          showErrorDialog={showErrorDialog}
          discordApplicationId={discordApplicationId}
          setDiscordApplicationId={setDiscordApplicationId}
          discordCommandDq={discordCommandDq}
          setDiscordCommandDq={setDiscordCommandDq}
          discordToken={discordToken}
          setDiscordToken={setDiscordToken}
          startggApiKey={startggApiKey}
          setStartggApiKey={setStartggApiKey}
          setTournaments={setTournaments}
          appVersion={appVersion}
          latestAppVersion={latestAppVersion}
          gotSettings={gotSettings}
        />
        <ConnectCodes connectCodes={connectCodes} />
        <DiscordUsernames discordUsernames={discordUsernames} />
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
      <Bracket searchSubstr={searchSubstr} />
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
