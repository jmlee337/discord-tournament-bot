import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  SvgIcon,
  TextField,
  Tooltip,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Check, Close, ContentCopy } from '@mui/icons-material';
import {
  Status,
  TwitchCallbackServerStatus,
  TwitchClient,
  TwitchStatus,
} from '../common/types';

function Setup() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [mainClient, setMainClient] = useState<TwitchClient>({
    clientId: '',
    clientSecret: '',
  });
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const [callbackServerStatus, setCallbackServerStatus] =
    useState<TwitchCallbackServerStatus>({ status: Status.STOPPED, port: 0 });
  const [status, setStatus] = useState<TwitchStatus>({
    status: Status.STOPPED,
    message: '',
  });
  const [userName, setUserName] = useState('');

  useEffect(() => {
    (async () => {
      const callbackServerStatusPromise =
        window.electron.getTwitchCallbackServerStatus();
      const statusPromise = window.electron.getTwitchStatus();
      const userNamePromise = window.electron.getTwitchUserName();
      setCallbackServerStatus(await callbackServerStatusPromise);
      setStatus(await statusPromise);
      setUserName(await userNamePromise);
    })();

    window.electron.onTwitchCallbackServerStatus(
      (event, newTwitchCallbackServerStatus) => {
        setCallbackServerStatus(newTwitchCallbackServerStatus);
        if (newTwitchCallbackServerStatus.status === Status.STOPPED) {
          setOpen(false);
        }
      },
    );
    window.electron.onTwitchStatus((event, newTwitchStatus) => {
      setStatus(newTwitchStatus);
    });
    window.electron.onTwitchUserName((event, newUserName) => {
      setUserName(newUserName);
    });
  }, []);

  const callbackUrl = useMemo(
    () => `http://localhost:${callbackServerStatus.port}`,
    [callbackServerStatus.port],
  );

  return (
    <Stack direction="row" alignItems="center" justifyContent="end" gap="8px">
      <DialogContentText>
        Twitch Channel: {userName || 'NONE'}
      </DialogContentText>
      {status.status === Status.STOPPED &&
        (status.message ? (
          <Tooltip title={status.message}>
            <Close color="error" />
          </Tooltip>
        ) : (
          <Close color="error" />
        ))}
      {status.status === Status.STARTING && <CircularProgress size="24px" />}
      {status.status === Status.STARTED && (
        <Tooltip title="Bot running">
          <Check color="success" />
        </Tooltip>
      )}
      <Button
        onClick={async () => {
          window.electron.startTwitchCallbackServer();
          const client = await window.electron.getTwitchClient();
          setMainClient(client);
          setClientId(client.clientId);
          setClientSecret(client.clientSecret);
          setOpen(true);
        }}
        variant="contained"
      >
        {!userName ? 'SET UP' : 'CHANGE'}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          window.electron.stopTwitchCallbackServer();
        }}
      >
        <DialogTitle>Twitch Setup</DialogTitle>
        <DialogContent>
          <Stack spacing="8px">
            <DialogContentText>
              Create an application from the{' '}
              <Link
                href="https://dev.twitch.tv/console/apps"
                target="_blank"
                rel="noreferrer"
              >
                Twitch Developer Console
              </Link>
              , using the following OAuth Redirect URL:
            </DialogContentText>
            <Stack alignItems="center" direction="row" spacing="8px">
              <DialogContentText>{callbackUrl}</DialogContentText>
              <Button
                disabled={callbackServerStatus.port === 0}
                endIcon={
                  callbackServerStatus.port === 0 ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <ContentCopy />
                  )
                }
                onClick={() => {
                  navigator.clipboard.writeText(callbackUrl);
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, 5000);
                }}
                variant="contained"
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </Stack>
            <DialogContentText>
              See example screenshots{' '}
              <Link
                href="https://github.com/jmlee337/auto-slp-player/blob/main/src/docs/twitch.md"
                target="_blank"
                rel="noreferrer"
              >
                here
              </Link>
              .
            </DialogContentText>
            <TextField
              label="Client ID"
              onChange={(event) => {
                setClientId(event.target.value);
              }}
              size="small"
              value={clientId}
              variant="filled"
            />
            <TextField
              label="Client Secret"
              onChange={(event) => {
                setClientSecret(event.target.value);
              }}
              size="small"
              type="password"
              value={clientSecret}
              variant="filled"
            />
            <Button
              disabled={
                callbackServerStatus.status !== Status.STARTED ||
                Boolean(clientId) !== Boolean(clientSecret) ||
                (clientId === mainClient.clientId &&
                  clientSecret === mainClient.clientSecret &&
                  status.status === Status.STARTED)
              }
              onClick={async () => {
                await window.electron.setTwitchClient({
                  clientId,
                  clientSecret,
                });
              }}
              variant="contained"
            >
              {clientId === '' && clientSecret === ''
                ? 'Disable'
                : 'Save & Go!'}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

export default function Twitch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title="Twitch" placement="top">
        <IconButton
          onClick={() => {
            setOpen(true);
          }}
        >
          <SvgIcon width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M2.149 0l-1.612 4.119v16.836h5.731v3.045h3.224l3.045-3.045h4.657l6.269-6.269v-14.686h-21.314zm19.164 13.612l-3.582 3.582h-5.731l-3.045 3.045v-3.045h-4.836v-15.045h17.194v11.463zm-3.582-7.343v6.262h-2.149v-6.262h2.149zm-5.731 0v6.262h-2.149v-6.262h2.149z"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </SvgIcon>
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <DialogTitle>Twitch - !bracket</DialogTitle>
        <DialogContent>
          <Setup />
        </DialogContent>
      </Dialog>
    </>
  );
}
