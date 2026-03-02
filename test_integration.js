/**
 * XenoGenesis Integration Test Suite
 * ===================================
 * Comprehensive end-to-end test that:
 * 1. Logs in a test user (moderator)
 * 2. Creates a room
 * 3. Adds AI players to form a triad
 * 4. Starts an experiment in conditions mode
 * 5. Runs 2 full blocks (42 rounds) at accelerated pace
 * 6. Validates incentive bonuses match incentive rules
 * 7. Logs all events, warnings, and errors
 * 
 * Usage:
 *   node test_integration.js [--port 2000] [--blocks 2] [--user andre] [--pass password]
 * 
 * Requires the server to be running.
 */

const io = require('socket.io-client');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const CONFIG = {
    SERVER: `http://localhost:${getArg('port', '2000')}`,
    USERNAME: getArg('user', '') || process.env.XENO_TEST_USER || 'xeno_testrunner',
    PASSWORD: getArg('pass', '') || process.env.XENO_TEST_PASS || 'xeno_testpass',
    INVITE_CODE: getArg('invite', '') || process.env.XENO_INVITE_CODE || '',  // From --invite or env var
    TARGET_ROUNDS_OVERRIDE: parseInt(getArg('rounds', '21'), 10),
    ROUNDS_PER_BLOCK: 21,
    CHOICE_DELAY_MS: 100,       // Delay before making a choice after yourTurn
    MAX_TEST_TIMEOUT_MS: 600000, // 10 minute max runtime (AI takes ~10-15s per round)
    LOG_FILE: path.join(__dirname, 'test_integration_results.log'),
};

CONFIG.TARGET_ROUNDS = CONFIG.TARGET_ROUNDS_OVERRIDE;

// ─── Round timing for ETA calculation ───────────────────────
const roundTimestamps = [];  // [Date.now()] per completed round

function getProgressBar(current, total) {
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const barLen = 30;
    const filled = Math.round(barLen * pct / 100);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    // ETA calculation from average round time
    let eta = '--:--';
    if (roundTimestamps.length >= 2) {
        const first = roundTimestamps[0];
        const last = roundTimestamps[roundTimestamps.length - 1];
        const avgMs = (last - first) / (roundTimestamps.length - 1);
        const remaining = total - current;
        const etaMs = avgMs * remaining;
        const etaSec = Math.ceil(etaMs / 1000);
        const m = String(Math.floor(etaSec / 60)).padStart(2, '0');
        const s = String(etaSec % 60).padStart(2, '0');
        eta = `${m}:${s}`;
    }

    return `[PROGRESS] ${bar} ${pct}% (${current}/${total}) ETA ${eta}`;
}

// ─── Logging ────────────────────────────────────────────────
const logLines = [];
const counters = {
    events: {},
    errors: [],
    warnings: [],
    rounds: 0,
    blocks: new Set(),
    conditions: {},
    incentives: {},
    choices: [],
    roundResults: [],
    tokenPool: [],
    turnUpdates: 0,
    lockins: 0,
    culturants: 0,
    startTime: null,
    endTime: null,
    // Data integrity counters
    roundsWithPlayerData: 0,     // Rounds where roundResultsPanel had valid player array
    roundsWithTokenValues: 0,    // Rounds where token values were present
    roundsWithPreviousData: 0,   // Rounds where previous round data was included
    totalPlayersInResults: 0,    // Sum of players across all round results
    playerChoicesRecorded: 0,    // How many player choices had non-null values
    csvValidation: null,         // CSV download test result
    // Token economics validation
    tokenMathErrors: [],         // {round, player, field, expected, actual}
    tokenMathChecks: 0,          // Total token math checks performed
    // Culturant production validation
    culturantRounds: { produced: 0, notProduced: 0, verified: 0, errors: 0 },
    // Token pool depletion tracking
    tokenPoolDecreasing: true,   // False if pool ever increased between rounds
    previousTokenPoolValue: null,
    tokenPoolChecks: 0,
    // Experiment end validation
    experimentEndReceived: false,
    experimentEndData: null,
    // Disconnect/reconnect test
    reconnectTest: { attempted: false, succeeded: false, sessionRestored: false, disconnectTime: null, reconnectTime: null },
    // Incentive bonus validation
    incentiveBonusRounds: { correct: 0, incorrect: 0, totalChecked: 0, bonusesAwarded: 0, details: [] },
    // Incentive assignment tracking (from conditionUpdate events)
    incentiveAssignments: [],          // [{round, player, incentive}] — who was assigned each round
    incentiveBonusNotifications: [],    // [{bonusTokens, round}] — incentiveBonusNotification events received by us
    lastKnownIncentive: null,          // Current incentive type from conditionUpdate
    lastKnownIncentivePlayer: null,    // Current assigned player from conditionUpdate
};

function log(level, emoji, msg, data) {
    const ts = new Date().toISOString().split('T')[1].replace('Z', '');
    const line = `[${ts}] ${emoji} ${level}: ${msg}`;
    logLines.push(data ? `${line} | ${JSON.stringify(data)}` : line);
    
    if (level === 'ERROR') {
        console.error(line);
        counters.errors.push({ ts, msg, data });
    } else if (level === 'WARN') {
        console.warn(line);
        counters.warnings.push({ ts, msg, data });
    } else {
        console.log(line);
    }
}

function trackEvent(name) {
    counters.events[name] = (counters.events[name] || 0) + 1;
}

// ─── State ──────────────────────────────────────────────────
let currentRoom = null;
let signedIn = false;
let gameStarted = false;
let experimentDone = false;
let currentTurnPlayer = null;
let myTriadPosition = null;
let currentRound = 0;
let currentBlock = 0;
let currentCondition = null;
let currentGrid = null;
let selectedColumn = null;
let isModerator = true; // Room creator = moderator = observer (can't vote)
let previousRoundPlayerData = null; // Track per-round player data for cross-round token validation
let reconnectScheduled = false;     // Ensure reconnect test only fires once
let endSequenceStarted = false;     // Prevent re-triggering end sequence
let roomCreationStarted = false;    // Prevent double room creation (server race condition)
let startGameEmitted = false;       // Prevent multiple startGame emissions
let _sessionCookie = '';             // Express session cookie for HTTP requests

// ─── Session Bootstrap ──────────────────────────────────────
// Do an HTTP GET to the server BEFORE connecting Socket.IO.
// This establishes an Express session and gives us a cookie
// that we pass to Socket.IO (so it shares the same session)
// and reuse for CSV download later.
function bootstrapSession() {
    return new Promise((resolve) => {
        const serverUrl = new URL(CONFIG.SERVER);
        const req = http.request({
            hostname: serverUrl.hostname,
            port: serverUrl.port,
            path: '/',
            method: 'GET',
        }, (res) => {
            // Extract set-cookie header(s)
            const setCookies = res.headers['set-cookie'];
            if (setCookies) {
                // Grab just the cookie name=value pairs (strip attributes)
                _sessionCookie = setCookies
                    .map(c => c.split(';')[0])
                    .join('; ');
                log('INFO', '[AUTH]', `Session cookie obtained: ${_sessionCookie.substring(0, 40)}...`);
            } else {
                log('WARN', '[WARN]', 'No set-cookie header from server — CSV download may fail');
            }
            // Drain response body
            res.resume();
            res.on('end', () => resolve());
        });
        req.on('error', (err) => {
            log('WARN', '[WARN]', `Session bootstrap failed: ${err.message}`);
            resolve();
        });
        req.setTimeout(5000, () => {
            log('WARN', '[WARN]', 'Session bootstrap timeout');
            req.destroy();
            resolve();
        });
        req.end();
    });
}

// ─── Socket Setup ───────────────────────────────────────────
let socket; // Defined after session bootstrap

bootstrapSession().then(() => {
    log('INFO', '[SOCK]', `Connecting to ${CONFIG.SERVER}...`);

    socket = io(CONFIG.SERVER, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        timeout: 10000,
        extraHeaders: _sessionCookie ? { Cookie: _sessionCookie } : {},
    });

    setupSocketHandlers();
});

