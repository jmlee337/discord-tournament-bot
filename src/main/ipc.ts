import { IpcMainInvokeEvent, app, clipboard, ipcMain } from 'electron';
import Store from 'electron-store';

export default function setupIPCs() {
  const store = new Store();
  let discordToken = store.has('discordToken')
    ? (store.get('discordToken') as string)
    : '';
  let startggApiKey = store.has('startggApiKey')
    ? (store.get('startggApiKey') as string)
    : '';

  ipcMain.removeHandler('getDiscordToken');
  ipcMain.handle('getDiscordToken', () => discordToken);

  ipcMain.removeHandler('setDiscordToken');
  ipcMain.handle(
    'setDiscordToken',
    (event: IpcMainInvokeEvent, newDiscordToken: string) => {
      store.set('discordToken', newDiscordToken);
      discordToken = newDiscordToken;
    },
  );

  ipcMain.removeHandler('getStartggApiKey');
  ipcMain.handle('getStartggApiKey', () => startggApiKey);

  ipcMain.removeHandler('setStartggApiKey');
  ipcMain.handle(
    'setStartggApiKey',
    (event: IpcMainInvokeEvent, newStartggApiKey: string) => {
      store.set('startggApiKey', newStartggApiKey);
      startggApiKey = newStartggApiKey;
    },
  );

  ipcMain.removeHandler('getVersion');
  ipcMain.handle('getVersion', () => app.getVersion());

  ipcMain.removeHandler('getLatestVersion');
  ipcMain.handle('getLatestVersion', async () => {
    const response = await fetch(
      'https://api.github.com/repos/jmlee337/discord-tournament-bot/releases',
    );
    const json = await response.json();
    return Array.isArray(json) && json.length > 0 ? json[0].tag_name : '';
  });

  ipcMain.removeHandler('copyToClipboard');
  ipcMain.handle(
    'copyToClipboard',
    (event: IpcMainInvokeEvent, text: string) => {
      clipboard.writeText(text);
    },
  );
}
