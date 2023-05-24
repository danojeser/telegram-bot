import dotenv from "dotenv";
import fetch from 'node-fetch';
import {load} from 'cheerio';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from "fs";
import ffmpeg from "ffmpeg";
import { Configuration, OpenAIApi, CreateImageRequestSizeEnum, CreateImageRequestResponseFormatEnum } from "openai";
import { Bot} from "grammy";
import { hydrateFiles } from "@grammyjs/files";
import { Menu, MenuRange } from '@grammyjs/menu'

// Initialize Firebase
const app = initializeApp({
    credential: cert('./serviceAccountKey.json')
});

// Initialize Cloud Firestore and get a reference to the service
const firestore_db = getFirestore();

// Variables de entorno
dotenv.config()
const TOKEN = process.env.TELEGRAM_TOKEN;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const TEXTREEL = process.env.TEXT_INSTAGRAM;


// Objeto del BOT
const bot = new Bot(TOKEN);
bot.api.config.use(hydrateFiles(bot.token));


const configuration = new Configuration({
    organization: process.env.OPENAI_ORG_ID,
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

bot.on('message:text', async (ctx, next) => {
    console.log('logger text');
    // Comprobar si es un comando el mensaje que envia
    if (ctx.message.text.startsWith("/")) {
        // es un comando
        const comando = ctx.message.text.replace("/", "").split(" ")[0];
        await command_logger(ctx.message.from.id, ctx.message.chat.id, comando);
        // TODO: en el caso de ser un comando, comprobar si es un comando que conocemos
    } else {
        // es un mensaje
        await message_logger(ctx.message.from.id, ctx.message.chat.id, ctx.message.text);
    }

    if (ctx.message.text.includes('tiktok.com')) {
        await ctx.reply("¿Otro Tiktok? ¿En serio?");
    }
    if (ctx.message.text.includes('/reel/') || ctx.message.text.includes('/reels/')) {
        await ctx.reply(TEXTREEL);
    }
    await next();
});


bot.on(':voice', async (ctx) => {
    console.log('entrando en voice');
    let mensaje = 'Otro puto audio';

    try {
        const file = await ctx.getFile();
        const filePath = await file.getUrl();

        await downloadAudio(filePath, 'audio.mp3');
        // TODO: Añadir una excepcion que controle que el archivo es del tamaño adecuado

        // TODO: porque esto funciona???
        const response = await openai.createTranscription(fs.createReadStream('audio.mp3'), 'whisper-1', 'illo, enverda, pue', 'text', 0, 'es');

        // TODO: meter un catch o un algo en el caso de bug de audio testeado desde mac
        mensaje = response.data !== '' ? response.data : mensaje;

        await fs.unlink('audio.mp3', err => {
            if (err) {
                console.log(err);
            } else {
                console.log('Borrado de audio exitoso');
            }
        });

        await ctx.reply(mensaje, {reply_to_message_id : ctx.message.message_id});
    } catch (error) {
        console.error(error);
        return ctx.reply('Ostias, ya me he roto. El puto bug raro del audio.');
    }
});

// error handling
bot.catch(async (err) => {
    console.log(err);
    await err.ctx.reply('Ostias, ya me he roto');
});

// initialize the commands
bot.command("start", async (ctx) => {
    await ctx.reply("Hola Mundo!!");
});


// COMANDO BOP
bot.command("bop", async (ctx) => {
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

    await ctx.replyWithPhoto(photo);
});

// COMANDO WEATHER - Esta es mi y funcionaba, mezcla con GPT
bot.command("weather",  async (ctx) => {
   console.log("Ejecutando weather");
   const arg = getArgCommand(ctx.message.text);

   if (arg !== ctx.message.text) {
       const url = `https://api.openweathermap.org/data/2.5/weather?q=${arg}&lang=es&appid=${OPENWEATHER_API_KEY}`;
       const response = await fetch(url);
       const data = await response.json();
       const weather = data['weather'][0];

       const message = `${data.name}: ${weather.main} (${weather.description})`;

       const icon_url = `http://openweathermap.org/img/wn/${weather.icon}@4x.png`;

       await ctx.replyWithPhoto(icon_url, {caption: message});
   } else {
       await ctx.reply("A ver bobin, me escribes la ciudad");
   }
});


// COMANDO ARTICLE
bot.command('article', async (ctx) => {
    console.log('Ejecutando article');
    const response = await fetch('https://es.wikipedia.org/wiki/Especial:Aleatoria');
    await ctx.reply(response.url);
});

// COMMAND MIAU
bot.command('miau', async ctx => {
    console.log('Ejecutando miau');

    const url = await getCatUrl();
    await ctx.replyWithPhoto(url);
});

// COMMAND CHILLING
bot.command('chilling', async (ctx) => {
    console.log('Ejecutando Chilling');
    const chat_id = ctx.chat.id;

    // Obtener la lista de usuarios del chat desde Firestore
    const doc = await firestore_db.collection('chats').doc(chat_id.toString()).get();
    const users_list = doc.data().users;

    let mentions = '';
    for (const user_id in users_list) {
        if (ctx.from.id.toString() !== user_id) {
            const user_name = users_list[user_id];
            mentions += ` [${user_name}](tg://user?id=${user_id}) `;
        }
    }

    const message = `${ctx.from.first_name}: ${process.env.CHILLING_MESSAGE || ''} ${mentions}`;
    await ctx.reply(message, { parse_mode: "MarkdownV2" });
});

// COMMAND ALL
bot.command('all', async (ctx) => {
    console.log('Ejecutando all');
    const chat_id = ctx.chat.id;

    // Obtener la lista de usuarios del chat desde Firestore
    const doc = await firestore_db.collection('chats').doc(chat_id.toString()).get();
    const users_list = doc.data().users;

    let mentions = '';
    for (const user_id in users_list) {
        if (ctx.from.id.toString() !== user_id) {
            const user_name = users_list[user_id];
            mentions += ` [${user_name}](tg://user?id=${user_id}) `;
        }
    }

    const message = `¡Ey\! ${mentions}`;
    await ctx.reply(message, { parse_mode: "MarkdownV2" });
});


// COMMAND CRY
bot.command('cry', async (ctx) => {
    // TODO: Hacer que el bot responda al mensaje que se indica
    console.log('Ejecutando cry');

    // Obtener la URL de la imagen de llorar desde las variables de entorno
    const url = process.env.CRY_PHOTO;

    let message = '¡A llorar a la llorería!';

    if (ctx.message.text.split(' ').length > 1) {
        // Añadir mención al mensaje
        const mention = ctx.message.text.split(' ')[1];
        message = `${mention} ${message}`;
    }

    if (ctx.message.reply_to_message?.message_id) {
        await ctx.replyWithPhoto(url, {caption: message, reply_to_message_id: ctx.message.reply_to_message.message_id});
    } else {
        await ctx.replyWithPhoto(url, {caption: message});
    }
});


// COMMAND INSULT - GPT
bot.command('insult', async (ctx) => {
    console.log('Ejecutando insult');
    const response = await fetch('https://evilinsult.com/generate_insult.php?lang=en&type=json');
    const data = await response.json();
    await ctx.reply(data.insult);
});


// COMANDO RECETA
bot.command('receta', async (ctx) => {
    console.log('Ejecutando receta');

    let url = 'https://www.recetasderechupete.com/?s=';
    if (ctx.message.text.split(' ').length > 1) {
        const args = ctx.message.text.split(' ').slice(1);
        for (let i = 0; i < args.length; i++) {
            url += args[i] + '+';
        }
    }

    const response = await fetch(url);
    const html = await response.text();
    const pa = load(html);

    const links = pa('div.pure-u-1-2 >  a');

    if (links.length > 0) {
        const randomIndex = Math.floor(Math.random() * links.length);
        const link = links[randomIndex].attribs.href;
        await ctx.reply(link);
    } else {
        await ctx.reply('No he encontrado ninguna receta para lo que has buscado');
    }
});


// COMANDO DESMOTIVACION
bot.command('desmotivacion', async (ctx) => {
    console.log('Ejecutando desmotivacion');
    // hacer petición
    const url = 'http://desmotivaciones.es/aleatorio';

    const response = await fetch(url);
    const html = await response.text();
    const $ = load(html);

    const img = $('div.align-center > a > img').eq(1);
    const imageUrl = 'http:' + img.attr('src');

    await ctx.replyWithPhoto(imageUrl);
});


// COMANDO MOVIE
bot.command('movie', async (ctx) => {
    console.log('Ejecutando movie');
    // hacer petición
    const url = 'https://randommer.io/random-movies';
    const baseUrl = 'https://randommer.io';

    const response = await fetch(url);
    const html = await response.text();
    const $ = load(html);

    const title = $('div.caption').first().text().trim();
    const image = baseUrl + $('picture > source').first().attr('srcset').replace(".webp", ".jpg");

    await ctx.replyWithPhoto(image, {caption: title});
});



// COMANDO STATS
bot.command("stats", async (ctx) => {
    console.log("Ejecutando stats");
    // obtener ID de usuario y chat
    const effective_user_id = ctx.from.id;
    const effective_chat_id = ctx.chat.id;

    // Total de mensajes enviados
    const message_data = await firestore_db.collection('loggerMessage').where('group', '==', effective_chat_id).where('user', '==', effective_user_id).get();

    // Total de comandos ejecutados
    const command_data = await firestore_db.collection('logger').where('group', '==', effective_chat_id).where('user', '==', effective_user_id).get();

    const mention = '[' + ctx.from.first_name + '](tg://user?id=' + effective_user_id + ')';

    const message = mention + '\n' +'Numero de mensajes enviados: ' + message_data.size + '\n' + 'Numero de comandos ejecutados: ' + command_data.size;

    await ctx.reply(message, { parse_mode: "MarkdownV2" });
});


// COMANDO AITANA
bot.command("aitana", async (ctx) => {
    console.log('Ejecutando aitana');
    // hacer peticion
    const response = await fetch(process.env.URL_AITANA_API);
    const data = await response.json();

    await ctx.replyWithPhoto(data.image, {caption: data.quote});
});


// COMANDO IMAGEN
bot.command("imagen", async (ctx) => {
    console.log('Ejecutando imagen');
    let prompt = getArgCommand(ctx.message.text);
    // hacer peticion
    const response = await openai.createImage({prompt: prompt, n: 1, response_format: CreateImageRequestResponseFormatEnum.Url, size: CreateImageRequestSizeEnum._512x512 });
    const url = response.data.data[0].url;

    await ctx.replyWithPhoto(url);
});

bot.start();


function getArgCommand(text) {
    return text.substring(text.indexOf(" ") + 1, text.length+1);
}


async function getCatImageUrl(){
    const response = await fetch('https://api.thecatapi.com/v1/images/search');
    const data = await response.json();
    return data[0]['url'];
}

async function getCatUrl() {
    let allowedExtension = ['jpg', 'jpeg', 'png'];
    let fileExtension = '';
    let url = '';
    
    while (allowedExtension.findIndex(ele => ele === fileExtension)) {
        url = await getCatImageUrl();
        fileExtension = url.substring(url.search("([^.]*)$")).toLowerCase();
    }

    return url
}

// Si el grupo y el user son iguales, es porque se estan enviando desde una conversacion directa con el bot

// función LOGGER
async function command_logger(user, group, command) {
    console.log('COMMAND LOGGER');
    /*await firestore_db.collection('logger').add({
        command: command,
        user: user,
        group: group,
        date: Date.now(),
    });*/
}

async function message_logger(user, group, text) {
    console.log('LOGGER MESSAGE');
    /*await firestore_db.collection('loggerMessage').add({
        text: text,
        user: user,
        group: group,
        date: Date.now()
    });*/
}


// TODO: Que leches hago con esto
async function register_user(chat_name, chat_id, user_name, user_id) {
    console.log('REGISTER USER');/*
    const doc = await firestore_db.collection('chats').doc(chat_id.toString()).get();
    if (doc.exists) {
        // Si el documento existe comprobar que el usuario está en la lista de usuario
        const users = doc.data().users;
        if (users[user_id]) {
            console.log('el user ya está metido');
        } else {
            // si el usuario no existe, añadirlo a la lista
            users[user_id] = user_name;
            await firestore_db.collection('chats').doc(chat_id.toString()).update({ users: users });
        }
    } else {
        // El grupo no existe, crearlo y añadir al usuario a la lista
        const data = { name: chat_name, users: { [user_id]: user_name } };
        await firestore_db.collection('chats').doc(chat_id.toString()).set(data);
        console.log('grupo creado');
    }*/
}


async function downloadAudio (url, outputFilePath) {
    const response = await fetch(url);
    const buffer = await response.buffer();

    await fs.writeFileSync('audio.oga', buffer);

    try {
        const audio = await new ffmpeg('audio.oga');
        await audio.save(outputFilePath, {
            codec: 'libmp3lame',
            bitrate: '192k',

        });
        console.log(`El archivo se ha convertido exitosamente a ${outputFilePath}`);
    } catch (e) {
        console.log(`Hubo un error al convertir el archivo: ${e.message}`);
    }
}




/*
Contexto: eres un asistente de programacion experto en python y nodejs, me estas ayudando a traducir un script de python a nodejs. Te voy a dar un ejemplo de una funcion traducida para que me ayudes en otras funciones. 
En Python estoy telegram.ext
y en node: telegraf
Funcion en python:
def bop(update, context):
    print('Ejecutanto bop')
    logger('bop', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    url = get_image_url()

    context.bot.send_photo(chat_id=update.effective_chat.id, photo=url)

La misma funcion pero en node: 
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
Solo tienes que contestar "ok", si has entendido lo que te he dicho.
*/

