import os
import requests
import re
import time
import random
from dotenv import load_dotenv
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters
import firebase_admin
from firebase_admin import credentials, firestore


load_dotenv()

TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
SECONDS_DAY = 86400
SECONDS_WEEK = 604800
SECONDS_MONTH = 2592000


cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
firestore_db = firestore.client()

aitana_quotes = [
  "Porque nunca admití estar enamorada, siempre lo supe y no dije nada",
  "Mi corazón se quiso esconder",
  "Te juro que esta vez voy a cuidarte",
  "Quise obligarme a olvidar tu boca y ahora mi boca dirá que si tú regresas",
  "Solo cuando llueve me buscas, solo cuando hay frío te asustas",
  "Una llamada perdida fácil se olvida",
  "No entiendo cómo pudiste borrarme",
  "Como lo hiciste tú y besa mejor que tú",
  "All these stupid guys like these stupid, stupid girls",
  "Dont talk, girl, just listen,keep it to yourself, dont tell em your opinion",
  "Like popcorn, tasty cant get enough, I want you on the daily",
  "And I know I should stop but the way that you talk",
  "No me esperaba verte aquí, sigues jugando con fuego",
  "Aquí yo me pienso quedar aunque te moleste tener que mirar",
  "Soy una ventana mirando al mar en un día de invierno",
  "Se fue, se fue perdiendo y hoy hay silencio",
  "Fuimos el secreto de una estrella fugaz que no cumplió el deseo",
  "Me dieron ganas de hablarte y vuelvo a pensarte",
  "Aunque no lo ves todo es frágil a mis pies",
  "Obligamos a nuestro corazón a perder la apuesta",
  "Nos juramos nunca mirar atrás y borrar la cuenta",
]

aitana_images = [
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-1.jpg?alt=media&token=1832321b-b382-40a3-8f94-43c18ac16da6",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-10.jpeg?alt=media&token=1e67452b-6866-473c-bcfb-ffd6202b893a",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-11.jpg?alt=media&token=e91302e6-20bf-43e5-ba91-db21199b6c82",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-12.jpg?alt=media&token=7c7642c5-453a-4303-b021-64ae3dc0c22a",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-13.jpg?alt=media&token=e4142230-a057-4d49-97e8-5d48b1bdcf0e",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-14.jpg?alt=media&token=a1ae6523-4e4e-427c-a296-c1e85d4046bc",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-15.jpg?alt=media&token=2add52e7-f0e7-4877-846b-1f0d5a6e1fb5",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-16.jpg?alt=media&token=7ba09ad9-061c-488c-9dfa-73556ba2c1e2",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-17.jpg?alt=media&token=8922b732-6800-4b09-8e7f-89f513d7ac91",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-18.jpg?alt=media&token=77e61a52-5430-4804-af62-b582cc5d382a",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-19.jpg?alt=media&token=7613d8e9-15cd-4996-b947-bab8bcff2edc",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-2.jpg?alt=media&token=a2a805fd-cecf-48a7-9166-54563c9c3a08",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-20.jpg?alt=media&token=afa1a137-c46b-41ec-ac2d-f19b453e700d",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-3.jpg?alt=media&token=514be93b-f107-4540-832f-70a0f660cb22",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-4.jpeg?alt=media&token=6da0aff0-0883-47d9-8dc3-3d0c46d9049a",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-5.jpeg?alt=media&token=0e353148-1740-4598-8cdb-77d42f909e50",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-6.jpg?alt=media&token=0c02e90b-3bd4-4bcc-a092-4c837a3acae3",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-7.jpg?alt=media&token=a624e993-9d58-47f0-b968-f0785a3595dd",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-8.jpg?alt=media&token=a1cc3b86-dcf7-4be9-b6b3-ca7c6f3d4e8e",
  "https://firebasestorage.googleapis.com/v0/b/aitana-api.appspot.com/o/aitana-9.jpg?alt=media&token=c513e836-8fe6-495d-a960-02238af41e01",
];


