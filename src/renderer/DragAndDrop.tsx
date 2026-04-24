import {
  Chip,
  createTheme,
  ThemeProvider,
  Tooltip,
  Typography,
} from '@mui/material';
import { DragEvent, useCallback, useMemo } from 'react';
import { PlayArrow } from '@mui/icons-material';
import { Broadcast } from '../common/types';

function dragStart(event: DragEvent<HTMLDivElement>) {
  event.dataTransfer.setData(
    'text/plain',
    event.currentTarget.dataset.broadcastId!,
  );
}

export function DraggableChip({
  broadcast,
  disabled,
  selectedChipBroadcastId,
  setSelectedChipBroadcastId,
}: {
  broadcast: Broadcast;
  disabled: boolean;
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
                margin: 0,
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
      <Tooltip
        placement="left"
        title={disabled ? 'Spectating...' : 'Click or drag to spectate'}
      >
        <span>
          <Chip
            color={isSelected ? 'primary' : undefined}
            data-broadcast-id={broadcast.id}
            disabled={disabled}
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
            sx={{
              borderRadius: '20px',
              height: '40px',
              width: '40px',
            }}
            variant={isSelected ? 'filled' : 'outlined'}
          />
        </span>
      </Tooltip>
    </ThemeProvider>
  );
}

export function DroppableChip({
  label,
  selectedChipBroadcastId,
  onClickOrDrop,
}: {
  label: string;
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
        placement="bottom-start"
        title={hasSelectedChip ? `Click to spectate` : `Drop here to spectate`}
      >
        <Chip
          color={hasSelectedChip ? 'secondary' : undefined}
          label={<Typography variant="h6">{label}</Typography>}
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
            backgroundColor: (theme) =>
              hasSelectedChip ? undefined : theme.palette.background.default,
          }}
          style={{
            height: '40px',
            borderRadius: '20px',
          }}
          variant={hasSelectedChip ? 'filled' : 'outlined'}
        />
      </Tooltip>
    </ThemeProvider>
  );
}
