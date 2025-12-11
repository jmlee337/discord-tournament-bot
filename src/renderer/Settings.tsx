import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import { lt, valid } from 'semver';
import { AdminedTournament } from '../common/types';
import LabeledCheckbox from './LabeledCheckbox';

export default function Settings({
  showErrorDialog,
  discordApplicationId,
  setDiscordApplicationId,
  discordToken,
  setDiscordToken,
  setTournaments,
  latestAppVersion,
  gotSettings,
}: {
  showErrorDialog: (errors: string[]) => void;
  discordApplicationId: string;
  setDiscordApplicationId: (discordApplicationId: string) => void;
  discordToken: string;
  setDiscordToken: (discordToken: string) => void;
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
  const needUpdate = useMemo(
    () =>
      valid(appVersion) &&
      valid(latestAppVersion) &&
      lt(appVersion, latestAppVersion),
    [appVersion, latestAppVersion],
  );

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
            Nicolet&apos;s Netplay Tournament Suite {appVersion}
          </Typography>
        </Stack>
        <DialogContent sx={{ pt: 0 }}>
          <DialogContentText>
            Get your start.gg token by clicking “Create new token” in the
            “Personal Access Tokens” tab of{' '}
            <Link
              href="https://start.gg/admin/profile/developer"
              target="_blank"
              rel="noreferrer"
            >
              this page
            </Link>
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
              style={{ width: '94px' }}
              variant="contained"
            >
              {startggApiKeyCopied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <DialogContentText>
            Get your bot&apos;s application id from the “General Information”
            settings tab in the appropriate app found on{' '}
            <Link
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
            >
              this page
            </Link>
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
            <Link
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
            >
              this page
            </Link>
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
              style={{ width: '94px' }}
              variant="contained"
            >
              {discordTokenCopied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          {discordApplicationId && discordToken && (
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
          )}
          {needUpdate && (
            <Alert severity="warning">
              Update available!{' '}
              <Link
                href="https://github.com/jmlee337/discord-tournament-bot/releases/latest"
                target="_blank"
                rel="noreferrer"
              >
                Version {latestAppVersion}
              </Link>
            </Alert>
          )}
          <Divider sx={{ marginTop: '4px', typography: 'subtitle2' }}>
            End User License Agreement
          </Divider>
          <Typography variant="caption">
            By using Nicolet&apos;s Netplay Tournament Suite, you affirm your
            support for trans rights. This End User License Agreement must be
            included in all copies or substantial portions of Nicolet&apos;s
            Netplay Tournament Suite.
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
}