# COMANDOS
def bop(update, context):
    print('Ejecutanto bop')
    logger('bop', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    url = get_image_url()

    context.bot.send_photo(chat_id=update.effective_chat.id, photo=url)


def chilling(update, context):
    print('Ejecutando Chilling')
    logger('chilling', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    chat_id = update.effective_chat.id
    users_list = firestore_db.collection(u'chats').document(str(chat_id)).get().get('users')

    mentions = ''
    for user_id in users_list:
        if str(update.effective_user.id) != user_id:
            mentions = " " + mentions + "[" + users_list[user_id] + "](tg://user?id=" + user_id + ")" + "   "

    message = update.effective_user.first_name + ': ' + os.getenv('CHILLING_MESSAGE')
    message = message + mentions
    context.bot.send_message(chat_id=chat_id, text=message, parse_mode="Markdown")


def mention_all(update, context):
    print('Ejecutando all')
    logger('mention_all', update.effective_user.id, update.effective_chat.id)

    chat_id = update.effective_chat.id
    users_list = firestore_db.collection(u'chats').document(str(chat_id)).get().get('users')

    mentions = ''
    for user_id in users_list:
        if str(update.effective_user.id) != user_id:
            mentions = "  " + mentions + "[" + users_list[user_id] + "](tg://user?id=" + user_id + ")" + "   "

    message = 'Ey! ' + mentions
    context.bot.send_message(chat_id=chat_id, text=message, parse_mode="Markdown")


def cry(update, context):
    print('Ejecutando cry')
    logger('cry', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    url = os.getenv('CRY_PHOTO')
    message = 'A llorar a la lloreria!'

    if len(context.args) == 1:
        # Añadir mencion al mensaje
        message = context.args[0] + ' ' + message

    context.bot.send_photo(chat_id=update.effective_chat.id, caption=message, photo=url)


def weather(update, context):
    print('Ejecutando weather')
    logger('weather', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)
    
    if len(context.args) > 0:
        arg = str(context.args[0]).lower()

        url = 'https://api.openweathermap.org/data/2.5/weather?q=' + arg + '&lang=es&appid=' + OPENWEATHER_API_KEY

        response = requests.get(url).json()
        weather = response['weather'][0]

        message = response['name'] + ': ' + weather['main'] + ' (' + weather['description'] + ')'
        icon_url = 'http://openweathermap.org/img/wn/' + weather['icon'] + '@4x.png'

        context.bot.send_photo(chat_id=update.effective_chat.id, caption=message, photo=icon_url)
    else:
        context.bot.send_message(chat_id=update.effective_chat.id, text='Te falta la ciudad, bobo')

def article(update, context):
    print('Ejecutando article')
    logger('article', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    response = requests.get('https://es.wikipedia.org/wiki/Especial:Aleatoria')
    context.bot.send_message(chat_id=update.effective_chat.id, text=response.url)

def insult(update, context):
    print('Ejecutando insult')
    logger('insult', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    response = requests.get('https://evilinsult.com/generate_insult.php?lang=en&type=json').json()
    context.bot.send_message(chat_id=update.effective_chat.id, text=response['insult'])

def taylor(update, context):
    print('Ejecutando taylor')
    logger('taylor', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    quote = requests.get('https://api.taylor.rest/').json()['quote']
    image_url = requests.get('https://api.taylor.rest/image').json()['url']
    context.bot.send_photo(chat_id=update.effective_chat.id, caption=quote, photo=image_url)

def miau(update, context):
    print('Ejecutando miau')
    logger('miau', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    url = get_cat_image_url()
    context.bot.send_photo(chat_id=update.effective_chat.id, photo=url)


def aitana(update, context):
    print('Ejecutando aitana')
    logger('aitana', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    quote = aitana_quotes[random.randint(0,19)]
    image_url = aitana_images[random.randint(0, 20)]
    context.bot.send_photo(chat_id=update.effective_chat.id, caption=quote, photo=image_url)


def stats(update, context):
    print('Ejecutando stats')
    logger('stats', update.effective_user.id, update.effective_chat.id)
    register_user(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)

    effective_user_id = update.effective_user.id
    effective_chat_id = update.effective_chat.id

    # Total de mensajes enviados
    message_data = firestore_db.collection(u'loggerMessage').where(u'group', u'==', effective_chat_id).where(u'user', u'==', effective_user_id).get()

    # Total de comandos ejecutado
    command_data = firestore_db.collection(u'logger').where(u'group', u'==', effective_chat_id).where(u'user', u'==', effective_user_id).get()

    mention = '[' + update.effective_user.first_name + '](tg://user?id=' + str(effective_user_id) + ')'

    message = mention + '\n' +'Numero de mensajes enviados: ' + str(len(message_data)) + '\n' + 'Numero de comandos ejecutados: ' + str(len(command_data))

    context.bot.send_message(chat_id=effective_chat_id, text=message, parse_mode="Markdown")


# HANDLER
def listen(update, context):
    print('Ejecutando Listen')
    logger_message(update.effective_user.id, update.effective_chat.id, update.message.text)

def unknown(update, context):
    print('Ejecutando Unknown')
    context.bot.send_message(chat_id=update.effective_chat.id, text='No se que me estas contando crack')


# FUNCIONES
def logger(command, user, group):
    print('LOGGER')
    firestore_db.collection(u'logger').add({'command': command, 'user': user, 'group': group, 'date': time.time()})


def logger_message(user, group, text):
    print('LOGGER MESSAGE')
    firestore_db.collection(u'loggerMessage').add({'text': text, 'user': user, 'group': group, 'date': time.time()})


def register_user(chat_name, chat_id, user_name, user_id):
    print('REGISTER USER')
    doc = firestore_db.collection(u'chats').document(str(chat_id)).get()
    if doc.exists:
        # Si el documento existe comprobar que el usuario esta en la lista de usuario
        if doc.get('users').get(str(user_id)):
            print('el user esta ya metido')
        else:
            # si el usuario no existe meterlo en la lista
            users_array = doc.get('users')
            users_array[str(user_id)] = user_name
            firestore_db.collection(u'chats').document(str(chat_id)).update({'users': users_array})
    else:
        # El grupo no existe, pues crearlo y meter al usuario en la lista
        firestore_db.collection(u'chats').document(str(chat_id)).set({'name': chat_name, 'users': {str(user_id): user_name}})
        print('grupo creado')


# def mention_all():


def get_url():
    contents = requests.get('https://random.dog/woof.json').json()
    url = contents['url']
    return url

def get_image_url():
    allowed_extension = ['jpg', 'jpeg', 'png']
    file_extension = ''
    while file_extension not in allowed_extension:
        url = get_url()
        file_extension = re.search("([^.]*)$",url).group(1).lower()
    return url

def get_cat_url():
    contents = requests.get('https://api.thecatapi.com/v1/images/search').json()
    url = contents[0]['url']
    return url

def get_cat_image_url():
    allowed_extension = ['jpg', 'jpeg', 'png']
    file_extension = ''
    while file_extension not in allowed_extension:
        url = get_cat_url()
        file_extension = re.search("([^.]*)$",url).group(1).lower()
    return url


def main():
    print('Iniciando Main')
    updater = Updater(TELEGRAM_TOKEN)
    dp = updater.dispatcher

    bop_handler = CommandHandler('bop', bop)
    chilling_handler = CommandHandler('chilling', chilling)
    all_handler = CommandHandler('all', mention_all)
    cry_handler = CommandHandler('cry', cry)
    weather_handler = CommandHandler('weather', weather)
    article_handler = CommandHandler('article', article)
    insult_handler = CommandHandler('insult', insult)
    taylor_handler = CommandHandler('taylor', taylor)
    miau_handler = CommandHandler('miau', miau)
    aitana_handler = CommandHandler('aitana', aitana)
    stats_handler = CommandHandler('stats', stats)

    listen_handler = MessageHandler(Filters.text & (~Filters.command), listen)
    unknown_handler = MessageHandler(Filters.command, unknown)

    dp.add_handler(bop_handler)
    dp.add_handler(chilling_handler)
    dp.add_handler(all_handler)
    dp.add_handler(cry_handler)
    dp.add_handler(weather_handler)
    dp.add_handler(article_handler)
    dp.add_handler(insult_handler)
    dp.add_handler(taylor_handler)
    dp.add_handler(miau_handler)
    dp.add_handler(aitana_handler)
    dp.add_handler(stats_handler)

    dp.add_handler(listen_handler)

    dp.add_handler(unknown_handler)

    updater.start_polling()
    updater.idle()


if __name__ == '__main__':
    main()


# TODO: Handler gente que entra y sale del grupo

"""
bop - Envía una foto aleatoria de un perro
chilling - Notifica a las personas del grupo de que estas de puto chilling
all - Menciona a todos los usuarios del grupo
cry - Envía a la lloreria
weather - Notifica el tiempo actual en la localidad que le indiques como parámetro
article - Envía un artículo aleatorio de Wikipedia
insult - Envía un insulto aleatorio
taylor - Envía una foto y una frase aleatoria de Taylor Swift
miau - Envía una foto aleatoria de un gato
"""