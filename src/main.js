import dotenv from "dotenv";
import fetch from 'node-fetch';
import {load} from 'cheerio';
import * as fs from "fs";
import ffmpeg from "ffmpeg";
import { Configuration, OpenAIApi, CreateImageRequestSizeEnum, CreateImageRequestResponseFormatEnum } from "openai";
import { Bot, InputFile } from "grammy";
import { hydrateFiles } from "@grammyjs/files";
import { exec } from 'child_process';
import dualAdapter from './db/dualAdapter.js';
import { createCanvas } from 'canvas';
import * as os from 'os';
import * as path from 'path';

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

const compareByName = (a, b) => {
    const nameA = a.command.toUpperCase();
    const nameB = b.command.toUpperCase();

    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }

    return 0;
};


const listaComandos = [
    { command: "bop", description: "Imagen de perrete"},
    { command: "weather", description: "El tiempo que hace"},
    { command: "article", description: "Articulo random de Wikipedia"},
    { command: "miau", description: "Imagen de gatete"},
    { command: "chilling", description: "Avisa a todo el mundo de que estas chilling"},
    { command: "all", description: "Menciona a todo el mundo"},
    { command: "cry", description: "Indica a una persona donde llorar"},
    { command: "insult", description: "Insulto random"},
    { command: "receta", description: "Busca una receta con el ingrediente indicado"},
    { command: "desmotivacion", description: "Desmotivación random"},
    { command: "movie", description: "Recomendacion de una pelicula"},
    { command: "stats", description: "Tus stats en este chat"},
    { command: "aitana", description: "Imagen y quote de Aitana"},
    { command: "imagen", description: "Imagen generada por IA"},
    { command: "messagestats", description: "Gráfica de mensajes por mes del último año"},
    { command: "commandstats", description: "Gráfica de comandos por mes del último año"},
    // TODO: { command: "yearstats", description: "Gráfica de comandos por mes de un año específico"},
];

await bot.api.setMyCommands(listaComandos.sort(compareByName));


