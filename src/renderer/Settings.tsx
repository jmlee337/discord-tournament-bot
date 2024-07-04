import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import { ChangeEvent, useMemo, useState } from 'react';

function LabeledCheckbox({
  checked,
  disabled,
  label,
  labelPlacement,
  set,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  set: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            set(event.target.checked);
          }}
        />
      }
      disabled={disabled}
      disableTypography
      label={label}
      labelPlacement={labelPlacement}
      sx={{ typography: 'caption' }}
    />
  );
}

LabeledCheckbox.defaultProps = {
  disabled: false,
  labelPlacement: 'end',
};

export default function Settings({
  discordApplicationId,
  setDiscordApplicationId,
  discordCommandDq,
  setDiscordCommandDq,
  discordToken,
  setDiscordToken,
  startggApiKey,
  setStartggApiKey,
  appVersion,
  latestAppVersion,
  gotSettings,
}: {
  discordApplicationId: string;
  setDiscordApplicationId: (discordApplicationId: string) => void;
  discordCommandDq: boolean;
  setDiscordCommandDq: (discordCommandDq: boolean) => void;
  discordToken: string;
  setDiscordToken: (discordToken: string) => void;
  startggApiKey: string;
  setStartggApiKey: (startggApiKey: string) => void;
  appVersion: string;
  latestAppVersion: string;
  gotSettings: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [discordTokenCopied, setDiscordTokenCopied] = useState(false);
  const [startggApiKeyCopied, setStartggApiKeyCopied] = useState(false);
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

  if (
    gotSettings &&
    !hasAutoOpened &&
    (!discordToken || !startggApiKey || needUpdate)
  ) {
    setOpen(true);
    setHasAutoOpened(true);
  }

  return (
    <>
      <Tooltip title="Settings">
        <IconButton onClick={() => setOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <Dialog
        fullWidth
        open={open}
        onClose={async () => {
          await Promise.all([
            window.electron.setDiscordConfig({
              applicationId: discordApplicationId,
              token: discordToken,
            }),
            window.electron.setStartggApiKey(startggApiKey),
          ]);
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
            Get your bot&apos;s application id from the “General Information”
            settings tab in the appropriate app found on{' '}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
            >
              this page
            </a>
            .
          </DialogContentText>
          <Stack alignItems="center" direction="row" gap="8px">
            <TextField
              autoFocus
              fullWidth
              label="Discord application id"
              onChange={(event) => {
                setDiscordApplicationId(event.target.value);
              }}
              size="small"
              value={discordApplicationId}
              variant="standard"
            />
          </Stack>
          <DialogContentText>
            Get your bot&apos;s token by clicking “Reset Token” on the “Bot”
            settings tab in the appropriate app found on{' '}
            <a
              href="https://discord.com/developers/applications"
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
              label="Discord token (Keep it private!)"
              onChange={(event) => {
                setDiscordToken(event.target.value);
              }}
              size="small"
              type="password"
              value={discordToken}
              variant="standard"
            />
            <Button
              disabled={discordTokenCopied}
              endIcon={discordTokenCopied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copyToClipboard(discordToken);
                setDiscordTokenCopied(true);
                setTimeout(() => setDiscordTokenCopied(false), 5000);
              }}
              variant="contained"
            >
              {discordTokenCopied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <DialogContentText>
            Get your start.gg token by clicking “Create new token” in the
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
              label="start.gg token (Keep it private!)"
              onChange={(event) => {
                setStartggApiKey(event.target.value);
              }}
              size="small"
              type="password"
              value={startggApiKey}
              variant="standard"
            />
            <Button
              disabled={startggApiKeyCopied}
              endIcon={startggApiKeyCopied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copyToClipboard(startggApiKey);
                setStartggApiKeyCopied(true);
                setTimeout(() => setStartggApiKeyCopied(false), 5000);
              }}
              variant="contained"
            >
              {startggApiKeyCopied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <LabeledCheckbox
            checked={discordCommandDq}
            label="Enable /dq command"
            set={async (checked) => {
              await window.electron.setDiscordCommandDq(checked);
              setDiscordCommandDq(checked);
            }}
          />
          {needUpdate && (
            <Alert severity="warning">
              Update available!{' '}
              <a
                href="https://github.com/jmlee337/discord-tournament-bot/releases/latest"
                target="_blank"
                rel="noreferrer"
              >
                Version {latestAppVersion}
              </a>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
