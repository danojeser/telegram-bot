# Firebase to SQLite Migration

This document explains how to migrate the Telegram bot data from Firebase Firestore to a local SQLite database.

## Prerequisites

Before running the migration, make sure you have the required dependencies installed:

```bash
npm install sqlite sqlite3
```

## Migration Process

### 1. Run the Migration Script

The migration script will:
- Read all data from your Firestore database
- Create a SQLite database file at `db/telegrambot.db`
- Migrate all chats, users, command logs, and message logs

Run the script:

```bash
node migrate.js
```

### 2. Update Your Bot Code

After migrating the data, you'll need to update your bot code to use SQLite instead of Firestore.

#### Option 1: Replace Firestore Functions

Replace the existing Firestore functions with the SQLite adapter functions as shown in the `src/db/mainExample.js` file.

#### Option 2: Complete Integration

For a complete integration:

1. Remove Firebase imports and initialization:
```javascript
// Remove these lines
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Remove Firebase initialization
const app = initializeApp({
    credential: cert('./serviceAccountKey.json')
});
const firestore_db = getFirestore();
```

2. Import the SQLite adapter:
```javascript
import sqlite from './db/sqliteAdapter.js';
```

3. Replace all Firestore function calls with SQLite adapter calls as shown in the example file.

## Database Schema

The SQLite database uses the following schema:

### Tables

#### chats
- `chat_id` (TEXT): Primary key, the Telegram chat ID
- `name` (TEXT): The name of the chat/group
- `created_at` (INTEGER): Timestamp when the chat was first created
- `updated_at` (INTEGER): Timestamp when the chat was last updated

#### users
- `user_id` (TEXT): Primary key, the Telegram user ID
- `user_name` (TEXT): The user's name
- `created_at` (INTEGER): Timestamp when the user was first added to the database
- `updated_at` (INTEGER): Timestamp when the user information was last updated

#### chat_users
- `user_id` (TEXT): The Telegram user ID, foreign key to users table
- `chat_id` (TEXT): The Telegram chat ID, foreign key to chats table
- `created_at` (INTEGER): Timestamp when the user joined the chat
- Primary key is the combination of `user_id` and `chat_id`

#### command_logs
- `id` (INTEGER): Auto-incremented primary key
- `command` (TEXT): The command executed
- `user_id` (TEXT): The user who executed the command
- `chat_id` (TEXT): The chat where the command was executed
- `date` (INTEGER): Timestamp when the command was executed

#### message_logs
- `id` (INTEGER): Auto-incremented primary key
- `text` (TEXT): The message content
- `user_id` (TEXT): The user who sent the message
- `chat_id` (TEXT): The chat where the message was sent
- `date` (INTEGER): Timestamp when the message was sent

## Database Schema Explanation

The database design follows proper normalization principles:

1. **Users and Chats**: These are separate entities, each with their own tables.
2. **Many-to-Many Relationship**: The `chat_users` table creates a many-to-many relationship between users and chats (a user can be in multiple chats, and a chat can have multiple users).
3. **Logs**: Both command and message logs reference users and chats.
4. **Timestamps**: All tables include timestamps to track when records were created or updated.

## New Helper Functions

The SQLite adapter includes these new helper functions for working with timestamps:

- `getUserJoinedDate(userId, chatId)`: Get the timestamp when a user joined a specific chat
- `getChatCreationDate(chatId)`: Get the timestamp when a chat was created

## Troubleshooting

If you encounter any issues during the migration:

1. Check that your Firestore credentials are valid and you have access to the database
2. Ensure you have write permissions in the directory where the SQLite database will be created
3. Make sure all required dependencies are installed

For any database errors after migration, check the structure of your SQLite database with:

```bash
npm install -g sqlite3
sqlite3 db/telegrambot.db
.tables
.schema chats
.schema users
.schema chat_users
.schema command_logs
.schema message_logs
```

## Advantages of SQLite

- No need for internet connection to access the database
- No monthly costs (Firebase may charge based on usage)
- Faster read/write operations for local access
- Simpler backup (just copy the database file)
- Can be easily moved or copied to another server 