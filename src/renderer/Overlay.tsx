import { useState } from 'react';
import {
  CircularProgress,
  IconButton,
  InputBase,
  Stack,
  Switch,
  Tooltip,
} from '@mui/material';
import { DisplaySettings } from '@mui/icons-material';
import { MSTScoreboardInfo } from '../common/mst';

export default function Overlay({
  enableMST,
  resourcesPath,
  scoreboardInfo,
  setEnableMST,
  setResourcesPath,
  showErrorDialog,
}: {
  enableMST: boolean;
  resourcesPath: string;
  scoreboardInfo: MSTScoreboardInfo;
  setEnableMST: (newEnableMST: boolean) => void;
  setResourcesPath: (newResourcesPath: string) => void;
  showErrorDialog: (errors: string[]) => void;
}) {
  const [choosingResourcesPath, setChoosingResourcesPath] = useState(false);

  return (
    <Stack>
      <Stack direction="row" alignItems="center">
        <InputBase
          disabled
          size="small"
          value={
            resourcesPath ||
            'Set Melee Stream Tool/Melee Ghost Streamer Resources folder...'
          }
          style={{ flexGrow: 1 }}
        />
        <Tooltip
          title={
            enableMST
              ? 'Set Melee Stream Tool/Melee Ghost Streamer Resources folder'
              : 'Melee Stream Tool/Melee Ghost Streamer overlay disabled'
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
        <Tooltip
          title={
            enableMST
              ? 'Melee Stream Tool/Melee Ghost Streamer overlay enabled'
              : 'Melee Stream Tool/Melee Ghost Streamer overlay disabled'
          }
        >
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
