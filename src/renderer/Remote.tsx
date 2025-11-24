import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Broadcast,
  ChipData,
  Highlight,
  HIGHLIGHT_COLOR,
  RemoteState,
  RemoteStatus,
  Spectating,
} from '../common/types';
import { DraggableChip, DroppableChip } from './DragAndDrop';

type BroadcastWithHighlight = {
  connectCodeHighlight?: Highlight;
  gamerTagHighlight?: Highlight;
  slippiNameHighlight?: Highlight;
  broadcast: Broadcast;
};

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

function getBroadcastsWithHighlights(
  broadcasts: Broadcast[],
  searchSubstr: string,
) {
  if (!searchSubstr) {
    return broadcasts.map((broadcast) => ({ broadcast }));
  }

  const broadcastsWithHighlights: BroadcastWithHighlight[] = [];
  broadcasts.forEach((broadcast) => {
    let connectCodeHighlight: Highlight | undefined;
    let gamerTagHighlight: Highlight | undefined;
    let slippiNameHighlight: Highlight | undefined;
    let include = false;
    const includeStr = searchSubstr.toLowerCase();
    const connectCodeStart = broadcast.connectCode
      .toLowerCase()
      .indexOf(includeStr);
    if (connectCodeStart >= 0) {
      include = true;
      connectCodeHighlight = {
        start: connectCodeStart,
        end: connectCodeStart + includeStr.length,
      };
    }
    if (broadcast.gamerTag) {
      const gamerTagStart = broadcast.gamerTag
        .toLowerCase()
        .indexOf(includeStr);
      if (gamerTagStart >= 0) {
        include = true;
        gamerTagHighlight = {
          start: gamerTagStart,
          end: gamerTagStart + includeStr.length,
        };
      }
    }
    const slippiNameStart = broadcast.slippiName
      .toLowerCase()
      .indexOf(includeStr);
    if (slippiNameStart >= 0) {
      include = true;
      slippiNameHighlight = {
        start: slippiNameStart,
        end: slippiNameStart + includeStr.length,
      };
    }
    if (include) {
      broadcastsWithHighlights.push({
        connectCodeHighlight,
        gamerTagHighlight,
        slippiNameHighlight,
        broadcast,
      });
    }
  });
  return broadcastsWithHighlights;
}

function BroadcastWithHighlightListItem({
  bwh,
  selectedChipData,
  setSelectedChipData,
}: {
  bwh: BroadcastWithHighlight;
  selectedChipData: ChipData;
  setSelectedChipData: (chipData: ChipData) => void;
}) {
  const connectCodeFrag = (
    <ListItemText>
      {bwh.connectCodeHighlight ? (
        <>
          <span>
            {bwh.broadcast.connectCode.substring(
              0,
              bwh.connectCodeHighlight.start,
            )}
          </span>
          <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
            {bwh.broadcast.connectCode.substring(
              bwh.connectCodeHighlight.start,
              bwh.connectCodeHighlight.end,
            )}
          </span>
          <span>
            {bwh.broadcast.connectCode.substring(bwh.connectCodeHighlight.end)}
          </span>
        </>
      ) : (
        bwh.broadcast.connectCode
      )}
    </ListItemText>
  );
  const slippiNameFrag = (
    <ListItemText>
      (
      {bwh.slippiNameHighlight ? (
        <>
          <span>
            {bwh.broadcast.slippiName.substring(
              0,
              bwh.slippiNameHighlight.start,
            )}
          </span>
          <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
            {bwh.broadcast.slippiName.substring(
              bwh.slippiNameHighlight.start,
              bwh.slippiNameHighlight.end,
            )}
          </span>
          <span>
            {bwh.broadcast.slippiName.substring(bwh.slippiNameHighlight.end)}
          </span>
        </>
      ) : (
        bwh.broadcast.slippiName
      )}
      )
    </ListItemText>
  );
  return (
    <ListItem
      style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
      sx={{
        borderColor: (theme) => theme.palette.grey[400],
        borderRadius: (theme) => theme.shape.borderRadius,
      }}
    >
      <Stack direction="row" alignItems="center" spacing="8px">
        {bwh.broadcast.gamerTag === undefined ? (
          <>
            {connectCodeFrag}
            {slippiNameFrag}
          </>
        ) : (
          <>
            <ListItemText>
              {bwh.gamerTagHighlight ? (
                <>
                  <span>
                    {bwh.broadcast.gamerTag.substring(
                      0,
                      bwh.gamerTagHighlight.start,
                    )}
                  </span>
                  <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                    {bwh.broadcast.gamerTag.substring(
                      bwh.gamerTagHighlight.start,
                      bwh.gamerTagHighlight.end,
                    )}
                  </span>
                  <span>
                    {bwh.broadcast.gamerTag.substring(
                      bwh.gamerTagHighlight.end,
                    )}
                  </span>
                </>
              ) : (
                bwh.broadcast.gamerTag
              )}
            </ListItemText>
            {connectCodeFrag}
            {slippiNameFrag}
          </>
        )}
      </Stack>
      <DraggableChip
        broadcast={bwh.broadcast}
        selectedChipData={selectedChipData}
        setSelectedChipData={setSelectedChipData}
      />
    </ListItem>
  );
}

export default function Remote({
  remoteState,
  searchSubstr,
}: {
  remoteState: RemoteState;
  searchSubstr: string;
}) {
  const [port, setPort] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [spectating, setSpectating] = useState<Spectating[]>([]);
  const [selectedChipData, setSelectedChipData] = useState<ChipData>({
    id: '',
    connectCode: '',
    slippiName: '',
  });

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

  const broadcastsWithHighlights = useMemo(
    () => getBroadcastsWithHighlights(broadcasts, searchSubstr),
    [broadcasts, searchSubstr],
  );

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
            style={{ width: '99px' }}
            variant="contained"
          >
            Connect
          </Button>
        </Stack>
      </Stack>
      <Stack direction="row" alignItems="start" spacing="8px">
        <List style={{ flexGrow: 1 }}>
          {broadcastsWithHighlights.map((bwh) => (
            <BroadcastWithHighlightListItem
              key={bwh.broadcast.id}
              bwh={bwh}
              selectedChipData={selectedChipData}
              setSelectedChipData={setSelectedChipData}
            />
          ))}
        </List>
        <Stack spacing="8px" style={{ marginTop: '8px' }}>
          {spectating.map((spectate) => (
            <Card key={spectate.dolphinId} style={{ width: '193px' }}>
              <CardContent>
                <Typography variant="h6">{spectate.dolphinId}</Typography>
                <Typography variant="caption">
                  {spectate.broadcastId}
                </Typography>
              </CardContent>
              <CardActions>
                <DroppableChip
                  dolphinId={spectate.dolphinId}
                  selectedChipData={selectedChipData}
                  onClickOrDrop={async (chipData) => {
                    await window.electron.startSpectating(
                      chipData.id,
                      spectate.dolphinId,
                    );
                    setSelectedChipData({
                      id: '',
                      connectCode: '',
                      slippiName: '',
                    });
                  }}
                />
              </CardActions>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
