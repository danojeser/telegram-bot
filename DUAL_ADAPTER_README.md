# Dual Database Adapter - Transition Guide

This document explains how the dual database adapter works and how to use it during the transition from Firebase Firestore to SQLite.

## How It Works

The dual adapter writes to both Firestore and SQLite simultaneously, ensuring that both databases stay in sync. This allows you to:

1. Continue using Firestore as your primary database
2. Gradually transition to SQLite over a few months
3. Validate that SQLite works correctly before fully migrating
4. Maintain a fallback option in case of issues

## Implementation Details

### Adapter Structure

The dual adapter (`src/db/dualAdapter.js`) wraps both the Firestore and SQLite databases:

- It implements the same interface as the original Firestore functions
- For write operations (insert/update), it writes to both databases
- For read operations, it prioritizes Firestore data for consistency with the existing system
- It falls back to SQLite if data isn't available in Firestore

### User Registration

User registration now happens automatically in the message handler:

```javascript
bot.on('message:text', async (ctx, next) => {
    // Extract user and chat information
    const chatName = ctx.chat.title || `Private chat with ${ctx.from.first_name}`;
    const chatId = ctx.chat.id;
    const userName = ctx.from.username ? ctx.from.username : ctx.from.first_name;
    const userId = ctx.from.id;
    
    // Register user in both databases
    await dualAdapter.registerUser(chatName, chatId, userName, userId);
    
    // Rest of the message handling
    // ...
});
```

Every time a user sends a message, they are registered in both databases. This ensures that:

1. New users are added to both databases
2. Existing users are updated if their information changes
3. All chats are properly tracked in both systems

## Transition Process

### Phase 1: Dual Operation (Current)

- Both databases operate simultaneously
- Firestore remains the primary data source
- SQLite is populated and kept in sync
- All interfaces use the dual adapter

### Phase 2: SQLite Validation

- Continue running both databases
- Verify SQLite data accuracy against Firestore
- Fix any discrepancies
- Test SQLite-specific features

### Phase 3: Complete Migration

- Switch to SQLite-only adapter
- Remove Firestore dependencies
- Run final migration to ensure all data is transferred
- Decommission Firestore

## Switching Between Adapters

To switch between adapters, simply change the import in your main.js file:

```javascript
// For dual operation (current)
import dualAdapter from './db/dualAdapter.js';

// For SQLite only (future)
import sqlite from './db/sqliteAdapter.js';

// For Firestore only (fallback)
// Use direct Firestore calls
```

## Monitoring and Verification

To verify that both databases are in sync:

1. Run the original migration script to snapshot current Firestore data
2. Compare record counts between both databases
3. Sample random records to ensure data integrity
4. Monitor for any errors in the dual adapter logs

## Troubleshooting

If you encounter issues with the dual adapter:

1. Check console logs for error messages
2. Verify that both databases are accessible
3. If one database fails, the adapter will log errors but attempt to continue with the other database
4. In case of critical failure, you can temporarily revert to direct Firestore calls

## Additional Features

The SQLite implementation includes additional features not available in Firestore:

- Timestamps for record creation and updates
- Normalized database schema with proper relationships
- Efficient querying for complex data relationships
- Helper functions for date-based operations 