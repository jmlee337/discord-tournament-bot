import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { useEffect, useState } from 'react';
import Settings from './Settings';

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

  return (
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
