import { BrowserWindow, shell } from 'electron';
import Store from 'electron-store';
import {
  AccessToken,
  accessTokenIsExpired,
  exchangeCode,
  getTokenInfo,
  RefreshingAuthProvider,
  refreshUserToken,
} from '@twurple/auth';
import { Bot, createBotCommand } from '@twurple/easy-bot';
import { Server } from 'net';
import express from 'express';
import GracefulShutdown from 'http-graceful-shutdown';
import {
  Status,
  StoreContents,
  TwitchCallbackServerStatus,
  TwitchClient,
  TwitchStatus,
} from '../common/types';

export default class Twitch {
  private store: Store<StoreContents>;

  private mainWindow: BrowserWindow;

  private bot: Bot | null;

  private status: TwitchStatus;

  private userName: string;

  private server: Server | null;

  private callbackServerStatus: TwitchCallbackServerStatus;

  private slug: string;

  private client: TwitchClient;

  private accessToken: AccessToken | null;

  constructor(store: Store<StoreContents>, mainWindow: BrowserWindow) {
    this.store = store;
    this.mainWindow = mainWindow;
    this.bot = null;
    this.status = { status: Status.STOPPED, message: '' };
    this.userName = '';
    this.server = null;
    this.callbackServerStatus = { status: Status.STOPPED, port: 0 };
    this.slug = '';

    this.client = this.store.get('twitchClient', {
      clientId: '',
      clientSecret: '',
    });
    this.accessToken = this.store.has('twitchAccessToken')
      ? this.store.get('twitchAccessToken')
      : null;
  }

  private setAccessToken(newAccessToken: AccessToken | null) {
    if (newAccessToken) {
      this.store.set('twitchAccessToken', newAccessToken);
    } else {
      this.store.delete('twitchAccessToken');
    }
    this.accessToken = newAccessToken;
  }

  getClient() {
    return this.client;
  }

  async setClient(newClient: TwitchClient) {
    if (Boolean(newClient.clientId) !== Boolean(newClient.clientSecret)) {
      throw new Error('must set/unset both clientId and clientSecret');
    }
    if (
      this.client.clientId === newClient.clientId &&
      this.client.clientSecret === newClient.clientSecret &&
      this.status.status === Status.STARTED
    ) {
      return;
    }

    this.store.set('twitchClient', newClient);
    this.client = newClient;
    this.setAccessToken(null);
    await this.stopBot();

    if (this.client.clientId && this.client.clientSecret) {
      if (!this.getPort()) {
        throw new Error('must start callback server.');
      }
      shell.openExternal(
        `https://id.twitch.tv/oauth2/authorize?client_id=${
          this.client.clientId
        }&redirect_uri=http://localhost:${this.getPort()}&response_type=code&scope=chat:read+chat:edit+channel:read:predictions+channel:manage:predictions`,
      );
    } else {
      this.stopCallbackServer();
    }
  }

  setSlug(newSlug: string) {
    this.slug = newSlug;
  }

  getStatus() {
    return this.status;
  }

  getCallbackServerStatus() {
    return this.callbackServerStatus;
  }

  getUserName() {
    return this.userName;
  }

  private getPort() {
    if (!this.server) {
      return 0;
    }

    const address = this.server.address();
    if (!(address instanceof Object)) {
      throw new Error('could not get server port');
    }
    if (!Number.isInteger(address.port) || address.port <= 0) {
      throw new Error('could not get server port');
    }
    return address.port;
  }

  async stopCallbackServer() {
    if (!this.server) {
      return;
    }

    await GracefulShutdown(this.server, {
      finally: () => {
        this.server = null;
        this.callbackServerStatus = { status: Status.STOPPED, port: 0 };
        this.mainWindow.webContents.send(
          'twitchCallbackServerStatus',
          this.callbackServerStatus,
        );
      },
    })();
  }

