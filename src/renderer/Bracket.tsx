import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { JSX, useEffect, useMemo, useState } from 'react';
import { HourglassTop, NotificationsActive } from '@mui/icons-material';
import Report from './Report';
import Reset from './Reset';
import {
  HIGHLIGHT_COLOR,
  Highlight,
  StartggPhase,
  StartggSet,
  Sets,
  DiscordChannel,
  Discord,
} from '../common/types';
import DiscordIcon from './DiscordIcon';
import getColor from './getColor';

type SetWithHighlight = {
  entrant1Highlight?: Highlight;
  entrant2Highlight?: Highlight;
  set: StartggSet;
};

const EMPTY_STARTGG_SET: StartggSet = {
  id: 0,
  bestOf: 0,
  completedAt: null,
  isDQ: false,
  entrant1Id: 0,
  entrant1Name: '',
  entrant1Sponsor: '',
  entrant1Score: 0,
  entrant2Id: 0,
  entrant2Name: '',
  entrant2Sponsor: '',
  entrant2Score: 0,
  fullRoundText: '',
  round: 1,
  startedAt: null,
  state: 1,
  updatedAt: 0,
  winnerId: null,
};

function getBackgroundColor(set: StartggSet) {
  if (set.round < 0) {
    return '#ffebee';
  }
  return '#fafafa';
}

function SetWithHighlightListItemButton({
  setWithHighlight,
  pending,
  setReportingDialogOpen,
  setResetDialogOpen,
  setResetSelectedSet,
  setSelectedSet,
}: {
  setWithHighlight: SetWithHighlight;
  pending: boolean;
  setReportingDialogOpen: (reportingDialogOpen: boolean) => void;
  setResetDialogOpen: (resetDialogOpen: boolean) => void;
  setResetSelectedSet: (set: StartggSet) => void;
  setSelectedSet: (set: StartggSet) => void;
}) {
  const titleEnd = useMemo(() => {
    if (setWithHighlight.set.state === 2) {
      return (
        <HourglassTop
          fontSize="small"
          style={{ marginLeft: '5px', marginRight: '-5px' }}
        />
      );
    }
    if (setWithHighlight.set.state === 6) {
      return (
        <NotificationsActive
          fontSize="small"
          style={{ marginLeft: '2px', marginRight: '-2px' }}
        />
      );
    }
    return <Box width="20px" />;
  }, [setWithHighlight]);

  return (
    <ListItemButton
      style={{
        flexGrow: 0,
        backgroundColor: getBackgroundColor(setWithHighlight.set),
        padding: '8px',
      }}
      onClick={() => {
        if (pending) {
          setSelectedSet(setWithHighlight.set);
          setReportingDialogOpen(true);
        } else {
          setResetSelectedSet(setWithHighlight.set);
          setResetDialogOpen(true);
        }
      }}
    >
      <Stack>
        <Stack
          direction="row"
          alignItems="center"
          gap="4px"
          width="100%"
          style={{ color: getColor(setWithHighlight.set) }}
        >
          <Typography flexGrow={1} textAlign="center" variant="caption">
            {setWithHighlight.set.fullRoundText}
          </Typography>
          {titleEnd}
        </Stack>
        <Typography
          variant="body2"
          style={{
            fontWeight:
              setWithHighlight.set.state === 3 &&
              setWithHighlight.set.entrant1Id === setWithHighlight.set.winnerId
                ? 700
                : undefined,
          }}
        >
          {setWithHighlight.entrant1Highlight ? (
            <>
              <span>
                {setWithHighlight.set.entrant1Name.substring(
                  0,
                  setWithHighlight.entrant1Highlight.start,
                )}
              </span>
              <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                {setWithHighlight.set.entrant1Name.substring(
                  setWithHighlight.entrant1Highlight.start,
                  setWithHighlight.entrant1Highlight.end,
                )}
              </span>
              <span>
                {setWithHighlight.set.entrant1Name.substring(
                  setWithHighlight.entrant1Highlight.end,
                )}
              </span>
            </>
          ) : (
            setWithHighlight.set.entrant1Name
          )}
        </Typography>
        <Typography
          variant="body2"
          style={{
            fontWeight:
              setWithHighlight.set.state === 3 &&
              setWithHighlight.set.entrant2Id === setWithHighlight.set.winnerId
                ? 700
                : undefined,
          }}
        >
          {setWithHighlight.entrant2Highlight ? (
            <>
              <span>
                {setWithHighlight.set.entrant2Name.substring(
                  0,
                  setWithHighlight.entrant2Highlight.start,
                )}
              </span>
              <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                {setWithHighlight.set.entrant2Name.substring(
                  setWithHighlight.entrant2Highlight.start,
                  setWithHighlight.entrant2Highlight.end,
                )}
              </span>
              <span>
                {setWithHighlight.set.entrant2Name.substring(
                  setWithHighlight.entrant2Highlight.end,
                )}
              </span>
            </>
          ) : (
            setWithHighlight.set.entrant2Name
          )}
        </Typography>
      </Stack>
    </ListItemButton>
  );
}

