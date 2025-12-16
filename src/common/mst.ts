export enum MSTCharacter {
  FALCON = 'Captain Falcon',
  BOWSER = 'Bowser',
  DK = 'Donkey Kong',
  DOC = 'Dr Mario',
  FALCO = 'Falco',
  FOX = 'Fox',
  GANON = 'Ganondorf',
  ICS = 'Ice Climbers',
  JIGGLYPUFF = 'Jigglypuff',
  KIRBY = 'Kirby',
  LINK = 'Link',
  LUIGI = 'Luigi',
  MARIO = 'Mario',
  MARTH = 'Marth',
  MEWTWO = 'Mewtwo',
  GW = 'Mr Game & Watch',
  NESS = 'Ness',
  PICHU = 'Pichu',
  PIKACHU = 'Pikachu',
  PEACH = 'Peach',
  ROY = 'Roy',
  SAMUS = 'Samus',
  SHEIK = 'Sheik', // only used internally, not supported by MST/MGS
  YOSHI = 'Yoshi',
  YL = 'Young Link',
  ZELDA = 'Zelda',
  RANDOM = 'Random',
}

export type MSTPortColor = 'Red' | 'Blue' | 'Yellow' | 'Green' | 'CPU';

export type MSTSkinColor =
  | 'Default'
  | 'Black'
  | 'Blue'
  | 'Red'
  | 'Green'
  | 'White'
  | 'Purple'
  | 'Orange'
  | 'Yellow'
  | 'Pink'
  | 'Brown'
  | 'Cyan'
  | 'Sheik Blue'
  | 'Sheik Default'
  | 'Sheik Green'
  | 'Sheik Purple'
  | 'Sheik Red';

export type MSTWL = 'Nada' | 'W' | 'L';
export type MSTBestOf = 'Bo3' | 'Bo5';

export type MSTPendingSetsScoreboardInfo = {
  setChanged: boolean;
  p1Name: string;
  p1Team: string;
  p1Score: number;
  p1WL?: MSTWL;
  p2Name: string;
  p2Team: string;
  p2Score: number;
  p2WL?: MSTWL;
  bestOf: MSTBestOf;
  round: string;
};

export type MSTSetData = {
  p1Score: number;
  p1WL?: MSTWL;
  p2Score: number;
  p2WL?: MSTWL;
  bestOf: MSTBestOf;
  round: string;
};

export type MSTNewFileScoreboardInfo = {
  participantsChanged: boolean;
  setChanged: boolean;
  p1Name?: string;
  p1Team?: string;
  p1Character: MSTCharacter;
  p1Skin: MSTSkinColor;
  p2Name?: string;
  p2Team?: string;
  p2Character: MSTCharacter;
  p2Skin: MSTSkinColor;
  setData?: MSTSetData;
};

export type MSTGameEndScoreboardInfo = {
  p1ScoreIncrement: boolean;
  p2ScoreIncrement: boolean;
};

export type MSTManualUpdateScoreboardInfo = {
  p1Name: string;
  p1Team: string;
  p1Character: MSTCharacter;
  p1Skin: MSTSkinColor;
  p1Color: MSTPortColor;
  p1Score: number;
  p1WL: MSTWL;
  p2Name: string;
  p2Team: string;
  p2Character: MSTCharacter;
  p2Skin: MSTSkinColor;
  p2Color: MSTPortColor;
  p2Score: number;
  p2WL: MSTWL;
  bestOf: MSTBestOf;
  round: string;
  tournamentName: string;
  caster1Name: string;
  caster1Twitter: string;
  caster1Twitch: string;
  caster2Name: string;
  caster2Twitter: string;
  caster2Twitch: string;
};

export type MSTScoreboardInfo = MSTManualUpdateScoreboardInfo & {
  allowIntro: false;
};

// https://docs.google.com/spreadsheets/d/1JX2w-r2fuvWuNgGb6D3Cs4wHQKLFegZe2jhbBuIhCG8/preview
// https://github.com/Readek/Melee-Stream-Tool/tree/master/Stream%20Tool/Resources/Texts/Character%20Info
export const characterIdToMST = new Map<
  number,
  { character: MSTCharacter; skinColors: MSTSkinColor[] }