  startCallbackServer() {
    if (this.server) {
      return;
    }

    this.callbackServerStatus = { status: Status.STARTING, port: 0 };
    this.mainWindow.webContents.send(
      'twitchCallbackServerStatus',
      this.callbackServerStatus,
    );
    const app = express();
    this.server = app.listen(() => {
      if (!this.server) {
        throw new Error('unreachable');
      }

      this.callbackServerStatus = {
        status: Status.STARTED,
        port: this.getPort(),
      };
      this.mainWindow.webContents.send(
        'twitchCallbackServerStatus',
        this.callbackServerStatus,
      );
    });
    app.get('/', async (req, res) => {
      const { code } = req.query;
      if (typeof code !== 'string' || code.length === 0) {
        res
          .status(400)
          .send('Failure! Request URL does not contain code param.');
        return;
      }

      try {
        this.setAccessToken(
          await exchangeCode(
            this.client.clientId,
            this.client.clientSecret,
            code,
            `http://localhost:${this.getPort()}`,
          ),
        );
        res
          .status(200)
          .send(
            'Success! You can close this tab and return to Auto Stream for Slippi.',
          );
        this.maybeStartBot();
        this.stopCallbackServer();
      } catch (e: unknown) {
        res.status(503).send(e instanceof Error ? e.message : e);
      }
    });
  }

  async maybeStartBot() {
    if (this.bot) {
      return;
    }
    if (!this.client.clientId || !this.client.clientSecret) {
      return;
    }
    if (!this.accessToken) {
      return;
    }

    if (accessTokenIsExpired(this.accessToken)) {
      if (!this.accessToken.refreshToken) {
        throw new Error('no refresh token');
      }

      this.setAccessToken(
        await refreshUserToken(
          this.client.clientId,
          this.client.clientSecret,
          this.accessToken.refreshToken,
        ),
      );
    }

    const tokenInfo = await getTokenInfo(
      this.accessToken.accessToken,
      this.client.clientId,
    );
    if (!tokenInfo.userId) {
      throw new Error('could not get bot user id');
    }
    if (!tokenInfo.userName) {
      throw new Error('could not get bot user name');
    }
    this.userName = tokenInfo.userName;
    this.mainWindow.webContents.send('twitchUserName', this.userName);

    const authProvider = new RefreshingAuthProvider(this.client);
    authProvider.onRefresh((userId, newAccessToken) => {
      this.setAccessToken(newAccessToken);
    });
    await authProvider.addUser(tokenInfo.userId, this.accessToken, ['chat']);
    this.status = { status: Status.STARTING, message: '' };
    this.mainWindow.webContents.send('twitchStatus', this.status);

    this.bot = new Bot({
      authProvider,
      channel: this.userName,
      commands: [
        createBotCommand('bracket', (params, { say }) => {
          if (this.slug) {
            say(`https://start.gg/tournament/${this.slug}`);
          }
        }),
      ],
    });
    this.bot.onConnect(() => {
      this.status = { status: Status.STARTED, message: '' };
      this.mainWindow.webContents.send('twitchStatus', this.status);
    });
    this.bot.onDisconnect((manually, reason) => {
      this.status = { status: Status.STOPPED, message: reason?.message ?? '' };
      this.mainWindow.webContents.send('twitchStatus', this.status);
      this.bot = null;
    });
  }

  async stopBot() {
    if (!this.bot) {
      return;
    }

    this.bot.removeListener();
    await new Promise<void>((resolve) => {
      if (!this.bot) {
        resolve();
        return;
      }

      this.bot.onDisconnect(() => {
        this.bot?.removeListener();
        this.status = { status: Status.STOPPED, message: '' };
        this.mainWindow.webContents.send('twitchStatus', this.status);
        this.bot = null;
        this.userName = '';
        this.mainWindow.webContents.send('twitchUserName', this.userName);
        resolve();
      });

      this.bot.chat.quit();
    });
  }
}