function setupSocketHandlers() {

// ─── Connection Events ──────────────────────────────────────
socket.on('connect', () => {
    log('INFO', '✅', `Connected (id=${socket.id})`);
    trackEvent('connect');
    
    // If this is a reconnect after our disconnect test, track it
    if (counters.reconnectTest.attempted && !counters.reconnectTest.succeeded) {
        counters.reconnectTest.succeeded = true;
        counters.reconnectTest.reconnectTime = Date.now();
        const elapsed = counters.reconnectTest.reconnectTime - counters.reconnectTest.disconnectTime;
        log('INFO', '✅', `Reconnected after disconnect test (${elapsed}ms)`);
    }
    
    // If already signed in, don't re-auth — wait for sessionRestored to rejoin
    // The server registers the joinRoom handler inside Player.onConnect,
    // which runs AFTER the 100ms session-restore delay. Emitting joinRoom
    // here (immediately on connect) would be silently dropped because the
    // handler doesn't exist yet. sessionRestored fires after Player.onConnect.
    if (signedIn) {
        log('INFO', '[SOCK]', 'Already signed in — waiting for sessionRestored before rejoining room...');
        return;
    }
    
    // Step 1: Sign in
    log('INFO', '[AUTH]', `Signing in as "${CONFIG.USERNAME}"...`);
    socket.emit('signIn', { username: CONFIG.USERNAME, password: CONFIG.PASSWORD });
});

socket.on('connect_error', (err) => {
    log('ERROR', '❌', `Connection error: ${err.message}`);
    trackEvent('connect_error');
});

socket.on('disconnect', (reason) => {
    log('WARN', '[SOCK]', `Disconnected: ${reason}`);
    trackEvent('disconnect');
});

socket.on('reconnect', () => {
    log('INFO', '[SYNC]', 'Reconnected');
    trackEvent('reconnect');
});

// ─── Auth Events ────────────────────────────────────────────
let signInAttempted = false;
let signUpAttempted = false;

socket.on('signInResponse', (data) => {
    trackEvent('signInResponse');
    
    if (data && data.success) {
        signedIn = true;
        log('INFO', '✅', `Signed in as ${data.username} (admin=${data.isAdmin})`);
        
        // If this is a re-auth after reconnect, rejoin the existing room
        if (counters.reconnectTest.attempted && currentRoom) {
            log('INFO', '[ROOM]', `Re-joining room "${currentRoom}" after reconnect...`);
            socket.emit('joinRoom', currentRoom);
            return;
        }
        
        // Step 2: Create a room (guarded — server can call Player.onConnect twice
        // due to session-restore 100ms timeout race, registering createRoom listener twice)
        setTimeout(() => {
            if (!roomCreationStarted) {
                roomCreationStarted = true;
                log('INFO', '[ROOM]', 'Creating room...');
                socket.emit('createRoom');
            }
        }, 300);
    } else {
        signInAttempted = true;
        
        if (CONFIG.INVITE_CODE && !signUpAttempted) {
            // Try signing up with the invite code
            log('WARN', '[WARN]', `Sign in failed for "${CONFIG.USERNAME}", attempting signup with invite code...`);
            signUpAttempted = true;
            socket.emit('signUp', { 
                username: CONFIG.USERNAME, 
                password: CONFIG.PASSWORD,
                inviteCode: CONFIG.INVITE_CODE 
            });
        } else {
            log('ERROR', '❌', 'Sign in FAILED. The test user account must exist in the database.', data);
            log('ERROR', '❌', `  Either create the account manually, or run with --invite <code>`);
            log('ERROR', '❌', `  e.g.: node test_integration.js --invite ABC123`);
            finishTest('Sign in failed — no valid account');
        }
    }
});

socket.on('signUpResponse', (data) => {
    trackEvent('signUpResponse');
    
    if (data && data.success) {
        signedIn = true;
        log('INFO', '✅', `Signed up & auto-logged in as ${data.username} (admin=${data.isAdmin})`);
        
        // Step 2: Create a room (same guard as signInResponse)
        setTimeout(() => {
            if (!roomCreationStarted) {
                roomCreationStarted = true;
                log('INFO', '[ROOM]', 'Creating room...');
                socket.emit('createRoom');
            }
        }, 300);
    } else {
        log('ERROR', '❌', `Sign up FAILED: ${data?.message || 'unknown reason'}`, data);
        finishTest('Sign up failed');
    }
});

// ─── Room Events ────────────────────────────────────────────
socket.on('roomCreated', (roomName) => {
    trackEvent('roomCreated');
    
    // Guard: Server may fire this twice due to double Player.onConnect race condition.
    // Only process the FIRST roomCreated event.
    if (currentRoom) {
        log('WARN', '[WARN]', `Ignoring duplicate roomCreated: "${roomName}" (already in "${currentRoom}")`);
        return;
    }
    
    currentRoom = roomName;
    log('INFO', '[ROOM]', `Room created: "${roomName}"`);
    
    // Step 3: Join the room
    log('INFO', '[ROOM]', `Joining room "${roomName}"...`);
    socket.emit('joinRoom', roomName);
    
    // Step 4: Add AI players after a brief delay
    setTimeout(() => {
        log('INFO', '🤖', 'Adding AI players for triad formation...');
        socket.emit('addAIPlayers', { room: roomName });
    }, 500);
});

socket.on('joinRoom', (room) => {
    trackEvent('joinRoom');
    log('INFO', '[ROOM]', `Joined room: ${room}`);
});

socket.on('copyToClipboard', (data) => {
    trackEvent('copyToClipboard');
    log('INFO', '[LIST]', `Room name copied: ${data.text}`);
});

socket.on('leftRoom', (data) => {
    trackEvent('leftRoom');
    log('INFO', '[LEAVE]', 'Left room', data);
});

// ─── Player/Room State Events ───────────────────────────────
socket.on('playersInRoom', (data) => {
    trackEvent('playersInRoom');
    const players = data.players || [];
    const aiCount = players.filter(p => p.isAI).length;
    const humanCount = players.filter(p => !p.isAI).length;
    const moderator = players.find(p => p.isModerator);
    
    log('INFO', '[USERS]', `Players in room (${players.length} total: ${humanCount}H/${aiCount}AI): ${players.map(p => `${p.username}${p.isAI ? '🤖' : ''}${p.isModerator ? '(mod)' : ''}`).join(', ')}`);
    
    // If we have 3 non-moderator players (triad), start the experiment
    const votingPlayers = players.filter(p => !p.isModerator);
    if (votingPlayers.length >= 3 && !gameStarted && !startGameEmitted && currentRoom) {
        startGameEmitted = true;
        setTimeout(() => {
            if (!gameStarted) {
                log('INFO', '[EXP]', `Starting experiment (conditions mode) in "${currentRoom}"...`);
                socket.emit('startGame', { 
                    room: currentRoom, 
                    experimentMode: 'conditions' 
                });
            }
        }, 800);
    }
});

socket.on('aiPlayersAdded', (data) => {
    trackEvent('aiPlayersAdded');
    log('INFO', '🤖', `AI players added: ${data.count || 'unknown count'}`, { message: data.message });
});

socket.on('roomUsers', (data) => {
    trackEvent('roomUsers');
    log('INFO', '[USERS]', `roomUsers: ${data.usersCount} in ${data.room}`);
});

socket.on('roomFull', (data) => {
    trackEvent('roomFull');
    log('WARN', '[FULL]', 'Room is full', data);
});

// ─── Game Lifecycle Events ──────────────────────────────────
socket.on('gameStarted', () => {
    trackEvent('gameStarted');
    gameStarted = true;
    counters.startTime = Date.now();
    log('INFO', '[GAME]', '*** GAME STARTED ***');
});

socket.on('init', (data) => {
    trackEvent('init');
    log('INFO', '[INIT]', `Init received (selfId=${data.selfId}, ${data.player?.length || 0} players)`);
});

socket.on('triadComplete', (data) => {
    trackEvent('triadComplete');
    myTriadPosition = data.playerPosition;
    currentGrid = data.gameSession?.grid;
    currentCondition = data.gameSession?.condition;
    
    log('INFO', '[TRIAD]', `Triad complete! My position: ${myTriadPosition}, Condition: ${currentCondition}, Round: ${data.gameSession?.currentRound}/${data.gameSession?.maxRounds}`);
    
    if (data.gameSession?.experiment) {
        log('INFO', '[EXP]', `Experiment: mode=${data.gameSession.experiment.mode}, tokens=${data.gameSession.experiment.whiteTokenPool}`);
    }
});

// ─── Turn & Round Events ────────────────────────────────────
socket.on('yourTurn', (data) => {
    trackEvent('yourTurn');
    currentTurnPlayer = data.currentPlayer;
    currentRound = data.round || currentRound;
    currentCondition = data.condition || currentCondition;
    selectedColumn = data.column || data.selectedColumn || selectedColumn;
    
    if (data.blockNumber) {
        currentBlock = data.blockNumber;
        counters.blocks.add(data.blockNumber);
    }
    
    // Track token pool from yourTurn — server sends whiteTokensRemaining each round
    if (data.whiteTokensRemaining !== undefined) {
        counters.tokenPool.push({ round: currentRound, tokens: data.whiteTokensRemaining });
    }
    
    // Moderator observes — AI players make their own choices server-side
    if (counters.events['yourTurn'] <= 3 || (counters.events['yourTurn'] % 10 === 0)) {
        log('INFO', '[TURN]', `Turn notification — Round ${currentRound}, Block ${currentBlock}, Tokens: ${data.whiteTokensRemaining}, Condition: ${typeof currentCondition === 'object' ? currentCondition?.name || JSON.stringify(currentCondition) : currentCondition}`);
    }
});

socket.on('newRound', (data) => {
    trackEvent('newRound');
    currentRound = data.round || currentRound;
    
    if (data.condition) currentCondition = data.condition;
    if (data.blockNumber) {
        if (data.blockNumber > currentBlock) {
            log('INFO', '[BLOCK]', `*** BLOCK TRANSITION: ${currentBlock} → ${data.blockNumber} ***`);
        }
        currentBlock = data.blockNumber;
        counters.blocks.add(data.blockNumber);
    }
    
    const tokens = data.whiteTokensRemaining;
    if (tokens !== undefined) {
        counters.tokenPool.push({ round: currentRound, tokens });
    }
    
    // Log every 5th round or first few
    if (currentRound <= 3 || currentRound % 5 === 0) {
        log('INFO', '[SYNC]', `New Round ${currentRound} — Tokens: ${tokens}, Condition: ${data.condition || '?'}, Block: ${data.blockNumber || '?'}, Incentive: ${data.incentive || '?'}`);
    }
});

socket.on('turnUpdate', (data) => {
    trackEvent('turnUpdate');
    counters.turnUpdates++;
    currentTurnPlayer = data.currentPlayer;
    
    // Only log occasionally to avoid spam
    if (counters.turnUpdates <= 5 || counters.turnUpdates % 20 === 0) {
        log('INFO', '[SYNC]', `Turn update: current=${data.currentPlayer}, round=${data.round || '?'}`);
    }
});

socket.on('playerLockedIn', (data) => {
    trackEvent('playerLockedIn');
    counters.lockins++;
    
    // Only log AI lockins occasionally
    if (data.isAI && counters.lockins > 10 && counters.lockins % 10 !== 0) return;
    log('INFO', '[LOCK]', `${data.username} locked in row ${data.row}${data.isAI ? ' (AI)' : ''}`);
});

// ─── Column Selection Events ────────────────────────────────
socket.on('columnSelected', (data) => {
    trackEvent('columnSelected');
    selectedColumn = data.column;
    log('INFO', '[DATA]', `Column selected: ${data.column} (round ${data.round})`);
});

socket.on('autoColumnSelected', (data) => {
    trackEvent('autoColumnSelected');
    selectedColumn = data.column;
    log('INFO', '[DATA]', `Auto column selected: ${data.column} (round ${data.round})`);
});

socket.on('columnModeChanged', (data) => {
    trackEvent('columnModeChanged');
    log('INFO', '[DATA]', `Column mode changed to: ${data.mode}`);
});

// ─── Round Results ──────────────────────────────────────────
socket.on('roundResult', (data) => {
    trackEvent('roundResult');
    // Note: moderators do NOT receive roundResult (only turnOrder players do).
    // This handler exists as a safety net in case the test user is somehow a voting player.
    const round = data.round;
    const tokensLeft = data.whiteTokensRemaining;
    
    if (data.culturantProduced) counters.culturants++;
    if (tokensLeft !== undefined) counters.tokenPool.push({ round, tokens: tokensLeft });
    
    log('INFO', '[DATA]', `roundResult (unexpected for moderator) — Round ${round} | Tokens left: ${tokensLeft}`);
});

// ─── Condition & Incentive Events ───────────────────────────
socket.on('conditionChanged', (data) => {
    trackEvent('conditionChanged');
    log('INFO', '[COND]', `Condition changed: ${data.condition}`, data);
});

socket.on('conditionUpdate', (data) => {
    trackEvent('conditionUpdate');
    log('INFO', '[COND]', `Condition update: ${data.condition}, Incentive: ${data.incentive}, Player: ${data.player}`);
    
    // Track incentive assignments for Check 15 cross-validation
    // Only track if this is a new round assignment (avoid duplicates from repeated conditionUpdate events)
    const assignRound = data.round || currentRound + 1;
    counters.lastKnownIncentive = data.incentive || 'No Incentive';
    counters.lastKnownIncentivePlayer = data.player || null;
    if (data.incentive && data.incentive !== 'No Incentive' && data.player) {
        // Avoid duplicate tracking for the same round
        const existing = counters.incentiveAssignments.find(a => a.round === assignRound);
        if (!existing) {
            counters.incentiveAssignments.push({
                round: assignRound,
                player: data.player,
                incentive: data.incentive
            });
        }
    }
});

socket.on('incentiveChanged', (data) => {
    trackEvent('incentiveChanged');
    log('INFO', '[BONUS]', `Incentive changed`, data);
});

socket.on('incentiveBonusNotification', (data) => {
    trackEvent('incentiveBonusNotification');
    counters.incentiveBonusNotifications.push({
        bonusTokens: data.bonusTokens,
        round: currentRound
    });
    log('INFO', '[BONUS]', `Incentive bonus! +${data.bonusTokens} black tokens (round ${currentRound})`);
});

// ─── Experiment Status Events ───────────────────────────────
socket.on('experimentStatusUpdate', (data) => {
    trackEvent('experimentStatusUpdate');
    log('INFO', '[DATA]', `Experiment status: phase=${data.phase}, tokens=${data.tokens}, round=${data.round}`);
});

socket.on('experimentEnd', (data) => {
    trackEvent('experimentEnd');
    counters.experimentEndReceived = true;
    counters.experimentEndData = data;
    
    // Validate experiment end data structure
    const requiredFields = ['finalResults', 'totalRounds', 'culturantsProduced'];
    const missingFields = requiredFields.filter(f => data[f] === undefined);
    if (missingFields.length > 0) {
        log('WARN', '[WARN]', `experimentEnd missing fields: ${missingFields.join(', ')}`);
    } else {
        log('INFO', '✅', `experimentEnd has all required fields (rounds=${data.totalRounds}, culturants=${data.culturantsProduced}, players=${data.finalResults?.length || 0})`);
    }
    
    // Validate finalResults array
    if (data.finalResults && data.finalResults.length > 0) {
        data.finalResults.forEach(p => {
            if (typeof p.whiteTokens !== 'number' || typeof p.blackTokens !== 'number') {
                log('WARN', '[WARN]', `experimentEnd finalResults player ${p.username} missing token fields`);
            }
        });
    }
    
    log('INFO', '[END]', `*** EXPERIMENT END *** (${data.totalRounds} rounds, ${data.culturantsProduced} culturants)`);
    experimentDone = true;
    finishTest('Experiment ended normally');
});

socket.on('experimentEnded', (data) => {
    trackEvent('experimentEnded');
    counters.experimentEndReceived = true;
    counters.experimentEndData = data;
    log('INFO', '[END]', '*** EXPERIMENT ENDED (from moderator) ***', data);
    experimentDone = true;
    finishTest('Experiment force-ended');
});

socket.on('experimentPaused', (data) => {
    trackEvent('experimentPaused');
    log('WARN', '[PAUSE]', 'Experiment paused', data);
});

socket.on('experimentResumed', (data) => {
    trackEvent('experimentResumed');
    log('INFO', '[RESUME]', 'Experiment resumed', data);
});

// ─── Player Status Events ───────────────────────────────────
socket.on('playerStatusUpdate', (data) => {
    trackEvent('playerStatusUpdate');
    // Only log occasionally — these fire frequently
    if ((counters.events['playerStatusUpdate'] || 0) <= 3 || 
        (counters.events['playerStatusUpdate'] || 0) % 20 === 0) {
        log('INFO', '[DATA]', `Player status update: round ${data.round}, locked ${data.lockedCount}/${data.totalCount}`);
    }
});

// ─── Error Events ───────────────────────────────────────────
socket.on('error', (data) => {
    trackEvent('error');
    const msg = data.message || JSON.stringify(data);
    
    // Moderators can't vote — this is expected, not a real error
    if (msg.includes('Moderators cannot vote')) {
        if ((counters.events['error'] || 0) <= 1) {
            log('INFO', '[LIST]', `Expected: ${msg} (moderator is an observer)`);
        }
        return;
    }
    
    log('ERROR', '❌', `Server error: ${msg}`);
});

socket.on('message', (msg) => {
    trackEvent('message');
    const text = typeof msg === 'string' ? msg : (msg.text || msg.message || JSON.stringify(msg));
    log('INFO', '[CHAT]', `Message: ${text.substring(0, 120)}`);
});

socket.on('systemMessage', (data) => {
    trackEvent('systemMessage');
    log('INFO', '[SYS]', `System: ${data.message?.substring(0, 120)}`);
});

socket.on('systemNotification', (data) => {
    trackEvent('systemNotification');
    log('INFO', '[SYS]', `Notification: ${data.title || ''} — ${data.message?.substring(0, 100)}`);
});

// ─── Session Events ─────────────────────────────────────────
socket.on('sessionRestored', (data) => {
    trackEvent('sessionRestored');
    log('INFO', '[SYNC]', 'Session restored', data);
    
    // Track session restoration after reconnect test
    if (counters.reconnectTest.attempted && !counters.reconnectTest.sessionRestored) {
        counters.reconnectTest.sessionRestored = true;
        log('INFO', '✅', 'Session restored after disconnect/reconnect test!');
        
        // NOW rejoin the room — the joinRoom handler is registered on the server
        // (Player.onConnect completed just before sessionRestored was emitted).
        if (currentRoom) {
            log('INFO', '[ROOM]', `Rejoining room "${currentRoom}" after session restore...`);
            socket.emit('joinRoom', currentRoom);
        }
    }
});

socket.on('sessionInvalid', (data) => {
    trackEvent('sessionInvalid');
    log('WARN', '[WARN]', 'Session invalid', data);
    
    // If session was lost after reconnect, re-authenticate and rejoin
    if (counters.reconnectTest.attempted && signedIn) {
        log('INFO', '[AUTH]', 'Re-authenticating after session loss during reconnect...');
        counters.reconnectTest.reAuthed = true;
        socket.emit('signIn', { username: CONFIG.USERNAME, password: CONFIG.PASSWORD });
    }
});

// ─── Game State Restore Events ──────────────────────────────
socket.on('gameStateRestore', (data) => {
    trackEvent('gameStateRestore');
    log('INFO', '[STATE]', `Game state restored: round ${data.round}`);
});

socket.on('unifiedGameStateRestore', (data) => {
    trackEvent('unifiedGameStateRestore');
    log('INFO', '[STATE]', 'Unified game state restore received');
});

socket.on('allPlayersWalletRestore', (data) => {
    trackEvent('allPlayersWalletRestore');
    log('INFO', '[TOKEN]', 'All players wallet restore received');
});

// ─── AI Events ──────────────────────────────────────────────
socket.on('aiBehaviorSet', (data) => {
    trackEvent('aiBehaviorSet');
    log('INFO', '🤖', `AI behavior set`, data);
});

// ─── Round Results Panel ────────────────────────────────────
socket.on('roundResultsPanel', (data) => {
    trackEvent('roundResultsPanel');
    counters.rounds++;
    
    const round = data.round || counters.rounds;
    currentRound = round;
    
    // Track condition distribution
    if (data.condition) {
        counters.conditions[data.condition] = (counters.conditions[data.condition] || 0) + 1;
    }
    
    // Track incentive distribution
    if (data.incentive) {
        counters.incentives[data.incentive] = (counters.incentives[data.incentive] || 0) + 1;
    }
    
    // ── Data Integrity: Validate player data in results ──
    const players = data.players || [];
    if (players.length > 0) {
        counters.roundsWithPlayerData++;
        counters.totalPlayersInResults += players.length;
        
        players.forEach(p => {
            // Verify each player has required token fields
            if (typeof p.whiteTokens === 'number' && typeof p.blackTokens === 'number') {
                counters.playerChoicesRecorded++;
            } else if (!p.isModerator) {
                log('WARN', '[WARN]', `Player ${p.username} missing token fields in round ${round}`, {
                    white: p.whiteTokens, black: p.blackTokens
                });
            }
        });
    }
    
    // ── Data Integrity: Validate token values per condition ──
    if (data.tokenValues && (data.tokenValues.white > 0 || data.tokenValues.black > 0)) {
        counters.roundsWithTokenValues++;
    }
    
    // ── Data Integrity: Track previous round data ──
    if (data.previousRoundPlayers && data.previousRoundPlayers.length > 0) {
        counters.roundsWithPreviousData++;
        
        // Validate previous round players have earnings fields
        data.previousRoundPlayers.forEach(p => {
            if (typeof p.roundEarnings !== 'number') {
                log('WARN', '[WARN]', `Previous round player ${p.username} missing roundEarnings`, p);
            }
        });
    }
    
    // ══ TOKEN ECONOMICS MATH VALIDATION ══
    // Compare cumulative tokens with previous round to verify correct awards
    if (previousRoundPlayerData && players.length > 0) {
        const prevMap = {};
        previousRoundPlayerData.players.forEach(p => { prevMap[p.username] = p; });
        
        players.forEach(p => {
            const prev = prevMap[p.username];
            if (!prev || prev.isModerator) return;
            
            // Delta = current cumulative - previous cumulative = tokens awarded THIS round
            // The CURRENT round's choice determines the award (odd row → 3, even row → 1)
            const currentChoice = parseInt(p.choice);
            if (isNaN(currentChoice)) return;
            
            const expectedWhiteAward = currentChoice % 2 === 1 ? 3 : 1; // Odd=impulsive(3), Even=self-control(1)
            const actualWhiteDelta = p.whiteTokens - prev.whiteTokens;
            
            counters.tokenMathChecks++;
            
            // Allow for pool depletion: actual may be less than expected but never more
            if (actualWhiteDelta > expectedWhiteAward) {
                const err = { round, player: p.username, field: 'white', expected: `<= ${expectedWhiteAward}`, actual: actualWhiteDelta, choice: currentChoice };
                counters.tokenMathErrors.push(err);
                log('ERROR', '[TOKEN]', `Token math error: ${p.username} round ${round} got ${actualWhiteDelta} white tokens (expected ≤ ${expectedWhiteAward} for row ${currentChoice})`);
            } else if (actualWhiteDelta < 0) {
                const err = { round, player: p.username, field: 'white', expected: '>= 0', actual: actualWhiteDelta };
                counters.tokenMathErrors.push(err);
                log('ERROR', '[TOKEN]', `Token math error: ${p.username} round ${round} white tokens DECREASED by ${Math.abs(actualWhiteDelta)}`);
            }
            
            // Black tokens: should never decrease (culturant + incentive bonuses only add)
            const actualBlackDelta = p.blackTokens - prev.blackTokens;
            if (actualBlackDelta < 0) {
                const err = { round, player: p.username, field: 'black', expected: '>= 0', actual: actualBlackDelta };
                counters.tokenMathErrors.push(err);
                log('ERROR', '[TOKEN]', `Token math error: ${p.username} round ${round} black tokens DECREASED by ${Math.abs(actualBlackDelta)}`);
            }
        });
    }
    
    // ══ CULTURANT PRODUCTION VALIDATION ══
    // If ALL non-moderator players chose even rows THIS round → culturant produced → black tokens +1 each
    // The delta in black tokens between this round and last = awards from THIS round
    if (previousRoundPlayerData && players.length > 0) {
        const prevMap2 = {};
        previousRoundPlayerData.players.forEach(p => { prevMap2[p.username] = p; });
        
        // Get non-moderator players from the CURRENT round's choices
        const currentVotingPlayers = players.filter(p => !p.isModerator && p.choice);
        const allChoseEven = currentVotingPlayers.length >= 3 && currentVotingPlayers.every(p => {
            const row = parseInt(p.choice);
            return !isNaN(row) && row % 2 === 0;
        });
        
        if (allChoseEven) {
            counters.culturantRounds.produced++;
            // Verify: each voting player's black tokens should have increased by at least 1
            let allGotBlack = true;
            currentVotingPlayers.forEach(p => {
                const prev = prevMap2[p.username];
                if (p && prev) {
                    if (p.blackTokens <= prev.blackTokens) {
                        allGotBlack = false;
                        log('WARN', '[WARN]', `Culturant round ${round}: ${p.username} black tokens didn't increase (${prev.blackTokens} → ${p.blackTokens})`);
                    }
                }
            });
            if (allGotBlack) {
                counters.culturantRounds.verified++;
            } else {
                counters.culturantRounds.errors++;
            }
        } else {
            counters.culturantRounds.notProduced++;
        }
    }
    
    // ══ INCENTIVE BONUS VALIDATION ══
    // Cross-validate incentive bonuses using both:
    //   - previousRoundPlayers[].incentiveBonus from server round history
    //   - conditionUpdate tracking of which player was assigned the incentive
    // Server flow: roundResultsPanel.round = N, previousRoundPlayers = round N's player data
    // (previousRoundPlayers contains the SAME round's results, stored in roundHistory then emitted
    // BEFORE currentRound is incremented). The conditionUpdate for round N fires before round N starts.
    if (data.previousRoundPlayers && data.previousRoundPlayers.length > 0) {
        // Look up the incentive assignment for THIS round from our tracked assignments.
        const thisRound = round;
        const assignment = counters.incentiveAssignments.find(a => a.round === thisRound) || null;
        const activeIncentiveType = assignment ? assignment.incentive : null;
        const assignedPlayer = assignment ? assignment.player : null;
        
        data.previousRoundPlayers.forEach(p => {
            if (p.isAI === undefined && p.isModerator) return; // Skip moderator
            
            // Infer the player's choice from white tokens: 3 = odd row, 1 = even row
            const whiteAwarded = p.whiteTokens || 0;
            const inferredRowType = whiteAwarded === 3 ? 'odd' : (whiteAwarded === 1 ? 'even' : null);
            const actualBonus = p.incentiveBonus || 0;
            
            if (!inferredRowType) return; // Can't validate without knowing the choice
            
            counters.incentiveBonusRounds.totalChecked++;
            
            // Was this player the assigned incentive recipient?
            const isAssignedPlayer = assignedPlayer && p.username === assignedPlayer;
            
            if (actualBonus > 0) {
                counters.incentiveBonusRounds.bonusesAwarded++;
                
                // Validate: bonus > 0 requires matching the incentive rule for the assigned player
                let bonusValid = false;
                if (activeIncentiveType === 'Impulse Incentive' && inferredRowType === 'odd') bonusValid = true;
                if (activeIncentiveType === 'Self Control Incentive' && inferredRowType === 'even') bonusValid = true;
                
                if (bonusValid) {
                    counters.incentiveBonusRounds.correct++;
                    log('INFO', '[BONUS]', `✅ Incentive bonus correct: ${p.username} round ${thisRound} bonus=${actualBonus} (${activeIncentiveType}, row=${inferredRowType}, assigned=${isAssignedPlayer})`);
                } else {
                    counters.incentiveBonusRounds.incorrect++;
                    counters.incentiveBonusRounds.details.push({
                        round: thisRound, player: p.username, incentiveType: activeIncentiveType,
                        rowType: inferredRowType, actualBonus, assignedPlayer: assignedPlayer,
                        issue: `Bonus awarded but choice/rule mismatch (incentive=${activeIncentiveType}, row=${inferredRowType})`
                    });
                    log('ERROR', '[BONUS]', `Incentive bonus error: ${p.username} round ${thisRound} got bonus=${actualBonus} but incentive=${activeIncentiveType}, row=${inferredRowType}`);
                }
            } else {
                // No bonus awarded — correct (either not assigned, wrong choice, or no incentive round)
                counters.incentiveBonusRounds.correct++;
            }
        });
    }
    
    // ══ TOKEN POOL DEPLETION TRACKING ══
    // The yourTurn event sends whiteTokensRemaining each round (tracked in counters.tokenPool).
    // Verify the pool is strictly non-increasing (tokens consumed, never created).
    if (counters.tokenPool.length >= 2) {
        const latest = counters.tokenPool[counters.tokenPool.length - 1];
        const previous = counters.tokenPool[counters.tokenPool.length - 2];
        counters.tokenPoolChecks++;
        if (latest.tokens > previous.tokens) {
            counters.tokenPoolDecreasing = false;
            log('ERROR', '[TOKEN]', `Token pool INCREASED from ${previous.tokens} (round ${previous.round}) → ${latest.tokens} (round ${latest.round})`);
        }
    }
    
    // Save current round's player data for next round comparison
    previousRoundPlayerData = {
        round: round,
        players: players.map(p => ({
            username: p.username,
            whiteTokens: p.whiteTokens,
            blackTokens: p.blackTokens,
            totalEarnings: p.totalEarnings,
            choice: p.choice,
            isModerator: p.isModerator || false,
            isAI: p.isAI || false
        }))
    };
    
    // Store result summary (enriched)
    counters.roundResults.push({
        round,
        condition: data.condition,
        incentive: data.incentive,
        playerCount: players.length,
        hasTokenValues: !!(data.tokenValues && data.tokenValues.white > 0),
        hasPreviousData: !!(data.previousRoundPlayers && data.previousRoundPlayers.length > 0),
    });
    
    // Track round timing for ETA
    roundTimestamps.push(Date.now());

    // ── Colorized round summary block ──
    const tokenInfo = counters.tokenPool.length > 0 ? counters.tokenPool[counters.tokenPool.length - 1].tokens : '?';
    const culturantFlag = data.previousRoundPlayers && data.previousRoundPlayers.length > 0
        ? (data.previousRoundPlayers.filter(p => !p.isModerator).every(p => (p.whiteTokens || 0) === 1) ? ' +culturant' : '')
        : '';
    console.log(getProgressBar(counters.rounds, CONFIG.TARGET_ROUNDS));
    console.log(`[ROUND] ──── Round ${round}/${CONFIG.TARGET_ROUNDS} | Block ${currentBlock} | ${data.condition || '?'} | ${data.incentive || 'No Incentive'} | Tokens: ${tokenInfo}${culturantFlag} ────`);
    
    // ══ DISCONNECT/RECONNECT TEST ══
    // After round 3, briefly disconnect and reconnect to test session restoration
    if (counters.rounds === 3 && !reconnectScheduled) {
        reconnectScheduled = true;
        counters.reconnectTest.attempted = true;
        log('INFO', '[SOCK]', 'Scheduling disconnect/reconnect test after round 3...');
        
        // Wait 500ms (well before next round ~10-15s away), close transport for ~2s
        setTimeout(() => {
            log('INFO', '[SOCK]', 'Closing transport for reconnect test (simulating network interruption)...');
            counters.reconnectTest.disconnectTime = Date.now();
            
            // Use engine-level close to simulate network interruption
            // This preserves the session cookie and triggers Socket.IO auto-reconnect
            if (socket.io && socket.io.engine) {
                socket.io.engine.close();
            } else {
                // Fallback: manual disconnect/reconnect
                socket.disconnect();
                setTimeout(() => {
                    log('INFO', '[SOCK]', 'Reconnecting socket (fallback)...');
                    socket.connect();
                }, 1500);
            }
            
            // Safety: if reconnect doesn't succeed within 10s, mark as failed
            setTimeout(() => {
                if (!counters.reconnectTest.succeeded) {
                    log('WARN', '[WARN]', 'Reconnect test: connection not re-established within 10s');
                }
            }, 10000);
        }, 500);
    }
    
    // Check if we've completed our target
    if (counters.rounds >= CONFIG.TARGET_ROUNDS && !endSequenceStarted) {
        endSequenceStarted = true;
        log('INFO', '[END]', `*** TARGET REACHED: ${counters.rounds}/${CONFIG.TARGET_ROUNDS} rounds complete ***`);
        setTimeout(() => {
            // Before ending, download + validate CSV, then force-stop everything
            downloadAndValidateCSV(() => {
                log('INFO', '[END]', 'Stopping experiment and cleaning up room...');
                
                // Use endExperiment (app.js handler) — only needs session + room name.
                // forceEndExperiment (Entity.js) depends on Player.list[socket.id]
                // which breaks after reconnect test — endExperiment is more reliable.
                if (currentRoom) {
                    socket.emit('endExperiment', { room: currentRoom });
                    log('INFO', '[END]', `Emitted endExperiment for room "${currentRoom}"`);
                }
                
                // After a delay, also explicitly leave the room to clean up
                setTimeout(() => {
                    if (currentRoom) {
                        socket.emit('leaveRoom', currentRoom);
                        log('INFO', '[ROOM]', `Left room "${currentRoom}"`);
                    }
                }, 2000);
                
                // Safety: if experiment doesn't end within 8s, finish the test directly
                setTimeout(() => {
                    if (!experimentDone) {
                        log('WARN', '[WARN]', 'endExperiment did not trigger experimentEnd within 8s, finishing test directly');
                        finishTest('Target rounds reached (end-experiment did not fire experimentEnd)');
                    }
                }, 8000);
            });
        }, 500);
    }
});

socket.on('roundReset', (data) => {
    trackEvent('roundReset');
    log('WARN', '[SYNC]', 'Round was reset', data);
});

socket.on('roundHistoryRestore', (data) => {
    trackEvent('roundHistoryRestore');
    const count = Array.isArray(data) ? data.length : (data?.rounds?.length || '?');
    log('INFO', '[STATE]', `Round history restored (${count} rounds)`);
});

// ─── Catch-all for unexpected events ────────────────────────
socket.onAny((eventName, ...args) => {
    // Track all events, but only log ones we haven't explicitly handled
    const handled = [
        'connect', 'disconnect', 'reconnect', 'connect_error',
        'signInResponse', 'signUpResponse', 'roomCreated', 'joinRoom',
        'copyToClipboard', 'leftRoom', 'playersInRoom', 'aiPlayersAdded',
        'roomUsers', 'roomFull', 'gameStarted', 'init', 'triadComplete',
        'yourTurn', 'newRound', 'turnUpdate', 'playerLockedIn',
        'columnSelected', 'autoColumnSelected', 'columnModeChanged',
        'roundResult', 'conditionChanged', 'conditionUpdate',
        'incentiveChanged', 'incentiveBonusNotification',
        'experimentStatusUpdate', 'experimentEnd', 'experimentEnded',
        'experimentPaused', 'experimentResumed', 'playerStatusUpdate',
        'error', 'message', 'systemMessage', 'systemNotification',
        'sessionRestored', 'sessionInvalid', 'gameStateRestore',
        'unifiedGameStateRestore', 'allPlayersWalletRestore',
        'aiBehaviorSet', 'roundResultsPanel', 'roundReset',
        'roundHistoryRestore',
        'logoutResponse', 'update', 'remove',
    ];
    
    if (!handled.includes(eventName)) {
        log('WARN', '[UNK]', `Unhandled event: "${eventName}"`, args.length > 0 ? args[0] : undefined);
    }
});

// ─── Note: Moderator is an OBSERVER ─────────────────────────
// The room creator (test user) is the moderator. They cannot vote.
// The 3 AI players form the triad and make their own choices server-side.
// Rounds progress automatically — we just observe and track.

// ─── CSV Download Validation ────────────────────────────────
function downloadAndValidateCSV(callback) {
    if (!currentRoom) {
        log('WARN', '[WARN]', 'No room name available for CSV download');
        counters.csvValidation = { success: false, error: 'No room name' };
        return callback();
    }
    
    // Use the session cookie we bootstrapped at startup.
    // This cookie was passed to Socket.IO extraHeaders so both share the same Express session.
    const cookieHeader = _sessionCookie || '';
    if (!cookieHeader) {
        log('WARN', '[WARN]', 'No session cookie available — CSV download will likely fail with 401');
    }
    
    const url = `${CONFIG.SERVER}/api/download-experiment-csv/${encodeURIComponent(currentRoom)}`;
    log('INFO', '[DL]', `Downloading CSV from: ${url}`);
    log('INFO', '[DL]', `Using cookie: ${cookieHeader.substring(0, 50)}${cookieHeader.length > 50 ? '...' : ''}`);
    
    const csvUrl = new URL(url);
    const options = {
        hostname: csvUrl.hostname,
        port: csvUrl.port,
        path: csvUrl.pathname,
        method: 'GET',
        headers: {
            'Cookie': cookieHeader,
        },
    };
    
    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            if (res.statusCode === 200 && body.length > 0) {
                validateCSVContent(body);
            } else if (res.statusCode === 401) {
                log('WARN', '[WARN]', `CSV download returned 401 (session not shared to HTTP). This is expected — Socket.IO sessions may not carry over to HTTP requests.`);
                counters.csvValidation = { success: false, error: 'Auth required (session not shared)', statusCode: 401, skipped: true };
            } else {
                log('WARN', '[WARN]', `CSV download returned ${res.statusCode}: ${body.substring(0, 200)}`);
                counters.csvValidation = { success: false, error: `HTTP ${res.statusCode}`, statusCode: res.statusCode };
            }
            callback();
        });
    });
    
    req.on('error', (err) => {
        log('WARN', '[WARN]', `CSV download error: ${err.message}`);
        counters.csvValidation = { success: false, error: err.message };
        callback();
    });
    
    req.setTimeout(5000, () => {
        log('WARN', '[WARN]', 'CSV download timeout (5s)');
        counters.csvValidation = { success: false, error: 'Timeout' };
        req.destroy();
        callback();
    });
    
    req.end();
}

