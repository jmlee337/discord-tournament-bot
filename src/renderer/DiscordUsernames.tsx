import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import { useRef, useState } from 'react';
import { Refresh } from '@mui/icons-material';
import {
  HIGHLIGHT_COLOR,
  Highlight,
  DiscordUsername,
  ConnectCode,
} from '../common/types';
import SearchBar from './SearchBar';
import DiscordIcon from './DiscordIcon';
import {
  popWindowEventListener,
  pushWindowEventListener,
  WindowEvent,
} from './windowEvent';

type DiscordUsernameWithHighlight = {
  highlights: Highlight[];
  discordUsername: DiscordUsername;
};

export default function DiscordUsernames({
  discordUsernames,
  setConnectCodes,
  setDiscordUsernames,
  showErrorDialog,
}: {
  discordUsernames: DiscordUsername[];
  setConnectCodes: (connectCodes: ConnectCode[]) => void;
  setDiscordUsernames: (discordUsernames: DiscordUsername[]) => void;
  showErrorDialog: (messages: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>();
  const [searchSubstr, setSearchSubstr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const discordUsernamesWithHighlights: DiscordUsernameWithHighlight[] = [];
  discordUsernames.forEach((discordUsername) => {
    if (!searchSubstr) {
      discordUsernamesWithHighlights.push({
        highlights: [],
        discordUsername,
      });
      return;
    }

    const highlights: Highlight[] = [];
    let include = false;
    const includeStr = searchSubstr.toLowerCase();
    const gamerTagStart = discordUsername.gamerTag
      .toLowerCase()
      .indexOf(includeStr);
    if (gamerTagStart >= 0) {
      include = true;
      highlights[0] = {
        start: gamerTagStart,
        end: gamerTagStart + includeStr.length,
      };
    }
    const usernameStart = discordUsername.username
      .toLowerCase()
      .indexOf(includeStr);
    if (usernameStart >= 0) {
      include = true;
      highlights[1] = {
        start: usernameStart,
        end: usernameStart + includeStr.length,
      };
    }
    if (include) {
      discordUsernamesWithHighlights.push({
        highlights,
        discordUsername,
      });
    }
  });

  return (
    <>
      <Tooltip placement="top" title="View Discord usernames">
        <div>
          <IconButton
            disabled={discordUsernames.length === 0}
            onClick={() => {
              pushWindowEventListener(WindowEvent.CTRLF, () => {
                searchInputRef.current?.select();
              });
              setOpen(true);
            }}
          >
            <DiscordIcon />
          </IconButton>
        </div>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => {
          popWindowEventListener(WindowEvent.CTRLF);
          setOpen(false);
        }}
      >
        <DialogTitle>Discord Usernames</DialogTitle>
        <DialogContent>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <SearchBar
              inputRef={searchInputRef}
              searchSubstr={searchSubstr}
              setSearchSubstr={setSearchSubstr}
            />
            <Tooltip
              placement="top"
              title={refreshing ? 'Refreshing' : 'Refresh'}
            >
              <span>
                <IconButton
                  disabled={refreshing}
                  onClick={async () => {
                    try {
                      setRefreshing(true);
                      const participantConnections =
                        await window.electron.refreshParticipants();
                      setConnectCodes(participantConnections.connectCodes);
                      setDiscordUsernames(
                        participantConnections.discordUsernames,
                      );
                    } catch (e: any) {
                      const message = e instanceof Error ? e.message : e;
                      showErrorDialog([message]);
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                >
                  {refreshing ? <CircularProgress size="24px" /> : <Refresh />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>start.gg</TableCell>
                <TableCell>Discord</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {discordUsernamesWithHighlights.map((duwh) => (
                <TableRow key={duwh.discordUsername.id}>
                  <TableCell>
                    {duwh.highlights[0] ? (
                      <>
                        <span>
                          {duwh.discordUsername.gamerTag.substring(
                            0,
                            duwh.highlights[0].start,
                          )}
                        </span>
                        <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                          {duwh.discordUsername.gamerTag.substring(
                            duwh.highlights[0].start,
                            duwh.highlights[0].end,
                          )}
                        </span>
                        <span>
                          {duwh.discordUsername.gamerTag.substring(
                            duwh.highlights[0].end,
                          )}
                        </span>
                      </>
                    ) : (
                      duwh.discordUsername.gamerTag
                    )}
                  </TableCell>
                  <TableCell>
                    {duwh.highlights[1] ? (
                      <>
                        <span>
                          {duwh.discordUsername.username.substring(
                            0,
                            duwh.highlights[1].start,
                          )}
                        </span>
                        <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                          {duwh.discordUsername.username.substring(
                            duwh.highlights[1].start,
                            duwh.highlights[1].end,
                          )}
                        </span>
                        <span>
                          {duwh.discordUsername.username.substring(
                            duwh.highlights[1].end,
                          )}
                        </span>
                      </>
                    ) : (
                      duwh.discordUsername.username
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
