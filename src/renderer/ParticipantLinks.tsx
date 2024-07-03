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
import { Cable } from '@mui/icons-material';
import { useState } from 'react';
import { HIGHLIGHT_COLOR, Highlight, LinkedParticipant } from '../common/types';
import SearchBar from './SearchBar';

type LinkedParticipantWithHighlight = {
  highlights: Highlight[];
  linkedParticipant: LinkedParticipant;
};

export default function ParticipantLinks({
  open,
  setOpen,
  linkedParticipants,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  linkedParticipants: LinkedParticipant[];
}) {
  const [searchSubstr, setSearchSubstr] = useState('');
  const linkedParticipantWithHighlights: LinkedParticipantWithHighlight[] = [];
  linkedParticipants.forEach((linkedParticipant) => {
    if (!searchSubstr) {
      linkedParticipantWithHighlights.push({
        highlights: [],
        linkedParticipant,
      });
      return;
    }

    const highlights: Highlight[] = [];
    let include = false;
    const includeStr = searchSubstr.toLowerCase();
    const gamerTagStart = linkedParticipant.gamerTag
      .toLowerCase()
      .indexOf(includeStr);
    if (gamerTagStart >= 0) {
      include = true;
      highlights[0] = {
        start: gamerTagStart,
        end: gamerTagStart + includeStr.length,
      };
    }
    const usernameStart = linkedParticipant.username
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
      linkedParticipantWithHighlights.push({ highlights, linkedParticipant });
    }
  });

  return (
    <>
      <Tooltip arrow title="View participant links">
        <div>
          <IconButton
            disabled={linkedParticipants.length === 0}
            onClick={() => {
              setOpen(true);
            }}
          >
            <Cable />
          </IconButton>
        </div>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <DialogTitle>Participant Links</DialogTitle>
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
              {linkedParticipantWithHighlights.map((lpwh) => (
                <TableRow>
                  <TableCell>
                    {lpwh.highlights[0] ? (
                      <>
                        <span>
                          {lpwh.linkedParticipant.gamerTag.substring(
                            0,
                            lpwh.highlights[0].start,
                          )}
                        </span>
                        <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                          {lpwh.linkedParticipant.gamerTag.substring(
                            lpwh.highlights[0].start,
                            lpwh.highlights[0].end,
                          )}
                        </span>
                        <span>
                          {lpwh.linkedParticipant.gamerTag.substring(
                            lpwh.highlights[0].end,
                          )}
                        </span>
                      </>
                    ) : (
                      lpwh.linkedParticipant.gamerTag
                    )}
                  </TableCell>
                  <TableCell>
                    {lpwh.highlights[1] ? (
                      <>
                        <span>
                          {lpwh.linkedParticipant.username.substring(
                            0,
                            lpwh.highlights[1].start,
                          )}
                        </span>
                        <span style={{ backgroundColor: HIGHLIGHT_COLOR }}>
                          {lpwh.linkedParticipant.username.substring(
                            lpwh.highlights[1].start,
                            lpwh.highlights[1].end,
                          )}
                        </span>
                        <span>
                          {lpwh.linkedParticipant.username.substring(
                            lpwh.highlights[1].end,
                          )}
                        </span>
                      </>
                    ) : (
                      lpwh.linkedParticipant.username
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