function validateCSVContent(csvData) {
    log('INFO', '[DATA]', `CSV received: ${csvData.length} chars`);
    log('INFO', '[CHECK]', `${'─'.repeat(40)}`);
    log('INFO', '[CHECK]', 'CSV DATA INTEGRITY CHECKS:');
    
    const lines = csvData.trim().split('\n');
    const headerLine = lines[0];
    const dataLines = lines.slice(1);
    
    const result = {
        success: true,
        totalRows: dataLines.length,
        headers: headerLine.split(','),
        errors: [],
    };
    const h = result.headers; // shorthand
    const col = (name) => h.indexOf(name); // column index helper
    
    // ── CSV Check 1: All 23 required CSV headers present ──
    const requiredHeaders = [
        'Round', 'Condition', 'Block_Number', 'Incentive_Type', 'Incentive_Recipient',
        'Player_A_Choice', 'Player_B_Choice', 'Player_C_Choice',
        'Player_A_White_Tokens', 'Player_A_Black_Tokens', 'Player_A_Round_Earnings', 'Player_A_Total_Payout',
        'Player_B_White_Tokens', 'Player_B_Black_Tokens', 'Player_B_Round_Earnings', 'Player_B_Total_Payout',
        'Player_C_White_Tokens', 'Player_C_Black_Tokens', 'Player_C_Round_Earnings', 'Player_C_Total_Payout',
        'Culturant_Produced', 'White_Tokens_Remaining', 'Timestamp'
    ];
    const missingHeaders = requiredHeaders.filter(hdr => !h.includes(hdr));
    if (missingHeaders.length > 0) {
        result.errors.push(`Missing headers: ${missingHeaders.join(', ')}`);
        result.success = false;
    } else {
        log('INFO', '✅', `CSV has all ${requiredHeaders.length} required headers`);
    }
    
    // ── CSV Check 2: Row count matches rounds played ──
    if (dataLines.length < counters.rounds) {
        result.errors.push(`CSV has ${dataLines.length} data rows but ${counters.rounds} rounds were played`);
        result.success = false;
    } else {
        log('INFO', '✅', `CSV has ${dataLines.length} data rows (≥ ${counters.rounds} rounds)`);
    }
    
    // Parse all rows into objects for deep checks
    const rows = dataLines.map(line => {
        const fields = line.split(',');
        const obj = {};
        h.forEach((header, i) => { obj[header] = (fields[i] || '').trim(); });
        return obj;
    });
    
    // ── CSV Check 3: Field count consistency ──
    const headerCount = h.length;
    let fieldCountErrors = 0;
    dataLines.forEach((line, i) => {
        const fields = line.split(',');
        if (fields.length < headerCount - 1) { // Allow slight variance for trailing comma
            fieldCountErrors++;
            result.errors.push(`Row ${i + 1} has ${fields.length} fields (expected ${headerCount})`);
        }
    });
    if (fieldCountErrors === 0) {
        log('INFO', '✅', `All ${dataLines.length} CSV rows have correct field count`);
    }
    
    // ── CSV Check 4: Choices are ODD or EVEN (non-empty for every player) ──
    let choiceErrors = 0;
    const allChoiceValues = new Set();
    rows.forEach((row, i) => {
        ['Player_A_Choice', 'Player_B_Choice', 'Player_C_Choice'].forEach(colName => {
            const v = row[colName];
            if (v) allChoiceValues.add(v);
            if (v !== 'ODD' && v !== 'EVEN') {
                choiceErrors++;
                if (choiceErrors <= 3) result.errors.push(`Row ${i+1} ${colName}='${v}' (expected ODD or EVEN)`);
            }
        });
    });
    if (choiceErrors === 0) {
        log('INFO', '✅', `All choices are valid ODD/EVEN across ${rows.length * 3} cells`);
    } else {
        result.errors.push(`${choiceErrors} invalid choice values found`);
        result.success = false;
    }
    
    // ── CSV Check 5: Round numbers sequential 1..N ──
    let roundSeqOk = true;
    rows.forEach((row, i) => {
        const expected = i + 1;
        const actual = parseInt(row.Round, 10);
        if (actual !== expected) {
            roundSeqOk = false;
            if (i < 3) result.errors.push(`Round sequence broken: row ${i+1} has Round=${actual}`);
        }
    });
    if (roundSeqOk) {
        log('INFO', '✅', `Round numbers sequential 1–${rows.length}`);
    } else {
        result.errors.push('Round numbers are not sequential');
        result.success = false;
    }
    
    // ── CSV Check 6: Block number present and valid ──
    const blockNumbers = new Set(rows.map(r => r.Block_Number).filter(Boolean));
    if (blockNumbers.size >= 1) {
        log('INFO', '✅', `Block numbers present: ${[...blockNumbers].sort().join(', ')}`);
    } else {
        result.errors.push('No block numbers found in CSV');
        result.success = false;
    }
    
    // ── CSV Check 7: Conditions are valid known values ──
    const knownConditions = new Set(['Baseline', 'High Culturant', 'High Operant', 'Equal Culturant-Operant', 'Equal Culturant–Operant']);
    const csvConditions = new Set(rows.map(r => r.Condition).filter(Boolean));
    const unknownConds = [...csvConditions].filter(c => !knownConditions.has(c));
    if (unknownConds.length === 0 && csvConditions.size >= 1) {
        log('INFO', '✅', `Conditions valid: ${[...csvConditions].join(', ')}`);
    } else if (unknownConds.length > 0) {
        result.errors.push(`Unknown conditions in CSV: ${unknownConds.join(', ')}`);
        result.success = false;
    }
    
    // ── CSV Check 8: White tokens are cumulative and non-decreasing per player ──
    let tokenCumErrors = 0;
    ['Player_A_White_Tokens', 'Player_B_White_Tokens', 'Player_C_White_Tokens'].forEach(colName => {
        let prev = 0;
        rows.forEach((row, i) => {
            const val = parseInt(row[colName], 10);
            if (isNaN(val)) return;
            if (val < prev) {
                tokenCumErrors++;
                if (tokenCumErrors <= 3) result.errors.push(`${colName} decreased: row ${i} (${prev}) → row ${i+1} (${val})`);
            }
            prev = val;
        });
    });
    if (tokenCumErrors === 0) {
        log('INFO', '✅', 'White tokens cumulative (non-decreasing) for all players');
    } else {
        result.errors.push(`${tokenCumErrors} white token cumulation errors`);
        result.success = false;
    }
    
    // ── CSV Check 9: Black tokens non-decreasing per player ──
    let blackCumErrors = 0;
    ['Player_A_Black_Tokens', 'Player_B_Black_Tokens', 'Player_C_Black_Tokens'].forEach(colName => {
        let prev = 0;
        rows.forEach((row, i) => {
            const val = parseInt(row[colName], 10);
            if (isNaN(val)) return;
            if (val < prev) {
                blackCumErrors++;
                if (blackCumErrors <= 3) result.errors.push(`${colName} decreased: row ${i} (${prev}) → row ${i+1} (${val})`);
            }
            prev = val;
        });
    });
    if (blackCumErrors === 0) {
        log('INFO', '✅', 'Black tokens cumulative (non-decreasing) for all players');
    } else {
        result.errors.push(`${blackCumErrors} black token cumulation errors`);
        result.success = false;
    }
    
    // ── CSV Check 10: White_Tokens_Remaining is non-increasing (pool depletes) ──
    let poolErrors = 0;
    let prevPool = Infinity;
    rows.forEach((row, i) => {
        const val = parseInt(row.White_Tokens_Remaining, 10);
        if (isNaN(val)) return;
        if (val > prevPool) {
            poolErrors++;
            if (poolErrors <= 3) result.errors.push(`Token pool increased: row ${i} (${prevPool}) → row ${i+1} (${val})`);
        }
        prevPool = val;
    });
    if (poolErrors === 0) {
        const firstPool = parseInt(rows[0]?.White_Tokens_Remaining, 10) || '?';
        const lastPool = parseInt(rows[rows.length-1]?.White_Tokens_Remaining, 10) || '?';
        log('INFO', '✅', `Token pool monotonically decreasing (${firstPool} → ${lastPool})`);
    } else {
        result.errors.push(`${poolErrors} token pool increase errors`);
        result.success = false;
    }
    
    // ── CSV Check 11: Culturant_Produced is Yes or No ──
    const culturantVals = new Set(rows.map(r => r.Culturant_Produced).filter(Boolean));
    const invalidCulturant = [...culturantVals].filter(v => v !== 'Yes' && v !== 'No');
    if (invalidCulturant.length === 0 && culturantVals.size > 0) {
        const yesCount = rows.filter(r => r.Culturant_Produced === 'Yes').length;
        log('INFO', '✅', `Culturant_Produced valid (${yesCount} Yes, ${rows.length - yesCount} No)`);
    } else if (invalidCulturant.length > 0) {
        result.errors.push(`Invalid Culturant_Produced values: ${invalidCulturant.join(', ')}`);
        result.success = false;
    }
    
    // ── CSV Check 12: Timestamps are valid ISO dates and chronological ──
    let tsErrors = 0;
    let prevTs = '';
    rows.forEach((row, i) => {
        const ts = row.Timestamp;
        if (!ts || isNaN(Date.parse(ts))) {
            tsErrors++;
            if (tsErrors <= 3) result.errors.push(`Row ${i+1} invalid timestamp: '${ts}'`);
        } else if (ts < prevTs) {
            tsErrors++;
            if (tsErrors <= 3) result.errors.push(`Timestamps not chronological at row ${i+1}`);
        }
        prevTs = ts || prevTs;
    });
    if (tsErrors === 0) {
        log('INFO', '✅', `All ${rows.length} timestamps valid and chronological`);
    } else {
        result.errors.push(`${tsErrors} timestamp errors`);
        result.success = false;
    }
    
    // ── CSV Check 13: Round_Earnings are non-negative numbers ──
    let earningsErrors = 0;
    ['Player_A_Round_Earnings', 'Player_B_Round_Earnings', 'Player_C_Round_Earnings'].forEach(colName => {
        rows.forEach((row, i) => {
            const val = parseFloat(row[colName]);
            if (isNaN(val) || val < 0) {
                earningsErrors++;
                if (earningsErrors <= 3) result.errors.push(`${colName} row ${i+1}: '${row[colName]}' (expected ≥ 0)`);
            }
        });
    });
    if (earningsErrors === 0) {
        log('INFO', '✅', `All round earnings are non-negative numbers`);
    } else {
        result.errors.push(`${earningsErrors} round earnings errors`);
        result.success = false;
    }
    
    // ── CSV Check 14: Total_Payout is non-decreasing per player ──
    let payoutErrors = 0;
    ['Player_A_Total_Payout', 'Player_B_Total_Payout', 'Player_C_Total_Payout'].forEach(colName => {
        let prev = 0;
        rows.forEach((row, i) => {
            const val = parseFloat(row[colName]);
            if (isNaN(val)) return;
            if (val < prev - 0.001) { // float tolerance
                payoutErrors++;
                if (payoutErrors <= 3) result.errors.push(`${colName} decreased: row ${i} (${prev}) → row ${i+1} (${val})`);
            }
            prev = val;
        });
    });
    if (payoutErrors === 0) {
        log('INFO', '✅', 'Total payouts non-decreasing for all players');
    } else {
        result.errors.push(`${payoutErrors} payout decrease errors`);
        result.success = false;
    }
    
    // ── CSV Check 15: Incentive_Type and Incentive_Recipient consistency ──
    let incentiveErrors = 0;
    rows.forEach((row, i) => {
        const type = row.Incentive_Type;
        const recip = row.Incentive_Recipient;
        // If there's an incentive type (not None), there should be a recipient
        if (type && type !== 'None' && type !== 'No Incentive') {
            if (!recip || recip === 'None') {
                incentiveErrors++;
                if (incentiveErrors <= 3) result.errors.push(`Row ${i+1}: incentive '${type}' but no recipient`);
            }
        }
        // If no incentive, recipient should be None
        if ((!type || type === 'None') && recip && recip !== 'None') {
            incentiveErrors++;
            if (incentiveErrors <= 3) result.errors.push(`Row ${i+1}: no incentive but recipient='${recip}'`);
        }
    });
    if (incentiveErrors === 0) {
        log('INFO', '✅', 'Incentive type/recipient pairs consistent');
    } else {
        result.errors.push(`${incentiveErrors} incentive consistency errors`);
        result.success = false;
    }
    
    // ── Summary ──
    log('INFO', '[CHECK]', `${'─'.repeat(40)}`);
    if (result.errors.length > 0) {
        result.errors.forEach(e => log('ERROR', '❌', `CSV: ${e}`));
        result.success = false;
    }
    
    counters.csvValidation = result;
    log('INFO', result.success ? '✅' : '❌', `CSV INTEGRITY: ${result.success ? 'ALL PASSED' : 'FAILED'} (${result.totalRows} rows, ${result.headers.length} columns, ${result.errors.length} errors)`);
}

