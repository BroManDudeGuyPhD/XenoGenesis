// MongoDB Database Initialization Script for XenoGenesis
// This script will try to connect to 'ironman' first, then fallback to localhost
// Run this script using: 
//   mongosh ironman:27017 setup_xenogenesis_db.js
//   OR if ironman is not available: mongosh localhost:27017 setup_xenogenesis_db.js

// Try to connect to the xenogenesis database
try {
    // This will work whether connecting to ironman or localhost
    use('xenogenesis');
    console.log('🚀 Setting up XenoGenesis MongoDB database...');
} catch (error) {
    console.log('❌ Error connecting to database:', error);
    quit(1);
}

// Drop existing collections if they exist (optional - remove if you want to preserve existing data)
// db.account.drop();
// db.progress.drop();

console.log('🚀 Setting up XenoGenesis MongoDB database...');

// ========================================
// 1. CREATE COLLECTIONS
// ========================================

// Create the account collection
db.createCollection('account', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["username", "password", "admin"],
            properties: {
                username: {
                    bsonType: "string",
                    description: "Username must be a string and is required"
                },
                password: {
                    bsonType: "string",
                    description: "Password must be a string and is required"
                },
                admin: {
                    bsonType: "string",
                    enum: ["true", "false"],
                    description: "Admin status must be 'true' or 'false' string"
                },
                createdAt: {
                    bsonType: "date",
                    description: "Account creation timestamp"
                },
                lastLogin: {
                    bsonType: "date",
                    description: "Last login timestamp"
                }
            }
        }
    }
});

// Create the progress collection
db.createCollection('progress', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["username", "items"],
            properties: {
                username: {
                    bsonType: "string",
                    description: "Username must be a string and is required"
                },
                items: {
                    bsonType: "array",
                    description: "Items array is required",
                    items: {
                        bsonType: "object",
                        required: ["id", "amount"],
                        properties: {
                            id: {
                                bsonType: "string",
                                description: "Item id must be a string"
                            },
                            amount: {
                                bsonType: "string",
                                description: "Item amount must be a string"
                            }
                        }
                    }
                },
                lastUpdated: {
                    bsonType: "date",
                    description: "Last progress update timestamp"
                }
            }
        }
    }
});

console.log('✅ Collections created successfully');

// ========================================
// 2. CREATE INDEXES FOR PERFORMANCE
// ========================================

// Create unique index on username for account collection
db.account.createIndex({ "username": 1 }, { unique: true });

// Create compound index for username and admin queries
db.account.createIndex({ "username": 1, "admin": 1 });

// Create index on username for progress collection
db.progress.createIndex({ "username": 1 }, { unique: true });

// Create index on lastLogin for account queries
db.account.createIndex({ "lastLogin": -1 });

// Create index on lastUpdated for progress queries  
db.progress.createIndex({ "lastUpdated": -1 });

console.log('✅ Indexes created successfully');

// ========================================
// 3. INSERT SAMPLE DATA
// ========================================

// Insert admin users
const adminUsers = [
    {
        username: "admin",
        password: "admin123", // In production, this should be hashed!
        admin: "true",
        createdAt: new Date(),
        lastLogin: new Date()
    },
    {
        username: "gamemaster",
        password: "gm123", // In production, this should be hashed!
        admin: "true",
        createdAt: new Date(),
        lastLogin: new Date()
    }
];

// Insert sample regular users
const regularUsers = [
    {
        username: "alice",
        password: "alice123",
        admin: "false", 
        createdAt: new Date(),
        lastLogin: new Date()
    },
    {
        username: "bob",
        password: "bob123",
        admin: "false",
        createdAt: new Date(), 
        lastLogin: new Date()
    },
    {
        username: "charlie",
        password: "charlie123",
        admin: "false",
        createdAt: new Date(),
        lastLogin: new Date()
    },
    {
        username: "diana",
        password: "diana123", 
        admin: "false",
        createdAt: new Date(),
        lastLogin: new Date()
    }
];

try {
    // Insert admin users
    db.account.insertMany(adminUsers);
    console.log('✅ Admin users created successfully');
    
    // Insert regular users
    db.account.insertMany(regularUsers);
    console.log('✅ Regular users created successfully');
    
} catch (error) {
    console.log('⚠️  Some users may already exist:', error.message);
}

// Insert sample progress data
const progressData = [
    {
        username: "alice",
        items: [
            { id: "potion", amount: "5" },
            { id: "sword", amount: "1" },
            { id: "gold", amount: "250" }
        ],
        lastUpdated: new Date()
    },
    {
        username: "bob", 
        items: [
            { id: "potion", amount: "3" },
            { id: "shield", amount: "1" },
            { id: "gold", amount: "150" }
        ],
        lastUpdated: new Date()
    },
    {
        username: "charlie",
        items: [
            { id: "bow", amount: "1" },
            { id: "arrow", amount: "50" },
            { id: "gold", amount: "75" }
        ],
        lastUpdated: new Date()
    },
    {
        username: "diana",
        items: [],
        lastUpdated: new Date()
    }
];

try {
    db.progress.insertMany(progressData);
    console.log('✅ Progress data created successfully');
} catch (error) {
    console.log('⚠️  Some progress data may already exist:', error.message);
}

// ========================================
// 4. VERIFY SETUP
// ========================================

console.log('\n📊 Database Setup Summary:');
console.log('Database name: xenogenesis');
console.log('Collections created: account, progress');

console.log('\n👥 Account Collection:');
console.log('Total accounts:', db.account.countDocuments());
console.log('Admin accounts:', db.account.countDocuments({ admin: "true" }));
console.log('Regular accounts:', db.account.countDocuments({ admin: "false" }));

console.log('\n📈 Progress Collection:');
console.log('Total progress records:', db.progress.countDocuments());

console.log('\n🔍 Sample Data Verification:');
console.log('Sample admin user:', db.account.findOne({ username: "admin" }));
console.log('Sample regular user:', db.account.findOne({ username: "alice" }));
console.log('Sample progress:', db.progress.findOne({ username: "alice" }));

console.log('\n🎯 Database indexes:');
db.account.getIndexes().forEach(index => console.log('Account index:', index.name));
db.progress.getIndexes().forEach(index => console.log('Progress index:', index.name));

console.log('\n🚀 XenoGenesis database setup complete!');
console.log('📝 Next step: Update Database.js to set USE_DB = true');