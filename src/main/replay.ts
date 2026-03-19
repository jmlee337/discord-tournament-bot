import { readFile } from 'fs/promises';
import iconv from 'iconv-lite';
import { GameEndInfo, GameStartInfo } from '../common/types';

const RAW_HEADER_START = Buffer.from([
  0x7b, 0x55, 0x03, 0x72, 0x61, 0x77, 0x5b, 0x24, 0x55, 0x23, 0x6c,
]);

async function getReplay(filePath: string) {
  const replay = await readFile(filePath);

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

class GameEndInfoError extends Error {
  private retriable: boolean;

  constructor(retriable: boolean, message?: string, options?: ErrorOptions) {
    super(message, options);
    this.retriable = retriable;
  }

  public isRetriable() {
    return this.retriable;
  }
}

async function getGameEndInfoInner(filePath: string) {
  const replay = await getReplay(filePath);
  if (!replay) {
    throw new GameEndInfoError(true, 'no replay yet');
  }

  const length = replay.readUint32BE(11);
  if (length === 0) {
    throw new GameEndInfoError(true, 'no replay yet');
  }
  const totalLength = 15 + length;
  if (replay.length < totalLength) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }

  const payloadSizeAndSizes = getPayloadSizes(replay);
  if (!payloadSizeAndSizes) {
    throw new GameEndInfoError(true, 'no replay yet');
  }

  const { payloadsSize, payloadSizes } = payloadSizeAndSizes;
  const gameStartSize = payloadSizes.get(0x36);
  if (!gameStartSize) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }
  const postFrameUpdateSize = payloadSizes.get(0x38);
  if (!postFrameUpdateSize) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }
  const gameEndSize = payloadSizes.get(0x39);
  if (!gameEndSize) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }
  const frameBookendSize = payloadSizes.get(0x3c);
  if (!frameBookendSize) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }

  const gameStart = getGameStart(replay, payloadsSize, gameStartSize);
  if (!gameStart) {
    throw new Error('unreachable');
  }
  const playerTypes = [0, 1, 2, 3].map((i) => {
    const gameInfoOffset = i * 36 + 101;
    return gameStart[gameInfoOffset + 1];
  });

  const emptySlots = playerTypes.filter((playerType) => playerType === 3);
  const playerSlots = playerTypes.filter((playerType) => playerType === 0);
  if (emptySlots.length !== 2 || playerSlots.length !== 2) {
    return null;
  }

  const gameEndStart = totalLength - gameEndSize;
  const gameEnd = replay.subarray(gameEndStart, totalLength);
  if (gameEnd[0] !== 0x39) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }

  const definite =
    (gameEnd[1] === 1 || gameEnd[1] === 2 || gameEnd[1] === 3) &&
    gameEnd[2] === 0xff;
  const placings = [gameEnd[3], gameEnd[4], gameEnd[5], gameEnd[6]].filter(
    (placing) =>
      placing === 0 || placing === 1 || placing === 2 || placing === 3,
  );
  if (placings.length !== 2) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }
  let isWinner: [boolean, boolean] = [placings[0] === 0, placings[1] === 0];

  const frameBookendStart = gameEndStart - frameBookendSize;
  const frameBookend = replay.subarray(frameBookendStart, gameEndStart);
  if (frameBookend[0] !== 0x3c) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }
  const lastFrameNum = frameBookend.readInt32BE(0x1);

  const numPlayers = playerTypes.filter(
    (playerType) => playerType === 0,
  ).length;
  let currentPostFrameUpdateStart = frameBookendStart - postFrameUpdateSize;
  let postFrameUpdatesSeen = 0;
  const postFramePlayers: {
    playerIndex: number;
    percent: number;
    stocks: number;
  }[] = [];
  while (postFrameUpdatesSeen < numPlayers) {
    const postFrameUpdate = replay.subarray(
      currentPostFrameUpdateStart,
      currentPostFrameUpdateStart + postFrameUpdateSize,
    );
    if (
      postFrameUpdate[0] !== 0x38 ||
      postFrameUpdate.readInt32BE(0x1) !== lastFrameNum
    ) {
      break;
    }

    if (postFrameUpdate[0x6] === 0) {
      postFramePlayers.push({
        playerIndex: postFrameUpdate[0x05],
        percent: Math.trunc(postFrameUpdate.readFloatBE(0x16)),
        stocks: postFrameUpdate[0x21],
      });
      postFrameUpdatesSeen += 1;
    }
    currentPostFrameUpdateStart -= postFrameUpdateSize;
  }
  if (postFrameUpdatesSeen !== 2 || postFramePlayers.length !== 2) {
    throw new GameEndInfoError(false, 'replay corrupted');
  }
  postFramePlayers.sort((a, b) => a.playerIndex - b.playerIndex);

  if (
    postFramePlayers[0].stocks === postFramePlayers[1].stocks &&
    postFramePlayers[0].percent === postFramePlayers[1].percent
  ) {
    isWinner = [false, false];
  } else if (gameEnd[1] === 1) {
    if (postFramePlayers[0].stocks !== postFramePlayers[1].stocks) {
      isWinner = [
        postFramePlayers[0].stocks > postFramePlayers[1].stocks,
        postFramePlayers[1].stocks > postFramePlayers[0].stocks,
      ];
    } else {
      isWinner = [
        postFramePlayers[0].percent < postFramePlayers[1].percent,
        postFramePlayers[1].percent < postFramePlayers[0].percent,
      ];
    }
  }

  return {
    definite,
    isWinner,
  };
}

export async function getGameEndInfo(
  filePath: string,
): Promise<GameEndInfo | null> {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
    try {
      // eslint-disable-next-line no-await-in-loop
      const gameEndInfo = await getGameEndInfoInner(filePath);
      return gameEndInfo;
    } catch (e: unknown) {
      if (!(e instanceof GameEndInfoError) || !e.isRetriable()) {
        throw e;
      }
      // if retriable just catch
    }
  }
  throw new Error('timed out');
}
