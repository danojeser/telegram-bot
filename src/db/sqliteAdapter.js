import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

class SQLiteAdapter {
    constructor() {
        this.db = null;
        this.dbPath = path.join(process.cwd(), 'db', 'telegrambot.db');
    }

    async connect() {
        if (this.db) return this.db;
        
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
        
        return this.db;
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    // Logger functions
    async commandLogger(user, chat, command) {
        const db = await this.connect();
        console.log('COMMAND LOGGER');
        
        await db.run(
            'INSERT INTO command_logs (command, user_id, chat_id, date) VALUES (?, ?, ?, ?)',
            [command, String(user), String(chat), Date.now()]
        );
    }

    async messageLogger(user, chat, text) {
        const db = await this.connect();
        console.log('LOGGER MESSAGE');
        
        await db.run(
            'INSERT INTO message_logs (text, user_id, chat_id, date) VALUES (?, ?, ?, ?)',
            [text, String(user), String(chat), Date.now()]
        );
    }

    // User registration
    async registerUser(chatName, chatId, userName, userId) {
        const db = await this.connect();
        console.log('REGISTER USER');
        const currentTimestamp = Date.now();

        // Ensure chatName is not null
        const safeChatName = chatName || `Private chat with ${userName}`;

        // First ensure the user exists in the users table
        const user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId.toString()]);
        if (!user) {
            await db.run(
                'INSERT INTO users (user_id, user_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
                [userId.toString(), userName, currentTimestamp, currentTimestamp]
            );
        } else {
            // Update the user's name if it changed and update the updated_at timestamp
            if (user.user_name !== userName) {
                await db.run(
                    'UPDATE users SET user_name = ?, updated_at = ? WHERE user_id = ?',
                    [userName, currentTimestamp, userId.toString()]
                );
            }
        }

        // Check if chat exists
        const chat = await db.get('SELECT * FROM chats WHERE chat_id = ?', [chatId.toString()]);
        
