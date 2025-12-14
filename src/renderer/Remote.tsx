import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Refresh, Stop } from '@mui/icons-material';
import {
  Broadcast,
  DolphinId,
  Highlight,
  HIGHLIGHT_COLOR,
  OverlayId,
  RemoteState,
  RemoteStatus,
  Spectating,
} from '../common/types';
import { DraggableChip, DroppableChip } from './DragAndDrop';
import LabeledCheckbox from './LabeledCheckbox';

type BroadcastWithHighlight = {
  connectCodeHighlight?: Highlight;
  gamerTagHighlight?: Highlight;
  opponentNameHighlights: (Highlight | undefined)[];
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
  requireSet: boolean,
  searchSubstr: string,
): BroadcastWithHighlight[] {
  if (!requireSet && !searchSubstr) {
    return broadcasts.map((broadcast) => ({
      broadcast,
      opponentNameHighlights: [],
    }));
  }

  let remainingBroadcasts = [...broadcasts];
  if (requireSet) {
    remainingBroadcasts = remainingBroadcasts.filter(
      (broadcast) => broadcast.sets.length > 0,
    );
    if (!searchSubstr) {
      return remainingBroadcasts.map((broadcast) => ({
        broadcast,
        opponentNameHighlights: [],
      }));
    }
  }

  if (searchSubstr) {
    const broadcastsWithHighlights: BroadcastWithHighlight[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const broadcast of remainingBroadcasts) {
      let connectCodeHighlight: Highlight | undefined;
      let gamerTagHighlight: Highlight | undefined;
      let opponentNameHighlights: (Highlight | undefined)[] = [];
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
      if (broadcast.sets.length > 0) {
        opponentNameHighlights = broadcast.sets.map((set) => {
          const opponentNameStart = set.opponentName
            .toLowerCase()
            .indexOf(includeStr);
          if (opponentNameStart >= 0) {
            include = true;
            const opponentNameHighlight: Highlight = {
              start: opponentNameStart,
              end: opponentNameStart + includeStr.length,
            };
            return opponentNameHighlight;
          }
          return undefined;
        });
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
          opponentNameHighlights,
          slippiNameHighlight,
          broadcast,
        });
      }
    }
    return broadcastsWithHighlights;
  }
  throw new Error('unreachable');
}

function BroadcastWithHighlightListItem({
  bwh,
  spectatingBroadcastIds,
  selectedChipBroadcastId,
  setSelectedChipBroadcastId,
}: {
  bwh: BroadcastWithHighlight;
  spectatingBroadcastIds: Set<string>;
  selectedChipBroadcastId: string;
  setSelectedChipBroadcastId: (broadcastId: string) => void;
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
              {bwh.broadcast.sets.length > 0 && (
                <>
                  {' '}
                  vs{' '}
                  <Stack
                    display="inline"
                    direction="row"
                    divider={<span>, </span>}
                  >
                    {bwh.broadcast.sets.map((set, i) =>
                      bwh.opponentNameHighlights[i] === undefined ? (
                        set.opponentName
                      ) : (
                        <span>
                          <span>
                            {set.opponentName.substring(
                              0,
                              bwh.opponentNameHighlights[i].start,
                            )}
                          </span>
                          <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                            {set.opponentName.substring(
                              bwh.opponentNameHighlights[i].start,
                              bwh.opponentNameHighlights[i].end,
                            )}
                          </span>
                          <span>
                            {set.opponentName.substring(
                              bwh.opponentNameHighlights[i].end,
                            )}
                          </span>
                        </span>
                      ),
                    )}
                  </Stack>
                </>
              )}
            </ListItemText>
            {connectCodeSlippiNameFrag}
          </>
        )}
      </Stack>
      <DraggableChip
        broadcast={bwh.broadcast}
        disabled={spectatingBroadcastIds.has(bwh.broadcast.id)}
        selectedChipBroadcastId={selectedChipBroadcastId}
        setSelectedChipBroadcastId={setSelectedChipBroadcastId}
      />
    </ListItem>
  );
}

