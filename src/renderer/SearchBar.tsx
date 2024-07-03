import { Clear } from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from '@mui/material';

export default function SearchBar({
  searchSubstr,
  setSearchSubstr,
}: {
  searchSubstr: string;
  setSearchSubstr: (searchSubstr: string) => void;
}) {
  return (
    <Box style={{ padding: '8px 0' }}>
      <TextField
        label="Search"
        onChange={(event) => {
          setSearchSubstr(event.target.value);
        }}
        size="small"
        value={searchSubstr}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Clear search">
                <IconButton onClick={() => setSearchSubstr('')}>
                  <Clear />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
}
