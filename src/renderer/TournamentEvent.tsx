import { EventAvailable, TaskAlt } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FormEvent, useState } from 'react';
import { AdminedTournament, StartggTournament } from '../common/types';

export default function TournamentEvent({
  tournaments,
  tournament,
  setTournament,
  showErrorDialog,
}: {
  tournaments: AdminedTournament[];
  tournament: StartggTournament;
  setTournament: (tournament: StartggTournament) => void;
  showErrorDialog: (messages: string[]) => void;
}) {
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const getTournament = async (slug: string) => {
    setGettingTournament(true);
    try {
      setTournament(await window.electron.setTournament(slug));
      setTournamentDialogOpen(false);
    } catch (e: any) {
      const message = e instanceof Error ? e.message : e;
      showErrorDialog([message]);
    } finally {
      setGettingTournament(false);
    }
  };
  const getStartggTournamentOnSubmit = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      slug: { value: string };
    };
    const newSlug = target.slug.value;
    event.preventDefault();
    event.stopPropagation();
    if (newSlug) {
      getTournament(newSlug);
    }
  };

  return (
    <Stack direction="row" alignItems="center" padding="8px 0 8px 8px">
      <InputBase
        disabled
        size="small"
        value={tournament.name || 'Select start.gg tournament...'}
        style={{ flexGrow: 1 }}
      />
      <Tooltip placement="left" title="Select start.gg tournament">
        <IconButton
          onClick={async () => {
            setTournamentDialogOpen(true);
          }}
        >
          <EventAvailable />
        </IconButton>
      </Tooltip>
      <Dialog
        open={tournamentDialogOpen}
        onClose={() => {
          setTournamentDialogOpen(false);
        }}
      >
        <DialogTitle>Set start.gg tournament and event</DialogTitle>
        <DialogContent>
          <form
            onSubmit={getStartggTournamentOnSubmit}
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: '8px',
              margin: '8px 0',
            }}
          >
            <TextField
              autoFocus
              label="Tournament Slug"
              name="slug"
              placeholder={tournament.slug || 'only-noobs-200'}
              size="small"
              variant="outlined"
            />
            <Button
              disabled={gettingTournament}
              endIcon={
                gettingTournament ? (
                  <CircularProgress size="24px" />
                ) : (
                  <TaskAlt />
                )
              }
              type="submit"
              variant="contained"
            >
              Set
            </Button>
          </form>
          {tournaments.map((adminedTournament) => (
            <ListItemButton
              key={adminedTournament.slug}
              disabled={gettingTournament}
              onClick={() => {
                getTournament(adminedTournament.slug);
              }}
            >
              <ListItemText
                style={{ overflowX: 'hidden', whiteSpace: 'nowrap' }}
              >
                {adminedTournament.name}{' '}
                <Typography variant="caption">
                  ({adminedTournament.slug})
                </Typography>
              </ListItemText>
            </ListItemButton>
          ))}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