function OverlaySelect({
  spectate,
  numMSTs,
  dolphinIdToOverlayId,
  overlayIdToDolphinId,
  setDolphinIdToOverlayId,
}: {
  spectate: Spectating;
  numMSTs: number;
  dolphinIdToOverlayId: Map<DolphinId, OverlayId>;
  overlayIdToDolphinId: Map<OverlayId, DolphinId>;
  setDolphinIdToOverlayId: (
    dolphinIdToOverlayId: Map<DolphinId, OverlayId>,
  ) => void;
}) {
  const dolphinId = useMemo(() => spectate.dolphinId, [spectate]);
  const overlayId = useMemo(
    () => dolphinIdToOverlayId.get(dolphinId),
    [dolphinId, dolphinIdToOverlayId],
  );

  const selectRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectRef.current?.blur();
  }, [overlayId]);

  return (
    numMSTs > 0 && (
      <FormControl
        ref={selectRef}
        style={{ marginTop: '8px' }}
        disabled={!spectate.spectating || overlayId !== undefined}
      >
        <InputLabel size="small" id={`${dolphinId}-overlay-select-id`}>
          Overlay
        </InputLabel>
        <Select
          size="small"
          label="Overlay"
          labelId={`${dolphinId}-overlay-select-id`}
          value={overlayId ?? ''}
          onChange={async (event) => {
            setDolphinIdToOverlayId(
              await window.electron.setDolphinOverlayId(
                dolphinId,
                event.target.value,
              ),
            );
          }}
        >
          <MenuItem value={1}>
            1
            {overlayId !== 1 && overlayIdToDolphinId.get(1) && (
              <Typography variant="caption">
                &nbsp;({overlayIdToDolphinId.get(1)})
              </Typography>
            )}
          </MenuItem>
          {numMSTs > 1 && (
            <MenuItem value={2}>
              2
              {overlayId !== 2 && overlayIdToDolphinId.get(2) && (
                <Typography variant="caption">
                  &nbsp;({overlayIdToDolphinId.get(2)})
                </Typography>
              )}
            </MenuItem>
          )}
          {numMSTs > 2 && (
            <MenuItem value={3}>
              3
              {overlayId !== 3 && overlayIdToDolphinId.get(3) && (
                <Typography variant="caption">
                  &nbsp;({overlayIdToDolphinId.get(3)})
                </Typography>
              )}
            </MenuItem>
          )}
          {numMSTs > 3 && (
            <MenuItem value={4}>
              4
              {overlayId !== 4 && overlayIdToDolphinId.get(4) && (
                <Typography variant="caption">
                  &nbsp;({overlayIdToDolphinId.get(4)})
                </Typography>
              )}
            </MenuItem>
          )}
        </Select>
      </FormControl>
    )
  );
}

