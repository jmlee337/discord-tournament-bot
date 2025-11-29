import { readFile } from 'fs/promises';
import iconv from 'iconv-lite';
import { GameEndInfo, GameStartInfo } from '../common/types';

const RAW_HEADER_START = Buffer.from([
  0x7b, 0x55, 0x03, 0x72, 0x61, 0x77, 0x5b, 0x24, 0x55, 0x23, 0x6c,
]);

async function getReplay(filePath: string): Promise<Buffer | undefined> {
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

  return replay;
}

function getPayloadSizes(replay: Buffer) {
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
  for (let i = 0; i < payloadsSize; i += 3) {
    const payloadSize = payloads.subarray(i + 1, i + 3).readUInt16BE();
    if (payloadSize === 0) {
      throw new Error('replay corrupted');
    }
    payloadSizes.set(payloads[i], payloadSize + 1);
  }

  return { payloadsSize, payloadSizes };
}

function getGameStart(
  replay: Buffer,
  payloadsSize: number,
  gameStartSize: number,
) {
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

  return gameStart;
}

async function getGameStartInfosInner(
  filePath: string,
): Promise<GameStartInfo[] | undefined> {
  const replay = await getReplay(filePath);
  if (!replay) {
    return replay;
  }

  const payloadSizeAndSizes = getPayloadSizes(replay);
  if (!payloadSizeAndSizes) {
    return undefined;
  }

  const { payloadsSize, payloadSizes } = payloadSizeAndSizes;
  const gameStartSize = payloadSizes.get(0x36);
  if (!gameStartSize) {
    throw new Error('replay corrupted');
  }

  const gameStart = getGameStart(replay, payloadsSize, gameStartSize);
  if (!gameStart) {
    return undefined;
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

export async function getGameStartInfos(
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
    const gameStartInfo = await getGameStartInfosInner(filePath);
    if (gameStartInfo) {
      return gameStartInfo;
    }
  }
  throw new Error('timed out');
}

async function getGameEndInfoInner(
  filePath: string,
): Promise<GameEndInfo | undefined> {
  const replay = await getReplay(filePath);
  if (!replay) {
    return replay;
  }

  const length = replay.readUint32BE(11);
  if (length === 0) {
    return undefined;
  }
  const totalLength = 15 + length;
  if (replay.length < totalLength) {
    throw new Error('replay corrupted');
  }

  const payloadSizeAndSizes = getPayloadSizes(replay);
  if (!payloadSizeAndSizes) {
    return undefined;
  }

  const { payloadsSize, payloadSizes } = payloadSizeAndSizes;
  const gameStartSize = payloadSizes.get(0x36);
  if (!gameStartSize) {
    throw new Error('replay corrupted');
  }
  const gameEndSize = payloadSizeAndSizes.payloadSizes.get(0x39);
  if (!gameEndSize) {
    throw new Error('replay corrupted');
  }

  const gameStart = getGameStart(replay, payloadsSize, gameStartSize);
  if (!gameStart) {
    throw new Error('unreachable');
  }

  const playerTypes = [0, 1, 2, 3].map((i) => {
    const gameInfoOffset = i * 36 + 101;
    return gameStart[gameInfoOffset + 1];
  });

  const gameEnd = replay.subarray(totalLength - gameEndSize, totalLength);
  if (gameEnd[0] !== 0x39) {
    throw new Error('replay corrupted');
  }

  const definite =
    (gameEnd[1] === 2 || gameEnd[1] === 3) && gameEnd[2] === 0xff;
  const placings = [gameEnd[3], gameEnd[4], gameEnd[5], gameEnd[6]];
  return {
    definite,
    placings,
    playerTypes,
  };
}

export async function getGameEndInfo(filePath: string): Promise<GameEndInfo> {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
    // eslint-disable-next-line no-await-in-loop
    const gameEndInfo = await getGameEndInfoInner(filePath);
    if (gameEndInfo) {
      return gameEndInfo;
    }
  }
  throw new Error('timed out');
}