>([
  [
    0x0,
    {
      character: MSTCharacter.FALCON,
      skinColors: ['Default', 'Black', 'Red', 'White', 'Green', 'Blue'],
    },
  ],
  [
    0x1,
    {
      character: MSTCharacter.DK,
      skinColors: ['Default', 'Blue', 'Red', 'Purple', 'Green'],
    },
  ],
  [
    0x2,
    {
      character: MSTCharacter.FOX,
      skinColors: ['Default', 'Red', 'Blue', 'Green'],
    },
  ],
  [
    0x3,
    {
      character: MSTCharacter.GW,
      skinColors: ['Default', 'Red', 'Blue', 'Green'],
    },
  ],
  [
    0x4,
    {
      character: MSTCharacter.KIRBY,
      skinColors: ['Default', 'Yellow', 'Blue', 'Red', 'Green', 'White'],
    },
  ],
  [
    0x5,
    {
      character: MSTCharacter.BOWSER,
      skinColors: ['Default', 'Red', 'Blue', 'Black'],
    },
  ],
  [
    0x6,
    {
      character: MSTCharacter.LINK,
      skinColors: ['Default', 'Red', 'Blue', 'Black', 'White'],
    },
  ],
  [
    0x7,
    {
      character: MSTCharacter.LUIGI,
      skinColors: ['Default', 'White', 'Blue', 'Pink'],
    },
  ],
  [
    0x8,
    {
      character: MSTCharacter.MARIO,
      skinColors: ['Default', 'Yellow', 'Brown', 'Blue', 'Green'],
    },
  ],
  [
    0x9,
    {
      character: MSTCharacter.MARTH,
      skinColors: ['Default', 'Red', 'Green', 'Black', 'White'],
    },
  ],
  [
    0xa,
    {
      character: MSTCharacter.MEWTWO,
      skinColors: ['Default', 'Yellow', 'Blue', 'Green'],
    },
  ],
  [
    0xb,
    {
      character: MSTCharacter.NESS,
      skinColors: ['Default', 'Yellow', 'Blue', 'Green'],
    },
  ],
  [
    0xc,
    {
      character: MSTCharacter.PEACH,
      skinColors: ['Default', 'Yellow', 'White', 'Blue', 'Green'],
    },
  ],
  [
    0xd,
    {
      character: MSTCharacter.PIKACHU,
      skinColors: ['Default', 'Red', 'Blue', 'Green'],
    },
  ],
  [
    0xe,
    {
      character: MSTCharacter.ICS,
      skinColors: ['Default', 'Green', 'Orange', 'Red'],
    },
  ],
  [
    0xf,
    {
      character: MSTCharacter.JIGGLYPUFF,
      skinColors: ['Default', 'Red', 'Blue', 'Green', 'Yellow'],
    },
  ],
  [
    0x10,
    {
      character: MSTCharacter.SAMUS,
      skinColors: ['Default', 'Pink', 'Brown', 'Green', 'Purple'],
    },
  ],
  [
    0x11,
    {
      character: MSTCharacter.YOSHI,
      skinColors: ['Default', 'Red', 'Blue', 'Yellow', 'Pink', 'Cyan'],
    },
  ],
  [
    0x12,
    {
      character: MSTCharacter.ZELDA,
      skinColors: ['Default', 'Red', 'Blue', 'Green', 'Purple'],
    },
  ],
  [
    0x13,
    {
      character: MSTCharacter.SHEIK,
      skinColors: [
        'Sheik Default',
        'Sheik Red',
        'Sheik Blue',
        'Sheik Green',
        'Sheik Purple',
      ],
    },
  ],
  [
    0x14,
    {
      character: MSTCharacter.FALCO,
      skinColors: ['Default', 'Red', 'Blue', 'Green'],
    },
  ],
  [
    0x15,
    {
      character: MSTCharacter.YL,
      skinColors: ['Default', 'Red', 'Blue', 'White', 'Black'],
    },
  ],
  [
    0x16,
    {
      character: MSTCharacter.DOC,
      skinColors: ['Default', 'Red', 'Blue', 'Green', 'Black'],
    },
  ],
  [
    0x17,
    {
      character: MSTCharacter.ROY,
      skinColors: ['Default', 'Red', 'Blue', 'Green', 'Yellow'],
    },
  ],
  [
    0x18,
    {
      character: MSTCharacter.PICHU,
      skinColors: ['Default', 'Red', 'Blue', 'Green'],
    },
  ],
  [
    0x19,
    {
      character: MSTCharacter.GANON,
      skinColors: ['Default', 'Red', 'Blue', 'Green', 'Purple'],
    },
  ],
  [0x1a, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // Master Hand
  // there are more but they all map to RANDOM/Default
]);

export const MSTCharacterToSkinColors = new Map(
  Array.from(characterIdToMST.values()).map(({ character, skinColors }) => [
    character,
    skinColors,
  ]),
);

export const EMPTY_SCOREBOARD_INFO: MSTScoreboardInfo = {
  p1Name: '',
  p1Team: '',
  p1Character: MSTCharacter.RANDOM,
  p1Skin: 'Default',
  p1Color: 'Red',
  p1Score: 0,
  p1WL: 'Nada',
  p2Name: '',
  p2Team: '',
  p2Character: MSTCharacter.RANDOM,
  p2Skin: 'Default',
  p2Color: 'Blue',
  p2Score: 0,
  p2WL: 'Nada',
  bestOf: 'Bo3',
  round: '',
  tournamentName: '',
  caster1Name: '',
  caster1Twitter: '',
  caster1Twitch: '',
  caster2Name: '',
  caster2Twitter: '',
  caster2Twitch: '',
  allowIntro: false,
};

export const SHEIK_SKIN_TO_ZELDA_SKIN = new Map<MSTSkinColor, MSTSkinColor>([
  ['Sheik Default', 'Default'],
  ['Sheik Red', 'Red'],
  ['Sheik Blue', 'Blue'],
  ['Sheik Green', 'Green'],
  ['Sheik Purple', 'Purple'],
]);

export const ZELDA_SKIN_TO_SHEIK_SKIN = new Map<MSTSkinColor, MSTSkinColor>([
  ['Default', 'Sheik Default'],
  ['Red', 'Sheik Red'],
  ['Blue', 'Sheik Blue'],
  ['Green', 'Sheik Green'],
  ['Purple', 'Sheik Purple'],
]);