export default function Remote({
  numMSTs,
  remoteState,
  searchSubstr,
  showErrorDialog,
}: {
  numMSTs: 0 | OverlayId;
  remoteState: RemoteState;
  searchSubstr: string;
  showErrorDialog: (messages: string[]) => void;
}) {
  const [port, setPort] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [requireSet, setRequireSet] = useState(false);
  const [dolphinIdToOverlayId, setDolphinIdToOverlayId] = useState<
    Map<DolphinId, OverlayId>
  >(new Map());
  const [spectating, setSpectating] = useState<Spectating[]>([]);
  const [selectedChipBroadcastId, setSelectedChipBroadcastId] = useState('');

  useEffect(() => {
    (async () => {
      const portPromise = window.electron.getRemotePort();
      const dolphinIdToOverlayIdPromise =
        window.electron.getDolphinIdToOverlayId();
      const startingRemotePromise = window.electron.getStartingRemote();
      setPort(await portPromise);
      setDolphinIdToOverlayId(await dolphinIdToOverlayIdPromise);
      const startingRemote = await startingRemotePromise;
      setBroadcasts(startingRemote.broadcasts);
      setSpectating(startingRemote.spectating);
    })();
  }, []);

  useEffect(() => {
    window.electron.onBroadcasts((event, newBroadcasts) => {
      setBroadcasts(newBroadcasts);
    });
    window.electron.onRefreshingBroadcasts((event, newRefreshing) => {
      setRefreshing(newRefreshing);
    });
    window.electron.onSpectating((event, newSpectating) => {
      setSpectating(newSpectating);
    });
  }, []);

  const broadcastsWithHighlights = useMemo(
    () => getBroadcastsWithHighlights(broadcasts, requireSet, searchSubstr),
    [broadcasts, requireSet, searchSubstr],
  );

  const spectatingBroadcastIds = useMemo(
    () =>
      new Set(
        spectating
          .map((spectate) => spectate.broadcast?.id)
          .filter((broadcastId) => broadcastId !== undefined),
      ),
    [spectating],
  );

  const overlayIdToDolphinId = useMemo(
    () =>
      new Map(
        Array.from(dolphinIdToOverlayId.entries()).map(
          ([dolphinId, overlayId]) => [overlayId, dolphinId],
        ),
      ),
    [dolphinIdToOverlayId],
  );

  return (
    <Stack direction="row" alignItems="start" height="100%">
      <style>
        {`
          @keyframes border-pulse {
            0% { border-color: rgba(238, 0, 0, 1); }
            50% { border-color: rgba(238, 0, 0, 0); }
            100% {border-color: rgba(238, 0, 0, 1); }
          }
        `}
      </style>
      <Stack flexGrow={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing="8px"
        >
          <Status remoteState={remoteState} />
          <Stack direction="row" alignItems="center">
            <LabeledCheckbox
              checked={requireSet}
              label="Hide broadcasts with no matching set"
              labelPlacement="start"
              set={async (checked) => {
                setRequireSet(checked);
              }}
            />
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
                      await window.electron.refreshBroadcasts();
                    } catch (e: any) {
                      const message = e instanceof Error ? e.message : e;
                      showErrorDialog([message]);
                    }
                  }}
                >
                  {refreshing ? <CircularProgress size="24px" /> : <Refresh />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
        <List style={{ flexGrow: 1, marginRight: '8px' }}>
          {broadcastsWithHighlights.map((bwh) => (
            <BroadcastWithHighlightListItem
              key={bwh.broadcast.id}
              bwh={bwh}
              spectatingBroadcastIds={spectatingBroadcastIds}
              selectedChipBroadcastId={selectedChipBroadcastId}
              setSelectedChipBroadcastId={setSelectedChipBroadcastId}
            />
          ))}
        </List>
      </Stack>
      <Stack alignItems="stretch">
        <Stack direction="row" alignItems="center" spacing="8px">
          <TextField
            disabled={
              remoteState.status === RemoteStatus.CONNECTING ||
              remoteState.status === RemoteStatus.CONNECTED
            }
            label="Port"
            name="port"
            onChange={(event) => {
              setPort(Number.parseInt(event.target.value, 10));
            }}
            size="small"
            slotProps={{ htmlInput: { min: 1024, max: 65536 } }}
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
        <Stack spacing="8px" style={{ marginTop: '8px', marginBottom: '24px' }}>
          {spectating.map((spectate) => (
            <Card
              key={spectate.dolphinId}
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
              <CardContent
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  paddingTop: 0,
                  paddingBottom: 0,
                }}
              >
                {spectate.spectating && (
                  <>
                    {spectate.broadcast === undefined && (
                      <Typography variant="caption">
                        unknown broadcast
                      </Typography>
                    )}
                    {spectate.broadcast && (
                      <Typography variant="caption">
                        {spectate.broadcast.sets.length > 0 &&
                          `${
                            spectate.broadcast.gamerTag
                          } vs ${spectate.broadcast.sets
                            .map((set) => set.opponentName)
                            .join(', ')}`}
                        {spectate.broadcast.sets.length === 0 &&
                          (spectate.broadcast.gamerTag
                            ? spectate.broadcast.gamerTag
                            : `${spectate.broadcast.connectCode} (${spectate.broadcast.slippiName})`)}
                      </Typography>
                    )}
                  </>
                )}
                <OverlaySelect
                  spectate={spectate}
                  numMSTs={numMSTs}
                  dolphinIdToOverlayId={dolphinIdToOverlayId}
                  overlayIdToDolphinId={overlayIdToDolphinId}
                  setDolphinIdToOverlayId={setDolphinIdToOverlayId}
                />
              </CardContent>
              <CardActions
                disableSpacing
                style={{
                  justifyContent: 'space-between',
                  position: 'relative',
                }}
              >
                <DroppableChip
                  selectedChipBroadcastId={selectedChipBroadcastId}
                  onClickOrDrop={async (broadcastId) => {
                    if (broadcastId !== spectate.broadcast?.id) {
                      await window.electron.startSpectating(
                        broadcastId,
                        spectate.dolphinId,
                      );
                    }
                    setSelectedChipBroadcastId('');
                  }}
                />
                {spectate.spectating && (
                  <>
                    <Tooltip title="Stop" style={{ zIndex: 2 }}>
                      <IconButton
                        onClick={async () => {
                          await window.electron.stopSpectating(
                            spectate.broadcast!.id,
                          );
                        }}
                      >
                        <Stop />
                      </IconButton>
                    </Tooltip>
                    <CircularProgress
                      enableTrackSlot
                      color="success"
                      style={{ position: 'absolute', right: '8px' }}
                    />
                  </>
                )}
              </CardActions>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
