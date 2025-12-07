import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  SvgIcon,
  Tab,
  Tabs,
  Tooltip,
} from '@mui/material';
import { GlobalHotKeys } from 'react-hotkeys';
import { Refresh } from '@mui/icons-material';
import Settings from './Settings';
import {
  AdminedTournament,
  DiscordStatus,
  DiscordUsername,
  StartggTournament,
  ConnectCode,
  RemoteStatus,
  RemoteState,
  DiscordServer,
} from '../common/types';
import DiscordUsernames from './DiscordUsernames';
import SearchBar from './SearchBar';
import TournamentEvent from './TournamentEvent';
import ConnectCodes from './ConnectCodes';
import Bracket from './Bracket';
import Remote from './Remote';
import { pushWindowEventListener, WindowEvent } from './windowEvent';
import Overlay from './Overlay';

enum TabValue {
  BRACKET = 'bracket',
  BROADCASTS = 'broadcasts',
  OVERLAY = 'overlay',
}

function TabPanel({
  children,
  value,
  index,
}: {
  children: ReactNode;
  index: TabValue;
  value: TabValue;
}) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
    >
      {value === index && children}
    </div>
  );
}

function StartggIcon() {
  // https://github.com/project-slippi/slippi-launcher/blob/313aa9e2bca44783db6ad740083d8e9a131b7742/src/renderer/styles/images/startgg_logo.svg
  return (
    <SvgIcon viewBox="0 0 1001 1001">
      <path
        style={{ fill: '#3F80FF' }}
        d="M32.2,500h187.5c17.3,0,31.2-14,31.2-31.2V281.2c0-17.3,14-31.2,31.2-31.2h687.5c17.3,0,31.2-14,31.2-31.2
		V31.2C1001,14,987,0,969.7,0H251C112.9,0,1,111.9,1,250v218.8C1,486,15,500,32.2,500z"
      />
      <path
        style={{ fill: '#FF2768' }}
        d="M969.8,500H782.3c-17.3,0-31.2,14-31.2,31.2v187.5c0,17.3-14,31.2-31.2,31.2H32.3C15,750,1,764,1,781.2v187.5
		C1,986,15,1000,32.3,1000H751c138.1,0,250-111.9,250-250V531.2C1001,514,987,500,969.8,500z"
      />
    </SvgIcon>
  );
}

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
  const [discordToken, setDiscordToken] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');

  // starting state
  const [connectCodes, setConnectCodes] = useState<ConnectCode[]>([]);
  const [discordStatus, setDiscordStatus] = useState(DiscordStatus.NONE);
  const [discordServers, setDiscordServers] = useState<DiscordServer[]>([]);
  const [discordServerId, setDiscordServerId] = useState('');
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
  const [remoteState, setRemoteState] = useState<RemoteState>({
    err: '',
    status: RemoteStatus.DISCONNECTED,
  });
  const [enableMST, setEnableMST] = useState(false);
  const [resourcesPath, setResourcesPath] = useState('');

  // tabs
  const [tabValue, setTabValue] = useState(TabValue.BROADCASTS);

  useEffect(() => {
    const inner = async () => {
      const discordConfigPromise = window.electron.getDiscordConfig();
      const discordServersPromise = window.electron.getDiscordServers();
      const startingStatePromise = window.electron.getStartingState();
      const enableMSTPromise = window.electron.getEnableMST();
      const resourcesPathPromise = window.electron.getResourcesPath();

      // req network
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const tournamentsPromise = window.electron.getTournaments();

      setDiscordApplicationId((await discordConfigPromise).applicationId);
      setDiscordToken((await discordConfigPromise).token);
      setDiscordServers(await discordServersPromise);
      setConnectCodes((await startingStatePromise).connectCodes);
      setDiscordStatus((await startingStatePromise).discordStatus);
      setDiscordServerId((await startingStatePromise).discordServerId);
      setDiscordUsernames((await startingStatePromise).discordUsernames);
      const tournamentName = (await startingStatePromise).tournament.name;
      const { eventName } = await startingStatePromise;
      if (tournamentName && eventName) {
        setEventDescription(`${tournamentName}, ${eventName}`);
      }
      setRemoteState((await startingStatePromise).remoteState);
      setTournament((await startingStatePromise).tournament);
      setEnableMST(await enableMSTPromise);
      setResourcesPath(await resourcesPathPromise);

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

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    window.electron.onDiscordStatus((event, newDiscordStatus) => {
      setDiscordStatus(newDiscordStatus);
    });
    window.electron.onDiscordServerId((event, newDiscordServerId) => {
      setDiscordServerId(newDiscordServerId);
    });
    window.electron.onDiscordServers((event, newDiscordServers) => {
      setDiscordServers(newDiscordServers);
    });
    window.electron.onGettingSets((event, getting) => {
      setRefreshing(getting);
    });
    window.electron.onRemoteState((event, newRemoteState) => {
      setRemoteState(newRemoteState);
    });
  });

  let discordNotStartedExplanation;
  if (discordStatus === DiscordStatus.NONE) {
    if (!discordApplicationId) {
      discordNotStartedExplanation = (
        <Alert severity="warning">Set Discord application id</Alert>
      );
    } else if (!discordToken) {
      discordNotStartedExplanation = (
        <Alert severity="warning">Set Discord token</Alert>
      );
    } else if (tournament.events.length === 0) {
      discordNotStartedExplanation = (
        <Alert severity="warning">Select tournament</Alert>
      );
    } else if (!eventDescription) {
      discordNotStartedExplanation = (
        <Alert severity="warning">Select event</Alert>
      );
    } else {
      discordNotStartedExplanation = (
        <Alert severity="warning">
          Event has no entrants with Discord connected
        </Alert>
      );
    }
  }

  const searchInputRef = useRef<HTMLInputElement>();
  const [searchSubstr, setSearchSubstr] = useState('');
  useEffect(() => {
    pushWindowEventListener(WindowEvent.CTRLF, () => {
      searchInputRef.current?.select();
    });
    pushWindowEventListener(WindowEvent.ESCAPE, () => {
      setSearchSubstr('');
    });
  }, []);

  const [refreshingDiscordServers, setRefreshingDiscordServers] =
    useState(false);

  return (
    <>
      <AppBar color="inherit" position="fixed">
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
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          height="57px"
        >
          <Stack direction="row" alignItems="center" gap="8px">
            {discordStatus === DiscordStatus.NONE &&
              discordNotStartedExplanation}
            {discordStatus === DiscordStatus.BAD_TOKEN && (
              <Alert severity="error">Discord bot token error!</Alert>
            )}
            {discordStatus === DiscordStatus.BAD_APPLICATION_ID && (
              <Alert severity="error">Discord bot application id error!</Alert>
            )}
            {discordStatus === DiscordStatus.STARTING && (
              <Alert severity="info">Discord bot starting...</Alert>
            )}
            {discordStatus === DiscordStatus.READY && (
              <Alert
                severity={discordServerId ? 'success' : 'warning'}
                style={{ paddingTop: 0, paddingRight: '8px', paddingBottom: 0 }}
                slotProps={{ icon: { style: { alignItems: 'center' } } }}
              >
                <FormControl>
                  <InputLabel id="discord-server-select-id" size="small">
                    {discordServerId
                      ? 'Discord Server'
                      : 'Select Discord Server...'}
                  </InputLabel>
                  <Select
                    disabled={refreshingDiscordServers}
                    label={
                      discordServerId
                        ? 'Discord Server'
                        : 'Select Discord Server...'
                    }
                    labelId="discord-server-select-id"
                    size="small"
                    style={{ width: '210px' }}
                    value={discordServerId}
                    onChange={async (event) => {
                      await window.electron.setDiscordServerId(
                        event.target.value,
                      );
                    }}
                  >
                    {discordServers.map((discordServer) => (
                      <MenuItem key={discordServer.id} value={discordServer.id}>
                        <Stack direction="row" alignItems="center">
                          {discordServer.iconUrl ? (
                            <img
                              src={discordServer.iconUrl}
                              alt={`${discordServer.name} icon`}
                              height="24px"
                              width="24px"
                              style={{
                                borderRadius: '6px',
                                marginLeft: '-8px',
                                marginRight: '8px',
                              }}
                            />
                          ) : (
                            <Stack width="24px" />
                          )}
                          {discordServer.name}
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip
                  placement="top"
                  title="Refresh"
                  style={{ marginLeft: '4px' }}
                >
                  <IconButton
                    disabled={refreshingDiscordServers}
                    onClick={async () => {
                      try {
                        setRefreshingDiscordServers(true);
                        setDiscordServers(
                          await window.electron.getDiscordServers(),
                        );
                      } finally {
                        setRefreshingDiscordServers(false);
                      }
                    }}
                  >
                    {refreshingDiscordServers ? (
                      <CircularProgress size="24px" />
                    ) : (
                      <Refresh />
                    )}
                  </IconButton>
                </Tooltip>
              </Alert>
            )}
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="end">
            <Settings
              showErrorDialog={showErrorDialog}
              discordApplicationId={discordApplicationId}
              setDiscordApplicationId={setDiscordApplicationId}
              discordToken={discordToken}
              setDiscordToken={setDiscordToken}
              setTournaments={setTournaments}
              latestAppVersion={latestAppVersion}
              gotSettings={gotSettings}
            />
            <ConnectCodes
              connectCodes={connectCodes}
              setConnectCodes={setConnectCodes}
              setDiscordUsernames={setDiscordUsernames}
              showErrorDialog={showErrorDialog}
            />
            <DiscordUsernames
              discordUsernames={discordUsernames}
              setConnectCodes={setConnectCodes}
              setDiscordUsernames={setDiscordUsernames}
              showErrorDialog={showErrorDialog}
            />
            <SearchBar
              inputRef={searchInputRef}
              searchSubstr={searchSubstr}
              setSearchSubstr={setSearchSubstr}
            />
            <Button
              disabled={refreshing || !eventDescription}
              startIcon={
                refreshing ? <CircularProgress size="20px" /> : <StartggIcon />
              }
              style={{ marginLeft: '4px' }}
              onClick={async () => {
                try {
                  setRefreshing(true);
                  await window.electron.refreshSets();
                } catch (e: any) {
                  const message = e instanceof Error ? e.message : e;
                  showErrorDialog([message]);
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
        <Tabs
          value={tabValue}
          onChange={(ev, newTabValue) => {
            setTabValue(newTabValue);
          }}
          aria-label="Tabs"
          variant="fullWidth"
        >
          <Tab
            label="Broadcasts"
            id="tab-broadcasts"
            aria-controls="tabpanel-broadcasts"
            value={TabValue.BROADCASTS}
          />
          <Tab
            label="Overlay"
            id="tab-overlay"
            aria-controls="tabpanel-overlay"
            value={TabValue.OVERLAY}
          />
          <Tab
            label="Bracket"
            id="tab-bracket"
            aria-controls="tabpanel-bracket"
            value={TabValue.BRACKET}
          />
        </Tabs>
      </AppBar>
      <div style={{ marginTop: '169px' }} />
      <TabPanel value={tabValue} index={TabValue.BROADCASTS}>
        <Remote
          overlayEnabled={enableMST && Boolean(resourcesPath)}
          remoteState={remoteState}
          searchSubstr={searchSubstr}
          showErrorDialog={showErrorDialog}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={TabValue.OVERLAY}>
        <Overlay
          enableMST={enableMST}
          resourcesPath={resourcesPath}
          gotSettings={gotSettings}
          sggTournamentName={tournament.name}
          setEnableMST={setEnableMST}
          setResourcesPath={setResourcesPath}
          showErrorDialog={showErrorDialog}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={TabValue.BRACKET}>
        <Bracket
          discordServerId={discordServerId}
          searchSubstr={searchSubstr}
        />
      </TabPanel>
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
      <GlobalHotKeys
        keyMap={{
          CTRLF: window.electron.isMac
            ? ['command+f', 'command+F']
            : ['ctrl+f', 'ctrl+F'],
          ESC: 'escape',
        }}
        handlers={{
          CTRLF: () => {
            window.dispatchEvent(new Event(WindowEvent.CTRLF));
          },
          ESC: () => {
            window.dispatchEvent(new Event(WindowEvent.ESCAPE));
          },
        }}
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
