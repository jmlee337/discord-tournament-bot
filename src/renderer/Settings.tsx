import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import { useMemo, useState } from 'react';

export default function Settings({
  startggApiKey,
  setStartggApiKey,
  appVersion,
  latestAppVersion,
  gotSettings,
}: {
  startggApiKey: string;
  setStartggApiKey: (startggApiKey: string) => void;
  appVersion: string;
  latestAppVersion: string;
  gotSettings: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const needUpdate = useMemo(() => {
    if (!appVersion || !latestAppVersion) {
      return false;
    }

    const versionStrArr = appVersion.split('.');
    const latestVersionStrArr = latestAppVersion.split('.');
    if (versionStrArr.length !== 3 || latestVersionStrArr.length !== 3) {
      return false;
    }

    const mapPred = (versionPartStr: string) =>
      Number.parseInt(versionPartStr, 10);
    const versionNumArr = versionStrArr.map(mapPred);
    const latestVersionNumArr = latestVersionStrArr.map(mapPred);
    const somePred = (versionPart: number) => Number.isNaN(versionPart);
    if (versionNumArr.some(somePred) || latestVersionNumArr.some(somePred)) {
      return false;
    }

    if (versionNumArr[0] < latestVersionNumArr[0]) {
      return true;
    }
    if (versionNumArr[1] < latestVersionNumArr[1]) {
      return true;
    }
    if (versionNumArr[2] < latestVersionNumArr[2]) {
      return true;
    }
    return false;
  }, [appVersion, latestAppVersion]);

  if (gotSettings && !hasAutoOpened && (!startggApiKey || needUpdate)) {
    setOpen(true);
    setHasAutoOpened(true);
  }

  return (
    <>
      <Tooltip title="Settings">
        <Fab
          onClick={() => setOpen(true)}
          size="small"
          style={{ position: 'absolute', bottom: 8, left: 8 }}
        >
          <SettingsIcon />
        </Fab>
      </Tooltip>
      <Dialog
        fullWidth
        open={open}
        onClose={async () => {
          await Promise.all([window.electron.setStartggKey(startggApiKey)]);
          setOpen(false);
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="24px"
        >
          <DialogTitle>Settings</DialogTitle>
          <Typography variant="caption">
            Nicolet&apos;s Discord Tournament Bot {appVersion}
          </Typography>
        </Stack>
        <DialogContent sx={{ pt: 0 }}>
          <DialogContentText>
            Get your start.gg API key by clicking “Create new token” in the
            <br />
            “Personal Access Tokens” tab of{' '}
            <a
              href="https://start.gg/admin/profile/developer"
              target="_blank"
              rel="noreferrer"
            >
              this page
            </a>
            . Keep it private!
          </DialogContentText>
          <Stack alignItems="center" direction="row" gap="8px">
            <TextField
              autoFocus
              fullWidth
              label="start.gg API key (Keep it private!)"
              onChange={(event) => {
                setStartggApiKey(event.target.value);
              }}
              size="small"
              type="password"
              value={startggApiKey}
              variant="standard"
            />
            <Button
              disabled={copied}
              endIcon={copied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copyToClipboard(startggApiKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 5000);
              }}
              variant="contained"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