function mapStartggPhasePredicate(
  phase: StartggPhase,
  searchSubstrInner: string,
  setReportingDialogOpen: (reportingDialogOpen: boolean) => void,
  setResetDialogOpen: (resetDialogOpen: boolean) => void,
  setResetSelectedSet: (resetSelectedSet: StartggSet) => void,
  setSelectedSet: (selectedSet: StartggSet) => void,
  pending: boolean,
) {
  const prefix = pending ? 'pending' : 'completed';
  const phaseGroups: JSX.Element[] = [];
  phase.phaseGroups.forEach((phaseGroup) => {
    const groupSets: SetWithHighlight[] = [];
    phaseGroup.sets.forEach((set) => {
      if (!searchSubstrInner) {
        groupSets.push({ set });
      } else {
        let entrant1Highlight: Highlight | undefined;
        let entrant2Highlight: Highlight | undefined;
        let include = false;
        const includeStr = searchSubstrInner.toLowerCase();
        const start1 = set.entrant1Name.toLowerCase().indexOf(includeStr);
        if (start1 >= 0) {
          include = true;
          entrant1Highlight = {
            start: start1,
            end: start1 + includeStr.length,
          };
        }
        const start2 = set.entrant2Name.toLowerCase().indexOf(includeStr);
        if (start2 >= 0) {
          include = true;
          entrant2Highlight = {
            start: start2,
            end: start2 + includeStr.length,
          };
        }
        if (include) {
          groupSets.push({ entrant1Highlight, entrant2Highlight, set });
        }
      }
    });
    if (groupSets.length > 0) {
      phaseGroups.push(
        <Box key={`${prefix}${phase.name}${phaseGroup.name}`}>
          <Typography variant="subtitle1">
            {phase.name}, {phaseGroup.name}
          </Typography>
          <Stack direction="row" gap="8px" flexWrap="wrap">
            {groupSets.map((setWithHighlight) => (
              <SetWithHighlightListItemButton
                key={`${prefix}${setWithHighlight.set.id}`}
                setWithHighlight={setWithHighlight}
                pending={pending}
                setReportingDialogOpen={setReportingDialogOpen}
                setResetDialogOpen={setResetDialogOpen}
                setResetSelectedSet={setResetSelectedSet}
                setSelectedSet={setSelectedSet}
              />
            ))}
          </Stack>
        </Box>,
      );
    }
  });
  return phaseGroups;
}

function getPendingPhases(
  sets: Sets,
  searchSubstr: string,
  setReportingDialogOpen: (reportingDialogOpen: boolean) => void,
  setResetDialogOpen: (resetDialogOpen: boolean) => void,
  setResetSelectedSet: (resetSelectedSet: StartggSet) => void,
  setSelectedSet: (selectedSet: StartggSet) => void,
) {
  const pendingPhases: JSX.Element[] = [];
  sets.pending.forEach((phase) => {
    pendingPhases.push(
      ...mapStartggPhasePredicate(
        phase,
        searchSubstr,
        setReportingDialogOpen,
        setResetDialogOpen,
        setResetSelectedSet,
        setSelectedSet,
        true,
      ),
    );
  });
  return pendingPhases;
}

function getCompletedPhases(
  sets: Sets,
  searchSubstr: string,
  setReportingDialogOpen: (reportingDialogOpen: boolean) => void,
  setResetDialogOpen: (resetDialogOpen: boolean) => void,
  setResetSelectedSet: (resetSelectedSet: StartggSet) => void,
  setSelectedSet: (selectedSet: StartggSet) => void,
) {
  const completedPhases: JSX.Element[] = [];
  sets.completed.forEach((phase) => {
    completedPhases.push(
      ...mapStartggPhasePredicate(
        phase,
        searchSubstr,
        setReportingDialogOpen,
        setResetDialogOpen,
        setResetSelectedSet,
        setSelectedSet,
        false,
      ),
    );
  });
  return completedPhases;
}

