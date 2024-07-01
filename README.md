# Nicolet's Discord Tournament Bot
<img width="280" alt="Screenshot 2024-07-01 at 10 41 24 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/a59b2f42-821e-4028-9fb5-f2e785bffab5">

### TO Dashboard
<img width="498" alt="Screenshot 2024-07-01 at 10 44 39 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/ad6224f7-4f64-4f15-afe6-c56b70937700">
<img width="498" alt="Screenshot 2024-07-01 at 10 44 47 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/6f4e379b-55b3-4216-9754-f74190859c93">
<img width="498" alt="Screenshot 2024-07-01 at 10 44 54 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/129ff09e-9a12-4087-8441-d8ee0d42b16b">

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

To confirm that everything is working so far, select a tournament and event. This can be a past tournament or a test tournament, as long as it requires Discord connection and has entrants. You will need to input the `Tournament Slug`, that's this part of the URL:  
<img width="426" alt="Screenshot 2024-07-01 at 10 32 24 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/e142f228-690b-4450-a88c-ef0216a65d01">

If everything is set up correctly, the Discord bot will connect:  
<img width="497" alt="Screenshot 2024-07-01 at 10 33 41 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/23928630-b97e-4dc7-b7a2-c2d4bfd20467">

Finally, to invite the bot to your server(s) first check the `applications.commands` and `bot` boxes in the `OAuth2 URL Generator` section of the `OAuth2` tab:  
![Screenshot 2024-06-30 214508](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/b7f25a47-f59a-4c4a-8fed-6934e02caa77)

Copy the `GENERATED URL` paste it into your browser's navigation bar:  
![Screenshot 2024-06-30 214536](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/5dd0e44d-f89a-4524-a41b-de1a20d253f8)

Select a server to add the bot to and click `Authorize`:  
![Screenshot 2024-06-30 215705](https://github.com/jmlee337/discord-tournament-bot/assets/3300257/332e0e0e-a488-462b-873d-47d576f89039)

Now verify that your bot has joined your server and you can use the `/reportset` command (I had to refresh Discord the first time for the command to show up):  
<img width="252" alt="Screenshot 2024-07-01 at 10 38 06 PM" src="https://github.com/jmlee337/discord-tournament-bot/assets/3300257/aa69927c-bea8-4cef-8757-9f731f135241">

## Issues
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
