import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { useEffect, useState } from 'react';
import Settings from './Settings';

function Hello() {
  // settings
  const [gotSettings, setGotSettings] = useState(false);
  const [startggApiKey, setStartggApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const startggKeyPromise = window.electron.getStartggKey();
      setAppVersion(await appVersionPromise);
      setLatestAppVersion(await latestAppVersionPromise);
      setStartggApiKey(await startggKeyPromise);
      setGotSettings(true);
    };
    inner();
  }, []);

  return (
    <Settings
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
