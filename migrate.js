import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Initialize Firebase
const app = initializeApp({
    credential: cert('./serviceAccountKey.json')
});

// Initialize Firestore
const firestore_db = getFirestore();

// SQLite database file path
const dbPath = path.join(process.cwd(), 'db', 'telegrambot.db');

// Ensure the db directory exists
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

async function initSqliteDb() {
    // Open SQLite database
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            chat_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            user_name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_users (
            user_id TEXT,
            chat_id TEXT,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, chat_id),
            FOREIGN KEY (user_id) REFERENCES users (user_id),
            FOREIGN KEY (chat_id) REFERENCES chats (chat_id)
        );

        CREATE TABLE IF NOT EXISTS command_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT NOT NULL,
            user_id TEXT NOT NULL,
            chat_id TEXT NOT NULL,
            date INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (user_id),
            FOREIGN KEY (chat_id) REFERENCES chats (chat_id)
        );

        CREATE TABLE IF NOT EXISTS message_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            user_id TEXT NOT NULL,
            chat_id TEXT NOT NULL,
            date INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (user_id),
            FOREIGN KEY (chat_id) REFERENCES chats (chat_id)
        );
    `);

    return db;
}

async function migrateChatsAndUsers(db) {
    console.log('Migrating chats and users...');
    const chatsSnapshot = await firestore_db.collection('chats').get();
    
    // Track processed users to avoid duplicates
    const processedUsers = new Set();
    const currentTimestamp = Date.now();
    
    // Statistics
    let totalChats = 0;
    let totalUsers = 0;
    
    for (const doc of chatsSnapshot.docs) {
        try {
            // Clean chat ID by removing trailing ".0" if present
            const chatId = String(doc.id).replace(/\.0$/, '');
            const chatData = doc.data();
            totalChats++;
            
            // Handle null chat names - use the same format as in main.js
            let chatName = chatData.name;
            if (!chatName) {
                // Try to find the first user in the chat to use in the name
                const users = chatData.users || {};
                const firstUserName = Object.values(users)[0] || 'unknown';
                chatName = `Private chat with ${firstUserName}`;
            }
            
            // Insert chat
            await db.run(
                'INSERT OR REPLACE INTO chats (chat_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
                [chatId, chatName, currentTimestamp, currentTimestamp]
            );
            
            // Process users
            const users = chatData.users || {};
            for (const [userId, userName] of Object.entries(users)) {
                // Clean user ID by removing trailing ".0" if present
                const cleanUserId = String(userId).replace(/\.0$/, '');
                
                // Insert user if not already processed
                if (!processedUsers.has(cleanUserId)) {
                    await db.run(
                        'INSERT OR REPLACE INTO users (user_id, user_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
                        [cleanUserId, userName || 'Unknown User', currentTimestamp, currentTimestamp]
                    );
                    processedUsers.add(cleanUserId);
                    totalUsers++;
                }
                
                // Create relationship between user and chat
                await db.run(
                    'INSERT OR REPLACE INTO chat_users (user_id, chat_id, created_at) VALUES (?, ?, ?)',
                    [cleanUserId, chatId, currentTimestamp]
                );
            }
        } catch (error) {
            console.error(`Error processing chat (${doc.id}):`, error);
        }
    }
    
    console.log(`Chats and users migration completed. Chats: ${totalChats}, Unique Users: ${totalUsers}`);
}

async function createMissingEntities(db, userId, chatId) {
    const currentTimestamp = Date.now();
    let userCreated = false;
    let chatCreated = false;
    
    // Ensure IDs are strings
    userId = String(userId);
    chatId = String(chatId);
    
    // Check if user exists, create if not
    const userExists = await db.get('SELECT 1 FROM users WHERE user_id = ?', userId);
    if (!userExists) {
        await db.run(
            'INSERT INTO users (user_id, user_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
            [userId, 'Unknown User (Placeholder)', currentTimestamp, currentTimestamp]
        );
        userCreated = true;
        console.log(`Created placeholder user: ${userId}`);
    }
    
    // Check if chat exists, create if not
    const chatExists = await db.get('SELECT 1 FROM chats WHERE chat_id = ?', chatId);
    if (!chatExists) {
        await db.run(
            'INSERT INTO chats (chat_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
            [chatId, 'Unknown Chat (Placeholder)', currentTimestamp, currentTimestamp]
        );
        chatCreated = true;
        console.log(`Created placeholder chat: ${chatId}`);
    }
    
    // Create relationship if both entities were created or if relationship doesn't exist
    if ((userCreated || chatCreated) || 
        !(await db.get('SELECT 1 FROM chat_users WHERE user_id = ? AND chat_id = ?', [userId, chatId]))) {
        await db.run(
            'INSERT OR IGNORE INTO chat_users (user_id, chat_id, created_at) VALUES (?, ?, ?)',
            [userId, chatId, currentTimestamp]
        );
    }
    
    return { userCreated, chatCreated };
}

/**
 * Normalize date values from different formats to a standard Unix timestamp in milliseconds
 * Handles various inconsistent date formats from the Firebase database
 */
function normalizeDate(dateValue) {
    // Handle null or undefined values
    if (dateValue == null) {
        return Date.now(); // Use current time for missing dates
    }
    
    const dateStr = String(dateValue);
    
    // Case 1: Already a valid number without decimal (Unix timestamp)
    if (!dateStr.includes('.') && !isNaN(Number(dateStr))) {
        const numValue = Number(dateStr);
        // Check if it's seconds (10 digits) or milliseconds (13 digits)
        return numValue < 10000000000 ? numValue * 1000 : numValue;
    }
    
    // Case 2: Has decimal point (e.g., "1611920789.9069796")
    if (dateStr.includes('.')) {
        try {
            // As per requirements, move the decimal point 3 positions to the right
            const movedDecimal = Number(dateValue) * 1000;
            return Math.floor(movedDecimal);
        } catch (e) {
            console.warn(`Failed to parse decimal date: ${dateStr}`, e);
            return Date.now();
        }
    }
    
    // Case 3: Try to parse as a JavaScript Date
    try {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate.getTime();
        }
    } catch (e) {
        console.warn(`Failed to parse date string: ${dateStr}`, e);
    }
    
    // Default: return current timestamp if all parsing attempts fail
    console.warn(`Unparseable date format: ${dateStr}, using current time`);
    return Date.now();
}

async function migrateCommandLogs(db) {
    console.log('Migrating command logs...');
    const logsSnapshot = await firestore_db.collection('logger').get();
    
    // Track statistics
    let total = 0;
    let skipped = 0;
    let fixedEntities = 0;
    
    for (const doc of logsSnapshot.docs) {
        const logData = doc.data();
        total++;
        
        try {
            // Clean user_id and chat_id by removing trailing ".0"
            const userId = String(logData.user).replace(/\.0$/, '');
            const chatId = String(logData.group).replace(/\.0$/, '');
            
            // Normalize date using the helper function
            const fixedDate = normalizeDate(logData.date);
            
            // Create missing entities if needed
            const userExists = await db.get('SELECT 1 FROM users WHERE user_id = ?', userId);
            const chatExists = await db.get('SELECT 1 FROM chats WHERE chat_id = ?', chatId);
            
            if (!userExists || !chatExists) {
                const { userCreated, chatCreated } = await createMissingEntities(db, userId, chatId);
                if (userCreated || chatCreated) {
                    fixedEntities++;
                }
            }
            
            await db.run(
                'INSERT INTO command_logs (command, user_id, chat_id, date) VALUES (?, ?, ?, ?)',
                [logData.command, userId, chatId, fixedDate]
            );
        } catch (error) {
            console.error(`Error processing command log (${doc.id}):`, error);
            skipped++;
        }
    }
    
    console.log(`Command logs migration completed. Total: ${total}, Skipped: ${skipped}, Fixed entities: ${fixedEntities}`);
}

async function migrateMessageLogs(db) {
    console.log('Migrating message logs...');
    const logsSnapshot = await firestore_db.collection('loggerMessage').get();
    
    // Track statistics
    let total = 0;
    let skipped = 0;
    let fixedEntities = 0;
    
    for (const doc of logsSnapshot.docs) {
        const logData = doc.data();
        total++;
        
        try {
            // Clean user_id and chat_id by removing trailing ".0"
            const userId = String(logData.user).replace(/\.0$/, '');
            const chatId = String(logData.group).replace(/\.0$/, '');
            
            // Normalize date using the helper function
            const fixedDate = normalizeDate(logData.date);
            
            // Create missing entities if needed
            const userExists = await db.get('SELECT 1 FROM users WHERE user_id = ?', userId);
            const chatExists = await db.get('SELECT 1 FROM chats WHERE chat_id = ?', chatId);
            
            if (!userExists || !chatExists) {
                const { userCreated, chatCreated } = await createMissingEntities(db, userId, chatId);
                if (userCreated || chatCreated) {
                    fixedEntities++;
                }
            }
            
            await db.run(
                'INSERT INTO message_logs (text, user_id, chat_id, date) VALUES (?, ?, ?, ?)',
                [logData.text, userId, chatId, fixedDate]
            );
        } catch (error) {
            console.error(`Error processing message log (${doc.id}):`, error);
            skipped++;
        }
    }
    
    console.log(`Message logs migration completed. Total: ${total}, Skipped: ${skipped}, Fixed entities: ${fixedEntities}`);
}

async function main() {
    try {
        console.log('Starting Firestore to SQLite migration...');
        
        // Initialize SQLite database
        const db = await initSqliteDb();
        
        // Migrate data
        await migrateChatsAndUsers(db);
        await migrateCommandLogs(db);
        await migrateMessageLogs(db);
        
        console.log('Migration completed successfully!');
        console.log(`SQLite database created at: ${dbPath}`);
        
        // Close database connection
        await db.close();
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

main(); 