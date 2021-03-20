import discord
import asyncio
import os
from dotenv import load_dotenv


load_dotenv()

DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
DISCORD_SERVER_ID = os.getenv('DISCORD_SERVER_ID')
DISCORD_CHANNEL_ID = os.getenv('DISCORD_CHANNEL_ID')


class MyClient(discord.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    async def on_ready(self):
        print('Logged in as')
        print(self.user.name)
        print(self.user.id)
        print('------')
        canal = self.get_channel(id=int(DISCORD_CHANNEL_ID))
        for m in canal.members:
            print(m)
        await self.close()


client = MyClient()

client.run(DISCORD_TOKEN)