        if (chat) {
            // Check if relationship exists
            const relationship = await db.get(
                'SELECT * FROM chat_users WHERE user_id = ? AND chat_id = ?', 
                [userId.toString(), chatId.toString()]
            );
            
            if (relationship) {
                console.log('User already exists in this chat');
            } else {
                // Add user-chat relationship
                await db.run(
                    'INSERT INTO chat_users (user_id, chat_id, created_at) VALUES (?, ?, ?)',
                    [userId.toString(), chatId.toString(), currentTimestamp]
                );
            }

            // Update chat name if it changed and update the updated_at timestamp
            if (chat.name !== safeChatName) {
                await db.run(
                    'UPDATE chats SET name = ?, updated_at = ? WHERE chat_id = ?',
                    [safeChatName, currentTimestamp, chatId.toString()]
                );
            }
        } else {
            // Create new chat
            await db.run(
                'INSERT INTO chats (chat_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
                [chatId.toString(), safeChatName, currentTimestamp, currentTimestamp]
            );
            
            // Add user-chat relationship
            await db.run(
                'INSERT INTO chat_users (user_id, chat_id, created_at) VALUES (?, ?, ?)',
                [userId.toString(), chatId.toString(), currentTimestamp]
            );
            
            console.log('Chat created');
        }
    }

    // Get chat users
    async getChatUsers(chatId) {
        const db = await this.connect();
        
        const users = await db.all(
            `SELECT u.user_id, u.user_name 
             FROM users u 
             JOIN chat_users cu ON u.user_id = cu.user_id 
             WHERE cu.chat_id = ?`,
            [chatId.toString()]
        );
        
        // Convert to the format used in the original code (userId -> userName)
        const userMap = {};
        for (const user of users) {
            userMap[user.user_id] = user.user_name;
        }
        
        return userMap;
    }

    // Stats
    async getUserMessageCount(userId, chatId) {
        const db = await this.connect();
        
        const result = await db.get(
            'SELECT COUNT(*) as count FROM message_logs WHERE user_id = ? AND chat_id = ?',
            [String(userId), String(chatId)]
        );
        
        return result.count;
    }

    async getUserCommandCount(userId, chatId) {
        const db = await this.connect();
        
        const result = await db.get(
            'SELECT COUNT(*) as count FROM command_logs WHERE user_id = ? AND chat_id = ?',
            [String(userId), String(chatId)]
        );
        
        return result.count;
    }

    // Get user joined date
    async getUserJoinedDate(userId, chatId) {
        const db = await this.connect();
        
        const result = await db.get(
            'SELECT created_at FROM chat_users WHERE user_id = ? AND chat_id = ?',
            [userId.toString(), chatId.toString()]
        );
        
        return result ? result.created_at : null;
    }

    // Get chat creation date
    async getChatCreationDate(chatId) {
        const db = await this.connect();
        
        const result = await db.get(
            'SELECT created_at FROM chats WHERE chat_id = ?',
            [chatId.toString()]
        );
        
        return result ? result.created_at : null;
    }

    // Get message counts by month for a specific chat
    async getMessageCountsByMonth(chatId, userId, monthsLimit = 12) {
        const db = await this.connect();
        
        // Calculate the timestamp for 'monthsLimit' months ago
        const limitDate = new Date();
        limitDate.setMonth(limitDate.getMonth() - monthsLimit);
        const limitTimestamp = limitDate.getTime();
        
        // Get message logs from database
        const logs = await db.all(
            'SELECT date FROM message_logs WHERE chat_id = ? AND user_id = ? AND date >= ?',
            [String(chatId), String(userId), limitTimestamp]
        );
        
        // Process logs to group by month
        const monthCounts = {};
        
        // Initialize the past 'monthsLimit' months with zero counts
        for (let i = 0; i < monthsLimit; i++) {
            const month = new Date();
            month.setMonth(month.getMonth() - i);
            const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[monthKey] = 0;
        }
        
        // Count messages by month
        for (const log of logs) {
            const date = new Date(log.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthCounts[monthKey] !== undefined) {
                monthCounts[monthKey]++;
            }
        }
        
        // Convert to array of objects sorted by month
        return Object.entries(monthCounts)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }

    // Get command counts by month for a specific chat
    async getCommandCountsByMonth(chatId, userId, monthsLimit = 12) {
        const db = await this.connect();
        
        // Calculate the timestamp for 'monthsLimit' months ago
        const limitDate = new Date();
        limitDate.setMonth(limitDate.getMonth() - monthsLimit);
        const limitTimestamp = limitDate.getTime();
        
        // Get command logs from database
        const logs = await db.all(
            'SELECT date FROM command_logs WHERE chat_id = ? AND user_id = ? AND date >= ?',
            [String(chatId), String(userId), limitTimestamp]
        );
        
        // Process logs to group by month
        const monthCounts = {};
        
        // Initialize the past 'monthsLimit' months with zero counts
        for (let i = 0; i < monthsLimit; i++) {
            const month = new Date();
            month.setMonth(month.getMonth() - i);
            const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[monthKey] = 0;
        }
        
        // Count commands by month
        for (const log of logs) {
            const date = new Date(log.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthCounts[monthKey] !== undefined) {
                monthCounts[monthKey]++;
            }
        }
        
        // Convert to array of objects sorted by month
        return Object.entries(monthCounts)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }

    // Get command counts by month for a specific year
    async getMessageCountsByYear(chatId, userId, year) {
        const db = await this.connect();
        
        // Calculate timestamps for the start and end of the specified year
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${parseInt(year) + 1}-01-01T00:00:00.000Z`);
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();
        
        // Get ALL command logs from database for this user and chat (no date filtering)
        const logs = await db.all(
            'SELECT date FROM message_logs WHERE chat_id = ? AND user_id = ?',
            [String(chatId), String(userId)]
        );
        
        // Initialize month counts for all months in the year
        const monthCounts = {};
        
        // Initialize all 12 months with zero counts
        for (let i = 0; i < 12; i++) {
            const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
            monthCounts[monthKey] = 0;
        }
        
        // Count commands by month with date filtering in code
        for (const log of logs) {
            const logDate = log.date;
            
            // Skip if the log date is outside our target year
            if (logDate < startTimestamp || logDate >= endTimestamp) {
                continue;
            }
            
            const date = new Date(logDate);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthCounts[monthKey] !== undefined) {
                monthCounts[monthKey]++;
            }
        }
        
        // Convert to array of objects sorted by month
        return Object.entries(monthCounts)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }

    // Get message counts by month for all time
    async getAllTimeMessageActivity(chatId, monthsLimit = 12) {
        const db = await this.connect();
        
        // Calculate the timestamp for 'monthsLimit' months ago
        const limitDate = new Date();
        limitDate.setMonth(limitDate.getMonth() - monthsLimit);
        const limitTimestamp = limitDate.getTime();
        
        // Get message logs from database
        const logs = await db.all(
            'SELECT date FROM message_logs WHERE chat_id = ? AND date >= ?',
            [String(chatId), limitTimestamp]
        );
        
        // Process logs to group by month
        const monthCounts = {};
        
        // Initialize the past 'monthsLimit' months with zero counts
        for (let i = 0; i < monthsLimit; i++) {
            const month = new Date();
            month.setMonth(month.getMonth() - i);
            const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[monthKey] = 0;
        }
        
        // Count messages by month
        for (const log of logs) {
            const date = new Date(log.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthCounts[monthKey] !== undefined) {
                monthCounts[monthKey]++;
            }
        }
        
        // Convert to array of objects sorted by month
        return Object.entries(monthCounts)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }
}

// Create a singleton instance
const sqliteAdapter = new SQLiteAdapter();
export default sqliteAdapter; 