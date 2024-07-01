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
import styled from '@emotion/styled';
import { useState } from 'react';
import { Restore, SwapHoriz } from '@mui/icons-material';
import { StartggSet } from '../common/types';

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default function Reset({
  open,
  setOpen,
  set,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  set: StartggSet;
}) {
  const [resetting, setResetting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [reportError, setReportError] = useState('');

  const entrant1Dq = set.isDQ && set.winnerId === set.entrant2Id;
  const entrant1Win = set.winnerId === set.entrant1Id;
  const entrant2Dq = set.isDQ && set.winnerId === set.entrant1Id;
  const entrant2Win = set.winnerId === set.entrant2Id;
  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
      }}
    >
      <DialogTitle>Reset Set?</DialogTitle>
      <DialogContent sx={{ width: '300px' }}>
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
                disabled={!entrant1Dq}
                variant={entrant1Dq ? 'contained' : 'outlined'}
              >
                DQ
              </Button>
              <Button
                color="secondary"
                disabled={!entrant1Win}
                variant={entrant1Win ? 'contained' : 'outlined'}
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
                disabled={!entrant2Dq}
                variant={entrant2Dq ? 'contained' : 'outlined'}
              >
                DQ
              </Button>
              <Button
                color="secondary"
                disabled={!entrant2Win}
                variant={entrant2Win ? 'contained' : 'outlined'}
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
          disabled={resetting || swapping}
          endIcon={swapping ? <CircularProgress size="24px" /> : <SwapHoriz />}
          onClick={async () => {
            setSwapping(true);
            setReportError('');
            try {
              await window.electron.swapWinner(set);
              setOpen(false);
            } catch (e: any) {
              const message = e instanceof Error ? e.message : e;
              setReportError(message);
            } finally {
              setSwapping(false);
            }
          }}
          variant="contained"
        >
          Swap Winner
        </Button>
        <Button
          disabled={resetting || swapping}
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
      </DialogActions>
    </Dialog>
  );
}
