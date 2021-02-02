import os
import requests
import re
import time
from dotenv import load_dotenv
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters
import firebase_admin
from firebase_admin import credentials, firestore


load_dotenv()

TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')


cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
firestore_db = firestore.client()


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


# HANDLER
def listen(update, context):
    print('Ejecutando Listen')
    logger_message(update.effective_user.id, update.effective_chat.id, update.message.text)
    context.bot.send_message(chat_id=update.effective_chat.id, text=update.message.text)


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

    dp.add_handler(listen_handler)

    dp.add_handler(unknown_handler)

    updater.start_polling()
    updater.idle()


if __name__ == '__main__':
    main()


# TODO: Handler gente que entra y sale del grupo
