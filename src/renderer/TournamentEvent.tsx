import { Close, EventAvailable, TaskAlt } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
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
import {
  AdminedTournament,
  ConnectCode,
  DiscordUsername,
  StartggTournament,
} from '../common/types';

type RestoreTournament =
  | {
      shouldRestore: false;
    }
  | {
      shouldRestore: true;
      tournament: StartggTournament;
    };

export default function TournamentEvent({
  tournaments,
  tournament,
  setTournament,
  eventDescription,
  setEventDescription,
  setConnectCodes,
  setDiscordUsernames,
  showErrorDialog,
}: {
  tournaments: AdminedTournament[];
  tournament: StartggTournament;
  setTournament: (tournament: StartggTournament) => void;
  eventDescription: string;
  setEventDescription: (eventDescription: string) => void;
  setConnectCodes: (connectCodes: ConnectCode[]) => void;
  setDiscordUsernames: (discordUsernames: DiscordUsername[]) => void;
  showErrorDialog: (messages: string[]) => void;
}) {
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const [shouldRestore, setShouldRestore] = useState<RestoreTournament>({
    shouldRestore: false,
  });
  const getTournament = async (slug: string) => {
    let newTournament;
    setGettingTournament(true);
    try {
      newTournament = await window.electron.getTournament(slug);
      setTournament(newTournament);
    } catch (e: any) {
      const message = e instanceof Error ? e.message : e;
      showErrorDialog([message]);
    } finally {
      setGettingTournament(false);
    }
    if (newTournament && newTournament.events.length === 1) {
      const newEvent = newTournament.events[0];
      setGettingTournament(true);
      try {
        const participantConnections = await window.electron.setEvent(newEvent);
        setConnectCodes(participantConnections.connectCodes);
        setDiscordUsernames(participantConnections.discordUsernames);
        setEventDescription(`${newTournament.name}, ${newEvent.name}`);
        setShouldRestore({ shouldRestore: false });
        setTournamentDialogOpen(false);
      } catch (e: any) {
        const message = e instanceof Error ? e.message : e;
        showErrorDialog([message]);
      } finally {
        setGettingTournament(false);
      }
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
        value={eventDescription || 'Select start.gg event...'}
        style={{ flexGrow: 1 }}
      />
      <Tooltip placement="left" title="Select start.gg event">
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
          if (shouldRestore.shouldRestore) {
            setTournament({
              name: shouldRestore.tournament.name,
              slug: shouldRestore.tournament.slug,
              events: shouldRestore.tournament.events,
            });
          }
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
          {tournament.name ? (
            <Stack>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <DialogContentText>{tournament.name}</DialogContentText>
                {!gettingTournament && (
                  <Tooltip placement="right" title="Choose another tournament">
                    <IconButton
                      onClick={() => {
                        setShouldRestore({
                          shouldRestore: true,
                          tournament: {
                            name: tournament.name,
                            slug: tournament.slug,
                            events: tournament.events,
                          },
                        });
                        setTournament({ name: '', slug: '', events: [] });
                      }}
                    >
                      <Close />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              {tournament.events.map((event) => (
                <ListItemButton
                  disabled={gettingTournament}
                  key={event.id}
                  onClick={async () => {
                    try {
                      setGettingTournament(true);
                      const participantConnections =
                        await window.electron.setEvent(event);
                      setConnectCodes(participantConnections.connectCodes);
                      setDiscordUsernames(
                        participantConnections.discordUsernames,
                      );
                      setEventDescription(`${tournament.name}, ${event.name}`);
                      setShouldRestore({ shouldRestore: false });
                      setTournamentDialogOpen(false);
                    } catch (e: any) {
                      const message = e instanceof Error ? e.message : e;
                      showErrorDialog([message]);
                    } finally {
                      setGettingTournament(false);
                    }
                  }}
                >
                  <ListItemText>{event.name}</ListItemText>
                </ListItemButton>
              ))}
            </Stack>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
