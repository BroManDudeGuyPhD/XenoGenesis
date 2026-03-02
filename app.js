// Centralized logging setup
const logger = require('./utils/logger');
const { c } = require('./utils/logger');
// Patch global console methods according to LOG_LEVEL/DEBUG_LOGS
// LOG_LEVEL options: silent, error, warn, info, debug (default: warn unless DEBUG_LOGS=true)
logger.applyGlobalPatch({ mapConsoleLogTo: 'debug' });

require('./Database');
require('./Entity');
require('./client/Inventory')

// Store user room associations for logout/login restoration
const userRoomRestoration = new Map(); // username -> { room, timestamp, hasActiveGame }

// Cache CSV data for recently ended experiments (survives GameSession cleanup)
// Entries auto-expire after 10 minutes
const recentCSVCache = new Map(); // room -> { csvData, timestamp }

const express = require('express');
const path = require('path');
const http = require("http");
const session = require('express-session');
const sharedsession = require('express-socket.io-session');

const app = express();
const server = http.createServer(app);

// Configure session middleware
const sessionMiddleware = session({
    secret: 'xenogenesis-secret-key-2025', // Change this to a random string in production
    resave: true, // Changed to true to ensure session is saved
    saveUninitialized: true, // Changed to true to create session even if not modified
    rolling: true, // Reset session expiry on each request
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true // Prevent XSS attacks
    },
    name: 'xenogenesis.sid' // Custom session name
});

// Apply session middleware to Express
app.use(sessionMiddleware);

const socketio = require("socket.io");
const io = socketio(server, {
    // Increase timeout settings to prevent disconnections during round processing
    pingTimeout: 60000,  // 60 seconds (default is 5 seconds)
    pingInterval: 25000  // 25 seconds (default is 25 seconds)
});

