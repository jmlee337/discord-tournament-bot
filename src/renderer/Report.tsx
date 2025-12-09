import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { useMemo, useState } from 'react';
import {
  HourglassTop,
  NotificationsActive,
  Restore,
  SaveAs,
} from '@mui/icons-material';
import styled from '@emotion/styled';
import { StartggSet } from '../common/types';
import getColor from './getColor';

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default function Report({
  open,
  setOpen,
  set,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  set: StartggSet;
}) {
  const [resetting, setResetting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [entrant1Dq, setEntrant1Dq] = useState(false);
  const [entrant1Win, setEntrant1Win] = useState(false);
  const [entrant2Dq, setEntrant2Dq] = useState(false);
  const [entrant2Win, setEntrant2Win] = useState(false);

  const resetForm = () => {
    setEntrant1Dq(false);
    setEntrant1Win(false);
    setEntrant2Dq(false);
    setEntrant2Win(false);
  };
  let winnerId = 0;
  if (entrant1Win || entrant2Dq) {
    winnerId = set.entrant1Id;
  } else if (entrant2Win || entrant1Dq) {
    winnerId = set.entrant2Id;
  }

  const titleEnd = useMemo(() => {
    const color = getColor(set);
    if (set.state === 2) {
      return <HourglassTop style={{ color }} />;
    }
    if (set.state === 6) {
      return <NotificationsActive style={{ color }} />;
    }
    return null;
  }, [set]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
      }}
    >
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        marginRight="24px"
      >
        <DialogTitle>Report Set</DialogTitle>
        {titleEnd}
      </Stack>
      <DialogContent sx={{ paddingTop: 0, width: '300px' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          typography="caption"
        >
          {set.fullRoundText}
        </Stack>
        <Stack
          alignItems="end"
          marginTop="4px"
          spacing="8px"
          sx={{ typography: 'body2' }}
        >
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            width="100%"
          >
            <Name>{set.entrant1Name}</Name>
            <Stack direction="row" spacing="8px">
              <Button
                color="secondary"
                variant={entrant1Dq ? 'contained' : 'outlined'}
                onClick={() => {
                  resetForm();
                  setEntrant1Dq(true);
                }}
              >
                DQ
              </Button>
              <Button
                color="secondary"
                variant={entrant1Win ? 'contained' : 'outlined'}
                onClick={() => {
                  resetForm();
                  setEntrant1Win(true);
                }}
              >
                W
              </Button>
            </Stack>
          </Stack>
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            width="100%"
          >
            <Name>{set.entrant2Name}</Name>
            <Stack direction="row" spacing="8px">
              <Button
                color="secondary"
                variant={entrant2Dq ? 'contained' : 'outlined'}
                onClick={() => {
                  resetForm();
                  setEntrant2Dq(true);
                }}
              >
                DQ
              </Button>
              <Button
                color="secondary"
                variant={entrant2Win ? 'contained' : 'outlined'}
                onClick={() => {
                  resetForm();
                  setEntrant2Win(true);
                }}
              >
                W
              </Button>
            </Stack>
          </Stack>
        </Stack>
        {reportError && <Alert severity="error">{reportError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button
          color="warning"
          disabled={set.state === 1 || reporting || resetting}
          endIcon={resetting ? <CircularProgress size="24px" /> : <Restore />}
          onClick={async () => {
            setResetting(true);
            setReportError('');
            try {
              await window.electron.resetSet(set.id);
              setOpen(false);
            } catch (e: any) {
              const message = e instanceof Error ? e.message : e;
              setReportError(message);
            } finally {
              setResetting(false);
            }
          }}
          variant="contained"
        >
          Reset Set
        </Button>
        <Button
          disabled={!winnerId || reporting || resetting}
          endIcon={reporting ? <CircularProgress size="24px" /> : <SaveAs />}
          onClick={async () => {
            setReporting(true);
            setReportError('');
            try {
              await window.electron.reportSet(
                set.id,
                winnerId,
                entrant1Dq || entrant2Dq,
              );
              resetForm();
              setOpen(false);
            } catch (e: any) {
              const message = e instanceof Error ? e.message : e;
              setReportError(message);
            } finally {
              setReporting(false);
            }
          }}
          variant="contained"
        >
          Report
        </Button>
      </DialogActions>
    </Dialog>
  );
}
