import { Telegraf } from 'telegraf';
import dotenv from "dotenv";
import fetch from 'node-fetch';

dotenv.config()

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN;

const bot = new Telegraf(token);


// error handling
bot.catch((err, ctx) => {
    return ctx.reply(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

// initialize the commands
bot.command("/start", (ctx) => {
    ctx.reply("Hello! Send any message and I will copy it.");
});
// copy every message and send to the user
// TODO: Esto peta un poco: bot.on("message", (ctx) => ctx.telegram.sendCopy(ctx.chat.id, ctx.message));

// COMANDO BOP
bot.command("/bop", async (ctx) => {
    console.log("Ejecutando bop");
    // hacer peticion
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
      let fileExtesion = '';
      let photo = '';

      while (!allowedExtensions.includes(fileExtesion)) {
          const response = await fetch('https://random.dog/woof.json');
          const data = await response.json();
          fileExtesion = data.url.split('.')[data.url.split('.').length - 1];

          photo = data.url;
      }

    ctx.replyWithPhoto({url:photo});
});

bot.launch();
