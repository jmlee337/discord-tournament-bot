import { useEffect, useState } from 'react';
import {
  CircularProgress,
  IconButton,
  InputBase,
  Stack,
  Switch,
  Tooltip,
} from '@mui/material';
import { DisplaySettings } from '@mui/icons-material';
import { EMPTY_SCOREBOARD_INFO } from '../common/mst';

export default function Overlay({
  showErrorDialog,
}: {
  showErrorDialog: (errors: string[]) => void;
}) {
  const [enableMST, setEnableMST] = useState(false);
  const [resourcesPath, setResourcesPath] = useState('');
  const [scoreboardInfo, setScoreboardInfo] = useState(EMPTY_SCOREBOARD_INFO);

  useEffect(() => {
    (async () => {
      const enableMSTPromise = window.electron.getEnableMST();
      const resourcesPathPromise = window.electron.getResourcesPath();
      const initEnableMST = await enableMSTPromise;
      const initResourcesPath = await resourcesPathPromise;
      setEnableMST(initEnableMST);
      setResourcesPath(initResourcesPath);

      if (initEnableMST && initResourcesPath) {
        setScoreboardInfo(await window.electron.getScoreboardInfo());
      }
    })();
  }, []);

  useEffect(() => {
    window.electron.onScoreboardInfo((event, newScoreboardInfo) => {
      setScoreboardInfo(newScoreboardInfo);
    });
  }, []);

  const [choosingResourcesPath, setChoosingResourcesPath] = useState(false);

  return (
    <Stack>
      <Stack direction="row" alignItems="center">
        <InputBase
          disabled
          size="small"
          value={resourcesPath || 'Set MST/MGS Resources Folder...'}
          style={{ flexGrow: 1 }}
        />
        <Tooltip
          title={
            enableMST
              ? 'Set MST/MGS Resources Folder'
              : 'MST/MGS Overlay Disabled'
          }
        >
          <div>
            <IconButton
              disabled={!enableMST || choosingResourcesPath}
              onClick={async () => {
                try {
                  setChoosingResourcesPath(true);
                  setResourcesPath(await window.electron.chooseResourcesPath());
                } catch (e: any) {
                  showErrorDialog([e instanceof Error ? e.message : e]);
                } finally {
                  setChoosingResourcesPath(false);
                }
              }}
            >
              {choosingResourcesPath ? (
                <CircularProgress size="24px" />
              ) : (
                <DisplaySettings />
              )}
            </IconButton>
          </div>
        </Tooltip>
        <Tooltip title="Enable MST/MGS Overlay">
          <Switch
            checked={enableMST}
            onChange={async (event) => {
              const newEnableMST = event.target.checked;
              await window.electron.setEnableMST(newEnableMST);
              setEnableMST(newEnableMST);
            }}
          />
        </Tooltip>
      </Stack>
      <InputBase
        disabled
        multiline
        value={
          enableMST && resourcesPath
            ? JSON.stringify(scoreboardInfo, undefined, 2)
            : ''
        }
      />
    </Stack>
  );
}
