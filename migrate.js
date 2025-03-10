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
            group_id TEXT NOT NULL,
            date INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS message_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            user_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            date INTEGER NOT NULL
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
    
    for (const doc of chatsSnapshot.docs) {
        const chatId = doc.id;
        const chatData = doc.data();
        
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
            // Insert user if not already processed
            if (!processedUsers.has(userId)) {
                await db.run(
                    'INSERT OR REPLACE INTO users (user_id, user_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
                    [userId, userName, currentTimestamp, currentTimestamp]
                );
                processedUsers.add(userId);
            }
            
            // Create relationship between user and chat
            await db.run(
                'INSERT OR REPLACE INTO chat_users (user_id, chat_id, created_at) VALUES (?, ?, ?)',
                [userId, chatId, currentTimestamp]
            );
        }
    }
    
    console.log('Chats and users migration completed.');
}

async function migrateCommandLogs(db) {
    console.log('Migrating command logs...');
    const logsSnapshot = await firestore_db.collection('logger').get();
    
    for (const doc of logsSnapshot.docs) {
        const logData = doc.data();
        
        await db.run(
            'INSERT INTO command_logs (command, user_id, group_id, date) VALUES (?, ?, ?, ?)',
            [logData.command, logData.user, logData.group, logData.date]
        );
    }
    
    console.log('Command logs migration completed.');
}

async function migrateMessageLogs(db) {
    console.log('Migrating message logs...');
    const logsSnapshot = await firestore_db.collection('loggerMessage').get();
    
    for (const doc of logsSnapshot.docs) {
        const logData = doc.data();
        
        await db.run(
            'INSERT INTO message_logs (text, user_id, group_id, date) VALUES (?, ?, ?, ?)',
            [logData.text, logData.user, logData.group, logData.date]
        );
    }
    
    console.log('Message logs migration completed.');
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