import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Radio,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
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
  setNamesHighlight?: Highlight;
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
    let setNamesHighlight: Highlight | undefined;
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
    if (broadcast.set) {
      const setNamesStart = broadcast.set.names
        .toLowerCase()
        .indexOf(includeStr);
      if (setNamesStart >= 0) {
        include = true;
        setNamesHighlight = {
          start: setNamesStart,
          end: setNamesStart + includeStr.length,
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
        setNamesHighlight,
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
  const connectCodeSlippiNameFrag = (
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
      )}{' '}
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
        marginBottom: '8px',
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
          connectCodeSlippiNameFrag
        ) : (
          <>
            <ListItemText
              style={{ paddingRight: '8px' }}
              sx={{
                borderRight: (theme) => `1px solid ${theme.palette.grey[400]}`,
              }}
            >
              {bwh.broadcast.set &&
                (bwh.setNamesHighlight ? (
                  <>
                    <span>
                      {bwh.broadcast.set.names.substring(
                        0,
                        bwh.setNamesHighlight.start,
                      )}
                    </span>
                    <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                      {bwh.broadcast.set.names.substring(
                        bwh.setNamesHighlight.start,
                        bwh.setNamesHighlight.end,
                      )}
                    </span>
                    <span>
                      {bwh.broadcast.set.names.substring(
                        bwh.setNamesHighlight.end,
                      )}
                    </span>
                  </>
                ) : (
                  bwh.broadcast.set.names
                ))}
              {bwh.broadcast.set === undefined &&
                (bwh.gamerTagHighlight ? (
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
                ))}
            </ListItemText>
            {connectCodeSlippiNameFrag}
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
  overlayEnabled,
  remoteState,
  searchSubstr,
  showErrorDialog,
}: {
  overlayEnabled: boolean;
  remoteState: RemoteState;
  searchSubstr: string;
  showErrorDialog: (messages: string[]) => void;
}) {
  const [port, setPort] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [overlayDolphinId, setOverlayDolphinId] = useState('');
  const [spectating, setSpectating] = useState<Spectating[]>([]);
  const [selectedChipData, setSelectedChipData] = useState<ChipData>({
    id: '',
    connectCode: '',
    slippiName: '',
  });

  useEffect(() => {
    (async () => {
      const portPromise = window.electron.getRemotePort();
      const overlayDolphinIdPromise = window.electron.getOverlayDolphinId();
      const startingRemotePromise = window.electron.getStartingRemote();
      setPort(await portPromise);
      setOverlayDolphinId(await overlayDolphinIdPromise);
      const startingRemote = await startingRemotePromise;
      setBroadcasts(startingRemote.broadcasts);
      setSpectating(startingRemote.spectating);
    })();
  }, []);

  useEffect(() => {
    window.electron.onBroadcasts((event, newBroadcasts) => {
      setBroadcasts(newBroadcasts);
      setRefreshing(false);
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
      <style>
        {`
          @keyframes border-pulse {
            0% { border-color: rgba(238, 0, 0, 1); }
            50% { border-color: rgba(238, 0, 0, 0); }
            100% {border-color: rgba(238, 0, 0, 1); }
          }
        `}
      </style>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing="8px"
      >
        <Status remoteState={remoteState} />
        <Stack direction="row" alignItems="center" spacing="8px">
          <Tooltip
            placement="left"
            title={refreshing ? 'Refreshing' : 'Refresh'}
          >
            <span>
              <IconButton
                disabled={
                  refreshing || remoteState.status !== RemoteStatus.CONNECTED
                }
                onClick={async () => {
                  try {
                    setRefreshing(true);
                    await window.electron.refreshBroadcasts();
                  } catch (e: any) {
                    const message = e instanceof Error ? e.message : e;
                    showErrorDialog([message]);
                    setRefreshing(false);
                  }
                }}
              >
                {refreshing ? <CircularProgress size="24px" /> : <Refresh />}
              </IconButton>
            </span>
          </Tooltip>
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
            <Card
              key={spectate.dolphinId}
              style={{ width: '208px' }}
              sx={
                spectate.spectating
                  ? undefined
                  : {
                      backgroundColor: (theme) =>
                        theme.palette.action.disabledBackground,
                    }
              }
            >
              <CardHeader title={spectate.dolphinId} />
              {spectate.spectating && (
                <CardContent style={{ paddingTop: 0, paddingBottom: 0 }}>
                  {spectate.broadcast === undefined && (
                    <Typography variant="caption">unknown broadcast</Typography>
                  )}
                  {spectate.broadcast && (
                    <Typography variant="caption">
                      {spectate.broadcast.set && spectate.broadcast.set.names}
                      {spectate.broadcast.set === undefined &&
                        (spectate.broadcast.gamerTag
                          ? spectate.broadcast.gamerTag
                          : `${spectate.broadcast.connectCode} (${spectate.broadcast.slippiName})`)}
                    </Typography>
                  )}
                </CardContent>
              )}
              <CardActions
                disableSpacing
                style={{
                  justifyContent: 'space-between',
                  position: 'relative',
                }}
              >
                <DroppableChip
                  selectedChipData={selectedChipData}
                  onClickOrDrop={async (chipData) => {
                    if (chipData.id !== spectate.broadcast?.id) {
                      await window.electron.startSpectating(
                        chipData.id,
                        spectate.dolphinId,
                      );
                    }
                    setSelectedChipData({
                      id: '',
                      connectCode: '',
                      slippiName: '',
                    });
                  }}
                />
                {spectate.spectating && (
                  <Box
                    height="40px"
                    width="40px"
                    sx={{
                      animation:
                        'border-pulse 1.5s cubic-bezier(.75, 0, .25, 1) infinite',
                      borderRadius: '20px',
                      borderStyle: 'solid',
                      borderWidth: '4px',
                      boxSizing: 'border-box',
                      position: 'absolute',
                      left: '4px',
                      zIndex: 1,
                    }}
                  />
                )}
                {overlayEnabled && (
                  <FormControlLabel
                    label="Overlay"
                    slotProps={{ typography: { variant: 'caption' } }}
                    control={
                      <Radio
                        checked={overlayDolphinId === spectate.dolphinId}
                        disabled={!spectate.spectating}
                        onChange={async (event, checked) => {
                          if (checked) {
                            await window.electron.setOverlayDolphinId(
                              spectate.dolphinId,
                            );
                            setOverlayDolphinId(spectate.dolphinId);
                          }
                        }}
                      />
                    }
                  />
                )}
              </CardActions>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
