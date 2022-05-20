import fetch from 'node-fetch';
import dotenv from 'dotenv';
import TelegramBot from "node-telegram-bot-api";

dotenv.config()

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});


// Comando bop
bot.onText(/\/bop/, async function onAudioText(msg) {
    console.log('Ejecutando bop');
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

    bot.sendPhoto(msg.chat.id, photo);
});

// Comando aitana
bot.onText(/\/aitana/, async function onAudioText(msg) {
    console.log('Ejecutando aitana');
    // hacer peticion
    const response = await fetch('http://aitana-api.danojeser.com');
    const data = await response.json();

    bot.sendPhoto(msg.chat.id, data.image, {caption: data.quote});
});

