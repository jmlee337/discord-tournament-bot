import { Chip, createTheme, ThemeProvider, Tooltip } from '@mui/material';
import { DragEvent, useCallback, useMemo } from 'react';
import { LiveTv, PlayArrow } from '@mui/icons-material';
import { Broadcast, ChipData } from '../common/types';

function dragStart(event: DragEvent<HTMLDivElement>) {
  const chipData: ChipData = {
    id: event.currentTarget.dataset.id!,
    connectCode: event.currentTarget.dataset.connectCode!,
    gamerTag: event.currentTarget.dataset.gamerTag,
    slippiName: event.currentTarget.dataset.slippiName!,
  };
  event.dataTransfer.setData('text/plain', JSON.stringify(chipData));
}

export function DraggableChip({
  broadcast,
  selectedChipData,
  setSelectedChipData,
}: {
  broadcast: Broadcast;
  selectedChipData: ChipData;
  setSelectedChipData: (chipData: ChipData) => void;
}) {
  const isSelected = useMemo(
    () => selectedChipData.id === broadcast.id,
    [broadcast, selectedChipData],
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
                marginRight: '4px',
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
        data-id={broadcast.id}
        data-connect-code={broadcast.connectCode}
        data-gamer-tag={broadcast.gamerTag}
        data-slippi-name={broadcast.slippiName}
        draggable
        icon={<PlayArrow />}
        onClick={() => {
          if (isSelected) {
            setSelectedChipData({
              id: '',
              connectCode: '',
              slippiName: '',
            });
          } else {
            setSelectedChipData(broadcast);
          }
        }}
        onDragStart={dragStart}
        variant={isSelected ? 'filled' : 'outlined'}
      />
    </ThemeProvider>
  );
}

export function DroppableChip({
  selectedChipData,
  onClickOrDrop,
}: {
  selectedChipData: ChipData;
  onClickOrDrop: (chipData: ChipData) => void;
}) {
  const drop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const chipData = JSON.parse(
        event.dataTransfer.getData('text/plain'),
      ) as ChipData;
      onClickOrDrop(chipData);
    },
    [onClickOrDrop],
  );

  const hasSelectedChip = useMemo(
    () => Boolean(selectedChipData.id),
    [selectedChipData],
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
                marginRight: '4px',
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
        arrow
        title={hasSelectedChip ? `Click to spectate` : `Drop here to spectate`}
      >
        <Chip
          color={hasSelectedChip ? 'secondary' : undefined}
          icon={<LiveTv />}
          onClick={
            hasSelectedChip
              ? (event) => {
                  onClickOrDrop(selectedChipData);
                  event.stopPropagation();
                }
              : undefined
          }
          onDrop={drop}
          onDragEnter={dragEnterOver}
          onDragOver={dragEnterOver}
          variant="outlined"
        />
      </Tooltip>
    </ThemeProvider>
  );
}
