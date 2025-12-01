import { Chip, createTheme, ThemeProvider, Tooltip } from '@mui/material';
import { DragEvent, useCallback, useMemo } from 'react';
import { LiveTv, PlayArrow } from '@mui/icons-material';
import { Broadcast } from '../common/types';

function dragStart(event: DragEvent<HTMLDivElement>) {
  event.dataTransfer.setData(
    'text/plain',
    event.currentTarget.dataset.broadcastId!,
  );
}

export function DraggableChip({
  broadcast,
  selectedChipBroadcastId,
  setSelectedChipBroadcastId,
}: {
  broadcast: Broadcast;
  selectedChipBroadcastId: string;
  setSelectedChipBroadcastId: (broadcastId: string) => void;
}) {
  const isSelected = useMemo(
    () => selectedChipBroadcastId === broadcast.id,
    [broadcast, selectedChipBroadcastId],
  );

  return (
    <ThemeProvider
      theme={createTheme({
        components: {
          MuiButtonBase: {
            defaultProps: {
              disableRipple: true,
            },
          },
          MuiChip: {
            styleOverrides: {
              icon: {
                marginLeft: '3px',
                marginRight: '3px',
              },
              label: {
                padding: 0,
              },
            },
          },
        },
        palette: {
          primary: {
            contrastText: '#FFF',
            light: '#5BCEFA',
            main: '#5BCEFA',
            dark: '#5BCEFA',
          },
          action: {
            hover: 'rgba(0, 0, 0, 0.04)',
          },
        },
      })}
    >
      <Chip
        color={isSelected ? 'primary' : undefined}
        data-broadcast-id={broadcast.id}
        draggable
        icon={<PlayArrow />}
        onClick={() => {
          if (isSelected) {
            setSelectedChipBroadcastId('');
          } else {
            setSelectedChipBroadcastId(broadcast.id);
          }
        }}
        onDragStart={dragStart}
        variant={isSelected ? 'filled' : 'outlined'}
      />
    </ThemeProvider>
  );
}

export function DroppableChip({
  selectedChipBroadcastId,
  onClickOrDrop,
}: {
  selectedChipBroadcastId: string;
  onClickOrDrop: (broadcastId: string) => void;
}) {
  const drop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onClickOrDrop(event.dataTransfer.getData('text/plain'));
    },
    [onClickOrDrop],
  );

  const hasSelectedChip = useMemo(
    () => Boolean(selectedChipBroadcastId),
    [selectedChipBroadcastId],
  );

  const dragEnterOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return (
    <ThemeProvider
      theme={createTheme({
        components: {
          MuiChip: {
            styleOverrides: {
              icon: {
                marginLeft: '3px',
                marginRight: '3px',
              },
              label: {
                padding: 0,
              },
            },
          },
        },
        palette: {
          secondary: {
            contrastText: '#FFF',
            light: '#F5A9B8',
            main: '#F5A9B8',
            dark: '#F5A9B8',
          },
        },
      })}
    >
      <Tooltip
        placement="top"
        title={hasSelectedChip ? `Click to spectate` : `Drop here to spectate`}
      >
        <Chip
          color={hasSelectedChip ? 'secondary' : undefined}
          icon={<LiveTv />}
          onClick={
            hasSelectedChip
              ? (event) => {
                  onClickOrDrop(selectedChipBroadcastId);
                  event.stopPropagation();
                }
              : undefined
          }
          onDrop={drop}
          onDragEnter={dragEnterOver}
          onDragOver={dragEnterOver}
          sx={{
            backgroundColor: (theme) => theme.palette.background.default,
            zIndex: 2,
          }}
          variant="outlined"
        />
      </Tooltip>
    </ThemeProvider>
  );
}
