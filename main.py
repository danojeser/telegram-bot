import os
import requests
import re
from dotenv import load_dotenv
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters
import firebase_admin
from firebase_admin import credentials, firestore


load_dotenv()

TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')


cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
firestore_db = firestore.client()

def get_url():
    contents = requests.get('https://random.dog/woof.json').json()
    url = contents['url']
    return url


def bop(update, context):
    print('Ejecutanto bop')
    url = get_image_url()
    chat_id = update.effective_chat.id
    context.bot.send_photo(chat_id=chat_id, photo=url)


def listen(update, context):
    print('Ejecutando Listen')
    context.bot.send_message(chat_id=update.effective_chat.id, text=update.message.text)


def unknown(update, context):
    print('Ejecutando Unknown')
    context.bot.send_message(chat_id=update.effective_chat.id, text='No se que me estas contando crack')

def chilling(update, context):
    print('Ejecutando Chilling')
    message='Estoy de chilling'
    """
    TODO: implementar firebase y guardar una tabla con los participantes, despues recorrer los participantes
    telegram_user = update.effective_user
    user_name = telegram_user.first_name
    user_id = telegram_user.id
    mention = "["+user_name+"](tg://user?id="+str(user_id)+")"
    text = 'Hola ' + mention
    """
    context.bot.send_message(chat_id=update.effective_chat.id, text=message, parse_mode="Markdown")
# Crear una tabla que guarde los ids de la gente que:
#   - Hable en el grupo
#   - Entre o salga del grupo

def main():
    print('Iniciando Main')
    updater = Updater(TELEGRAM_TOKEN)
    dp = updater.dispatcher

    bop_handler = CommandHandler('bop', bop)
    chilling_handler = CommandHandler('chilling', chilling)
    listen_handler = MessageHandler(Filters.text & (~Filters.command), listen)

    unknown_handler = MessageHandler(Filters.command, unknown)


    dp.add_handler(bop_handler)
    dp.add_handler(chilling_handler)
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


if __name__=='__main__':
    main()