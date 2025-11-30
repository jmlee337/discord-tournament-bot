import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { AdminedTournament } from '../common/types';

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
  showErrorDialog,
  discordApplicationId,
  setDiscordApplicationId,
  discordToken,
  setDiscordToken,
  enableMST,
  setEnableMST,
  enableSkinColor,
  setEnableSkinColor,
  setTournaments,
  latestAppVersion,
  gotSettings,
}: {
  showErrorDialog: (errors: string[]) => void;
  discordApplicationId: string;
  setDiscordApplicationId: (discordApplicationId: string) => void;
  discordToken: string;
  setDiscordToken: (discordToken: string) => void;
  enableMST: boolean;
  setEnableMST: (enableMST: boolean) => void;
  enableSkinColor: boolean;
  setEnableSkinColor: (enableSkinColor: boolean) => void;
  setTournaments: (tournaments: AdminedTournament[]) => void;
  latestAppVersion: string;
  gotSettings: boolean;
}) {
  const [discordCommandDq, setDiscordCommandDq] = useState(false);
  const [discordCommandReport, setDiscordCommandReport] = useState(false);
  const [discordCommandReset, setDiscordCommandReset] = useState(false);
  const [startggApiKey, setStartggApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [gotSettingsInternal, setGotSettingsInternal] = useState(false);

  const [open, setOpen] = useState(false);
  const [shouldGetTournaments, setShouldGetTournaments] = useState(false);
  const [discordTokenCopied, setDiscordTokenCopied] = useState(false);
  const [startggApiKeyCopied, setStartggApiKeyCopied] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    (async () => {
      const discordCommandDqPromise = window.electron.getDiscordCommandDq();
      const discordCommandReportPromise =
        window.electron.getDiscordCommandReport();
      const discordCommandResetPromise =
        window.electron.getDiscordCommandReset();
      const startggApiKeyPromise = window.electron.getStartggApiKey();
      const appVersionPromise = window.electron.getVersion();

      setDiscordCommandDq(await discordCommandDqPromise);
      setDiscordCommandReport(await discordCommandReportPromise);
      setDiscordCommandReset(await discordCommandResetPromise);
      setStartggApiKey(await startggApiKeyPromise);
      setAppVersion(await appVersionPromise);
      setGotSettingsInternal(true);
    })();
  }, []);
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

  useEffect(() => {
    if (
      gotSettings &&
      gotSettingsInternal &&
      !hasAutoOpened &&
      (!discordToken || !startggApiKey || needUpdate)
    ) {
      setOpen(true);
      setHasAutoOpened(true);
    }
  }, [
    gotSettings,
    gotSettingsInternal,
    hasAutoOpened,
    discordToken,
    startggApiKey,
    needUpdate,
  ]);

  return (
    <>
      <Tooltip placement="top" title="Settings">
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
          if (shouldGetTournaments) {
            try {
              setTournaments(await window.electron.getTournaments());
            } catch (e: any) {
              showErrorDialog([e instanceof Error ? e.message : e]);
              return;
            } finally {
              setShouldGetTournaments(false);
            }
          }
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
                setShouldGetTournaments(true);
              }}
              size="small"
              style={{ marginTop: '4px', marginBottom: '8px' }}
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
          <Divider style={{ margin: '8px -24px' }}>
            <Typography variant="button">Discord</Typography>
          </Divider>
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
              style={{ marginTop: '4px', marginBottom: '8px' }}
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
              style={{ marginTop: '4px', marginBottom: '8px' }}
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
          <Stack>
            <LabeledCheckbox
              checked={discordCommandDq}
              label="Enable Discord /dq command"
              set={async (checked) => {
                await window.electron.setDiscordCommandDq(checked);
                setDiscordCommandDq(checked);
              }}
            />
            <LabeledCheckbox
              checked={discordCommandReport}
              label="Enable Discord /reportset command"
              set={async (checked) => {
                await window.electron.setDiscordCommandReport(checked);
                setDiscordCommandReport(checked);
              }}
            />
            <LabeledCheckbox
              checked={discordCommandReset}
              label="Enable Discord /resetset command"
              set={async (checked) => {
                await window.electron.setDiscordCommandReset(checked);
                setDiscordCommandReset(checked);
              }}
            />
          </Stack>
          <Divider style={{ marginLeft: '-24px', marginRight: '-24px' }}>
            <Typography variant="button">Overlay</Typography>
          </Divider>
          <Stack>
            <LabeledCheckbox
              checked={enableMST}
              label="Enable overlay"
              set={async (checked) => {
                await window.electron.setEnableMST(checked);
                setEnableMST(checked);
              }}
            />
            <LabeledCheckbox
              checked={enableSkinColor}
              disabled={!enableMST}
              label="Enable character colors"
              set={async (checked) => {
                await window.electron.setEnableSkinColor(checked);
                setEnableSkinColor(checked);
              }}
            />
          </Stack>
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
