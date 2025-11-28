export enum MSTCharacter {
  DOC = 'Dr Mario',
  MARIO = 'Mario',
  LUIGI = 'Luigi',
  BOWSER = 'Bowser',
  PEACH = 'Peach',
  YOSHI = 'Yoshi',
  DK = 'Donkey Kong',
  FALCON = 'Captain Falcon',
  GANON = 'Ganondorf',
  FALCO = 'Falco',
  FOX = 'Fox',
  NESS = 'Ness',
  ICS = 'Ice Climbers',
  KIRBY = 'Kirby',
  SAMUS = 'Samus',
  ZELDA = 'Zelda',
  LINK = 'Link',
  YL = 'Young Link',
  PICHU = 'Pichu',
  PIKACHU = 'Pikachu',
  JIGGLYPUFF = 'Jigglypuff',
  MEWTWO = 'Mewtwo',
  GW = 'Mr Game & Watch',
  MARTH = 'Marth',
  ROY = 'Roy',
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

export type MSTNewFileScoreboardInfo = {
  p1Name?: string;
  p1Character: MSTCharacter;
  p1Skin: MSTSkinColor;
  p1Color: MSTPortColor;
  p1Score?: number;
  p1WL?: MSTWL;
  p2Name?: string;
  p2Character: MSTCharacter;
  p2Skin: MSTSkinColor;
  p2Color: MSTPortColor;
  p2Score?: number;
  p2WL?: MSTWL;
  bestOf?: MSTBestOf;
  round?: string;
  tournamentName?: string;
};

export type MSTScoreboardInfo = {
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
      character: MSTCharacter.ZELDA,
      skinColors: [
        'Sheik Default',
        'Sheik Red',
        'Sheik Blue',
        'Sheik Green',
        'Sheik Purple',
      ],
    },
  ], // Sheik
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
  [0x1b, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // Wireframe Male
  [0x1c, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // Wireframe Female
  [0x1d, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // Giga Bowser
  [0x1e, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // Crazy Hand
  [0x1f, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // Sandbag
  [0x20, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // Sopo
  [0x21, { character: MSTCharacter.RANDOM, skinColors: ['Default'] }], // "User Select(Event) / None"
]);
