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


def main():
    print('Iniciando Main')
    updater = Updater(TELEGRAM_TOKEN)
    dp = updater.dispatcher

    bop_handler = CommandHandler('bop', bop)
    chilling_handler = CommandHandler('chilling', chilling)
    all_handler = CommandHandler('all', mention_all)
    listen_handler = MessageHandler(Filters.text & (~Filters.command), listen)

    unknown_handler = MessageHandler(Filters.command, unknown)

    dp.add_handler(bop_handler)
    dp.add_handler(chilling_handler)
    dp.add_handler(all_handler)
    dp.add_handler(listen_handler)

    dp.add_handler(unknown_handler)

    updater.start_polling()
    updater.idle()


def get_image_url():
    allowed_extension = ['jpg', 'jpeg', 'png']
    file_extension = ''
    while file_extension not in allowed_extension:
        url = get_url()
        file_extension = re.search("([^.]*)$",url).group(1).lower()
    return url


if __name__ == '__main__':
    main()


# TODO: Handler gente que entra y sale del grupo
