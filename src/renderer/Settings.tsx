import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputBase,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ContentCopy,
  Settings as SettingsIcon,
  TextSnippet,
} from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import { lt, valid } from 'semver';
import { AdminedTournament, OverlayId } from '../common/types';
import LabeledCheckbox from './LabeledCheckbox';

export default function Settings({
  showErrorDialog,
  discordApplicationId,
  setDiscordApplicationId,
  discordToken,
  setDiscordToken,
  enableSkinColor,
  setEnableSkinColor,
  numMSTs,
  setNumMSTs,
  setTournaments,
  latestAppVersion,
  gotSettings,
}: {
  showErrorDialog: (errors: string[]) => void;
  discordApplicationId: string;
  setDiscordApplicationId: (discordApplicationId: string) => void;
  discordToken: string;
  setDiscordToken: (discordToken: string) => void;
  enableSkinColor: boolean;
  setEnableSkinColor: (enableSkinColor: boolean) => void;
  numMSTs: 0 | OverlayId;
  setNumMSTs: (numMSTs: 0 | OverlayId) => void;
  setTournaments: (tournaments: AdminedTournament[]) => void;
  latestAppVersion: string;
  gotSettings: boolean;
}) {
  const [discordCommandDq, setDiscordCommandDq] = useState(false);
  const [discordCommandReport, setDiscordCommandReport] = useState(false);
  const [discordCommandReset, setDiscordCommandReset] = useState(false);
  const [enableSggSponsors, setEnableSggSponsors] = useState(false);
  const [simpleTextPathA, setSimpleTextPathA] = useState('');
  const [simpleTextPathB, setSimpleTextPathB] = useState('');
  const [simpleTextPathC, setSimpleTextPathC] = useState('');
  const [simpleTextPathD, setSimpleTextPathD] = useState('');
  const [startggApiKey, setStartggApiKey] = useState('');
  const [updateAutomatically, setUpdateAutomatically] = useState(false);
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
      const enableSggSponsorsPromise = window.electron.getEnableSggSponsors();
      const simpleTextPathAPromise = window.electron.getSimpleTextPathA();
      const simpleTextPathBPromise = window.electron.getSimpleTextPathB();
      const simpleTextPathCPromise = window.electron.getSimpleTextPathC();
      const simpleTextPathDPromise = window.electron.getSimpleTextPathD();
      const startggApiKeyPromise = window.electron.getStartggApiKey();
      const updateAutomaticallyPromise =
        window.electron.getUpdateAutomatically();
      const appVersionPromise = window.electron.getVersion();

      setDiscordCommandDq(await discordCommandDqPromise);
      setDiscordCommandReport(await discordCommandReportPromise);
      setDiscordCommandReset(await discordCommandResetPromise);
      setEnableSggSponsors(await enableSggSponsorsPromise);
      setSimpleTextPathA(await simpleTextPathAPromise);
      setSimpleTextPathB(await simpleTextPathBPromise);
      setSimpleTextPathC(await simpleTextPathCPromise);
      setSimpleTextPathD(await simpleTextPathDPromise);
      setStartggApiKey(await startggApiKeyPromise);
      setUpdateAutomatically(await updateAutomaticallyPromise);
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

  const [choosingSimpleTextPathA, setChoosingSimpleTextPathA] = useState(false);
  const [choosingSimpleTextPathB, setChoosingSimpleTextPathB] = useState(false);
  const [choosingSimpleTextPathC, setChoosingSimpleTextPathC] = useState(false);
  const [choosingSimpleTextPathD, setChoosingSimpleTextPathD] = useState(false);

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
                labelPlacement="start"
                set={async (checked) => {
                  await window.electron.setDiscordCommandDq(checked);
                  setDiscordCommandDq(checked);
                }}
              />
              <LabeledCheckbox
                checked={discordCommandReport}
                label="Enable Discord /reportset command"
                labelPlacement="start"
                set={async (checked) => {
                  await window.electron.setDiscordCommandReport(checked);
                  setDiscordCommandReport(checked);
                }}
              />
              <LabeledCheckbox
                checked={discordCommandReset}
                label="Enable Discord /resetset command"
                labelPlacement="start"
                set={async (checked) => {
                  await window.electron.setDiscordCommandReset(checked);
                  setDiscordCommandReset(checked);
                }}
              />
            </Stack>
          )}
          <Divider
            textAlign="right"
            sx={{ margin: '8px 0', typography: 'body2' }}
          >
            Overlay
          </Divider>
          <Stack marginRight="11px">
            <FormControlLabel
              control={
                <Select
                  size="small"
                  style={{ marginLeft: '9px' }}
                  value={numMSTs}
                  onChange={async (event) => {
                    const newNumMSTs = event.target.value;
                    await window.electron.setNumMSTs(newNumMSTs);
                    setNumMSTs(newNumMSTs);
                  }}
                >
                  <MenuItem value={0}>0</MenuItem>
                  <MenuItem value={1}>1</MenuItem>
                  <MenuItem value={2}>2</MenuItem>
                  <MenuItem value={3}>3</MenuItem>
                  <MenuItem value={4}>4</MenuItem>
                </Select>
              }
              disableTypography
              label="# of overlays"
              labelPlacement="start"
              sx={{ typography: 'caption' }}
            />
          </Stack>
          {numMSTs > 0 && (
            <Stack>
              <LabeledCheckbox
                checked={updateAutomatically}
                label="Update overlay(s) automatically from Slippi/start.gg"
                labelPlacement="start"
                set={async (checked) => {
                  await window.electron.setUpdateAutomatically(checked);
                  setUpdateAutomatically(checked);
                }}
              />
              <LabeledCheckbox
                checked={enableSkinColor}
                label="Enable character colors"
                labelPlacement="start"
                set={async (checked) => {
                  await window.electron.setEnableSkinColor(checked);
                  setEnableSkinColor(checked);
                }}
              />
              <LabeledCheckbox
                checked={enableSggSponsors}
                label="Use sponsor tags from start.gg"
                labelPlacement="start"
                set={async (checked) => {
                  await window.electron.setEnableSggSponsors(checked);
                  setEnableSggSponsors(checked);
                }}
              />
            </Stack>
          )}
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={simpleTextPathA || 'Set simple text title file A...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip placement="left" title="Set simple text title file A">
              <div>
                <IconButton
                  disabled={choosingSimpleTextPathA}
                  onClick={async () => {
                    try {
                      setChoosingSimpleTextPathA(true);
                      setSimpleTextPathA(
                        await window.electron.chooseSimpleTextPathA(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingSimpleTextPathA(false);
                    }
                  }}
                >
                  {choosingSimpleTextPathA ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TextSnippet />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={simpleTextPathB || 'Set simple text title file B...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip placement="left" title="Set simple text title file B">
              <div>
                <IconButton
                  disabled={choosingSimpleTextPathB}
                  onClick={async () => {
                    try {
                      setChoosingSimpleTextPathB(true);
                      setSimpleTextPathB(
                        await window.electron.chooseSimpleTextPathB(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingSimpleTextPathB(false);
                    }
                  }}
                >
                  {choosingSimpleTextPathB ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TextSnippet />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={simpleTextPathC || 'Set simple text title file C...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip placement="left" title="Set simple text title file C">
              <div>
                <IconButton
                  disabled={choosingSimpleTextPathC}
                  onClick={async () => {
                    try {
                      setChoosingSimpleTextPathC(true);
                      setSimpleTextPathC(
                        await window.electron.chooseSimpleTextPathC(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingSimpleTextPathC(false);
                    }
                  }}
                >
                  {choosingSimpleTextPathC ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TextSnippet />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={simpleTextPathD || 'Set simple text title file D...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip placement="left" title="Set simple text title file D">
              <div>
                <IconButton
                  disabled={choosingSimpleTextPathD}
                  onClick={async () => {
                    try {
                      setChoosingSimpleTextPathD(true);
                      setSimpleTextPathD(
                        await window.electron.chooseSimpleTextPathD(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingSimpleTextPathD(false);
                    }
                  }}
                >
                  {choosingSimpleTextPathD ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TextSnippet />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
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
