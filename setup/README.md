# Setup Folder

This folder contains all the database setup files for the XenoGenesis project.

## Files

### 📖 Documentation
- **`DATABASE_SETUP_README.md`** - Comprehensive setup guide and documentation

### 🔧 Setup Scripts
- **`setup_database.ps1`** - Windows PowerShell script for automated setup
- **`setup_xenogenesis_db.js`** - MongoDB script to create database, collections, and sample data

## Quick Setup

### Option 1: PowerShell (Windows)
```powershell
cd setup
.\setup_database.ps1
```

### Option 2: MongoDB Shell (Any OS)
```bash
cd setup
mongosh ironman:27017 setup_xenogenesis_db.js
# OR
mongosh localhost:27017 setup_xenogenesis_db.js
```

## What Gets Created
- Database: `xenogenesis`
- Collections: `account`, `progress`
- Sample admin and user accounts
- Proper indexes for performance
- Smart connection fallback system

See `DATABASE_SETUP_README.md` for detailed instructions and configuration options.