export default function Bracket({
  discordServerId,
  searchSubstr,
}: {
  discordServerId: string;
  searchSubstr: string;
}) {
  const [sets, setSets] = useState<Sets>({ pending: [], completed: [] });
  const [selectedSet, setSelectedSet] = useState<StartggSet>(EMPTY_STARTGG_SET);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);
  const [resetSelectedSet, setResetSelectedSet] =
    useState<StartggSet>(EMPTY_STARTGG_SET);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const [gettingDiscordCheckinPings, setGettingDiscordCheckinPings] =
    useState(false);
  const [discordCheckinPings, setDiscordCheckinPings] = useState<{
    channels: DiscordChannel[];
    discords: Discord[];
  }>({ channels: [], discords: [] });
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [discordCheckinPingsDialogOpen, setDiscordCheckinPingsDialogOpen] =
    useState(false);

  useEffect(() => {
    (async () => {
      setSets(await window.electron.getStartingSets());
    })();
  }, []);

  useEffect(() => {
    window.electron.onSets((event, newSets) => {
      setSets(newSets);
    });
  }, []);

  const pendingPhases = useMemo(
    () =>
      getPendingPhases(
        sets,
        searchSubstr,
        setReportingDialogOpen,
        setResetDialogOpen,
        setResetSelectedSet,
        setSelectedSet,
      ),
    [sets, searchSubstr],
  );
  const completedPhases = useMemo(
    () =>
      getCompletedPhases(
        sets,
        searchSubstr,
        setReportingDialogOpen,
        setResetDialogOpen,
        setResetSelectedSet,
        setSelectedSet,
      ),
    [sets, searchSubstr],
  );

  const pingDisabled = useMemo(
    () =>
      discordCheckinPings.channels.length === 0 ||
      discordCheckinPings.discords.length === 0 ||
      !discordCheckinPings.channels.some(
        (channel) => channel.id === discordChannelId,
      ),
    [discordChannelId, discordCheckinPings],
  );

  return (
    <Stack>
      {pendingPhases.length > 0 && (
        <>
          <Stack direction="row" alignItems="center" gap="16px">
            <Typography variant="h5">Pending</Typography>
            <Button
              color="warning"
              disabled={!discordServerId || gettingDiscordCheckinPings}
              endIcon={
                gettingDiscordCheckinPings ? (
                  <CircularProgress size="24px" />
                ) : (
                  <DiscordIcon />
                )
              }
              size="small"
              variant="contained"
              onClick={async () => {
                try {
                  setGettingDiscordCheckinPings(true);
                  const newDiscordCheckinPings =
                    await window.electron.getDiscordCheckinPings();
                  setDiscordCheckinPings(newDiscordCheckinPings);
                  setDiscordCheckinPingsDialogOpen(true);
                } finally {
                  setGettingDiscordCheckinPings(false);
                }
              }}
            >
              Ping For Checkins
            </Button>
            <Dialog
              open={discordCheckinPingsDialogOpen}
              onClose={() => {
                setDiscordCheckinPingsDialogOpen(false);
              }}
            >
              <DialogTitle>Ping players who have not checked in?</DialogTitle>
              <DialogContent>
                {discordCheckinPings.channels.length === 0 ? (
                  <Alert severity="error">
                    No channels in which we can ping
                  </Alert>
                ) : (
                  <FormControl fullWidth style={{ marginTop: '8px' }}>
                    <InputLabel id="discord-channel-select-label" size="small">
                      Channel
                    </InputLabel>
                    <Select
                      label="Channel"
                      labelId="discord-channel-select-label"
                      value={discordChannelId}
                      size="small"
                      onChange={(event) => {
                        setDiscordChannelId(event.target.value);
                      }}
                    >
                      {discordCheckinPings.channels.map((channel) => (
                        <MenuItem key={channel.id} value={channel.id}>
                          #{channel.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {discordCheckinPings.discords.length === 0 ? (
                  <Alert severity="error" style={{ marginTop: '8px' }}>
                    No pingable players
                  </Alert>
                ) : (
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>start.gg</TableCell>
                        <TableCell>Discord</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discordCheckinPings.discords.map((discordUsername) => (
                        <TableRow key={discordUsername.id}>
                          <TableCell>{discordUsername.gamerTag}</TableCell>
                          <TableCell>{discordUsername.username}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  variant="contained"
                  onClick={() => {
                    setDiscordCheckinPingsDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  color="warning"
                  variant="contained"
                  disabled={pingDisabled}
                  onClick={async () => {
                    await window.electron.pingDiscords(
                      discordChannelId,
                      discordCheckinPings.discords.map(
                        (discord) => discord.discordId,
                      ),
                    );
                    setDiscordCheckinPingsDialogOpen(false);
                  }}
                >
                  Ping!
                </Button>
              </DialogActions>
            </Dialog>
          </Stack>
          <Stack gap="8px">{pendingPhases}</Stack>
        </>
      )}
      {completedPhases.length > 0 && (
        <>
          <Typography variant="h5" style={{ marginTop: '16px' }}>
            Completed
          </Typography>
          <Stack gap="8px">{completedPhases}</Stack>
        </>
      )}
      <Report
        open={reportingDialogOpen}
        setOpen={setReportingDialogOpen}
        set={selectedSet}
      />
      <Reset
        open={resetDialogOpen}
        setOpen={setResetDialogOpen}
        set={resetSelectedSet}
      />
    </Stack>
  );
}
