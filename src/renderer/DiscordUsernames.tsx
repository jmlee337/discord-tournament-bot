import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { ContentCopy } from '@mui/icons-material';
import {
  HIGHLIGHT_COLOR,
  Highlight,
  DiscordUsername,
  IsDiscordServerMember,
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
}: {
  discordUsernames: DiscordUsername[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>();
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
          <Stack direction="row" alignItems="center" gap="8px">
            <Typography variant="caption">
              Players can update their Discord connection at
              <br />
              <Link
                href="https://www.start.gg/admin/profile/connected-accounts"
                target="_blank"
                rel="noreferrer"
              >
                https://www.start.gg/admin/profile/connected-accounts
              </Link>
            </Typography>
            <Button
              style={{ width: '94px' }}
              variant="contained"
              disabled={copied}
              endIcon={copied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copyToClipboard(
                  'https://www.start.gg/admin/profile/connected-accounts',
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 5000);
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <SearchBar
            fullWidth
            inputRef={searchInputRef}
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
                <TableRow key={duwh.discordUsername.participantId}>
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
                  <TableCell
                    sx={
                      duwh.discordUsername.isDiscordServerMember ===
                      IsDiscordServerMember.NO
                        ? {
                            color: (theme) => theme.palette.error.main,
                            textDecoration: 'line-through',
                          }
                        : undefined
                    }
                  >
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
