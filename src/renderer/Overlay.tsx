import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputBase,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { DisplaySettings, OpenInBrowser, Restore } from '@mui/icons-material';
import {
  matchesGrandFinal,
  MSTBestOf,
  MSTCharacter,
  MSTCharacterToSkinColors,
  MSTScoreboardInfo,
  MSTSkinColor,
  MSTWL,
  SHEIK_SKIN_TO_ZELDA_SKIN,
  ZELDA_SKIN_TO_SHEIK_SKIN,
} from '../common/mst';
import LabeledCheckbox from './LabeledCheckbox';

export default function Overlay({
  enableMST,
  resourcesPath,
  gotSettings,
  setEnableMST,
  setResourcesPath,
  showErrorDialog,
}: {
  enableMST: boolean;
  resourcesPath: string;
  gotSettings: boolean;
  setEnableMST: (newEnableMST: boolean) => void;
  setResourcesPath: (newResourcesPath: string) => void;
  showErrorDialog: (errors: string[]) => void;
}) {
  const [enableSkinColor, setEnableSkinColor] = useState(false);
  const [enableSggSponsors, setEnableSggSponsors] = useState(false);

  useEffect(() => {
    (async () => {
      const enableSkinColorPromise = window.electron.getEnableSkinColor();
      const enableSggSponsorsPromise = window.electron.getEnableSggSponsors();
      setEnableSkinColor(await enableSkinColorPromise);
      setEnableSggSponsors(await enableSggSponsorsPromise);
    })();
  }, []);

  const [p1Name, setP1Name] = useState('');
  const [p1Team, setP1Team] = useState('');
  const [p1Character, setP1Character] = useState(MSTCharacter.RANDOM);
  const [p1Skin, setP1Skin] = useState<MSTSkinColor>('Default');
  const [p1Score, setP1Score] = useState(0);
  const [p1WL, setP1WL] = useState<MSTWL>('Nada');
  const [p2Name, setP2Name] = useState('');
  const [p2Team, setP2Team] = useState('');
  const [p2Character, setP2Character] = useState(MSTCharacter.RANDOM);
  const [p2Skin, setP2Skin] = useState<MSTSkinColor>('Default');
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
      setP1Score(newScoreboardInfo.p1Score);
      setP1WL(newScoreboardInfo.p1WL);
      setP2Name(newScoreboardInfo.p2Name);
      setP2Team(newScoreboardInfo.p2Team);
      setP2Character(newScoreboardInfo.p2Character);
      setP2Skin(newScoreboardInfo.p2Skin);
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
        setScoreboardInfo(await window.electron.getScoreboardInfo());
      }
    })();
  }, [enableMST, resourcesPath, gotSettings, setScoreboardInfo]);

  useEffect(() => {
    window.electron.onScoreboardInfo((event, newScoreboardInfo) => {
      setScoreboardInfo(newScoreboardInfo);
    });
  }, [setScoreboardInfo]);

  const [choosingResourcesPath, setChoosingResourcesPath] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [updating, setUpdating] = useState(false);

  // TODO: fix da settings LOL
  return (
    <Stack>
      <Stack alignItems="end">
        <LabeledCheckbox
          checked={enableMST}
          label="Enable overlay"
          labelPlacement="start"
          set={async (checked) => {
            await window.electron.setEnableMST(checked);
            setEnableMST(checked);
          }}
        />
      </Stack>
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
                  setResourcesPath(await window.electron.chooseResourcesPath());
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
          checked={enableSkinColor}
          disabled={!enableMST}
          label="Enable character colors"
          labelPlacement="start"
          set={async (checked) => {
            await window.electron.setEnableSkinColor(checked);
            setEnableSkinColor(checked);
          }}
        />
        <LabeledCheckbox
          checked={enableSggSponsors}
          disabled={!enableMST}
          label="Fetch sponsor tags from start.gg"
          labelPlacement="start"
          set={async (checked) => {
            await window.electron.setEnableSggSponsors(checked);
            setEnableSggSponsors(checked);
          }}
        />
      </Stack>
      {enableMST && resourcesPath && (
        <Stack spacing="8px">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack spacing="8px" paddingRight="16px">
              <Stack direction="row" spacing="8px">
                <TextField
                  variant="outlined"
                  size="small"
                  style={{ width: '100px' }}
                  label="Sponsor"
                  value={p1Team}
                  onChange={(event) => {
                    setP1Team(event.target.value);
                  }}
                />
                <TextField
                  variant="outlined"
                  size="small"
                  label="Player 1"
                  value={p1Name}
                  onChange={(event) => {
                    setP1Name(event.target.value);
                  }}
                />
                <TextField
                  variant="outlined"
                  size="small"
                  slotProps={{
                    htmlInput: { min: 0, max: bestOf === 'Bo5' ? 5 : 3 },
                  }}
                  type="number"
                  label="Score"
                  value={p1Score}
                  onChange={(event) => {
                    setP1Score(Number.parseInt(event.target.value, 10));
                  }}
                />
                {matchesGrandFinal(round) && (
                  <ToggleButton
                    size="small"
                    onChange={() => {
                      setP1WL((prevP1WL) => {
                        setP2WL(prevP1WL === 'L' ? 'L' : 'Nada');
                        return prevP1WL === 'L' ? 'Nada' : 'L';
                      });
                    }}
                    selected={p1WL === 'L'}
                    value=""
                  >
                    [L]
                  </ToggleButton>
                )}
              </Stack>
              <Stack direction="row" spacing="8px">
                <FormControl>
                  <InputLabel id="p1-character-select-label">
                    Character
                  </InputLabel>
                  <Select
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
                    <InputLabel id="p1-skin-select-label">Color</InputLabel>
                    <Select
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
                            {skinColor}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                )}
              </Stack>
            </Stack>
            <Stack
              sx={{
                borderRight: (theme) => `1px solid ${theme.palette.grey[400]}`,
                height: '104px',
              }}
            />
            <Stack spacing="8px" paddingLeft="16px">
              <Stack direction="row" spacing="8px">
                <TextField
                  variant="outlined"
                  size="small"
                  style={{ width: '100px' }}
                  label="Sponsor"
                  value={p2Team}
                  onChange={(event) => {
                    setP2Team(event.target.value);
                  }}
                />
                <TextField
                  variant="outlined"
                  size="small"
                  label="Player 2"
                  value={p2Name}
                  onChange={(event) => {
                    setP2Name(event.target.value);
                  }}
                />
                <TextField
                  variant="outlined"
                  size="small"
                  slotProps={{
                    htmlInput: { min: 0, max: bestOf === 'Bo5' ? 5 : 3 },
                  }}
                  type="number"
                  label="Score"
                  value={p2Score}
                  onChange={(event) => {
                    setP2Score(Number.parseInt(event.target.value, 10));
                  }}
                />
                {matchesGrandFinal(round) && (
                  <ToggleButton
                    size="small"
                    onChange={() => {
                      setP2WL((prevP2WL) => {
                        setP1WL(prevP2WL === 'L' ? 'L' : 'Nada');
                        return prevP2WL === 'L' ? 'Nada' : 'L';
                      });
                    }}
                    selected={p2WL === 'L'}
                    value=""
                  >
                    [L]
                  </ToggleButton>
                )}
              </Stack>
              <Stack direction="row" spacing="8px">
                <FormControl>
                  <InputLabel id="p2-character-select-label">
                    Character
                  </InputLabel>
                  <Select
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
                    <InputLabel id="p2-skin-select-label">Color</InputLabel>
                    <Select
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
          <Stack
            direction="row"
            alignItems="end"
            justifyContent="center"
            paddingTop="8px"
            spacing="8px"
          >
            <Stack direction="row" justifyContent="right" width="210px">
              <ToggleButtonGroup
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
            </Stack>
            <TextField
              variant="outlined"
              size="small"
              label="Current Round"
              value={round}
              onChange={(event) => {
                setRound(event.target.value);
              }}
            />
            <TextField
              variant="outlined"
              size="small"
              label="Tournament Name"
              value={tournamentName}
              onChange={(event) => {
                setTournamentName(event.target.value);
              }}
            />
          </Stack>
          <Stack direction="row" spacing="8px" justifyContent="center">
            <TextField
              variant="outlined"
              size="small"
              label="Caster 1 Name"
              value={caster1Name}
              onChange={(event) => {
                setCaster1Name(event.target.value);
              }}
            />
            <TextField
              variant="outlined"
              size="small"
              label="Caster 1 Twitter"
              value={caster1Twitter}
              onChange={(event) => {
                setCaster1Twitch(event.target.value);
              }}
            />
            <TextField
              variant="outlined"
              size="small"
              label="Caster 1 Twitch"
              value={caster1Twitch}
              onChange={(event) => {
                setCaster1Twitch(event.target.value);
              }}
            />
          </Stack>
          <Stack direction="row" spacing="8px" justifyContent="center">
            <TextField
              variant="outlined"
              size="small"
              label="Caster 2 Name"
              value={caster2Name}
              onChange={(event) => {
                setCaster2Name(event.target.value);
              }}
            />
            <TextField
              variant="outlined"
              size="small"
              label="Caster 2 Twitter"
              value={caster2Twitter}
              onChange={(event) => {
                setCaster2Twitch(event.target.value);
              }}
            />
            <TextField
              variant="outlined"
              size="small"
              label="Caster 2 Twitch"
              value={caster2Twitch}
              onChange={(event) => {
                setCaster2Twitch(event.target.value);
              }}
            />
          </Stack>
          <Stack
            direction="row"
            justifyContent="center"
            paddingTop="8px"
            spacing="8px"
          >
            <Button
              variant="contained"
              color="warning"
              disabled={resetting}
              endIcon={resetting ? <CircularProgress size="20" /> : <Restore />}
              style={{ width: '100px' }}
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
              Reset
            </Button>
            <Button
              variant="contained"
              disabled={updating}
              endIcon={
                updating ? <CircularProgress size="20" /> : <OpenInBrowser />
              }
              style={{ flexGrow: 4 }}
              onClick={async () => {
                try {
                  setUpdating(true);
                  await window.electron.setScoreboardInfo({
                    p1Name,
                    p1Team,
                    p1Character,
                    p1Skin,
                    p1Score,
                    p1WL,
                    p2Name,
                    p2Team,
                    p2Character,
                    p2Skin,
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
              }}
            >
              Update
            </Button>
            <Stack width="100px" />
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
