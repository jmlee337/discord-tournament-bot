import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { useEffect, useState } from 'react';
import { Description } from '@mui/icons-material';
import { IconButton, InputBase, Stack, Tooltip } from '@mui/material';
import Settings from './Settings';
import { DiscordStatus } from '../common/types';

function Hello() {
  // settings
  const [gotSettings, setGotSettings] = useState(false);
  const [discordApplicationId, setDiscordApplicationId] = useState('');
  const [discordToken, setDiscordToken] = useState('');
  const [startggApiKey, setStartggApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const discordConfigPromise = window.electron.getDiscordConfig();
      const startggApiKeyPromise = window.electron.getStartggApiKey();
      setAppVersion(await appVersionPromise);
      setLatestAppVersion(await latestAppVersionPromise);
      setDiscordApplicationId((await discordConfigPromise).applicationId);
      setDiscordToken((await discordConfigPromise).token);
      setStartggApiKey(await startggApiKeyPromise);
      setGotSettings(true);
    };
    inner();
  }, []);

  const [discordStatus, setDiscordStatus] = useState(DiscordStatus.NONE);
  useEffect(() => {
    window.electron.onDiscordStatus((event, newDiscordStatus) => {
      setDiscordStatus(newDiscordStatus);
    });
  });

  const [csvPath, setCsvPath] = useState('');

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