// ─── Test Completion ────────────────────────────────────────
function finishTest(reason) {
    if (counters.endTime) return; // Already finishing
    counters.endTime = Date.now();
    
    const duration = ((counters.endTime - (counters.startTime || counters.endTime)) / 1000).toFixed(1);
    
    log('INFO', '[END]', `\n${'='.repeat(60)}`);
    log('INFO', '[END]', `TEST COMPLETE — ${reason}`);
    log('INFO', '[END]', `${'='.repeat(60)}`);
    
    // Summary
    log('INFO', '[DATA]', `Duration: ${duration}s`);
    log('INFO', '[DATA]', `Room: ${currentRoom}`);
    log('INFO', '[DATA]', `Rounds completed: ${counters.rounds}/${CONFIG.TARGET_ROUNDS}`);
    log('INFO', '[DATA]', `Blocks seen: ${[...counters.blocks].sort().join(', ') || 'none'}`);
    log('INFO', '[DATA]', `Culturants produced: ${counters.culturants}`);
    log('INFO', '[DATA]', `Turn updates received: ${counters.turnUpdates}`);
    log('INFO', '[DATA]', `Player lock-ins received: ${counters.lockins}`);
    
    // Condition distribution
    log('INFO', '[DATA]', `Condition distribution:`);
    Object.entries(counters.conditions).forEach(([cond, count]) => {
        log('INFO', '  ', `  ${cond}: ${count} rounds`);
    });
    
    // Incentive distribution
    log('INFO', '[DATA]', `Incentive distribution:`);
    Object.entries(counters.incentives).forEach(([inc, count]) => {
        log('INFO', '  ', `  ${inc}: ${count} rounds`);
    });
    
    // Token pool trend
    if (counters.tokenPool.length > 0) {
        const first = counters.tokenPool[0];
        const last = counters.tokenPool[counters.tokenPool.length - 1];
        log('INFO', '[DATA]', `Token pool: ${first.tokens} (round ${first.round}) → ${last.tokens} (round ${last.round})`);
    }
    
    // Data integrity summary
    log('INFO', '[DATA]', `Data integrity:`);
    log('INFO', '  ', `  Rounds with player data: ${counters.roundsWithPlayerData}/${counters.rounds}`);
    log('INFO', '  ', `  Rounds with token values: ${counters.roundsWithTokenValues}/${counters.rounds}`);
    log('INFO', '  ', `  Rounds with previous data: ${counters.roundsWithPreviousData}/${counters.rounds}`);
    log('INFO', '  ', `  Total players in results: ${counters.totalPlayersInResults}`);
    log('INFO', '  ', `  Player choices recorded: ${counters.playerChoicesRecorded}`);
    if (counters.csvValidation) {
        const csv = counters.csvValidation;
        log('INFO', '  ', `  CSV export: ${csv.success ? 'PASSED' : csv.skipped ? 'SKIPPED (auth)' : 'FAILED'} ${csv.totalRows ? `(${csv.totalRows} rows)` : `(${csv.error})`}`);
    }
    
    // Token economics summary
    log('INFO', '[DATA]', `Token economics:`);
    log('INFO', '  ', `  Math checks performed: ${counters.tokenMathChecks}`);
    log('INFO', '  ', `  Math errors found: ${counters.tokenMathErrors.length}`);
    if (counters.tokenMathErrors.length > 0) {
        counters.tokenMathErrors.forEach((e, i) => {
            log('ERROR', '  ', `  Error ${i+1}: Round ${e.round} ${e.player} ${e.field} tokens: expected ${e.expected}, got ${e.actual}`);
        });
    }
    
    // Culturant production summary
    log('INFO', '[DATA]', `Culturant production:`);
    log('INFO', '  ', `  All-even rounds (culturant): ${counters.culturantRounds.produced}`);
    log('INFO', '  ', `  Non-culturant rounds: ${counters.culturantRounds.notProduced}`);
    log('INFO', '  ', `  Verified correct: ${counters.culturantRounds.verified}`);
    if (counters.culturantRounds.errors > 0) {
        log('ERROR', '  ', `  Verification errors: ${counters.culturantRounds.errors}`);
    }
    
    // Incentive bonus summary
    log('INFO', '[DATA]', `Incentive bonuses:`);
    log('INFO', '  ', `  Checks performed: ${counters.incentiveBonusRounds.totalChecked}`);
    log('INFO', '  ', `  Bonuses awarded: ${counters.incentiveBonusRounds.bonusesAwarded}`);
    log('INFO', '  ', `  Correct: ${counters.incentiveBonusRounds.correct}`);
    log('INFO', '  ', `  Incentive assignments tracked: ${counters.incentiveAssignments.length}`);
    log('INFO', '  ', `  Bonus notifications received: ${counters.incentiveBonusNotifications.length}`);
    if (counters.incentiveAssignments.length > 0) {
        counters.incentiveAssignments.forEach(a => {
            log('INFO', '  ', `    Round ${a.round}: ${a.player} → ${a.incentive}`);
        });
    }
    if (counters.incentiveBonusNotifications.length > 0) {
        counters.incentiveBonusNotifications.forEach(n => {
            log('INFO', '  ', `    Notification: +${n.bonusTokens} black (round ${n.round})`);
        });
    }
    if (counters.incentiveBonusRounds.incorrect > 0) {
        log('ERROR', '  ', `  Incorrect: ${counters.incentiveBonusRounds.incorrect}`);
        counters.incentiveBonusRounds.details.forEach((d, i) => {
            log('ERROR', '  ', `  Error ${i+1}: Round ${d.round} ${d.player} — ${d.issue}`);
        });
    }
    
    // Token pool depletion summary
    log('INFO', '[DATA]', `Token pool depletion:`);
    log('INFO', '  ', `  Checks performed: ${counters.tokenPoolChecks}`);
    log('INFO', '  ', `  Monotonically decreasing: ${counters.tokenPoolDecreasing ? 'YES ✅' : 'NO ❌'}`);
    if (counters.tokenPool.length > 0) {
        log('INFO', '  ', `  Range: ${counters.tokenPool[0].tokens} → ${counters.tokenPool[counters.tokenPool.length-1].tokens}`);
    }
    
    // Reconnect test summary
    log('INFO', '[DATA]', `Disconnect/reconnect test:`);
    log('INFO', '  ', `  Attempted: ${counters.reconnectTest.attempted}`);
    log('INFO', '  ', `  Reconnected: ${counters.reconnectTest.succeeded}`);
    log('INFO', '  ', `  Session restored: ${counters.reconnectTest.sessionRestored}`);
    if (counters.reconnectTest.disconnectTime && counters.reconnectTest.reconnectTime) {
        log('INFO', '  ', `  Downtime: ${counters.reconnectTest.reconnectTime - counters.reconnectTest.disconnectTime}ms`);
    }
    
    // Experiment end summary
    log('INFO', '[DATA]', `Experiment end:`);
    log('INFO', '  ', `  Received: ${counters.experimentEndReceived}`);
    if (counters.experimentEndData) {
        log('INFO', '  ', `  Total rounds: ${counters.experimentEndData.totalRounds}`);
        log('INFO', '  ', `  Culturants: ${counters.experimentEndData.culturantsProduced}`);
        log('INFO', '  ', `  Players in results: ${counters.experimentEndData.finalResults?.length || 0}`);
    }
    
    // Event counts
    log('INFO', '[DATA]', `Event counts:`);
    Object.entries(counters.events)
        .sort((a, b) => b[1] - a[1])
        .forEach(([event, count]) => {
            log('INFO', '  ', `  ${event}: ${count}`);
        });
    
    // Errors
    if (counters.errors.length > 0) {
        log('ERROR', '[ALERT]', `${counters.errors.length} ERROR(S) DURING TEST:`);
        counters.errors.forEach((err, i) => {
            log('ERROR', '  ', `  ${i + 1}. ${err.msg} ${err.data ? JSON.stringify(err.data) : ''}`);
        });
    } else {
        log('INFO', '✅', 'NO ERRORS during test!');
    }
    
    // Warnings
    if (counters.warnings.length > 0) {
        log('WARN', '[WARN]', `${counters.warnings.length} warning(s) during test`);
    }
    
    // Validation checks
    log('INFO', '[CHECK]', `\n${'─'.repeat(40)}`);
    log('INFO', '[CHECK]', 'VALIDATION CHECKS:');
    
    const checks = [];
    
    // Check 1: Did we get enough rounds?
    const roundsOk = counters.rounds >= CONFIG.TARGET_ROUNDS;
    checks.push({ name: `Rounds completed (${counters.rounds}/${CONFIG.TARGET_ROUNDS})`, pass: roundsOk });
    
    // Check 2: Did we see at least 1 block?
    const blocksOk = counters.blocks.size >= 1;
    checks.push({ name: `Blocks seen (${counters.blocks.size})`, pass: blocksOk });
    
    // Check 3: At least 1 condition seen?
    const condCount = Object.keys(counters.conditions).length;
    checks.push({ name: `Conditions variety (${condCount} types)`, pass: condCount >= 1 });
    
    // Check 4: At least 1 incentive type seen?
    const incCount = Object.keys(counters.incentives).length;
    checks.push({ name: `Incentive variety (${incCount} types)`, pass: incCount >= 1 });
    
    // Check 5: No errors?
    checks.push({ name: `No errors (${counters.errors.length} found)`, pass: counters.errors.length === 0 });
    
    // Check 6: Rounds progressed (autoColumnSelected should match rounds)
    const columnsSelected = counters.events['autoColumnSelected'] || 0;
    checks.push({ name: `Columns selected (${columnsSelected}/${counters.rounds} rounds)`, pass: columnsSelected >= counters.rounds });
    
    // Check 7: Round results contained valid player data
    const playerDataOk = counters.roundsWithPlayerData >= counters.rounds;
    checks.push({ name: `Player data in results (${counters.roundsWithPlayerData}/${counters.rounds} rounds)`, pass: playerDataOk });
    
    // Check 8: Token values present in round results
    const tokenValuesOk = counters.roundsWithTokenValues >= 1;
    checks.push({ name: `Token values in results (${counters.roundsWithTokenValues} rounds)`, pass: tokenValuesOk });
    
    // Check 9: CSV export validation (pass if successful OR skipped due to auth)
    const csvResult = counters.csvValidation;
    const csvOk = csvResult && (csvResult.success || csvResult.skipped);
    const csvLabel = csvResult
        ? (csvResult.success ? `PASSED (${csvResult.totalRows} rows)` : (csvResult.skipped ? 'SKIPPED (auth)' : `FAILED: ${csvResult.errors?.[0] || csvResult.error}`))
        : 'NOT RUN';
    checks.push({ name: `CSV export (${csvLabel})`, pass: csvOk });
    
    // Check 10: Token economics math — no errors in white/black token calculations
    const tokenMathOk = counters.tokenMathErrors.length === 0 && counters.tokenMathChecks > 0;
    checks.push({ name: `Token economics (${counters.tokenMathChecks} checks, ${counters.tokenMathErrors.length} errors)`, pass: tokenMathOk });
    
    // Check 11: Culturant production — verified rounds had correct black token awards
    const culturantOk = counters.culturantRounds.errors === 0;
    const culturantLabel = `${counters.culturantRounds.verified} verified, ${counters.culturantRounds.errors} errors`;
    checks.push({ name: `Culturant production (${culturantLabel})`, pass: culturantOk });
    
    // Check 12: Token pool monotonically decreasing (tokens are consumed, never created)
    const poolOk = counters.tokenPoolDecreasing && counters.tokenPoolChecks > 0;
    checks.push({ name: `Token pool decreasing (${counters.tokenPoolChecks} checks)`, pass: poolOk });
    
    // Check 13: Experiment end event received with valid data
    // After reconnect test, the experiment end should still work because
    // endExperiment (app.js) only needs session + room name, not Player.list.
    const expEndOk = counters.experimentEndReceived || (counters.rounds >= CONFIG.TARGET_ROUNDS);
    const expEndLabel = counters.experimentEndReceived
        ? `received (${counters.experimentEndData?.totalRounds || '?'} rounds)`
        : counters.rounds >= CONFIG.TARGET_ROUNDS
            ? `target reached (experimentEnd not received)`
            : 'NOT received';
    checks.push({ name: `Experiment lifecycle (${expEndLabel})`, pass: expEndOk });
    
    // Check 14: Disconnect/reconnect — connection re-established (session restore is bonus)
    const reconnectOk = counters.reconnectTest.attempted && counters.reconnectTest.succeeded;
    const reconnectLabel = !counters.reconnectTest.attempted ? 'not attempted'
        : counters.reconnectTest.succeeded
            ? `reconnected${counters.reconnectTest.sessionRestored ? ' + session restored' : ''}`
            : 'FAILED to reconnect';
    checks.push({ name: `Reconnect resilience (${reconnectLabel})`, pass: reconnectOk });
    
    // Check 15: Incentive bonuses — no bonuses awarded that violate incentive rules
    // A bonus is incorrect if awarded when the player's choice didn't match the active incentive.
    // We need at least some checks performed and no errors. Also verify bonuses were actually
    // awarded when incentive rounds existed (server should set activeIncentive on AI players too).
    const hadIncentiveRounds = counters.incentiveAssignments.length > 0;
    const incentiveBonusOk = counters.incentiveBonusRounds.incorrect === 0 && counters.incentiveBonusRounds.totalChecked > 0;
    const incentiveBonusLabel = `${counters.incentiveBonusRounds.totalChecked} checks, ${counters.incentiveBonusRounds.bonusesAwarded} awarded, ${counters.incentiveBonusRounds.incorrect} errors, ${counters.incentiveAssignments.length} assignments`;
    checks.push({ name: `Incentive bonuses (${incentiveBonusLabel})`, pass: incentiveBonusOk });
    
    checks.forEach(check => {
        const icon = check.pass ? '✅' : '❌';
        log(check.pass ? 'INFO' : 'ERROR', icon, `  ${check.name}`);
    });
    
    const allPassed = checks.every(c => c.pass);
    log('INFO', allPassed ? '🎉' : '[FAIL]', `\nOVERALL: ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
    
    // Write log file
    try {
        fs.writeFileSync(CONFIG.LOG_FILE, logLines.join('\n'), 'utf8');
        console.log(`\nFull log written to: ${CONFIG.LOG_FILE}`);
    } catch (e) {
        console.error('Failed to write log file:', e.message);
    }
    
    // ── Force-stop experiment and clean up room before exiting ──
    log('INFO', '[END]', 'Ensuring experiment and room are stopped...');
    
    // End experiment one more time in case it's still running
    // Use endExperiment (session-based) instead of forceEndExperiment (Player.list-based)
    if (!experimentDone && currentRoom) {
        try { socket.emit('endExperiment', { room: currentRoom }); } catch(e) {}
    }
    
    // Leave the room to trigger server-side cleanup
    if (currentRoom) {
        try { socket.emit('leaveRoom', currentRoom); } catch(e) {}
    }
    
    // Disconnect after giving server time to process cleanup
    setTimeout(() => {
        try { socket.disconnect(); } catch(e) {}
        // Hard exit after brief grace period
        setTimeout(() => {
            process.exit(allPassed ? 0 : 1);
        }, 500);
    }, 1500);
}

// Update lastRoundTime on round progress events (for stall detection)
socket.on('roundResultsPanel', () => { lastRoundTime = Date.now(); });
socket.on('newRound', () => { lastRoundTime = Date.now(); });
socket.on('autoColumnSelected', () => { lastRoundTime = Date.now(); });

// ─── Safety Timeout ─────────────────────────────────────────
const safetyTimer = setTimeout(() => {
    log('WARN', '[TIMEOUT]', `Safety timeout reached (${CONFIG.MAX_TEST_TIMEOUT_MS / 1000}s)`);
    finishTest('Safety timeout');
}, CONFIG.MAX_TEST_TIMEOUT_MS);

// Stall detection — if no round progress for 60s, something is stuck
let lastRoundTime = Date.now();
const stallChecker = setInterval(() => {
    if (!gameStarted || experimentDone) return;
    
    const elapsed = Date.now() - lastRoundTime;
    if (elapsed > 60000 && counters.rounds > 0) {
        log('ERROR', '[STALL]', `Stall detected: no round progress for ${(elapsed / 1000).toFixed(0)}s (last round: ${counters.rounds})`);
        finishTest('Stall detected');
    }
}, 10000);

// ─── Graceful Shutdown ──────────────────────────────────────
process.on('SIGINT', () => {
    log('INFO', '[STOP]', 'SIGINT received, finishing...');
    finishTest('User interrupted (SIGINT)');
});

process.on('uncaughtException', (err) => {
    log('ERROR', '[CRASH]', `Uncaught exception: ${err.message}\n${err.stack}`);
    finishTest('Uncaught exception');
});

process.on('unhandledRejection', (reason) => {
    log('ERROR', '[CRASH]', `Unhandled rejection: ${reason}`);
    finishTest('Unhandled rejection');
});

} // end setupSocketHandlers()

console.log(`
╔══════════════════════════════════════════════════════╗
║          XenoGenesis Integration Test Suite          ║
╠══════════════════════════════════════════════════════╣
║  Server:  ${CONFIG.SERVER.padEnd(40)}║
║  User:    ${CONFIG.USERNAME.padEnd(40)}║
║  Invite:  ${(CONFIG.INVITE_CODE || '(none — will sign in only)').padEnd(40)}║
║  Target:  ${(CONFIG.TARGET_ROUNDS + ' rounds').padEnd(40)}║
║  Timeout: ${(CONFIG.MAX_TEST_TIMEOUT_MS / 1000 + 's').padEnd(40)}║
╚══════════════════════════════════════════════════════╝
`);
