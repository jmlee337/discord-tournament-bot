import { Box, ListItemButton, Stack, Typography } from '@mui/material';
import { JSX, useEffect, useState } from 'react';
import Report from './Report';
import Reset from './Reset';
import {
  HIGHLIGHT_COLOR,
  Highlight,
  StartggPhase,
  StartggSet,
  Sets,
} from '../common/types';

type SetWithHighlight = {
  entrant1Highlight?: Highlight;
  entrant2Highlight?: Highlight;
  set: StartggSet;
};

const EMPTY_STARTGG_SET: StartggSet = {
  id: 0,
  completedAt: null,
  isDQ: false,
  entrant1Id: 0,
  entrant1Name: '',
  entrant2Id: 0,
  entrant2Name: '',
  fullRoundText: '',
  round: 1,
  startedAt: null,
  state: 1,
  updatedAt: 0,
  winnerId: null,
};

export default function Bracket({ searchSubstr }: { searchSubstr: string }) {
  const [sets, setSets] = useState<Sets>({ pending: [], completed: [] });
  const [selectedSet, setSelectedSet] = useState<StartggSet>(EMPTY_STARTGG_SET);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);
  const [resetSelectedSet, setResetSelectedSet] =
    useState<StartggSet>(EMPTY_STARTGG_SET);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

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

  const mapStartggPhasePredicate = (phase: StartggPhase, pending: boolean) => {
    const prefix = pending ? 'pending' : 'completed';
    const phaseGroups: JSX.Element[] = [];
    phase.phaseGroups.forEach((phaseGroup) => {
      const groupSets: SetWithHighlight[] = [];
      phaseGroup.sets.forEach((set) => {
        if (!searchSubstr) {
          groupSets.push({ set });
        } else {
          let entrant1Highlight: Highlight | undefined;
          let entrant2Highlight: Highlight | undefined;
          let include = false;
          const includeStr = searchSubstr.toLowerCase();
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
            <Typography variant="h6">
              {phase.name}, {phaseGroup.name}
            </Typography>
            <Stack direction="row" gap="8px" flexWrap="wrap">
              {groupSets.map((setWithHighlight) => (
                <ListItemButton
                  key={`${prefix}${setWithHighlight.set.id}`}
                  style={{ flexGrow: 0 }}
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
                    <Typography variant="caption">
                      {setWithHighlight.set.fullRoundText}
                    </Typography>
                    {setWithHighlight.entrant1Highlight ? (
                      <Typography variant="body2">
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
                      </Typography>
                    ) : (
                      <Typography variant="body2">
                        {setWithHighlight.set.entrant1Name}
                      </Typography>
                    )}
                    {setWithHighlight.entrant2Highlight ? (
                      <Typography variant="body2">
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
                      </Typography>
                    ) : (
                      <Typography variant="body2">
                        {setWithHighlight.set.entrant2Name}
                      </Typography>
                    )}
                  </Stack>
                </ListItemButton>
              ))}
            </Stack>
          </Box>,
        );
      }
    });
    return phaseGroups;
  };
  const pendingPhases: JSX.Element[] = [];
  sets.pending.forEach((phase) => {
    pendingPhases.push(...mapStartggPhasePredicate(phase, true));
  });
  const completedPhases: JSX.Element[] = [];
  sets.completed.forEach((phase) => {
    completedPhases.push(...mapStartggPhasePredicate(phase, false));
  });

  return (
    <Stack>
      {pendingPhases.length > 0 && (
        <>
          <Typography variant="h5">Pending</Typography>
          <Stack>{pendingPhases}</Stack>
        </>
      )}
      {completedPhases.length > 0 && (
        <>
          <Typography variant="h5">Completed</Typography>
          <Stack>{completedPhases}</Stack>
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
