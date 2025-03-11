import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sqliteAdapter from './sqliteAdapter.js';

/**
 * DualAdapter - writes to both Firestore and SQLite simultaneously
 * This adapter is designed to be used during the migration period
 * to ensure both databases stay in sync
 */
class DualAdapter {
    constructor() {
        // Initialize Firebase if not already initialized
        let app = initializeApp({
            credential: cert('./serviceAccountKey.json')
        });
        
        // Get Firestore instance
        this.firestore_db = getFirestore(app);
        this.sqlite = sqliteAdapter;
    }

    // Logger functions
    async commandLogger(user, chat, command) {
        console.log('DUAL COMMAND LOGGER');

        // Log to Firestore
        await this.firestore_db.collection('logger').add({
            command: command,
            user: user,
            group: chat,
            date: Date.now(),
        });

        // Log to SQLite
        await this.sqlite.commandLogger(user, chat, command);
    }

    async messageLogger(user, chat, text) {
        console.log('DUAL LOGGER MESSAGE');

        // Log to Firestore
        await this.firestore_db.collection('loggerMessage').add({
            text: text,
            user: user,
            group: chat,
            date: Date.now()
        });

        // Log to SQLite
        await this.sqlite.messageLogger(user, chat, text);
    }

    // User registration
    async registerUser(chatName, chatId, userName, userId) {
        console.log('DUAL REGISTER USER');

        // Ensure chatName is not null
        const safeChatName = chatName || `Private chat with ${userName}`;

        // Register in Firestore
        const doc = await this.firestore_db.collection('chats').doc(chatId.toString()).get();
        if (doc.exists) {
            // Check if the user is already in the users list
            const users = doc.data().users;
            if (users[userId]) {
                console.log('User already in Firestore');
            } else {
                // Add user to the list
                users[userId] = userName;
                await this.firestore_db.collection('chats').doc(chatId.toString()).update({ users: users });
            }
        } else {
            // Create new chat with this user
            const data = { name: safeChatName, users: { [userId]: userName } };
            await this.firestore_db.collection('chats').doc(chatId.toString()).set(data);
            console.log('Chat created in Firestore');
        }

        // Register in SQLite
        await this.sqlite.registerUser(safeChatName, chatId, userName, userId);
    }

    // Get chat users
    async getChatUsers(chatId) {
        // We'll prioritize Firestore data for now to maintain consistency
        // with the old system
        console.log('DUAL GET CHAT USERS');
        const doc = await this.firestore_db.collection('chats').doc(chatId.toString()).get();
        
        if (doc.exists) {
            return doc.data().users || {};
        }
        
        // Fallback to SQLite if not in Firestore
        return await this.sqlite.getChatUsers(chatId);
    }

    // Stats
    async getUserMessageCount(userId, chatId) {
        console.log('DUAL GET USER MESSAGE COUNT');
        
        // Query Firestore
        const message_data = await this.firestore_db.collection('loggerMessage')
            .where('group', '==', chatId)
            .where('user', '==', userId)
            .get();
            
        return message_data.size;
    }

    async getUserCommandCount(userId, chatId) {
        console.log('DUAL GET USER COMMAND COUNT');
        
        // Query Firestore
        const command_data = await this.firestore_db.collection('logger')
            .where('group', '==', chatId)
            .where('user', '==', userId)
            .get();
            
        return command_data.size;
    }

    // Additional SQLite-specific methods that don't exist in Firestore
    // These won't be used during the transition period but are available
    
    async getUserJoinedDate(userId, chatId) {
        return await this.sqlite.getUserJoinedDate(userId, chatId);
    }
    
    async getChatCreationDate(chatId) {
        return await this.sqlite.getChatCreationDate(chatId);
    }

    // Get message count by month for a specific chat
    async getMessageCountsByMonth(chatId, userId, monthsLimit = 12) {
        console.log('DUAL GET MESSAGE COUNTS BY MONTH');
        
        // Query data from SQLite since it has better date/time functions for this task
        return await this.sqlite.getMessageCountsByMonth(chatId, userId, monthsLimit);
    }

    // Get command count by month for a specific chat
    async getCommandCountsByMonth(chatId, userId, monthsLimit = 12) {
        console.log('DUAL GET COMMAND COUNTS BY MONTH');
        
        // Query data from SQLite since it has better date/time functions for this task
        return await this.sqlite.getCommandCountsByMonth(chatId, userId, monthsLimit);
    }

    // Get command count by month for a specific year
    async getMessageCountsByYear(chatId, userId, year) {
        console.log('DUAL GET COMMAND COUNTS BY YEAR');
        
        // Query data from SQLite for a specific year
        return await this.sqlite.getMessageCountsByYear(chatId, userId, year);
    }

    // Get all-time message activity by month
    async getAllTimeMessageActivity(chatId) {
        console.log('DUAL GET TOTAL ACTIVITY BY YEAR');
        
        // Query data from SQLite for a specific year
        return await this.sqlite.getAllTimeMessageActivity(chatId);
    }
}
// Create a singleton instance
const dualAdapter = new DualAdapter();
export default dualAdapter; 