bot.on('message:text', async (ctx, next) => {
    console.log('logger text');
    
    // Register the user when they send a message
    const chatName = ctx.chat.title || `Private chat with ${ctx.from.first_name}`;
    const chatId = ctx.chat.id;
    const userName = ctx.from.username ? ctx.from.username : ctx.from.first_name;
    const userId = ctx.from.id;
    
    // Register user in both databases
    await dualAdapter.registerUser(chatName, chatId, userName, userId);
    
    // Comprobar si es un comando el mensaje que envia
    if (ctx.message.text.startsWith("/")) {
        // es un comando
        const comando = ctx.message.text.replace("/", "").split(" ")[0];
        await dualAdapter.commandLogger(ctx.message.from.id, ctx.message.chat.id, comando);
        // TODO: en el caso de ser un comando, comprobar si es un comando que conocemos
    } else {
        // es un mensaje
        await dualAdapter.messageLogger(ctx.message.from.id, ctx.message.chat.id, ctx.message.text);
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

        // Control de que no exista el mp3, porque si existe se peta
        if (fs.existsSync(filePath)) {
            await fs.unlink('audio.mp3', err => {
                if (err) {
                    console.log(err);
                } else {
                    console.log('Borrado preventivo de audio exitoso');
                }
            });
        }

        await downloadAudio(filePath, 'audio.mp3');
        // TODO: Añadir una excepcion que controle que el archivo es del tamaño adecuado

        // TODO: porque esto funciona???
        const response = await openai.createTranscription(fs.createReadStream('audio.mp3'), 'whisper-1', 'illo, enverda, pue', 'text', 0, 'es');

        // TODO: meter un catch o un algo en el caso de bug de audio testeado desde mac, no se de que bug hablo, gracias Dani del pasado
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

    // Get users from dual adapter
    const users_list = await dualAdapter.getChatUsers(chat_id);

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

    // Get users from dual adapter
    const users_list = await dualAdapter.getChatUsers(chat_id);

    let mentions = '';
    for (const user_id in users_list) {
        if (ctx.from.id.toString() !== user_id) {
            const user_name = users_list[user_id];
            mentions += ` [${user_name}](tg://user?id=${user_id}) `;
        }
    }

    const message = `\¡Ey\\! ${mentions}`;
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
    const imageUrl = img.attr('src');
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

    // Get stats from dual adapter
    const messageCount = await dualAdapter.getUserMessageCount(effective_user_id, effective_chat_id);
    const commandCount = await dualAdapter.getUserCommandCount(effective_user_id, effective_chat_id);

    const mention = '[' + ctx.from.first_name + '](tg://user?id=' + effective_user_id + ')';

    const message = mention + '\n' +'Numero de mensajes enviados: ' + messageCount + '\n' + 'Numero de comandos ejecutados: ' + commandCount;

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


// COMANDO SERVER
bot.command("server", async (ctx) => {
    // TODO: crear una lista que tenga el nombre del server y la ip que tiene asociada para poder hacerlo facil para no tocar codigo cuando haya nuevo server
    console.log('Ejecutando server');

    let message = 'Texto vacio. Algo ha ido mal.';
    const listaJuegos = {
        'minecraft': '25565',
        'terraria': '7777',
        'palworld': '25575' // pingeamos el rconport porque no acepta por el otro 
    };
    const arg = getArgCommand(ctx.message.text).toLowerCase();

    if (arg !== ctx.message.text && listaJuegos.hasOwnProperty(arg)) {
        let comando = `nc -vz -w 1 ${process.env.IP_SERVER_GAMES} ${listaJuegos[arg]}`;

        await exec(comando, (error, stdout, stderr) => {
            if (stderr.includes('succeeded')) {
                // server encendido
                message = `El servidor de ${arg.charAt(0).toUpperCase() + arg.slice(1)} está encendido`;
            }

            if (error) {
                // El comando NC indica que que si no hay respuesta hay un error en el comando
                // server apagado
                message = `El servidor de ${arg.charAt(0).toUpperCase() + arg.slice(1)} está apagado`;
            }

            ctx.reply(message, { parse_mode: "MarkdownV2" });
        });
    } else {
        await ctx.reply("A ver bobín, me escribes un juego válido");
    }
});

// COMANDO MESSAGESTATS
bot.command("messagestats", async (ctx) => {
    console.log('Ejecutando messagestats');
    
    try {
        // Get chat ID and user ID
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        
        // Get message counts by month
        const stats = await dualAdapter.getMessageCountsByMonth(chatId, userId, 12);
        
        if (stats.length === 0) {
            return await ctx.reply("No hay suficientes datos para generar la gráfica");
        }
        
        // Generate bar graph image
        const imagePath = await generateMessageStatsGraph(stats, ctx.chat.title || "este chat", "Mensajes", ctx.from.first_name);
        
        // Send the image
        await ctx.replyWithPhoto(new InputFile(imagePath));
        
        // Delete the temporary file
        fs.unlink(imagePath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
    } catch (error) {
        console.error('Error generating message stats:', error);
        await ctx.reply('Hubo un error al generar la gráfica de estadísticas');
    }
});

// COMANDO COMMANDSTATS
bot.command("commandstats", async (ctx) => {
    console.log('Ejecutando commandstats');
    
    try {
        // Get chat ID and user ID
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        
        // Get command counts by month
        const stats = await dualAdapter.getCommandCountsByMonth(chatId, userId, 12);
        
        if (stats.length === 0) {
            return await ctx.reply("No hay suficientes datos para generar la gráfica");
        }
        
        // Generate bar graph image
        const imagePath = await generateMessageStatsGraph(stats, ctx.chat.title || "este chat", "Comandos", ctx.from.first_name);
        
        // Send the image
        await ctx.replyWithPhoto(new InputFile(imagePath));
        
        // Delete the temporary file
        fs.unlink(imagePath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
    } catch (error) {
        console.error('Error generating command stats:', error);
        await ctx.reply('Hubo un error al generar la gráfica de estadísticas');
    }
});

// COMANDO YEARSTATS
// TODO: Rework this command. Por el momento esta deshabilitado
bot.command("yearstats", async (ctx) => {
    console.log('Ejecutando yearstats');
    return await ctx.reply("De momento no funciona");
    
    try {
        // Get chat ID and user ID
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        
        // Get the year from the command text
        const commandText = ctx.message.text;
        const parts = commandText.split(' ');
        
        // Check if a year was provided
        if (parts.length < 2) {
            return await ctx.reply("Por favor, especifica un año. Ejemplo: /yearstats 2023");
        }
        
        // Parse the year
        const year = parts[1].trim();
        const yearNum = parseInt(year);
        
        // Validate the year
        const currentYear = new Date().getFullYear();
        if (isNaN(yearNum) || yearNum < 2024 || yearNum > currentYear) {
            return await ctx.reply(`Por favor, especifica un año válido entre 2024 y ${currentYear}`);
        }
        
        // Get command counts by month for the specified year
        const stats = await dualAdapter.getMessageCountsByYear(chatId, userId, year);
        
        if (stats.every(item => item.count === 0)) {
            return await ctx.reply(`No hay datos de mensajes para el año ${year}`);
        }
        
        // Generate bar graph image
        const imagePath = await generateMessageStatsGraph(stats, ctx.chat.title || "este chat", "Mensajes", ctx.from.first_name);
        
        // Send the image using a file read stream
        await ctx.replyWithPhoto(new InputFile(imagePath));
        
        // Delete the temporary file
        fs.unlink(imagePath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
    } catch (error) {
        console.error('Error generating year stats:', error);
        await ctx.reply('Hubo un error al generar la gráfica de estadísticas por año');
    }
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

// Function to generate a message stats bar graph
async function generateMessageStatsGraph(stats, chatTitle, type, userName) {
    // Canvas dimensions
    const width = 800;
    const height = 500;
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Chart settings
    const padding = 60;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);
    
    // Draw title
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.fillText(`${type} por mes en ${chatTitle} de ${userName}`, width / 2, padding / 2);
    
    // Get max value for scaling
    const maxCount = Math.max(...stats.map(s => s.count));
    const maxValue = maxCount > 0 ? maxCount : 10; // Avoid division by zero
    
    // Format months for display
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    // Calculate bar width
    const barWidth = chartWidth / stats.length * 0.7;
    const barSpacing = chartWidth / stats.length - barWidth;
    
    // Draw y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.strokeStyle = '#333333';
    ctx.stroke();
    
    // Draw x-axis
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw y-axis labels
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    
    const yLabelCount = 5;
    for (let i = 0; i <= yLabelCount; i++) {
        const value = Math.round((maxValue / yLabelCount) * i);
        const y = height - padding - (i * (chartHeight / yLabelCount));
        
        // Draw grid line
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.strokeStyle = '#dddddd';
        ctx.stroke();
        
        // Draw label
        ctx.fillStyle = '#333333';
        ctx.fillText(value.toString(), padding - 10, y + 5);
    }
    
    // Draw bars
    stats.forEach((stat, index) => {
        // Calculate bar position and height
        const x = padding + (index * (barWidth + barSpacing)) + barSpacing / 2;
        const barHeight = (stat.count / maxValue) * chartHeight;
        const y = height - padding - barHeight;
        
        // Draw bar
        ctx.fillStyle = 'rgba(54, 162, 235, 0.8)';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw bar border
        ctx.strokeStyle = 'rgba(54, 162, 235, 1)';
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Draw x-axis label (month)
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        
        // Format the month name
        const [year, month] = stat.month.split('-');
        const monthName = months[parseInt(month) - 1];
        const shortMonth = monthName.substring(0, 3);
        
        // Draw month label
        ctx.fillText(`${shortMonth}`, x + barWidth / 2, height - padding + 20);
        
        // Draw year if it's January or the first month in the graph
        if (month === '01' || index === 0) {
            ctx.fillText(`${year}`, x + barWidth / 2, height - padding + 40);
        }
        
        // Draw count on top of bar
        if (stat.count > 0) {
            ctx.fillText(stat.count.toString(), x + barWidth / 2, y - 10);
        }
    });
    
    // Save image to temporary file
    const imagePath = path.join('temp', `messagestats_${Date.now()}.png`);
    
    // Create a write stream to save the canvas as PNG
    const out = fs.createWriteStream(imagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    
    return new Promise((resolve, reject) => {
        out.on('finish', () => resolve(imagePath));
        out.on('error', reject);
    });
}