// Share session between Express and Socket.IO
io.use(sharedsession(sessionMiddleware, {
    autoSave: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/client/views/pages'));

// CSV parsing utility (sync)
const { parse } = require('csv-parse/sync');

// Configure static file serving with proper MIME types
app.use('/client', express.static(__dirname + '/client', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Parse JSON bodies for API endpoints (CSV content will be posted as text)
app.use(express.json({ limit: '5mb' }));

// Specific route for CSS files to ensure proper MIME type
app.get('/css/style.css', function(req, res) {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(__dirname + '/client/css/style.css');
});

app.get('/', function(req, res) {
    // Check if user has an active session and pass it to the client
    // Validate room if user has one in session
    let validatedRoom = req.session.room || 'Global';
    let roomExists = true;
    
    if (req.session.room && typeof roomList !== 'undefined') {
        const roomIndex = roomList.findIndex(room => 
            room.name.toLowerCase() === req.session.room.toLowerCase()
        );
        roomExists = roomIndex !== -1;
        
        if (!roomExists) {
            console.log(`${c.warn('[WARN]')} HTTP: Room "${req.session.room}" no longer exists, defaulting to Global`);
            validatedRoom = 'Global';
        }
    }
    
    const sessionData = {
        isLoggedIn: !!req.session.username,
        username: req.session.username || null,
        room: validatedRoom,
        roomRestored: roomExists,
        isAdmin: req.session.isAdmin || false
    };

    // Check for active game session if user is logged in and has a room
    if (req.session.username && validatedRoom && validatedRoom !== 'Global') {
        const Entity = require('./Entity.js');
        const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(validatedRoom);
        sessionData.hasActiveGame = hasActiveGame;
        console.log(`${c.game('[GAME]')} HTTP session check: Active game in "${validatedRoom}": ${hasActiveGame}`);
    } else {
        sessionData.hasActiveGame = false;
    }
    // Determine whether current user is the room moderator (creator)
    try {
        const currentRoom = typeof roomList !== 'undefined' ? roomList.find(r => r.name === validatedRoom) : null;
        sessionData.isModerator = req.session.username && currentRoom && currentRoom.creator === req.session.username;
    } catch (e) {
        sessionData.isModerator = false;
    }
    
    console.log(c.net('[NET]'), 'HTTP request session data:', sessionData);
    
    res.render('login', { 
        sessionData: JSON.stringify(sessionData)
    });
});

// CSV evaluation endpoint — accepts JSON { room, filename, content }
app.post('/api/evaluate-csv', function(req, res) {
    const username = req.session.username;
    if (!username) return res.status(401).json({ error: 'Not authenticated' });

    // Only allow admins or room moderators
    const room = req.body.room || req.session.room || 'Global';
    const isAdmin = req.session.isAdmin;
    const currentRoom = typeof roomList !== 'undefined' ? roomList.find(r => r.name === room) : null;
    const isModerator = currentRoom && currentRoom.creator === username;
    if (!isAdmin && !isModerator) return res.status(403).json({ error: 'Forbidden: moderator or admin required' });

    const content = req.body.content || '';
    if (!content) return res.status(400).json({ error: 'No CSV content provided' });

    try {
        // Parse CSV using robust CSV parser (handles quotes, commas)
        const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
        const rows = records;

        // Group rows by block
        const blocks = {};
        rows.forEach(r => {
            const b = parseInt(r['Block_Number'],10) || 0;
            if (!blocks[b]) blocks[b]=[];
            blocks[b].push(r);
        });

        const conditions = ['High Culturant','High Operant','Equal Culturant-Operant','Equal Culturant–Operant'];
        const incentSC = ['Self Control Incentive','Self Control Incentive'];

        const report = {};

        Object.entries(blocks).forEach(([blockNum, rowsInBlock]) => {
            const blockReport = { ok: true, errors: [], recipients: {}, noneCount: 0 };

            // Normalizers
            const canonicalCondition = (c) => (c||'').replace(/–/g,'-').trim();
            const canonicalIncentive = (i) => (i||'').trim();

            // Collect recipients including 'None'
            const recipientsSet = new Set();
            rowsInBlock.forEach(r => {
                const recip = (r['Incentive_Recipient'] || r['Incentive Recipient'] || 'None') || 'None';
                recipientsSet.add(recip);
            });

            const recipients = Array.from(recipientsSet);

            // Base conditions expected (normalize to use hyphen)
            const baseConds = ['High Culturant','High Operant','Equal Culturant-Operant'].map(c => canonicalCondition(c));
            const expectedKeys = [];
            baseConds.forEach(c => {
                expectedKeys.push(`${c}::Self Control Incentive`);
                expectedKeys.push(`${c}::Impulse Incentive`);
            });

            // Build per-recipient seen counts
            recipients.forEach(recipient => {
                const seen = {};
                let localNoneCount = 0;
                rowsInBlock.forEach(r => {
                    const recip = (r['Incentive_Recipient'] || r['Incentive Recipient'] || 'None') || 'None';
                    if (recip !== recipient) return;
                    const condRaw = r['Condition'] || r['Condition'] || '';
                    const cond = canonicalCondition(condRaw);
                    const inc = canonicalIncentive(r['Incentive_Type'] || r['Incentive Type'] || r['Incentive'] || '');

                    if (!inc || inc.toLowerCase() === 'none' || inc.toLowerCase() === 'no incentive') {
                        localNoneCount++;
                        return;
                    }

                    const key = `${cond}::${inc}`;
                    seen[key] = (seen[key] || 0) + 1;
                });

                blockReport.recipients[recipient] = { combos: seen, noneCount: localNoneCount };
            });

            // Verify each non-None recipient has exactly the expected combos once
            recipients.filter(r => r !== 'None').forEach(recipient => {
                const data = blockReport.recipients[recipient] || { combos: {} };
                expectedKeys.forEach(k => {
                    const count = data.combos[k] || 0;
                    if (count !== 1) {
                        blockReport.ok = false;
                        blockReport.errors.push(`Recipient ${recipient} has ${count} occurrences of ${k} in block ${blockNum}`);
                    }
                });
            });

            // Count NONE rounds for this block (rows where incentive is None)
            const noneCount = rowsInBlock.reduce((acc, r) => {
                const inc = (r['Incentive_Type'] || r['Incentive Type'] || r['Incentive'] || '').toString().toLowerCase();
                return acc + ((inc === 'none' || inc === 'no incentive' || inc === '') ? 1 : 0);
            }, 0);
            blockReport.noneCount = noneCount;
            if (noneCount !== 3) {
                blockReport.ok = false;
                blockReport.errors.push(`Block ${blockNum} has ${noneCount} NONE rounds (expected 3)`);
            }

            // Compute total earnings and culturant counts for the block if present
            let totalEarnings = 0;
            let culturantCount = 0;
            const earningKeys = ['Round_Earnings','Round Earnings','Earnings','Player_Earnings','Player Earnings','RoundEarnings','Earning'];
            rowsInBlock.forEach(r => {
                // earnings: detect common single-field names OR per-player round earnings like Player_A_Round_Earnings
                let added = false;
                for (const k of earningKeys) {
                    if (r[k] !== undefined && r[k] !== '') {
                        const v = parseFloat((r[k] + '').replace(/[^0-9.\-]/g, ''));
                        if (!isNaN(v)) {
                            totalEarnings += v;
                            added = true;
                            break;
                        }
                    }
                }

                if (!added) {
                    // Fallback: scan all columns for any that look like per-player round earnings
                    for (const colKey of Object.keys(r)) {
                        const lk = (colKey || '').toString().toLowerCase();
                        if (lk.includes('round') && lk.includes('earning')) {
                            const v = parseFloat((r[colKey] + '').replace(/[^0-9.\-]/g, ''));
                            if (!isNaN(v)) {
                                totalEarnings += v;
                                added = true;
                                // do not break — there may be multiple player round earnings per row; continue summing
                            }
                        }
                        // also consider columns like 'player_a_total_payout' or 'player_a_total' if needed
                        if (lk.includes('total') && lk.includes('payout')) {
                            const v = parseFloat((r[colKey] + '').replace(/[^0-9.\-]/g, ''));
                            if (!isNaN(v)) {
                                // skip adding total payout to avoid double-counting across rounds
                            }
                        }
                    }
                }

                // culturant condition
                const cond = (r['Condition'] || r['Condition'] || '').toString().toLowerCase();
                if (cond.indexOf('culturant') !== -1) culturantCount++;
            });
            blockReport.totalEarnings = totalEarnings;
            blockReport.culturantCount = culturantCount;

            report[blockNum] = blockReport;
        });

        return res.json({ success: true, report });
    } catch (err) {
        console.error('Error evaluating CSV:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Add session check endpoint
app.get('/api/session', function(req, res) {
    // Validate room if user has one in session
    let validatedRoom = req.session.room || 'Global';
    let roomExists = true;
    
    if (req.session.room && typeof roomList !== 'undefined') {
        const roomIndex = roomList.findIndex(room => 
            room.name.toLowerCase() === req.session.room.toLowerCase()
        );
        roomExists = roomIndex !== -1;
        
        if (!roomExists) {
            console.log(`${c.warn('[WARN]')} API: Room "${req.session.room}" no longer exists, defaulting to Global`);
            validatedRoom = 'Global';
        }
    }
    
    const sessionData = {
        isLoggedIn: !!req.session.username,
        username: req.session.username || null,
        room: validatedRoom,
        roomRestored: roomExists
    };

    // Check for active game session if user is logged in and has a room
    if (req.session.username && validatedRoom && validatedRoom !== 'Global') {
        const Entity = require('./Entity.js');
        const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(validatedRoom);
        sessionData.hasActiveGame = hasActiveGame;
        console.log(`${c.game('[GAME]')} API session check: Active game in "${validatedRoom}": ${hasActiveGame}`);
    } else {
        sessionData.hasActiveGame = false;
    }

    res.json(sessionData);
});

// CSV download endpoint for moderators
app.get('/api/download-experiment-csv/:roomId', function(req, res) {
    try {
        const { roomId } = req.params;
        
        console.log(`${c.data('[DATA]')} CSV download request received for room: ${roomId} by user: ${req.session.username}`);
        
        // Validate request
        if (!roomId) {
            console.log('❌ CSV download failed: No room ID provided');
            return res.status(400).send('Room ID is required');
        }
        
        // Check if user is authenticated and authorized
        if (!req.session.username) {
            console.log('❌ CSV download failed: User not authenticated');
            return res.status(401).send('Authentication required');
        }
        
        // Import required modules
        const ExperimentScheduler = require('./ExperimentScheduler.js');
        const Entity = require('./Entity.js');
        
        console.log(`${c.data('[DATA]')} Looking for game session in room: ${roomId}`);
        
        // Get the game session for this room
        const gameSession = Entity.GameSession.get(roomId);
        
        if (!gameSession) {
            // Check cache for recently ended experiments (session may have been cleaned up)
            const cached = recentCSVCache.get(roomId);
            if (cached) {
                console.log(`${c.data('[DATA]')} Serving cached CSV for room ${roomId} (session ended ${Math.round((Date.now() - cached.timestamp) / 1000)}s ago)`);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="experiment_${roomId}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.csv"`);
                return res.send(cached.csvData);
            }
            console.log(`❌ CSV download failed: No game session found for room ${roomId}`);
            return res.status(404).send('No active experiment found for this room');
        }
        
        console.log(`${c.data('[DATA]')} Game session found. DataLog length: ${gameSession.dataLog ? gameSession.dataLog.length : 0}`);
        
        if (!gameSession.dataLog || gameSession.dataLog.length === 0) {
            console.log(`❌ CSV download failed: No dataLog or empty dataLog for room ${roomId}`);
            return res.status(404).send('No experiment data found for this room - experiment may not have started yet');
        }
        
        // Create ExperimentScheduler instance and export CSV
        const scheduler = new ExperimentScheduler();
        const csvData = scheduler.exportExperimentResultsToCSV(gameSession.dataLog);
        
        console.log(`${c.data('[DATA]')} CSV generated successfully. Length: ${csvData.length} characters`);
        
        if (!csvData || csvData.trim().length === 0) {
            console.log(`❌ CSV download failed: Generated CSV is empty for room ${roomId}`);
            return res.status(404).send('No experiment data found for this room');
        }
        
        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="experiment_${roomId}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.csv"`);
        
        // Send CSV data
        res.send(csvData);
        
        console.log(`✅ CSV download completed successfully for ${req.session.username} in room ${roomId}`);
        
    } catch (error) {
        console.error('❌ Error generating CSV for download:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).send('Error generating CSV file');
    }
});

// Test endpoint to check game sessions and data
app.get('/api/test-rooms', function(req, res) {
    try {
        const Entity = require('./Entity.js');
        const allRooms = Entity.GameSession.getAll();
        
        const roomInfo = {};
        for (const [roomId, session] of Object.entries(allRooms)) {
            roomInfo[roomId] = {
                hasDataLog: !!session.dataLog,
                dataLogLength: session.dataLog ? session.dataLog.length : 0,
                experimentPhase: session.experimentPhase || 'unknown',
                players: session.players ? session.players.length : 0
            };
        }
        
        res.json({
            totalRooms: Object.keys(allRooms).length,
            rooms: roomInfo
        });
    } catch (error) {
        console.error('Error getting room info:', error);
        res.status(500).json({ error: 'Error getting room information' });
    }
});

app.get('/about', function(req, res) {
    res.render('about');
});

// Invite link route - redirects to login with invite code pre-filled
app.get('/invite', function(req, res) {
    const inviteCode = req.query.code;
    
    if (!inviteCode) {
        console.log(c.warn('[WARN]'), 'Invite link accessed without code parameter');
        return res.redirect('/');
    }
    
    // Sanitize the invite code
    const sanitizedCode = inviteCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    if (sanitizedCode.length < 3) {
        console.log(c.warn('[WARN]'), 'Invalid invite code in link:', inviteCode);
        return res.redirect('/');
    }
    
    console.log(`${c.net('[LINK]')} Invite link accessed with code: ${sanitizedCode}`);
    
    // Look up invite code details to get target room
    Database.getInviteCodeDetails(sanitizedCode, function(inviteDetails) {
        // Get session data same as main route
        let validatedRoom = req.session.room || 'Global';
        
        if (req.session.room && typeof roomList !== 'undefined') {
            const roomIndex = roomList.findIndex(room => 
                room.name.toLowerCase() === req.session.room.toLowerCase()
            );
            if (roomIndex === -1) {
                validatedRoom = 'Global';
            }
        }
        
        const sessionData = {
            isLoggedIn: !!req.session.username,
            username: req.session.username || null,
            room: validatedRoom,
            inviteCode: sanitizedCode,  // Pass the invite code to pre-fill
            targetRoom: inviteDetails ? inviteDetails.targetRoom : null  // Room to auto-join after signup
        };
        
        if (inviteDetails && inviteDetails.targetRoom) {
            console.log(`${c.net('[LINK]')} Invite code ${sanitizedCode} has target room: ${inviteDetails.targetRoom}`);
        }
        
        // Check for active game
        if (req.session.username && validatedRoom && validatedRoom !== 'Global') {
            const Entity = require('./Entity.js');
            const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(validatedRoom);
            sessionData.hasActiveGame = hasActiveGame;
        } else {
            sessionData.hasActiveGame = false;
        }
        
        res.render('login', { 
            sessionData: JSON.stringify(sessionData)
        });
    });
});

// Remove game route - game interface should be embedded in main page

app.get('/globalChat', function(req, res) {
    res.render('globalChat');
});

// Debug route to test LED tracker
app.get('/debug/test-led-tracker', function(req, res) {
    const testData = {
        condition: 'High Culturant',
        round: 15,
        blockNumber: 3,
        players: [
            { name: 'Player A', id: 'player1' },
            { name: 'Player B', id: 'player2' },
            { name: 'Player C', id: 'player3' }
        ]
    };
    
    console.log(c.game('[TEST]'), 'Testing LED tracker with data:', testData);
    
    // Emit to all connected sockets
    io.emit('conditionUpdate', testData);
    
    res.json({ 
        message: 'LED tracker test data sent', 
        data: testData,
        socketCount: Object.keys(SOCKET_LIST).length
    });
});

const LISTEN_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 2000;

server.listen(LISTEN_PORT, () => {
    console.log(`------------ Server started on port ${LISTEN_PORT} ------------`);
    
    // Update invite code schema and clean up on startup
    setTimeout(() => {
        Database.updateInviteCodeSchema(function(schemaSuccess) {
            if (schemaSuccess) {
                console.log(c.net('[RESTORE]'), 'Invite code schema update completed');
                
                // Clean up any existing used invite codes after schema update
                Database.cleanupUsedInviteCodes(function(cleanupSuccess) {
                    if (cleanupSuccess) {
                        console.log(c.clean('[CLEAN]'), 'Startup cleanup of used invite codes completed');
                    }
                    
                    // Debug: List all invite codes after cleanup
                    Database.listAllInviteCodes((invites) => {
                        console.log(`${c.data('[DATA]')} Found ${invites.length} total invite codes in database`);
                    });
                });
            }
        });
    }, 2000); // Wait 2 seconds for DB connection to be ready
});


////
// Variables
var SOCKET_LIST = {};


io.on('connection', (socket) => {
    console.log(c.net('[SOCK]'), 'New socket connection:', socket.id);
    SOCKET_LIST[socket.id] = socket;

    // IMMEDIATELY capture session data before any client actions can modify it
    let originalSessionRoom = null;
    if (socket.handshake.session && socket.handshake.session.username) {
        originalSessionRoom = socket.handshake.session.room;
    }

    // Add a small delay to ensure session data is properly loaded
    setTimeout(() => {
        // Guard: If signIn/signUp already called Player.onConnect for this socket,
        // skip the session-restore path to avoid registering handlers twice.
        if (socket._playerConnected) {
            return;
        }

        // Check for existing session on connection        
        if (socket.handshake.session && socket.handshake.session.username) {
            console.log(c.net('[RESTORE]'), 'Restoring session for user:', socket.handshake.session.username);
            
            // Use the ORIGINAL room we captured, not the potentially overwritten one
            let targetRoom = originalSessionRoom || 'Global';
            
            let roomExists = false;
            
            // Validate if the room still exists in roomList (roomList is global from Entity.js)
            if (typeof roomList !== 'undefined') {
                const roomIndex = roomList.findIndex(room => 
                    room.name.toLowerCase() === targetRoom.toLowerCase()
                );
                roomExists = roomIndex !== -1;
                
                if (roomExists) {
                    console.log(`✅ Room "${targetRoom}" still exists, will reconnect user`);
                } else {
                    console.log(`${c.warn('[WARN]')} Room "${targetRoom}" no longer exists, defaulting to Global`);
                    targetRoom = 'Global';
                }
            } else {
                console.log(c.warn('[WARN]'), 'roomList not available, defaulting to Global');
                targetRoom = 'Global';
            }
            
            Database.isAdmin({ username: socket.handshake.session.username }, function(admin) {
                Player.onConnect(socket, socket.handshake.session.username, admin, io);
                
                // Check if there's an active game session in the target room
                const Entity = require('./Entity.js');
                const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(targetRoom);
                console.log(`${c.game('[GAME]')} Checking for active game in room "${targetRoom}": ${hasActiveGame}`);
                
                // Get stored player position if available
                let playerPosition = null;
                if (hasActiveGame) {
                    const gameSession = Entity.GameSession.get(targetRoom);
                    if (gameSession && gameSession.playerPositions) {
                        playerPosition = gameSession.playerPositions[socket.handshake.session.username];
                    }
                }
                
                // Emit session restore event with validated room and game status
                socket.emit('sessionRestored', { 
                    success: true, 
                    username: socket.handshake.session.username,
                    room: targetRoom,
                    roomRestored: roomExists,
                    hasActiveGame: hasActiveGame,
                    isAdmin: admin,
                    playerPosition: playerPosition
                });
            });
        } else {
            // Emit session invalid event to prompt re-login
            socket.emit('sessionInvalid', { 
                message: 'Session expired, please log in again' 
            });
        }
    }, 100); // 100ms delay

    socket.on('signIn', function(data) {
        console.log(c.auth('[AUTH]'), 'Sign in attempt for:', data.username);
        
        Database.isValidPassword(data, function(res){
            if (!res) {
                console.log('❌ Invalid password for:', data.username);
                return socket.emit('signInResponse', { success: false });
            }
            
            console.log('✅ Password validated for:', data.username);
            
            // Clean up used invite codes on successful login
            Database.cleanupUsedInviteCodes(function(cleanupSuccess) {
                if (!cleanupSuccess) {
                    console.log(c.warn('[WARN]'), 'Invite code cleanup failed, but continuing with login');
                }
            });
            
            // Store user data in session
            socket.handshake.session.username = data.username;
            socket.handshake.session.loginTime = new Date().toISOString();
            
            // Check for room restoration data after logout
            if (userRoomRestoration.has(data.username)) {
                const restorationData = userRoomRestoration.get(data.username);
                const age = Date.now() - restorationData.timestamp;
                const maxAge = 10 * 60 * 1000; // 10 minutes
                
                if (age < maxAge && restorationData.hasActiveGame) {
                    // Check if the game is still active
                    const Entity = require('./Entity.js');
                    const stillActive = Entity.hasActiveGameSession && Entity.hasActiveGameSession(restorationData.room);
                    
                    if (stillActive) {
                        socket.handshake.session.room = restorationData.room;
                        console.log(`${c.net('[RESTORE]')} Restored ${data.username} to room "${restorationData.room}" with active game`);
                        
                        // Save session first
                        socket.handshake.session.save((err) => {
                            if (err) {
                                console.error('❌ Session save error:', err);
                            }
                            
                            Database.isAdmin(data, function(admin){ 
                                // Store admin status in session
                                socket.handshake.session.isAdmin = admin;
                                socket.handshake.session.save();
                                
                                Player.onConnect(socket, data.username, admin, io);
                                socket._playerConnected = true;
                                socket.emit('signInResponse', { 
                                    success: true, 
                                    isAdmin: admin, 
                                    username: data.username 
                                });
                                console.log('✅ Sign in response sent to client');
                                
                                // Get stored player position if available
                                let playerPosition = null;
                                const gameSession = Entity.GameSession.get(restorationData.room);
                                if (gameSession && gameSession.playerPositions) {
                                    playerPosition = gameSession.playerPositions[data.username];
                                }
                                
                                // Trigger session restoration event for room restoration
                                socket.emit('sessionRestored', { 
                                    success: true, 
                                    username: data.username,
                                    room: restorationData.room,
                                    roomRestored: true,
                                    hasActiveGame: true,
                                    isAdmin: admin,
                                    playerPosition: playerPosition
                                });
                            });
                        });
                        
                    } else {
                        socket.handshake.session.room = 'Global';
                        console.log(`${c.warn('[WARN]')} Game no longer active in "${restorationData.room}", defaulting ${data.username} to Global`);
                        
                        // Handle non-restoration case
                        socket.handshake.session.save((err) => {
                            if (err) {
                                console.error('❌ Session save error:', err);
                            }
                            
                            Database.isAdmin(data, function(admin){ 
                                // Store admin status in session
                                socket.handshake.session.isAdmin = admin;
                                socket.handshake.session.save();
                                
                                Player.onConnect(socket, data.username, admin, io);
                                socket._playerConnected = true;
                                socket.emit('signInResponse', { 
                                    success: true, 
                                    isAdmin: admin, 
                                    username: data.username 
                                });
                                console.log('✅ Sign in response sent to client');
                            });
                        });
                    }
                    // Clean up restoration data after use
                    userRoomRestoration.delete(data.username);
                } else {
                    socket.handshake.session.room = 'Global';
                    console.log(`${c.warn('[WARN]')} Restoration data expired for ${data.username}, defaulting to Global`);
                    userRoomRestoration.delete(data.username);
                    
                    // Handle non-restoration case
                    socket.handshake.session.save((err) => {
                        if (err) {
                            console.error('❌ Session save error:', err);
                        }
                        
                        Database.isAdmin(data, function(admin){ 
                            // Store admin status in session
                            socket.handshake.session.isAdmin = admin;
                            socket.handshake.session.save();
                            
                            Player.onConnect(socket, data.username, admin, io);
                            socket._playerConnected = true;
                            socket.emit('signInResponse', { 
                                success: true, 
                                isAdmin: admin, 
                                username: data.username 
                            });
                            console.log('✅ Sign in response sent to client');
                        });
                    });
                }
            } else {
                socket.handshake.session.room = 'Global';
                console.log(`${c.net('[NET]')} No restoration data found for ${data.username}, starting in Global`);
                
                // Handle non-restoration case
                socket.handshake.session.save((err) => {
                    if (err) {
                        console.error('❌ Session save error:', err);
                    }
                    
                    Database.isAdmin(data, function(admin){ 
                        // Store admin status in session
                        socket.handshake.session.isAdmin = admin;
                        socket.handshake.session.save();
                        
                        Player.onConnect(socket, data.username, admin, io);
                        socket._playerConnected = true;
                        socket.emit('signInResponse', { 
                            success: true, 
                            isAdmin: admin, 
                            username: data.username 
                        });
                        console.log('✅ Sign in response sent to client');
                    });
                });
            }
        });
    });

    // Client can request a session restore explicitly (useful after reconnect)
    socket.on('requestSessionRestore', function(req) {
        console.log(c.info('[RETRY]'), 'requestSessionRestore received from socket', socket.id, 'for', req && req.room ? req.room : 'n/a');
        // Use existing session data to build the same response as on initial connect
        if (socket.handshake.session && socket.handshake.session.username) {
            let targetRoom = socket.handshake.session.room || 'Global';
            let roomExists = false;

            if (typeof roomList !== 'undefined') {
                const roomIndex = roomList.findIndex(r => r.name.toLowerCase() === (targetRoom || 'Global').toLowerCase());
                roomExists = roomIndex !== -1;
                if (!roomExists) targetRoom = 'Global';
            } else {
                targetRoom = 'Global';
            }

            const Entity = require('./Entity.js');
            const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(targetRoom);

            Database.isAdmin({ username: socket.handshake.session.username }, function(admin) {
                socket.emit('sessionRestored', {
                    success: true,
                    username: socket.handshake.session.username,
                    room: targetRoom,
                    roomRestored: roomExists,
                    hasActiveGame: hasActiveGame,
                    isAdmin: admin
                });
            });
        } else {
            socket.emit('sessionInvalid', { message: 'Session expired, please log in again' });
        }
    });

    socket.on('signUp', function(data) {
        console.log(c.dim('[NOTE]'), 'Sign up attempt:', { username: data.username, inviteCode: data.inviteCode });
        
        // Validate required fields
        if (!data.username || !data.password || !data.inviteCode) {
            console.log('❌ Missing required signup fields');
            return socket.emit('signUpResponse', { 
                success: false, 
                message: 'All fields are required' 
            });
        }
        
        // Sanitize invite code - only alphanumeric characters, max 8 chars for security
        const sanitizedInviteCode = data.inviteCode.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
        
        if (sanitizedInviteCode.length < 3) {
            console.log('❌ Invalid invite code format:', data.inviteCode);
            return socket.emit('signUpResponse', { 
                success: false, 
                message: 'Invite code must contain at least 3 alphanumeric characters' 
            });
        }
        
        console.log(c.auth('[LOCK]'), 'Sanitized invite code:', sanitizedInviteCode, 'from original:', data.inviteCode);
        
        // Validate invite code first
        Database.validateInviteCode(sanitizedInviteCode, function(isValidInvite) {
            if (!isValidInvite) {
                console.log('❌ Invalid invite code:', data.inviteCode);
                return socket.emit('signUpResponse', { 
                    success: false, 
                    message: 'Invalid or expired invite code' 
                });
            }
            
            // Check if username is taken
            Database.isUsernameTaken(data, function(isTaken) {
                if (isTaken) {
                    console.log('❌ Username already taken:', data.username);
                    return socket.emit('signUpResponse', { 
                        success: false, 
                        message: 'Username is already taken' 
                    });
                }
                
                // Create the user account
                Database.addUser(data, function(userAdded) {
                    if (!userAdded) {
                        console.log('❌ Failed to create user account');
                        return socket.emit('signUpResponse', { 
                            success: false, 
                            message: 'Failed to create account' 
                        });
                    }
                    
                    // Mark invite code as used
                    Database.useInviteCode(sanitizedInviteCode, data.username, function(codeUsed) {
                        if (!codeUsed) {
                            console.log(c.warn('[WARN]'), 'Account created but failed to mark invite code as used');
                        }
                        
                        // Store user data in session after successful signup
                        socket.handshake.session.username = data.username;
                        socket.handshake.session.loginTime = new Date().toISOString();
                        socket.handshake.session.room = 'Global'; // New users start in Global
                        socket.handshake.session.save((err) => {
                            if (err) {
                                console.error('❌ Session save error after signup:', err);
                            }
                            
                            console.log('✅ Account created successfully for:', data.username);
                            
                            // Auto-login the user after successful signup
                            Database.isAdmin(data, function(admin) {
                                console.log(c.dim('[NOTE]'), 'Sending successful signUpResponse with autoLogin for:', data.username);
                                Player.onConnect(socket, data.username, admin, io);
                                socket._playerConnected = true;
                                socket.emit('signUpResponse', { 
                                    success: true, 
                                    message: 'Account created successfully!',
                                    autoLogin: true,
                                    username: data.username,
                                    isAdmin: admin
                                });
                                console.log('✅ User auto-logged in after signup');
                            });
                        });
                    });
                });
            });
        });
    });

    socket.on('generateInviteCode', function(data) {
        const username = socket.handshake.session.username;
        
        if (!username) {
            return socket.emit('inviteCodeResponse', { 
                success: false, 
                message: 'Not logged in' 
            });
        }
        
        // Check if user is admin
        Database.isAdmin({ username: username }, function(isAdmin) {
            if (!isAdmin) {
                console.log('❌ Non-admin attempted to generate invite code:', username);
                return socket.emit('inviteCodeResponse', { 
                    success: false, 
                    message: 'Admin privileges required' 
                });
            }
            
            // Check if this is a permanent code request
            if (data.isPermanent && data.customCode) {
                // Sanitize custom code - only alphanumeric characters
                const sanitizedCustomCode = data.customCode.replace(/[^a-zA-Z0-9]/g, '');
                
                if (sanitizedCustomCode.length < 3) {
                    return socket.emit('inviteCodeResponse', { 
                        success: false, 
                        message: 'Custom code must contain at least 3 alphanumeric characters' 
                    });
                }
                
                console.log(c.auth('[LOCK]'), 'Sanitized custom code:', sanitizedCustomCode, 'from original:', data.customCode);
                
                // Generate permanent custom code
                Database.generatePermanentInviteCode(sanitizedCustomCode, username, function(inviteCode) {
                    if (!inviteCode) {
                        console.log('❌ Failed to create permanent invite code for admin:', username);
                        return socket.emit('inviteCodeResponse', { 
                            success: false, 
                            message: 'Failed to create permanent invite code (may already exist)' 
                        });
                    }
                    
                    console.log('✅ Admin created permanent invite code:', { admin: username, code: inviteCode });
                    socket.emit('inviteCodeResponse', { 
                        success: true, 
                        inviteCode: inviteCode,
                        isPermanent: true,
                        message: 'Permanent invite code created successfully!' 
                    });
                });
            } else {
                // Generate random single-use code
                // Check if mod is in an active room (not Global)
                const currentRoom = socket.handshake.session.room;
                const targetRoom = (currentRoom && currentRoom !== 'Global') ? currentRoom : null;
                
                Database.generateInviteCode(username, targetRoom, function(inviteCode, room) {
                    if (!inviteCode) {
                        console.log('❌ Failed to generate invite code for admin:', username);
                        return socket.emit('inviteCodeResponse', { 
                            success: false, 
                            message: 'Failed to generate invite code' 
                        });
                    }
                    
                    console.log('✅ Admin generated random invite code:', { admin: username, code: inviteCode, targetRoom: room });
                    socket.emit('inviteCodeResponse', { 
                        success: true, 
                        inviteCode: inviteCode,
                        isPermanent: false,
                        targetRoom: room,
                        message: room ? `Invite code generated for room "${room}"!` : 'Random invite code generated successfully!'
                    });
                });
            }
        });
    });

    socket.on('logout', function() {
        console.log(c.auth('[UNLOCK]'), 'User logging out:', socket.handshake.session.username);
        
        // Store user's room information for potential restoration after re-login
        if (socket.handshake.session && socket.handshake.session.username && socket.handshake.session.room) {
            const username = socket.handshake.session.username;
            const currentRoom = socket.handshake.session.room;
            
            if (currentRoom !== 'Global') {
                const Entity = require('./Entity.js');
                const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(currentRoom);
                
                if (hasActiveGame) {
                    // Store room information for restoration after re-login
                    userRoomRestoration.set(username, {
                        room: currentRoom,
                        timestamp: Date.now(),
                        hasActiveGame: true
                    });
                    console.log(`${c.data('[SAVE]')} Stored room restoration data for ${username}: room="${currentRoom}", activeGame=true`);
                } else {
                    // Remove any existing restoration data if no active game
                    userRoomRestoration.delete(username);
                    console.log(`${c.clean('[CLEAN]')} Cleared room restoration data for ${username} - no active game`);
                }
            } else {
                // Remove restoration data if user was in Global
                userRoomRestoration.delete(username);
            }
        }
        
        // Clear session data safely
        if (socket.handshake.session) {
            // Clear session properties instead of destroying
            socket.handshake.session.isLoggedIn = false;
            socket.handshake.session.username = null;
            socket.handshake.session.room = 'Global';
            socket.handshake.session.loginTime = null;
            socket.handshake.session.save(() => {
                socket.emit('logoutResponse', { success: true });
            });
        } else {
            socket.emit('logoutResponse', { success: true });
        }
    });

    socket.on('joinRoom', function(data) {
        // Store current room in session for persistence
        if (socket.handshake.session) {
            // Handle both string and object formats
            const roomName = typeof data === 'string' ? data : data.room;
            socket.handshake.session.room = roomName;
            socket.handshake.session.save();
            console.log(c.data('[SAVE]'), 'Room saved to session:', roomName);
        }
    });
    
    socket.on('endExperiment', function(data) {
        console.log(c.err('[STOP]'), 'End experiment request received:', data);
        
        // Verify the user is a moderator (you may need to add this check)
        const username = socket.handshake.session?.username;
        
        if (!username) {
            console.log('❌ End experiment failed: No authenticated user');
            return;
        }
        
        const room = data.room;
        if (!room || room === 'Global') {
            console.log('❌ End experiment failed: Invalid room');
            return;
        }
        
        console.log(`${c.err('[STOP]')} Moderator ${username} ending experiment in room: ${room}`);
        
        // Grab session data BEFORE cleanup destroys it
        const Entity_stop = require('./Entity.js');
        const stopSession = Entity_stop.GameSession.get(room);
        const stopRoundHistory = (stopSession && stopSession.roundHistory) ? stopSession.roundHistory : [];
        
        // Cache CSV before cleanup destroys the GameSession
        // This allows the client's CSV validation to work after the modal appears
        try {
            if (stopSession && stopSession.dataLog && stopSession.dataLog.length > 0) {
                const ExperimentScheduler = require('./ExperimentScheduler.js');
                const scheduler = new ExperimentScheduler();
                const csvData = scheduler.exportExperimentResultsToCSV(stopSession.dataLog);
                recentCSVCache.set(room, { csvData, timestamp: Date.now() });
                console.log(`${c.data('[DATA]')} Cached CSV for room ${room} before cleanup (${csvData.length} chars)`);
                // Auto-expire cache entry after 10 minutes
                setTimeout(() => { recentCSVCache.delete(room); }, 10 * 60 * 1000);
            }
        } catch (cacheErr) {
            console.error(`❌ Failed to cache CSV for room ${room}:`, cacheErr.message);
        }
        
        // Clear session room for all users in the room by sending them to Global
        io.in(room).fetchSockets().then(sockets => {
            console.log(`${c.net('[EMIT]')} Found ${sockets.length} users in room ${room} to process`);
            
            // Identify the room creator (moderator) for per-socket isModerator flag
            const currentRoom = typeof roomList !== 'undefined' ? roomList.find(r => r.name === room) : null;
            const moderatorUsername = currentRoom ? currentRoom.creator : username;
            
            // First, send events to all sockets while they're still in the room
            sockets.forEach(socket => {
                const socketUsername = socket.handshake.session?.username;
                const isSocketModerator = socketUsername === moderatorUsername;
                
                // Send experimentEnded event to each socket individually
                socket.emit('experimentEnded', {
                    message: `The experiment has been ended by the moderator.`,
                    moderator: username,
                    isModerator: isSocketModerator,
                    roomName: room,
                    roundHistory: stopRoundHistory
                });
                
                // Send leftRoom event to each socket individually
                socket.emit('leftRoom', {
                    room: 'Global',
                    reason: 'Experiment ended by moderator'
                });
                
                console.log(`${c.net('[EMIT]')} Sent end experiment events to: ${socket.handshake.session?.username || 'unknown user'}`);
            });
            
            // Then update sessions and move sockets
            sockets.forEach(socket => {
                if (socket.handshake.session) {
                    socket.handshake.session.room = 'Global';
                    socket.handshake.session.save();
                    console.log(`${c.clean('[CLEAN]')} Cleared session room for user: ${socket.handshake.session.username}`);
                    
                    // Force socket to leave the experiment room and join Global
                    socket.leave(room);
                    socket.join('Global');
                    console.log(`${c.info('[ROOM]')} Moved socket from ${room} to Global for user: ${socket.handshake.session.username}`);
                    
                    // Send joinRoom confirmation to the socket
                    socket.emit('joinRoom', 'Global');
                    console.log(`✅ Sent joinRoom Global confirmation to: ${socket.handshake.session.username}`);
                }
            });
            
            // After clearing all sessions, log completion
            console.log(`✅ Processed experiment end for ${sockets.length} users in room ${room}`);
            
            // Clean up game sessions and room data
            const Entity = require('./Entity.js');
            const cleanupSuccess = Entity.cleanupRoom(room);
            
            if (!cleanupSuccess) {
                console.warn(`${c.warn('[WARN]')} Room cleanup had some issues for room: ${room}`);
            }
            
            console.log(`✅ Experiment ended in room: ${room}`);
        }).catch(error => {
            console.error(`❌ Error ending experiment in room ${room}:`, error);
            
            // Fallback: send events to individual sockets if main flow failed
            io.in(room).fetchSockets().then(fallbackSockets => {
                fallbackSockets.forEach(socket => {
                    const socketUser = socket.handshake.session?.username;
                    socket.emit('experimentEnded', {
                        message: `The experiment has been ended by the moderator.`,
                        moderator: username,
                        isModerator: socketUser === username,
                        roomName: room,
                        roundHistory: stopRoundHistory
                    });
                    
                    socket.emit('leftRoom', {
                        room: 'Global',
                        reason: 'Experiment ended by moderator'
                    });
                    
                    socket.emit('joinRoom', 'Global');
                });
            }).catch(fallbackError => {
                console.error(`❌ Fallback also failed:`, fallbackError);
            });
        });
    });

    // ─── Integration Test Runner (admin/moderator only) ─────────
    // Spawns test_integration.js as a child process, streams output
    // back to the requesting client via Socket.IO events.
    let activeTestProcess = null;

    socket.on('runIntegrationTest', function(opts) {
        // Guard: admin or moderator only
        const isAdmin = socket.handshake.session && socket.handshake.session.isAdmin;
        const userRoom = socket.handshake.session && socket.handshake.session.room;
        const username = socket.handshake.session && socket.handshake.session.username;
        // Check if user is room creator (moderator)
        let isMod = false;
        if (userRoom && userRoom !== 'Global' && typeof roomList !== 'undefined') {
            const room = roomList.find(r => r.name === userRoom);
            isMod = room && room.creator === username;
        }

        if (!isAdmin && !isMod) {
            socket.emit('integrationTestOutput', { line: '❌ Permission denied — admin or moderator required', type: 'error' });
            socket.emit('integrationTestComplete', { code: 1, signal: null });
            return;
        }

        if (activeTestProcess) {
            socket.emit('integrationTestOutput', { line: '⚠️ A test is already running — please wait', type: 'warn' });
            return;
        }

        const { spawn } = require('child_process');
        const testArgs = ['test_integration.js', '--rounds', String((opts && opts.rounds) || 21)];

        // If an invite code was passed, forward it
        if (opts && opts.inviteCode) {
            testArgs.push('--invite', opts.inviteCode);
        }

        console.log(`${c.game('[TEST]')} Integration test triggered by ${socket.handshake.session.username}: node ${testArgs.join(' ')}`);
        socket.emit('integrationTestOutput', { line: `Starting integration test (${(opts && opts.rounds) || 21} rounds / 1 full block)…`, type: 'info' });

        const child = spawn(process.execPath, testArgs, {
            cwd: __dirname,
            env: { ...process.env, FORCE_COLOR: '0' },   // no ANSI in piped output
            stdio: ['ignore', 'pipe', 'pipe']
        });
        activeTestProcess = child;

        function sendLine(raw, type) {
            const line = raw.toString().replace(/\r?\n$/, '');
            if (line.length === 0) return;
            // Split multi-line chunks
            line.split(/\r?\n/).forEach(l => {
                socket.emit('integrationTestOutput', { line: l, type: type });
            });
        }

        child.stdout.on('data', chunk => sendLine(chunk, 'stdout'));
        child.stderr.on('data', chunk => sendLine(chunk, 'stderr'));

        child.on('close', (code, signal) => {
            activeTestProcess = null;
            console.log(`${c.game('[TEST]')} Integration test finished (code=${code}, signal=${signal})`);
            socket.emit('integrationTestComplete', { code: code, signal: signal });
        });

        child.on('error', (err) => {
            activeTestProcess = null;
            socket.emit('integrationTestOutput', { line: `❌ Failed to start test: ${err.message}`, type: 'error' });
            socket.emit('integrationTestComplete', { code: 1, signal: null });
        });

        // Allow the client to abort a running test
        socket.once('cancelIntegrationTest', () => {
            if (activeTestProcess) {
                console.log(`${c.err('[STOP]')} Integration test cancelled by ${socket.handshake.session.username}`);
                activeTestProcess.kill('SIGINT');
            }
        });
    });

    socket.on('disconnect', function(){
        // Store user's room information for potential restoration (same logic as logout)
        if (socket.handshake.session && socket.handshake.session.username && socket.handshake.session.room) {
            const username = socket.handshake.session.username;
            const currentRoom = socket.handshake.session.room;
            
            if (currentRoom !== 'Global') {
                const Entity = require('./Entity.js');
                const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(currentRoom);
                
                if (hasActiveGame) {
                    // Store room information for restoration after re-login
                    userRoomRestoration.set(username, {
                        room: currentRoom,
                        timestamp: Date.now(),
                        hasActiveGame: true
                    });
                    console.log(`${c.data('[SAVE]')} Stored room restoration data on disconnect for ${username}: room="${currentRoom}", activeGame=true`);
                } else {
                    // Remove any existing restoration data if no active game
                    userRoomRestoration.delete(username);
                }
            }
        }
        
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket, io);
    });
});


////
// Main Loop
setInterval(function(){

    var packs = Entity.getFrameUpdateData();
    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        // Don't send init events in the main loop - they should only be sent on join/game start
        // socket.emit('init',packs.initPack);
        socket.emit('update',packs.updatePack);
        socket.emit('remove',packs.removePack);
    }

},1000/60);

module.exports = {io};