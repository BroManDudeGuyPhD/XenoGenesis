# XenoGenesis MongoDB Database Setup Guide

## Overview
This guide will help you set up a MongoDB database for the XenoGenesis project, supporting all the user queries defined in `Database.js`. The system includes smart connection fallback that tries to connect to the "ironman" server first, then falls back to localhost.

## Prerequisites
1. **MongoDB Server** - Running on either "ironman" server or localhost
2. **MongoDB Shell (mongosh)** - For running setup scripts
3. **Node.js mongojs package** - For database connectivity
4. **Network Access** - To "ironman" server (if using remote setup)

## Database Structure

### Collections
- **account**: Stores user authentication and admin status
- **progress**: Stores player game progress and items

### Account Collection Schema
```javascript
{
  username: String (required, unique),
  password: String (required), // Note: In production, passwords should be hashed!
  admin: String (required, "true" or "false"),
  createdAt: Date,
  lastLogin: Date
}
```

### Progress Collection Schema
```javascript
{
  username: String (required, unique),
  items: Array (required), // Array of {id: String, amount: String}
  lastUpdated: Date
}
```

## Setup Instructions

### Step 1: Install Dependencies
```bash
npm install mongojs
```

### Step 2: Start MongoDB
Make sure MongoDB is running on your target server:

#### For "ironman" server (Linux):
```bash
# SSH into ironman server
ssh user@ironman

# Start MongoDB service
sudo systemctl start mongod

# Verify it's running and listening on all interfaces
sudo netstat -tlnp | grep :27017
```

#### For localhost (Windows/Linux/Mac):
```bash
# Windows (if MongoDB is installed as a service)
net start MongoDB

# Or run directly
mongod

# Linux/Mac
sudo systemctl start mongod
# or
brew services start mongodb-community
```

### Step 3: Run Database Setup
Choose the appropriate method based on your target server:

#### Method A: Setup on "ironman" server
```bash
# Navigate to setup folder and connect to ironman
cd setup
mongosh ironman:27017 setup_xenogenesis_db.js
```

#### Method B: Setup on localhost
```bash
# Navigate to setup folder and connect to localhost
cd setup
mongosh localhost:27017 setup_xenogenesis_db.js
```

#### Method C: PowerShell Script (attempts ironman first)
```powershell
# Navigate to the setup folder and run the script
cd setup
.\setup_database.ps1
```

### Step 4: Enable Database in Application
Update `Database.js` to enable database usage:
```javascript
var USE_DB = true; // Change from false to true
```

The application will automatically:
1. Try to connect to `ironman:27017/xenogenesis`
2. If ironman is unavailable, fallback to `localhost:27017/xenogenesis`
3. If `USE_DB = false`, disable database entirely (useful for testing)

### Step 5: Restart Your Application
```bash
npm start
```

## 🔗 Connection Strings & Environments

### Smart Connection Logic
The application uses intelligent connection fallback:

1. **Primary**: `ironman:27017/xenogenesis` (remote server)
2. **Fallback**: `localhost:27017/xenogenesis` (local server)
3. **Disabled**: `USE_DB = false` (no database, mock responses)

### MongoDB Compass Connection Strings

#### For "ironman" server:
```
mongodb://ironman:27017
```

#### For localhost:
```
mongodb://localhost:27017
```

### Environment-Specific Usage

#### Development on Remote Machine (connecting to ironman):
- Application tries `ironman:27017` first
- Falls back to `localhost:27017` if ironman unavailable
- Perfect for development from multiple machines

#### Production on ironman Server:
- Application tries `ironman:27017` (which resolves to localhost)
- Falls back to `localhost:27017` (same server)
- Ensures consistent behavior regardless of hostname resolution

#### Testing Mode:
```javascript
var USE_DB = false; // Disables all database operations
```

## Sample Accounts Created

### Admin Accounts
- **Username**: `admin` | **Password**: `admin123`
- **Username**: `gamemaster` | **Password**: `gm123`

### Regular User Accounts
- **Username**: `alice` | **Password**: `alice123` (has sample items)
- **Username**: `bob` | **Password**: `bob123` (has sample items)
- **Username**: `charlie` | **Password**: `charlie123` (has sample items)
- **Username**: `diana` | **Password**: `diana123` (empty inventory)

## Network Configuration

### "ironman" Server Setup
If you're using a remote "ironman" server, ensure:

1. **MongoDB Configuration** (`/etc/mongod.conf`):
```yaml
net:
  port: 27017
  bindIp: 0.0.0.0  # Allow connections from any IP
```

2. **Firewall Settings**:
```bash
# Ubuntu/Debian
sudo ufw allow 27017

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=27017/tcp
sudo firewall-cmd --reload
```

3. **Hostname Resolution**:
Ensure "ironman" resolves properly from your development machine:
```bash
# Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
192.168.1.119 ironman
```

## Database Functions Supported

The setup supports all functions in `Database.js`:

- ✅ `Database.isValidPassword()` - User authentication
- ✅ `Database.isAdmin()` - Check admin status
- ✅ `Database.makeAdmin()` - Grant admin privileges
- ✅ `Database.removeAdmin()` - Remove admin privileges
- ✅ `Database.isUsernameTaken()` - Check username availability
- ✅ `Database.addUser()` - Create new user accounts
- ✅ `Database.getPlayerProgress()` - Retrieve player items/progress
- ✅ `Database.savePlayerProgress()` - Save player items/progress

## Database Indexes (for Performance)

The setup creates the following indexes:
- `account.username` (unique)
- `account.username + admin` (compound)
- `account.lastLogin`
- `progress.username` (unique)
- `progress.lastUpdated`

## Verification

After setup, you can verify the database using MongoDB Compass or mongosh:

```javascript
// Connect to the database
use xenogenesis

// Check collections
show collections

// Count documents
db.account.countDocuments()
db.progress.countDocuments()

// View sample data
db.account.findOne()
db.progress.findOne()
```

## Security Notes

⚠️ **Important**: The sample passwords are stored in plain text for development purposes only. In a production environment, you should:

1. Hash passwords before storing them
2. Use environment variables for database credentials
3. Enable MongoDB authentication
4. Use SSL/TLS for database connections
5. Implement rate limiting for login attempts

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running on port 27017
- Check firewall settings
- Verify MongoDB service is started

### Permission Issues
- Make sure the MongoDB data directory has proper permissions
- Check if the user running the application has database access

### mongojs Installation Issues
```bash
# If you encounter installation issues
npm cache clean --force
npm install mongojs --save
```

## Advanced Configuration

### Custom MongoDB Connection
The application now uses smart connection logic. If you need to modify the connection behavior, update `Database.js`:

```javascript
// Current smart connection (tries ironman → localhost)
var USE_DB = true;

// To disable database entirely (testing mode)
var USE_DB = false;

// The connection logic automatically handles:
// 1. ironman:27017/xenogenesis (primary)
// 2. localhost:27017/xenogenesis (fallback)
```

### Environment Variables (Future Enhancement)
For additional flexibility, you could extend this to use environment variables:
```javascript
var primaryHost = process.env.MONGO_PRIMARY_HOST || 'ironman';
var fallbackHost = process.env.MONGO_FALLBACK_HOST || 'localhost';
var mongoPort = process.env.MONGO_PORT || '27017';
var dbName = process.env.MONGO_DB || 'xenogenesis';
```

---

🎉 **Your XenoGenesis database is now ready to support all user authentication and progress tracking features!**