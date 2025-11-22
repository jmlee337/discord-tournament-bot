import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
} from '@mui/material';
import {
  Broadcast,
  RemoteState,
  RemoteStatus,
  Spectating,
} from '../common/types';

function Status({ remoteState }: { remoteState: RemoteState }) {
  if (remoteState.err) {
    return <Alert severity="error">{remoteState.err}</Alert>;
  }
  if (remoteState.status === RemoteStatus.DISCONNECTED) {
    return <Alert severity="warning">Spectate Remote Disconnected</Alert>;
  }
  if (remoteState.status === RemoteStatus.CONNECTING) {
    return <Alert severity="info">Spectate Remote Connecting...</Alert>;
  }
  if (remoteState.status === RemoteStatus.CONNECTED) {
    return <Alert severity="success">Spectate Remote Connected!</Alert>;
  }
  throw new Error('unreachable');
}

export default function Remote({ remoteState }: { remoteState: RemoteState }) {
  const [port, setPort] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [spectating, setSpectating] = useState<Spectating[]>([]);

  useEffect(() => {
    (async () => {
      const portPromise = window.electron.getRemotePort();
      const startingRemotePromise = window.electron.getStartingRemote();
      setPort(await portPromise);
      const startingRemote = await startingRemotePromise;
      setBroadcasts(startingRemote.broadcasts);
      setSpectating(startingRemote.spectating);
    })();
  }, []);

  useEffect(() => {
    window.electron.onBroadcasts((event, newBroadcasts) => {
      setBroadcasts(newBroadcasts);
    });
    window.electron.onSpectating((event, newSpectating) => {
      setSpectating(newSpectating);
    });
  }, []);

  return (
    <Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing="8px"
      >
        <Status remoteState={remoteState} />
        <Stack direction="row" alignItems="center" spacing="8px">
          <TextField
            disabled={
              remoteState.status === RemoteStatus.CONNECTING ||
              remoteState.status === RemoteStatus.CONNECTED
            }
            inputProps={{ min: 1024, max: 65535 }}
            label="Port"
            name="port"
            onChange={(event) => {
              setPort(Number.parseInt(event.target.value, 10));
            }}
            size="small"
            type="number"
            value={port}
            variant="filled"
          />
          <Button
            disabled={
              remoteState.status === RemoteStatus.CONNECTING ||
              remoteState.status === RemoteStatus.CONNECTED
            }
            onClick={async () => {
              await window.electron.setRemotePort(port);
              window.electron.connectRemote();
            }}
            variant="contained"
          >
            Connect
          </Button>
        </Stack>
      </Stack>
      <Stack direction="row" alignItems="start" justifyContent="space-between">
        <Stack>
          <List>
            {broadcasts.map((broadcast) => (
              <ListItem key={broadcast.id} disableGutters sx={{ gap: '8px' }}>
                {broadcast.gamerTag === undefined ? (
                  <>
                    <ListItemText>{broadcast.connectCode}</ListItemText>
                    <ListItemText>({broadcast.slippiName})</ListItemText>
                  </>
                ) : (
                  <>
                    <ListItemText>{broadcast.gamerTag}</ListItemText>
                    <ListItemText>{broadcast.connectCode}</ListItemText>
                    <ListItemText>({broadcast.slippiName})</ListItemText>
                  </>
                )}
              </ListItem>
            ))}
          </List>
        </Stack>
        <Stack>
          <List>
            {spectating.map((spectate) => (
              <ListItem key={spectate.dolphinId}>
                <ListItemText>{spectate.dolphinId}</ListItemText>
                <ListItemText>{spectate.broadcastId}</ListItemText>
              </ListItem>
            ))}
          </List>
        </Stack>
      </Stack>
    </Stack>
  );
}
