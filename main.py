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
    url = get_image_url()
    chat_id = update.effective_chat.id
    user_id = str(update.effective_user.id)

    print('USER ID: ' + user_id)

    logger('bop', update.effective_user.id, update.effective_chat.id)
    registerUser(update.effective_chat.title, update.effective_chat.id, update.effective_user.first_name, update.effective_user.id)
    print(update.effective_user.id)
    context.bot.send_photo(chat_id=chat_id, photo=url)



def chilling(update, context):
    print('Ejecutando Chilling')
    message='Estoy de chilling'
    chat_id = update.effective_chat.id

    users_list = firestore_db.collection(u'chats').document(str(chat_id)).get().get('users')
    print(users_list)

    mentions = ''
    for user_id in users_list:
        mentions = "  " + mentions + "[" + users_list[user_id] + "](tg://user?id=" + user_id + ")" + "   "

    message = message + mentions
    """
    TODO: implementar firebase y guardar una tabla con los participantes, despues recorrer los participantes
    telegram_user = update.effective_user
    user_name = telegram_user.first_name
    user_id = telegram_user.id
    mention = "["+user_name+"](tg://user?id="+str(user_id)+")"
    text = 'Hola ' + mention
    """
    context.bot.send_message(chat_id=chat_id, text=message, parse_mode="Markdown")




# HANDLER
def listen(update, context):
    print('Ejecutando Listen')
    loggerMessage(update.effective_user.id, update.effective_chat.id, update.message.text)
    context.bot.send_message(chat_id=update.effective_chat.id, text=update.message.text)

def unknown(update, context):
    print('Ejecutando Unknown')
    context.bot.send_message(chat_id=update.effective_chat.id, text='No se que me estas contando crack')





# FUNCIONES
def logger(command, user, group):
    print('LOGGER')
    firestore_db.collection(u'logger').add({'command': command, 'user': user, 'group': group, 'date': time.time()})


def loggerMessage(user, group, text):
    print('LOGGER MESSAGE')
    firestore_db.collection(u'loggerMessage').add({'text': text, 'user': user, 'group': group, 'date': time.time()})


def registerUser(chat_name, chat_id, user_name, user_id):
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




#TODO:Handler gente que entra y sale del grupo