import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import { useState } from 'react';
import { HIGHLIGHT_COLOR, Highlight, DiscordUsername } from '../common/types';
import SearchBar from './SearchBar';
import DiscordIcon from './DiscordIcon';

type DiscordUsernameWithHighlight = {
  highlights: Highlight[];
  discordUsername: DiscordUsername;
};

export default function DiscordUsernames({
  discordUsernames,
}: {
  discordUsernames: DiscordUsername[];
}) {
  const [open, setOpen] = useState(false);
  const [searchSubstr, setSearchSubstr] = useState('');
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
      <Tooltip arrow title="View Discord usernames">
        <div>
          <IconButton
            disabled={discordUsernames.length === 0}
            onClick={() => {
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
          setOpen(false);
        }}
      >
        <DialogTitle>Discord Usernames</DialogTitle>
        <DialogContent>
          <SearchBar
            searchSubstr={searchSubstr}
            setSearchSubstr={setSearchSubstr}
          />
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
