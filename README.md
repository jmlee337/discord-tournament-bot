# Nicolet's Netplay Tournament Suite (NTS)

Nicolet's Netplay Tournament Suite offers TOs a range of helpful tools for running netplay tournaments, including broadcast management, overlay automation, and a Discord bot.

[![Download](https://github.com/user-attachments/assets/0f155c5c-bd25-45fb-99f7-db055a380e12)](http://github.com/jmlee337/discord-tournament-bot/releases/latest)

### Broadcasts

<img width="400" alt="Screenshot 2025-12-07 at 12 45 17" src="https://github.com/user-attachments/assets/7f8030c8-9f15-416e-a6b3-8afccd7fa746" />
<img width="400" alt="Screenshot 2025-12-07 at 12 45 24" src="https://github.com/user-attachments/assets/abf35ea2-c945-40d8-ab89-e75962fe3b83" />

### Overlay

<img width="400" alt="Screenshot 2025-12-07 at 12 50 01" src="https://github.com/user-attachments/assets/862cbe14-b1a5-47d3-9ce4-fb32aab2e029" />

### Bracket Dashboard

<img width="400" alt="Screenshot 2025-12-07 at 12 39 12" src="https://github.com/user-attachments/assets/14bf8808-bf69-4383-9dfc-0cce9c228e82" />
<img width="400" alt="Screenshot 2025-12-07 at 12 39 19" src="https://github.com/user-attachments/assets/bf6287f4-3c7c-46c2-9d94-371e96003b9b" />
<img width="400" alt="Screenshot 2025-12-07 at 12 39 24" src="https://github.com/user-attachments/assets/d33fe252-1a07-4ef2-a430-177e997a4c7c" />
<img width="400" alt="Screenshot 2025-12-07 at 12 39 29" src="https://github.com/user-attachments/assets/bcc0281a-c46a-4f23-8365-a88d63394217" />
<img width="400" alt="Screenshot 2025-12-07 at 12 53 49" src="https://github.com/user-attachments/assets/8b015c31-11bd-4fd9-a758-18a7a1901963" />

### Discord Bot

<img width="313" alt="Screenshot 2025-12-07 at 12 51 49" src="https://github.com/user-attachments/assets/7ce14bc8-1091-4866-8db6-a52c00acfba7" /><br />
<img width="280" alt="Screenshot 2024-07-01 at 10 41 24 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/a59b2f42-821e-4028-9fb5-f2e785bffab5">

## Setup

### Broadcast

You must have Slippi Launcher version 2.12.0 or later to use the NTS Broadcasts tab.

Enable Spectate Remote Control in Slippi Launcher Settings:  
<img width="400" alt="Screenshot 2025-12-07 at 13 40 21" src="https://github.com/user-attachments/assets/2244f52d-0798-481f-88bd-f1c36da83783" />

Then start the Remote Control Server from the Slippi Launcher Spectate tab:  
<img width="400" alt="Screenshot 2025-12-07 at 13 40 31" src="https://github.com/user-attachments/assets/97c81c11-84ba-4a8f-b129-66ba944bafa6" />

Then you should be able to connect and manage your broadcasts from the NTS Broadcasts tab.

### Overlay

Requires [Melee Stream Tool](https://github.com/Readek/Melee-Stream-Tool/releases/latest).

Enable Melee Stream Tool integration and set your Melee Stream Tool `Resources` folder in the settings dialog on the NTS Overlay tab:
<img width="600" alt="Screenshot 2025-12-07 162249" src="https://github.com/user-attachments/assets/d43cb0fd-2219-47ca-8615-87da25e0e67b" />

### Discord

Mac users, please see how to [open an app from an unidentified developer](https://support.apple.com/en-gb/guide/mac-help/mh40616/mac).

This will only work for start.gg tournaments that `Require Discord connection to register`.
This is required for the bot to know which Discord users are which start.gg players:  
<img width="600" alt="Screenshot 2024-06-30 222512" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/907c850a-6fa5-48d6-8190-80e6d49f9be4" />

To make a Discord bot, click the `New Application` button at https://discord.com/developers/applications:  
<img width="300" alt="Screenshot 2024-06-30 214045" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/c873933b-1a28-43d5-bd67-65e8981b4b75" />

Copy the `APPLICATION ID` from the `General Information` tab:  
<img width="300" alt="Screenshot 2024-06-30 213939" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/241d9cb3-dcff-4ad9-8900-c9d7c0dc04be" />

Paste your Discord bot's application id into Settings:  
<img width="300" alt="Screenshot 2024-06-30 214723" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/e19eacc9-2510-4c6e-8b1f-77971ac2507b" />

Turn on `Server Members Intent` on the `Bot` tab:  
<img width="600" alt="image" src="https://github.com/user-attachments/assets/4f1af5ce-e273-42a1-ad0d-57b63b961563" />

Press `Reset Token` and copy the token from the `Bot` tab:  
<img width="300" alt="Screenshot 2024-06-30 214012" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/78137e48-d6ac-478c-bac2-2222a3299180" />

Paste your Discord bot's token into Settings:  
<img width="300" alt="Screenshot 2024-06-30 214755" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/1c038893-8091-4f95-b1a7-a2dcabf1d57b" />

Invite the bot to your server(s) first check the `applications.commands` and `bot` boxes in the `OAuth2 URL Generator` section of the `OAuth2` tab:  
<img width="600" alt="Screenshot 2024-06-30 214508" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/b7f25a47-f59a-4c4a-8fed-6934e02caa77" />

Copy the `GENERATED URL` paste it into your browser's navigation bar:  
<img width="600" alt="Screenshot 2024-06-30 214536" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/5dd0e44d-f89a-4524-a41b-de1a20d253f8" />

Select a server to add the bot to and click `Authorize`:  
<img width="600" alt="Screenshot 2024-06-30 215705" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/332e0e0e-a488-462b-873d-47d576f89039" />

Press `Create new token` at https://start.gg/admin/profile/developer and copy the start.gg token:  
<img width="600" alt="Screenshot 2024-06-30 215139" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/28a46c89-99d5-4125-8f2a-999f414f4bee" />

Paste your start.gg token into Settings:  
<img width="300" alt="Screenshot 2024-06-30 220241" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/610245f6-2428-4d97-957c-b70639b7bb65" />

Finally, select a tournament and event.
This can be a past tournament or a test tournament, as long as it requires Discord connection and has entrants.
If everything is set up correctly, the Discord bot will connect:  
<img width="300" alt="Screenshot 2025-12-07 at 13 47 01" src="https://github.com/user-attachments/assets/e0ba7a80-c3f4-4cf3-a839-3b1d73a4bb6f" />

Now verify that your bot has joined your server and you can use the `/reportset` command (I had to refresh Discord the first time for the command to show up):  
<img width="252" alt="Screenshot 2024-07-01 at 10 38 06 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/aa69927c-bea8-4cef-8757-9f731f135241">

## Issues

Please [check discussions/ask for help](https://github.com/jmlee337/discord-tournament-bot/discussions) before [checking issues/filing a bug report or feature request](https://github.com/jmlee337/discord-tournament-bot/issues).

## Development

Clone the repo and install dependencies:

```bash
git clone https://github.com/jmlee337/discord-tournament-bot.git discord-tournament-bot
cd discord-tournament-bot
```

I use Node 20

```bash
nvm use 20
npm install
```

Start the app in the `dev` environment:

```bash
npm start
```

To package apps for the local platform:

```bash
npm run package
```
