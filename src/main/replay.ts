import { readFile } from 'fs/promises';
import iconv from 'iconv-lite';
import { GameStartInfo } from '../common/types';

const RAW_HEADER_START = Buffer.from([
  0x7b, 0x55, 0x03, 0x72, 0x61, 0x77, 0x5b, 0x24, 0x55, 0x23, 0x6c,
]);

async function getGameStartInfoInner(
  filePath: string,
): Promise<GameStartInfo[] | undefined> {
  let replay: Buffer | undefined;
  try {
    replay = await readFile(filePath);
  } catch (e: any) {
    throw new Error(e instanceof Error ? e.message : e);
  }

  // raw header
  if (replay.length < 15) {
    return undefined;
  }
  if (!replay.subarray(0, 11).equals(RAW_HEADER_START)) {
    throw new Error('replay corrupted');
  }

  if (replay.length < 17) {
    return undefined;
  }
  const payloadsHeader = replay.subarray(15, 17);
  if (payloadsHeader[0] !== 0x35) {
    throw new Error('replay corrupted');
  }

  const payloadsSize = payloadsHeader[1] - 1;
  if (replay.length < 17 + payloadsSize) {
    return undefined;
  }
  const payloads = replay.subarray(17, 17 + payloadsSize);
  const payloadSizes = new Map<number, number>();
  let gameStartSize = 0;
  for (let i = 0; i < payloadsSize; i += 3) {
    const payloadSize = payloads.subarray(i + 1, i + 3).readUInt16BE();
    if (payloadSize === 0) {
      throw new Error('replay corrupted');
    }
    payloadSizes.set(payloads[i], payloadSize);
    if (payloads[i] === 0x36) {
      gameStartSize = payloadSize + 1;
    }
  }

  if (replay.length < 17 + payloadsSize + gameStartSize) {
    return undefined;
  }
  const gameStart = replay.subarray(
    17 + payloadsSize,
    17 + payloadsSize + gameStartSize,
  );
  if (gameStart[0] !== 0x36) {
    throw new Error('replay corrupted');
  }

  const version = gameStart.readUint32BE(1);
  if (version < 0x03090000) {
    // Display Names/Connect Codes added in 3.9.0
    throw new Error('replay version too old');
  }

  return [0, 1, 2, 3].map((i) => {
    const gameInfoOffset = i * 36 + 101;
    const playerType = gameStart[gameInfoOffset + 1];
    const characterId = gameStart[gameInfoOffset];
    const costumeIndex = gameStart[gameInfoOffset + 3];

    const connectCodeOffset = i * 10 + 545;
    const connectCode = iconv
      .decode(
        gameStart.subarray(connectCodeOffset, connectCodeOffset + 10),
        'Shift_JIS',
      )
      .split('\0')
      .shift()
      ?.replace('\uff03', '#');

    return {
      playerType,
      characterId,
      costumeIndex,
      connectCode,
    };
  });
}

export default async function getGameStartInfo(
  filePath: string,
): Promise<GameStartInfo[]> {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
    // eslint-disable-next-line no-await-in-loop
    const gameStartInfo = await getGameStartInfoInner(filePath);
    if (gameStartInfo) {
      return gameStartInfo;
    }
  }
  throw new Error('timed out');
}
