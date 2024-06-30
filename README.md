# Nicolet's Discord Tournament Bot

## Setup
This will only work for start.gg tournaments that `Require Discord connection to register`.
This is required for the bot to know which Discord users are which start.gg players:  
![Screenshot 2024-06-30 222512](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/907c850a-6fa5-48d6-8190-80e6d49f9be4)

To make a Discord bot, click the `New Application` button at https://discord.com/developers/applications:  
![Screenshot 2024-06-30 214045](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/c873933b-1a28-43d5-bd67-65e8981b4b75)

Copy the `APPLICATION ID` from the `General Information` tab:  
![Screenshot 2024-06-30 213939](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/241d9cb3-dcff-4ad9-8900-c9d7c0dc04be)

Paste your Discord bot's application id into Settings:  
![Screenshot 2024-06-30 214723](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/e19eacc9-2510-4c6e-8b1f-77971ac2507b)

Press `Reset Token` and copy the token from the Bot tab:  
![Screenshot 2024-06-30 214012](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/78137e48-d6ac-478c-bac2-2222a3299180)

Paste your Discord bot's token into Settings:  
![Screenshot 2024-06-30 214755](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/1c038893-8091-4f95-b1a7-a2dcabf1d57b)

Press `Create new token` at https://start.gg/admin/profile/developer and copy the start.gg token:  
![Screenshot 2024-06-30 215139](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/28a46c89-99d5-4125-8f2a-999f414f4bee)

Paste your start.gg token into Settings:  
![Screenshot 2024-06-30 220241](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/610245f6-2428-4d97-957c-b70639b7bb65)

Finally, to invite the bot to your server(s) first check the `applications.commands` and `bot` boxes in the `OAuth2 URL Generator` section of the `OAuth2` tab:  
![Screenshot 2024-06-30 214508](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/b7f25a47-f59a-4c4a-8fed-6934e02caa77)

Copy the `GENERATED URL` paste it into your browser's navigation bar:  
![Screenshot 2024-06-30 214536](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/5dd0e44d-f89a-4524-a41b-de1a20d253f8)

Select a server to add the bot to and click `Authorize`:  
![Screenshot 2024-06-30 215705](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/332e0e0e-a488-462b-873d-47d576f89039)

## Users
Please [check discussions/ask for help](https://github.com/jmlee337/discord-tournament-bot/discussions) before [checking issues/filing a bug report or feature request](https://github.com/jmlee337/discord-tournament-bot/issues).

## Development
Clone the repo and install dependencies:
```bash
git clone https://github.com/jmlee337/discord-tournament-bot.git discord-tournament-bot
cd discord-tournament-bot
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
