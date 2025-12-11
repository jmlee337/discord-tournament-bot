import { Clear } from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from '@mui/material';
import { MutableRefObject } from 'react';

export default function SearchBar({
  fullWidth,
  inputRef,
  searchSubstr,
  setSearchSubstr,
}: {
  fullWidth?: boolean;
  inputRef: MutableRefObject<HTMLInputElement | undefined>;
  searchSubstr: string;
  setSearchSubstr: (searchSubstr: string) => void;
}) {
  return (
    <Box style={{ padding: '8px 0' }}>
      <TextField
        label="Search"
        fullWidth={fullWidth}
        inputRef={inputRef}
        onChange={(event) => {
          setSearchSubstr(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setSearchSubstr('');
          } else if (
            ((window.electron.isMac && event.metaKey) ||
              (!window.electron.isMac && event.ctrlKey)) &&
            event.key === 'f'
          ) {
            event.preventDefault();
            event.stopPropagation();
            inputRef.current?.select();
          }
        }}
        size="small"
        value={searchSubstr}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip placement="top" title="Clear search">
                  <IconButton onClick={() => setSearchSubstr('')}>
                    <Clear />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}

SearchBar.defaultProps = {
  fullWidth: false,
};
