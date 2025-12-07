import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputBase,
  InputLabel,
  MenuItem,
  Rating,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  CheckBox,
  CheckBoxOutlineBlank,
  DisplaySettings,
  OpenInBrowser,
  Restore,
  TextSnippet,
} from '@mui/icons-material';
import { blue, green, grey, red, yellow } from '@mui/material/colors';
import styled from '@emotion/styled';
import {
  MSTBestOf,
  MSTCharacter,
  MSTCharacterToSkinColors,
  MSTPortColor,
  MSTScoreboardInfo,
  MSTSkinColor,
  MSTWL,
  SHEIK_SKIN_TO_ZELDA_SKIN,
  ZELDA_SKIN_TO_SHEIK_SKIN,
} from '../common/mst';
import LabeledCheckbox from './LabeledCheckbox';

const StyledRating = styled(Rating)({
  '& .MuiRating-iconFilled': {
    color: blue[700],
  },
  '& .MuiRating-iconHover': {
    color: blue[700],
  },
});

export default function Overlay({
  enableMST,
  resourcesPath,
  gotSettings,
  sggTournamentName,
  setEnableMST,
  setResourcesPath,
  showErrorDialog,
}: {
  enableMST: boolean;
  resourcesPath: string;
  gotSettings: boolean;
  sggTournamentName: string;
  setEnableMST: (newEnableMST: boolean) => void;
  setResourcesPath: (newResourcesPath: string) => void;
  showErrorDialog: (errors: string[]) => void;
}) {
  const [enableSkinColor, setEnableSkinColor] = useState(false);
  const [enableSggSponsors, setEnableSggSponsors] = useState(false);
  const [enableSggRound, setEnableSggRound] = useState(false);
  const [simpleTextPathA, setSimpleTextPathA] = useState('');
  const [simpleTextPathB, setSimpleTextPathB] = useState('');
  const [simpleTextPathC, setSimpleTextPathC] = useState('');
  const [updateAutomatically, setUpdateAutomatically] = useState(false);

  useEffect(() => {
    (async () => {
      const enableSkinColorPromise = window.electron.getEnableSkinColor();
      const enableSggSponsorsPromise = window.electron.getEnableSggSponsors();
      const enableSggRoundPromise = window.electron.getEnableSggRound();
      const simpleTextPathAPromise = window.electron.getSimpleTextPathA();
      const simpleTextPathBPromise = window.electron.getSimpleTextPathB();
      const simpleTextPathCPromise = window.electron.getSimpleTextPathC();
      const updateAutomaticallyPromise =
        window.electron.getUpdateAutomatically();
      setEnableSkinColor(await enableSkinColorPromise);
      setEnableSggSponsors(await enableSggSponsorsPromise);
      setEnableSggRound(await enableSggRoundPromise);
      setSimpleTextPathA(await simpleTextPathAPromise);
      setSimpleTextPathB(await simpleTextPathBPromise);
      setSimpleTextPathC(await simpleTextPathCPromise);
      setUpdateAutomatically(await updateAutomaticallyPromise);
    })();
  }, []);

  const [p1Name, setP1Name] = useState('');
  const [p1Team, setP1Team] = useState('');
  const [p1Character, setP1Character] = useState(MSTCharacter.RANDOM);
  const [p1Skin, setP1Skin] = useState<MSTSkinColor>('Default');
  const [p1Color, setP1Color] = useState<MSTPortColor>('Red');
  const [p1Score, setP1Score] = useState(0);
  const [p1WL, setP1WL] = useState<MSTWL>('Nada');
  const [p2Name, setP2Name] = useState('');
  const [p2Team, setP2Team] = useState('');
  const [p2Character, setP2Character] = useState(MSTCharacter.RANDOM);
  const [p2Skin, setP2Skin] = useState<MSTSkinColor>('Default');
  const [p2Color, setP2Color] = useState<MSTPortColor>('Blue');
  const [p2Score, setP2Score] = useState(0);
  const [p2WL, setP2WL] = useState<MSTWL>('Nada');
  const [bestOf, setBestOf] = useState<MSTBestOf>('Bo3');
  const [round, setRound] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [caster1Name, setCaster1Name] = useState('');
  const [caster1Twitter, setCaster1Twitter] = useState('');
  const [caster1Twitch, setCaster1Twitch] = useState('');
  const [caster2Name, setCaster2Name] = useState('');
  const [caster2Twitter, setCaster2Twitter] = useState('');
  const [caster2Twitch, setCaster2Twitch] = useState('');

  const setScoreboardInfo = useCallback(
    (newScoreboardInfo: MSTScoreboardInfo) => {
      setP1Name(newScoreboardInfo.p1Name);
      setP1Team(newScoreboardInfo.p1Team);
      setP1Character(newScoreboardInfo.p1Character);
      setP1Skin(newScoreboardInfo.p1Skin);
      setP1Color(newScoreboardInfo.p1Color);
      setP1Score(newScoreboardInfo.p1Score);
      setP1WL(newScoreboardInfo.p1WL);
      setP2Name(newScoreboardInfo.p2Name);
      setP2Team(newScoreboardInfo.p2Team);
      setP2Character(newScoreboardInfo.p2Character);
      setP2Skin(newScoreboardInfo.p2Skin);
      setP2Color(newScoreboardInfo.p2Color);
      setP2Score(newScoreboardInfo.p2Score);
      setP2WL(newScoreboardInfo.p2WL);
      setBestOf(newScoreboardInfo.bestOf);
      setRound(newScoreboardInfo.round);
      setTournamentName(newScoreboardInfo.tournamentName);
      setCaster1Name(newScoreboardInfo.caster1Name);
      setCaster1Twitter(newScoreboardInfo.caster1Twitter);
      setCaster1Twitch(newScoreboardInfo.caster1Twitch);
      setCaster2Name(newScoreboardInfo.caster2Name);
      setCaster2Twitter(newScoreboardInfo.caster2Twitter);
      setCaster2Twitch(newScoreboardInfo.caster2Twitch);
    },
    [],
  );

  useEffect(() => {
    (async () => {
      if (gotSettings && enableMST && resourcesPath) {
        try {
          setScoreboardInfo(await window.electron.getScoreboardInfo());
        } catch (e: any) {
          showErrorDialog([e instanceof Error ? e.message : e]);
        }
      }
    })();
  }, [
    enableMST,
    resourcesPath,
    gotSettings,
    setScoreboardInfo,
    showErrorDialog,
  ]);

  useEffect(() => {
    window.electron.onScoreboardInfo((event, newScoreboardInfo) => {
      setScoreboardInfo(newScoreboardInfo);
    });
  }, [setScoreboardInfo]);

  const [open, setOpen] = useState(false);
  const [choosingResourcesPath, setChoosingResourcesPath] = useState(false);
  const [choosingSimpleTextPathA, setChoosingSimpleTextPathA] = useState(false);
  const [choosingSimpleTextPathB, setChoosingSimpleTextPathB] = useState(false);
  const [choosingSimpleTextPathC, setChoosingSimpleTextPathC] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const updateFunc = useCallback(async () => {
    try {
      setUpdating(true);
      await window.electron.setScoreboardInfo({
        p1Name,
        p1Team,
        p1Character,
        p1Skin,
        p1Color,
        p1Score,
        p1WL,
        p2Name,
        p2Team,
        p2Character,
        p2Skin,
        p2Color,
        p2Score,
        p2WL,
        bestOf,
        round,
        tournamentName,
        caster1Name,
        caster1Twitter,
        caster1Twitch,
        caster2Name,
        caster2Twitter,
        caster2Twitch,
      });
    } catch (e: any) {
      showErrorDialog([e instanceof Error ? e.message : e]);
    } finally {
      setUpdating(false);
    }
  }, [
    p1Name,
    p1Team,
    p1Character,
    p1Skin,
    p1Color,
    p1Score,
    p1WL,
    p2Name,
    p2Team,
    p2Character,
    p2Skin,
    p2Color,
    p2Score,
    p2WL,
    bestOf,
    round,
    tournamentName,
    caster1Name,
    caster1Twitter,
    caster1Twitch,
    caster2Name,
    caster2Twitter,
    caster2Twitch,
    showErrorDialog,
  ]);

  return (
    <Stack>
      <Dialog
        fullWidth
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="14px"
        >
          <DialogTitle>Melee Stream Tool Integration</DialogTitle>
          <Tooltip placement="left" title="Enabled">
            <Switch
              checked={enableMST}
              onChange={async (event, checked) => {
                await window.electron.setEnableMST(checked);
                setEnableMST(checked);
              }}
            />
          </Tooltip>
        </Stack>
        <DialogContent sx={{ pt: 0 }}>
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={
                resourcesPath ||
                'Set Melee Stream Tool/Melee Ghost Streamer Resources folder...'
              }
              style={{ flexGrow: 1 }}
            />
            <Tooltip
              placement="left"
              title={
                enableMST
                  ? 'Set Melee Stream Tool/Melee Ghost Streamer Resources folder'
                  : 'Melee Stream Tool/Melee Ghost Streamer overlay disabled'
              }
            >
              <div>
                <IconButton
                  disabled={!enableMST || choosingResourcesPath}
                  onClick={async () => {
                    try {
                      setChoosingResourcesPath(true);
                      setResourcesPath(
                        await window.electron.chooseResourcesPath(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingResourcesPath(false);
                    }
                  }}
                >
                  {choosingResourcesPath ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <DisplaySettings />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
          <Stack alignItems="end">
            <LabeledCheckbox
              checked={updateAutomatically}
              disabled={!enableMST || !resourcesPath}
              label="Update automatically from Slippi/start.gg"
              labelPlacement="start"
              set={async (checked) => {
                await window.electron.setUpdateAutomatically(checked);
                setUpdateAutomatically(checked);
              }}
            />
            <LabeledCheckbox
              checked={enableSkinColor}
              disabled={!enableMST || !resourcesPath}
              label="Enable character colors"
              labelPlacement="start"
              set={async (checked) => {
                await window.electron.setEnableSkinColor(checked);
                setEnableSkinColor(checked);
              }}
            />
            <LabeledCheckbox
              checked={enableSggSponsors}
              disabled={!enableMST || !resourcesPath}
              label="Use sponsor tags from start.gg"
              labelPlacement="start"
              set={async (checked) => {
                await window.electron.setEnableSggSponsors(checked);
                setEnableSggSponsors(checked);
              }}
            />
          </Stack>
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={simpleTextPathA || 'Set simple text file A...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip
              placement="left"
              title={
                enableMST
                  ? 'Set simple text file A'
                  : 'Melee Stream Tool/Melee Ghost Streamer overlay disabled'
              }
            >
              <div>
                <IconButton
                  disabled={!enableMST || choosingSimpleTextPathA}
                  onClick={async () => {
                    try {
                      setChoosingSimpleTextPathA(true);
                      setSimpleTextPathA(
                        await window.electron.chooseSimpleTextPathA(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingSimpleTextPathA(false);
                    }
                  }}
                >
                  {choosingSimpleTextPathA ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TextSnippet />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={simpleTextPathB || 'Set simple text file B...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip
              placement="left"
              title={
                enableMST
                  ? 'Set simple text file B'
                  : 'Melee Stream Tool/Melee Ghost Streamer overlay disabled'
              }
            >
              <div>
                <IconButton
                  disabled={!enableMST || choosingSimpleTextPathB}
                  onClick={async () => {
                    try {
                      setChoosingSimpleTextPathB(true);
                      setSimpleTextPathB(
                        await window.electron.chooseSimpleTextPathB(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingSimpleTextPathB(false);
                    }
                  }}
                >
                  {choosingSimpleTextPathB ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TextSnippet />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
          <Stack direction="row" alignItems="center" marginRight="-9px">
            <InputBase
              disabled
              size="small"
              value={simpleTextPathC || 'Set simple text file C...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip
              placement="left"
              title={
                enableMST
                  ? 'Set simple text file C'
                  : 'Melee Stream Tool/Melee Ghost Streamer overlay disabled'
              }
            >
              <div>
                <IconButton
                  disabled={!enableMST || choosingSimpleTextPathC}
                  onClick={async () => {
                    try {
                      setChoosingSimpleTextPathC(true);
                      setSimpleTextPathC(
                        await window.electron.chooseSimpleTextPathC(),
                      );
                    } catch (e: any) {
                      showErrorDialog([e instanceof Error ? e.message : e]);
                    } finally {
                      setChoosingSimpleTextPathC(false);
                    }
                  }}
                >
                  {choosingSimpleTextPathC ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <TextSnippet />
                  )}
                </IconButton>
              </div>
            </Tooltip>
          </Stack>
        </DialogContent>
      </Dialog>
      <Stack gap="16px">
        <Stack
          direction="row"
          alignItems="center"
          divider={
            <Divider
              flexItem
              orientation="vertical"
              style={{ height: '152px', margin: '0 16px' }}
            />
          }
        >
          <Stack flexBasis="50%" spacing="8px">
            <Stack direction="row" spacing="8px">
              <TextField
                disabled={!enableMST || !resourcesPath}
                variant="outlined"
                size="small"
                style={{ width: '89px' }}
                label="Sponsor"
                value={p1Team}
                onChange={(event) => {
                  setP1Team(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    updateFunc();
                  }
                }}
              />
              <TextField
                disabled={!enableMST || !resourcesPath}
                variant="outlined"
                size="small"
                label="Player 1"
                value={p1Name}
                onChange={(event) => {
                  setP1Name(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    updateFunc();
                  }
                }}
              />
              <Tooltip placement="top" title="Port Color">
                <Select
                  disabled={!enableMST || !resourcesPath}
                  size="small"
                  value={p1Color}
                  onChange={(event) => {
                    setP1Color(event.target.value);
                  }}
                  sx={{
                    backgroundColor: () => {
                      switch (p1Color) {
                        case 'Red':
                          return red[400];
                        case 'Blue':
                          return blue[400];
                        case 'Yellow':
                          return yellow[400];
                        case 'Green':
                          return green[400];
                        case 'CPU':
                          return grey[400];
                        default:
                          throw new Error('unreachable');
                      }
                    },
                  }}
                >
                  <MenuItem value="Red" style={{ backgroundColor: red[400] }}>
                    Red
                  </MenuItem>
                  <MenuItem value="Blue" style={{ backgroundColor: blue[400] }}>
                    Blue
                  </MenuItem>
                  <MenuItem
                    value="Yellow"
                    style={{ backgroundColor: yellow[400] }}
                  >
                    Yellow
                  </MenuItem>
                  <MenuItem
                    value="Green"
                    style={{ backgroundColor: green[400] }}
                  >
                    Green
                  </MenuItem>
                  <MenuItem value="CPU" style={{ backgroundColor: grey[400] }}>
                    CPU
                  </MenuItem>
                </Select>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing="8px">
              <FormControlLabel
                disabled={!enableMST || !resourcesPath}
                label="Wins"
                labelPlacement="start"
                slotProps={{ typography: { style: { marginRight: '4px' } } }}
                style={{ height: '40px' }}
                control={
                  <StyledRating
                    max={bestOf === 'Bo5' ? 3 : 2}
                    icon={<CheckBox fontSize="inherit" />}
                    emptyIcon={<CheckBoxOutlineBlank fontSize="inherit" />}
                    value={p1Score}
                    onChange={(event, newP1Score) => {
                      setP1Score(newP1Score ?? 0);
                    }}
                  />
                }
              />
              <ToggleButtonGroup
                disabled={!enableMST || !resourcesPath}
                aria-label="Winners/Losers"
                exclusive
                size="small"
                style={{ paddingLeft: '4px' }}
                value={p1WL}
                onChange={(event, value) => {
                  setP1WL(value ?? 'Nada');
                }}
              >
                <ToggleButton style={{ width: '36px' }} value="W">
                  [W]
                </ToggleButton>
                <ToggleButton style={{ width: '36px' }} value="L">
                  [L]
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Stack direction="row" spacing="8px">
              <FormControl>
                <InputLabel id="p1-character-select-label" size="small">
                  Character
                </InputLabel>
                <Select
                  disabled={!enableMST || !resourcesPath}
                  size="small"
                  style={{ width: '177px' }}
                  label="Character"
                  labelId="p1-character-select-label"
                  value={p1Character}
                  onChange={(event) => {
                    const oldCharacter = p1Character;
                    const newCharacter = event.target.value;
                    if (oldCharacter !== newCharacter) {
                      setP1Character(newCharacter);
                      if (
                        oldCharacter === MSTCharacter.SHEIK &&
                        newCharacter === MSTCharacter.ZELDA
                      ) {
                        setP1Skin((previousP1Skin) => {
                          const zeldaSkin =
                            SHEIK_SKIN_TO_ZELDA_SKIN.get(previousP1Skin);
                          if (!zeldaSkin) {
                            throw new Error('unreachable');
                          }
                          return zeldaSkin;
                        });
                      } else if (
                        oldCharacter === MSTCharacter.ZELDA &&
                        newCharacter === MSTCharacter.SHEIK
                      ) {
                        setP1Skin((previousP1Skin) => {
                          const sheikSkin =
                            ZELDA_SKIN_TO_SHEIK_SKIN.get(previousP1Skin);
                          if (!sheikSkin) {
                            throw new Error('unreachable');
                          }
                          return sheikSkin;
                        });
                      } else {
                        setP1Skin(
                          MSTCharacterToSkinColors.get(newCharacter)![0],
                        );
                      }
                    }
                  }}
                >
                  {Object.values(MSTCharacter).map((character) => (
                    <MenuItem key={character} value={character}>
                      {character}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {enableSkinColor && (
                <FormControl>
                  <InputLabel id="p1-skin-select-label" size="small">
                    Color
                  </InputLabel>
                  <Select
                    disabled={!enableMST || !resourcesPath}
                    size="small"
                    style={{ width: '142px' }}
                    label="Color"
                    labelId="p1-skin-select-label"
                    value={p1Skin}
                    onChange={(event) => {
                      setP1Skin(event.target.value);
                    }}
                  >
                    {MSTCharacterToSkinColors.get(p1Character)?.map(
                      (skinColor) => (
                        <MenuItem key={skinColor} value={skinColor}>
                          {skinColor.replace('Sheik ', '')}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Stack>
          <Stack flexBasis="50%" spacing="8px">
            <Stack direction="row" spacing="8px">
              <TextField
                disabled={!enableMST || !resourcesPath}
                variant="outlined"
                size="small"
                style={{ width: '89px' }}
                label="Sponsor"
                value={p2Team}
                onChange={(event) => {
                  setP2Team(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    updateFunc();
                  }
                }}
              />
              <TextField
                disabled={!enableMST || !resourcesPath}
                variant="outlined"
                size="small"
                label="Player 2"
                value={p2Name}
                onChange={(event) => {
                  setP2Name(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    updateFunc();
                  }
                }}
              />
              <Tooltip placement="top" title="Port Color">
                <Select
                  disabled={!enableMST || !resourcesPath}
                  size="small"
                  value={p2Color}
                  onChange={(event) => {
                    setP2Color(event.target.value);
                  }}
                  sx={{
                    backgroundColor: () => {
                      switch (p2Color) {
                        case 'Red':
                          return red[400];
                        case 'Blue':
                          return blue[400];
                        case 'Yellow':
                          return yellow[400];
                        case 'Green':
                          return green[400];
                        case 'CPU':
                          return grey[400];
                        default:
                          throw new Error('unreachable');
                      }
                    },
                  }}
                >
                  <MenuItem value="Red" style={{ backgroundColor: red[400] }}>
                    Red
                  </MenuItem>
                  <MenuItem value="Blue" style={{ backgroundColor: blue[400] }}>
                    Blue
                  </MenuItem>
                  <MenuItem
                    value="Yellow"
                    style={{ backgroundColor: yellow[400] }}
                  >
                    Yellow
                  </MenuItem>
                  <MenuItem
                    value="Green"
                    style={{ backgroundColor: green[400] }}
                  >
                    Green
                  </MenuItem>
                  <MenuItem value="CPU" style={{ backgroundColor: grey[400] }}>
                    CPU
                  </MenuItem>
                </Select>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing="8px">
              <FormControlLabel
                disabled={!enableMST || !resourcesPath}
                label="Wins"
                labelPlacement="start"
                slotProps={{ typography: { style: { marginRight: '4px' } } }}
                style={{ height: '40px' }}
                control={
                  <StyledRating
                    max={bestOf === 'Bo5' ? 3 : 2}
                    icon={<CheckBox fontSize="inherit" />}
                    emptyIcon={<CheckBoxOutlineBlank fontSize="inherit" />}
                    value={p2Score}
                    onChange={(event, newP2Score) => {
                      setP2Score(newP2Score ?? 0);
                    }}
                  />
                }
              />
              <ToggleButtonGroup
                disabled={!enableMST || !resourcesPath}
                aria-label="Winners/Losers"
                exclusive
                size="small"
                style={{ paddingLeft: '4px' }}
                value={p2WL}
                onChange={(event, value) => {
                  setP2WL(value ?? 'Nada');
                }}
              >
                <ToggleButton style={{ width: '36px' }} value="W">
                  [W]
                </ToggleButton>
                <ToggleButton style={{ width: '36px' }} value="L">
                  [L]
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Stack direction="row" spacing="8px">
              <FormControl>
                <InputLabel id="p2-character-select-label" size="small">
                  Character
                </InputLabel>
                <Select
                  disabled={!enableMST || !resourcesPath}
                  size="small"
                  style={{ width: '177px' }}
                  label="Character"
                  labelId="p2-character-select-label"
                  value={p2Character}
                  onChange={(event) => {
                    const oldCharacter = p2Character;
                    const newCharacter = event.target.value;
                    if (oldCharacter !== newCharacter) {
                      setP2Character(newCharacter);
                      if (
                        oldCharacter === MSTCharacter.SHEIK &&
                        newCharacter === MSTCharacter.ZELDA
                      ) {
                        setP2Skin((previousP2Skin) => {
                          const zeldaSkin =
                            SHEIK_SKIN_TO_ZELDA_SKIN.get(previousP2Skin);
                          if (!zeldaSkin) {
                            throw new Error('unreachable');
                          }
                          return zeldaSkin;
                        });
                      } else if (
                        oldCharacter === MSTCharacter.ZELDA &&
                        newCharacter === MSTCharacter.SHEIK
                      ) {
                        setP2Skin((previousP2Skin) => {
                          const sheikSkin =
                            ZELDA_SKIN_TO_SHEIK_SKIN.get(previousP2Skin);
                          if (!sheikSkin) {
                            throw new Error('unreachable');
                          }
                          return sheikSkin;
                        });
                      } else {
                        setP2Skin(
                          MSTCharacterToSkinColors.get(newCharacter)![0],
                        );
                      }
                    }
                  }}
                >
                  {Object.values(MSTCharacter).map((character) => (
                    <MenuItem key={character} value={character}>
                      {character}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {enableSkinColor && (
                <FormControl>
                  <InputLabel id="p2-skin-select-label" size="small">
                    Color
                  </InputLabel>
                  <Select
                    disabled={!enableMST || !resourcesPath}
                    size="small"
                    style={{ width: '142px' }}
                    label="Color"
                    labelId="p2-skin-select-label"
                    value={p2Skin}
                    onChange={(event) => {
                      setP2Skin(event.target.value);
                    }}
                  >
                    {MSTCharacterToSkinColors.get(p2Character)?.map(
                      (skinColor) => (
                        <MenuItem key={skinColor} value={skinColor}>
                          {skinColor}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Stack>
        </Stack>
        <Table
          padding="none"
          style={{
            alignSelf: 'center',
            border: 'none',
            borderCollapse: 'separate',
            borderSpacing: '8px',
            tableLayout: 'fixed',
            width: 'initial',
          }}
        >
          <TableBody>
            <TableRow>
              <TableCell style={{ border: 'none' }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  gap="8px"
                  height="40px"
                >
                  <ToggleButtonGroup
                    disabled={!enableMST || !resourcesPath}
                    aria-label="Best Of"
                    exclusive
                    size="small"
                    value={bestOf}
                    onChange={(event, value) => {
                      setBestOf(value);
                    }}
                  >
                    <ToggleButton value="Bo3">BO3</ToggleButton>
                    <ToggleButton value="Bo5">BO5</ToggleButton>
                  </ToggleButtonGroup>
                  <ToggleButtonGroup
                    disabled={!enableMST || !resourcesPath}
                    aria-label="Auto Round"
                    exclusive
                    size="small"
                    style={{
                      marginRight: '-8px',
                    }}
                    value={enableSggRound}
                    onChange={async (event, value) => {
                      await window.electron.setEnableSggRound(value);
                      setEnableSggRound(value);
                    }}
                  >
                    <ToggleButton value={false}>Manual</ToggleButton>
                    <ToggleButton
                      value
                      style={{
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        borderRight: 'none',
                      }}
                    >
                      Auto
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </TableCell>
              <TableCell style={{ border: 'none' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Current Round"
                  value={round}
                  onChange={(event) => {
                    setRound(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      updateFunc();
                    }
                  }}
                  slotProps={{
                    input: {
                      style: {
                        borderBottomLeftRadius: 0,
                        borderTopLeftRadius: 0,
                      },
                    },
                  }}
                />
              </TableCell>
              <TableCell style={{ border: 'none', position: 'relative' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Tournament Name"
                  value={tournamentName}
                  onChange={(event) => {
                    setTournamentName(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      updateFunc();
                    }
                  }}
                />
                {sggTournamentName && tournamentName !== sggTournamentName && (
                  <Tooltip
                    title="Set to start.gg tournament name"
                    style={{ position: 'absolute' }}
                  >
                    <IconButton
                      onClick={() => {
                        setTournamentName(sggTournamentName);
                      }}
                    >
                      <Restore />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={{ border: 'none' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Caster 1 Name"
                  value={caster1Name}
                  onChange={(event) => {
                    setCaster1Name(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      updateFunc();
                    }
                  }}
                />
              </TableCell>
              <TableCell style={{ border: 'none' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Caster 1 Twitter"
                  value={caster1Twitter}
                  onChange={(event) => {
                    setCaster1Twitch(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      updateFunc();
                    }
                  }}
                />
              </TableCell>
              <TableCell style={{ border: 'none' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Caster 1 Twitch"
                  value={caster1Twitch}
                  onChange={(event) => {
                    setCaster1Twitch(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      updateFunc();
                    }
                  }}
                />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={{ border: 'none' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Caster 2 Name"
                  value={caster2Name}
                  onChange={(event) => {
                    setCaster2Name(event.target.value);
                  }}
                />
              </TableCell>
              <TableCell style={{ border: 'none' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Caster 2 Twitter"
                  value={caster2Twitter}
                  onChange={(event) => {
                    setCaster2Twitch(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      updateFunc();
                    }
                  }}
                />
              </TableCell>
              <TableCell style={{ border: 'none' }}>
                <TextField
                  disabled={!enableMST || !resourcesPath}
                  variant="outlined"
                  size="small"
                  style={{ minWidth: '210px' }}
                  label="Caster 2 Twitch"
                  value={caster2Twitch}
                  onChange={(event) => {
                    setCaster2Twitch(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      updateFunc();
                    }
                  }}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Stack direction="row" justifyContent="center" spacing="8px">
          <Button
            variant="contained"
            color="warning"
            disabled={resetting || !(enableMST && resourcesPath)}
            endIcon={resetting ? <CircularProgress size="20" /> : <Restore />}
            style={{ width: '109px' }}
            onClick={async () => {
              try {
                setResetting(true);
                setScoreboardInfo(await window.electron.getScoreboardInfo());
              } catch (e: any) {
                showErrorDialog([e instanceof Error ? e.message : e]);
              } finally {
                setResetting(false);
              }
            }}
          >
            Revert
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={updating || !(enableMST && resourcesPath)}
            endIcon={
              updating ? <CircularProgress size="20" /> : <OpenInBrowser />
            }
            style={{ flexGrow: 1 }}
            onClick={updateFunc}
          >
            Update
          </Button>
          <Button
            variant="contained"
            style={{ width: '109px' }}
            onClick={() => {
              setOpen(true);
            }}
          >
            Settings
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
