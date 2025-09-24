var initPack = {player:[]};
var removePack = {player:[]};
const { uniqueNamesGenerator, colors, animals } = require('unique-names-generator');
var _ = require('lodash');
require('./client/Inventory');
let Commands = require('./Commands')
let Room = require('./Room')
const formatMessage = require("./utils/messages");
const {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
} = require("./utils/users");

const botName = "Server";
const mainChat = "Global";

// Behavioral Economics Experiment State
var GameSessions = {}; // Key: room name, Value: session data

// Token pool - shared across all sessions  
var GlobalTokenPool = {
    whiteTokens: 2500, // Starts with 2,500 white tokens
    blackTokens: Infinity // Unlimited black tokens
};

// Experimental conditions - Token assignment rules and payout calculations
var Conditions = {
    BASELINE: {
        name: "Baseline",
        whiteTokenValue: 0.01,  // $0.01 each
        blackTokenValue: 0.05,  // $0.05 each
        // Rules: Odd row → 3 white ($0.03), Even row → 1 white ($0.01), All even → +1 black each ($0.05)
        // Max payout = $0.06
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        maxPayout: 0.06
    },
    HIGH_CULTURANT: {
        name: "High Culturant", 
        whiteTokenValue: 0.02,  // $0.02 each
        blackTokenValue: 0.07,  // $0.07 each
        // Rules: Odd row → 3 white ($0.06), Even row → 1 white ($0.02), All even → +1 black each ($0.07)
        // Max payout = $0.09
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        maxPayout: 0.09
    },
    HIGH_OPERANT: {
        name: "High Operant",
        whiteTokenValue: 0.03,  // $0.03 each
        blackTokenValue: 0.04,  // $0.04 each
        // Rules: Odd row → 3 white ($0.09), Even row → 1 white ($0.03), All even → +1 black each ($0.04)
        // Max payout = $0.07 (note: $0.09 from odd choice is higher, but max with black token bonus is $0.07 for even)
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        maxPayout: 0.07
    },
    EQUAL_CULTURANT_OPERANT: {
        name: "Equal Culturant-Operant",
        whiteTokenValue: 0.01,  // $0.01 each
        blackTokenValue: 0.02,  // $0.02 each
        // Rules: Odd row → 3 white ($0.03), Even row → 1 white ($0.01), All even → +1 black each ($0.02)
        // Max payout = $0.03
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        maxPayout: 0.03
    }
};

// AI Player Configuration
var AIConfig = {
    enabled: true,
    maxAIPlayers: 2, // Up to 2 AI players per triad
    decisionDelay: 2000, // AI decision delay in milliseconds (2 seconds)
    behaviorTypes: {
        RANDOM: { name: "Random", impulsiveChance: 0.5 },
        IMPULSIVE: { name: "Impulsive", impulsiveChance: 0.8 },
        CONSERVATIVE: { name: "Conservative", impulsiveChance: 0.2 },
        ADAPTIVE: { name: "Adaptive", impulsiveChance: 0.5 } // Could be made smarter later
    }
};

// AI Player Management
var AIPlayer = {
    create: function(room, playerNumber, behaviorType = 'RANDOM') {
        const aiId = `AI_${room}_P${playerNumber}_${Date.now()}`;
        const behavior = AIConfig.behaviorTypes[behaviorType] || AIConfig.behaviorTypes.RANDOM;
        
        // Create AI player with null socket (special case)
        const aiPlayer = Player({
            username: `AI Player ${playerNumber}`,
            id: aiId,
            socket: null, // AI players don't have real sockets
            room: room,
            x: 0,
            y: 0,
            inventory: { items: [] },
            startingContinent: "",
            admin: false,
        });
        
        // Add AI-specific properties
        aiPlayer.isAI = true;
        aiPlayer.behaviorType = behaviorType;
        aiPlayer.impulsiveChance = behavior.impulsiveChance;
        
        console.log(`🤖 Created AI player: ${aiPlayer.username} in room ${room}`);
        return aiPlayer;
    },
    
    makeDecision: function(aiPlayer) {
        if (!aiPlayer.isAI) return;
        
        // Get session for testing behavior overrides
        const session = GameSessions[aiPlayer.room];
        let chosenRow;
        
        // Check for testing behavior override
        if (session && session.aiBehaviorMode) {
            switch (session.aiBehaviorMode) {
                case 'all_impulsive':
                    // Force all AI to choose odd rows (impulsive)
                    const impulsiveRows = [1, 3, 5, 7];
                    chosenRow = impulsiveRows[Math.floor(Math.random() * impulsiveRows.length)];
                    console.log(`🧪 AI ${aiPlayer.username} forced to impulsive behavior: row ${chosenRow}`);
                    break;
                    
                case 'all_selfcontrol':
                    // Force all AI to choose even rows (self-control)
                    const selfControlRows = [2, 4, 6, 8];
                    chosenRow = selfControlRows[Math.floor(Math.random() * selfControlRows.length)];
                    console.log(`🧪 AI ${aiPlayer.username} forced to self-control behavior: row ${chosenRow}`);
                    break;
                    
                case 'mixed':
                    // Alternating pattern: first AI impulsive, second self-control, etc.
                    const aiIndex = Object.values(Player.list)
                        .filter(p => p.room === aiPlayer.room && p.isAI)
                        .indexOf(aiPlayer);
                    if (aiIndex % 2 === 0) {
                        // Even index = impulsive
                        const impulsiveRows = [1, 3, 5, 7];
                        chosenRow = impulsiveRows[Math.floor(Math.random() * impulsiveRows.length)];
                        console.log(`🧪 AI ${aiPlayer.username} (${aiIndex}) forced to impulsive in mixed pattern: row ${chosenRow}`);
                    } else {
                        // Odd index = self-control
                        const selfControlRows = [2, 4, 6, 8];
                        chosenRow = selfControlRows[Math.floor(Math.random() * selfControlRows.length)];
                        console.log(`🧪 AI ${aiPlayer.username} (${aiIndex}) forced to self-control in mixed pattern: row ${chosenRow}`);
                    }
                    break;
                    
                case 'specific_row':
                    // Force all AI to choose a specific row
                    const targetRow = session.aiSpecificRow;
                    if (targetRow >= 1 && targetRow <= 8) {
                        chosenRow = targetRow;
                        console.log(`🧪 AI ${aiPlayer.username} forced to specific row: ${chosenRow}`);
                    } else {
                        // Fallback to random if invalid row
                        chosenRow = Math.floor(Math.random() * 8) + 1;
                        console.log(`🧪 AI ${aiPlayer.username} invalid specific row, using random: ${chosenRow}`);
                    }
                    break;
                    
                default:
                case 'random':
                    // Standard AI behavior based on personality
                    if (Math.random() < aiPlayer.impulsiveChance) {
                        // Choose an odd row (impulsive: 1, 3, 5, 7)
                        const impulsiveRows = [1, 3, 5, 7];
                        chosenRow = impulsiveRows[Math.floor(Math.random() * impulsiveRows.length)];
                    } else {
                        // Choose an even row (self-control: 2, 4, 6, 8)
                        const selfControlRows = [2, 4, 6, 8];
                        chosenRow = selfControlRows[Math.floor(Math.random() * selfControlRows.length)];
                    }
                    break;
            }
        } else {
            // Standard AI behavior based on personality (no testing override)
            if (Math.random() < aiPlayer.impulsiveChance) {
                // Choose an odd row (impulsive: 1, 3, 5, 7)
                const impulsiveRows = [1, 3, 5, 7];
                chosenRow = impulsiveRows[Math.floor(Math.random() * impulsiveRows.length)];
            } else {
                // Choose an even row (self-control: 2, 4, 6, 8)
                const selfControlRows = [2, 4, 6, 8];
                chosenRow = selfControlRows[Math.floor(Math.random() * selfControlRows.length)];
            }
        }
        
        aiPlayer.currentChoice = chosenRow.toString(); // Store as string for consistency
        aiPlayer.isLockedIn = true; // AI players automatically lock in their decisions
        
        console.log(`🤖 ${aiPlayer.username} chose and locked in row: ${chosenRow} (${chosenRow % 2 === 0 ? 'self-control' : 'impulsive'})`);
        return chosenRow;
    },
    
    // Simulate AI making decisions for all AI players in a room
    processAIDecisions: function(room, gameSession) {
        // Check if experiment is paused
        if (gameSession && gameSession.isPaused) {
            console.log(`⏸️ AI decisions paused for room ${room}`);
            return;
        }
        
        const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
        
        // In turn-based mode, only process AI if it's their turn
        if (gameSession && gameSession.turnBased) {
            const currentTurnPlayer = GameSession.getCurrentTurnPlayer(room);
            const currentTurnPlayerObj = roomPlayers.find(p => p.username === currentTurnPlayer);
            
            if (currentTurnPlayerObj && currentTurnPlayerObj.isAI && !currentTurnPlayerObj.isLockedIn) {
                // Process decision for the current turn AI player
                this.makeAIDecision(currentTurnPlayerObj, room, gameSession);
            }
            return; // Exit early for turn-based mode
        }
        
        // Original simultaneous AI decision logic for non-turn-based
        const aiPlayers = roomPlayers.filter(p => p.isAI && (!p.currentChoice || !p.isLockedIn));
        
        aiPlayers.forEach(aiPlayer => {
            setTimeout(() => {
                // Double-check pause state before making decision
                const session = GameSessions[room];
                if (session && session.isPaused) {
                    console.log(`⏸️ AI decision cancelled for ${aiPlayer.username} due to pause`);
                    return;
                }
                
                this.makeAIDecision(aiPlayer, room, session);
            }, Math.random() * 2000 + 1000); // Random delay 1-3 seconds
        });
    },
    
    // Extract AI decision making into separate function
    makeAIDecision: function(aiPlayer, room, gameSession) {
        const delay = gameSession && gameSession.turnBased ? 
            Math.random() * 2000 + 1000 : // Turn-based: 1-3 seconds
            Math.random() * AIConfig.decisionDelay; // Simultaneous: use config delay
        
        setTimeout(() => {
            // Double-check pause state before making decision
            if (gameSession && gameSession.isPaused) {
                console.log(`⏸️ AI decision cancelled for ${aiPlayer.username} due to pause`);
                return;
            }
            
            // Check if AI player has already locked in (prevent double decisions)
            if (aiPlayer.isLockedIn && aiPlayer.currentChoice) {
                console.log(`🤖 AI ${aiPlayer.username} decision cancelled - already locked in with choice ${aiPlayer.currentChoice}`);
                return;
            }
            
            // Double-check it's still this AI's turn (in case turns advanced while waiting)
            if (gameSession && gameSession.turnBased) {
                const currentTurnPlayer = GameSession.getCurrentTurnPlayer(room);
                if (currentTurnPlayer !== aiPlayer.username) {
                    console.log(`🤖 AI ${aiPlayer.username} decision cancelled - no longer their turn (now ${currentTurnPlayer})`);
                    return;
                }
            }
            
            // Make the AI decision
            AIPlayer.makeDecision(aiPlayer);
            
            // Broadcast AI lock-in event to all players in the room for visual feedback
            const aiRoomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const aiCurrentRoom = roomList.find(r => r.name === room);
            
            aiRoomPlayers.forEach(p => {
                if (p.socket) {
                    const isModerator = aiCurrentRoom && p.username === aiCurrentRoom.creator;
                    
                    p.socket.emit('playerLockedIn', {
                        username: aiPlayer.username,
                        row: aiPlayer.currentChoice, // Now show to ALL players
                        isAI: true,
                        showRowDetails: true, // Always show details to everyone
                        currentTurnPlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : null,
                        turnOrder: gameSession.turnOrder || [],
                        turnBased: gameSession.turnBased,
                        column: gameSession.selectedColumn // Show selected column
                    });
                }
            });
            
            // In turn-based mode, check if all players have locked in before advancing turn
            if (gameSession && gameSession.turnBased) {
                // Check if all non-moderator players have locked in their choices
                const aiRoomPlayersForCheck = Object.values(Player.list).filter(p => p.room === room);
                const aiVotingPlayers = aiRoomPlayersForCheck.filter(p => {
                    const playerRoom = roomList.find(r => r.name === room);
                    return !(playerRoom && p.username === playerRoom.creator); // Exclude moderator
                });
                
                const allAILockedIn = aiVotingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
                
                // Only advance turn if not all players have locked in yet
                if (!allAILockedIn) {
                    console.log(`🤖 AI ${aiPlayer.username} completed their turn, advancing...`);
                    GameSession.advanceTurn(room);
                    
                    // Broadcast turn update to all players
                    const newCurrentPlayer = GameSession.getCurrentTurnPlayer(room);
                    aiRoomPlayers.forEach(p => {
                        if (p.socket) {
                            p.socket.emit('turnUpdate', {
                                currentTurnPlayer: newCurrentPlayer,
                                turnOrder: gameSession.turnOrder,
                                turnBased: gameSession.turnBased
                            });
                        }
                    });
                } else {
                    console.log(`🏁 AI ${aiPlayer.username} was the last to lock in, pausing turn advancement until round processes`);
                }
            }
            
            // Immediately broadcast player status update after AI decision
            broadcastPlayerStatusUpdate(room);
            
            // Check if all voting players (exclude moderator) have locked in after this AI decision
            const allPlayers = Object.values(Player.list).filter(p => p.room === room);
            const currentRoom = roomList.find(r => r.name === room);
            const votingPlayers = allPlayers.filter(p => {
                return !(currentRoom && p.username === currentRoom.creator); // Exclude moderator
            });
            const allLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
            
            console.log(`🤖 AI ${aiPlayer.username} finished decision. Lock-in status: ${votingPlayers.filter(p => p.isLockedIn).length}/${votingPlayers.length}`);
            
            if (allLockedIn) {
                console.log(`🎯 All voting players locked in after AI decision! Processing round...`);
                setTimeout(() => {
                    processRound(room, gameSession);
                }, 500);
            }
        }, delay);
    }
};

// Helper function to trigger AI decisions (respects pause state)
function triggerAIDecisions(room) {
    const session = GameSessions[room];
    if (!session) {
        console.log(`🚫 No session found for room ${room}`);
        return;
    }
    
    if (session.isPaused) {
        console.log(`⏸️ AI decisions skipped for paused room ${room}`);
        return;
    }
    
    console.log(`🤖 Triggering AI decisions for room ${room}`);
    AIPlayer.processAIDecisions(room, session);
}

Entity = function(param) {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: "",
        map:'forest',
    }

    if(param){
        if(param.x)
            self.x = param.x;
        if(param.y)
            self.y = param.y;
        if(param.map)
            self.map = param.map;
        if(param.id)
            self.id = param.id;
    }

    self.update = function () {
        self.updatePosition();
    }
    self.updatePosition = function () {
        self.x += self.spdX;
        self.y += self.spdY;
    }
    return self;

}

Entity.getFrameUpdateData = function () {
    var pack = {
        initPack: {
            player: initPack.player,
            //bullet: initPack.bullet,
        },
        removePack: {
            player: removePack.player,
            //bullet: removePack.bullet,
        },
        updatePack: {
            player: Player.update(),
            //bullet: Bullet.update(),

        }
    };

    initPack.player = [];
    //initPack.bullet = [];
    removePack.player = [];
    //removePack.bullet = [];
    return pack;
}

Player = function (param) {
    var self = Entity(param);
    self.number = "" + Math.floor(10 * Math.random());
    self.username = param.username;
    
    // Remove old game properties - keeping for compatibility but will be unused
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.maxSpd = 10;
    self.hp = 100;
    self.hpMax = 100;
    
    // New behavioral economics properties
    self.whiteTokens = 0;           // Individual reinforcement tokens
    self.blackTokens = 0;           // Group reinforcement tokens  
    self.totalEarnings = 0;         // Money earned so far
    self.currentChoice = null;      // 'impulsive' or 'self-control' 
    self.roundsPlayed = 0;
    self.culturantsProduced = 0;    // Times all 3 chose self-control
    self.triadPosition = 0;         // 1, 2, or 3 for turn order
    self.isActivePlayer = false;    // Whose turn it is in current round
    self.seatPosition = 'center';   // 'left', 'top', 'right' for poker table positioning
    self.activeIncentive = null;    // Current incentive bonus type ('performance', 'collaboration', etc.)
    self.incentiveBonusTokens = 0;  // Extra black tokens from incentives
    
    // AI properties
    self.isAI = param.isAI || false;
    self.behaviorType = param.behaviorType || null;
    self.impulsiveChance = param.impulsiveChance || 0.5;
    
    // Legacy properties (keeping for now)
    self.score = 0;
    self.startingContinent = param.startingContinent || "";
    self.conquredContinents = "";
    self.socket = param.socket;
    self.jointime = param.jointime;
    self.room = param.room;
    self.admin = param.admin;

    var super_update = self.update;
    self.update = function(){
        // Remove movement logic for behavioral experiment
        // self.updateSpd();
        super_update();
    }

    self.updateSpd = function () {
        if (self.pressingRight)
            self.spdX = self.maxSpd;
        else if (self.pressingLeft)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;
        if (self.pressingUp)
            self.spdY = -self.maxSpd;
        else if (self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;
    }

    self.getInitPack = function () {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            number:self.number,
            hp:self.hp,
            hpMax:self.hpMax,
            score:self.score,
            map:self.map,
            startingContinent:self.startingContinent,
            username:self.username,
            isAI:self.isAI,
            whiteTokens:self.whiteTokens,
            blackTokens:self.blackTokens,
            totalEarnings:self.totalEarnings,
            triadPosition:self.triadPosition,
            seatPosition:self.seatPosition,
            activeIncentive:self.activeIncentive,
            incentiveBonusTokens:self.incentiveBonusTokens
        };
    }

    self.getUpdatePack = function () {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            hp:self.hp,
            score:self.score,
            map:self.map,
            conquredContinents:self.conquredContinents,
        };
    }

    Player.list[self.id] = self;

    initPack.player.push(self.getInitPack());

    return self;
}

Player.list = {};
roomList = [];
let newRoom = new Room("server", "Global");
roomList.push(newRoom);

// Game Session Management Functions
GameSession = {
    create: function(roomName) {
        if (GameSessions[roomName]) {
            return GameSessions[roomName];
        }
        
        GameSessions[roomName] = {
            roomName: roomName,
            currentRound: 0,
            maxRounds: 500,
            currentCondition: Conditions.BASELINE,
            activePlayerIndex: 0, // Which player's turn (0, 1, 2)
            roundChoices: [], // Store choices for current round
            gameState: 'lobby', // 'lobby', 'playing', 'finished'
            culturantsProduced: 0,
            sessionStartTime: new Date(),
            dataLog: [], // For CSV export
            grid: GameSession.generateRandomGrid(), // Random + and - placement
            columnMode: 'auto', // 'auto' or 'manual'
            manualColumn: null, // Column selected by moderator
            selectedColumn: null, // Column selected for current round
            pendingColumnMode: null, // Column mode to apply next round
            pendingChangeRound: null, // Round when the change should take effect
            // Turn-based system properties
            turnOrder: [], // Array of player usernames in turn order
            currentTurnIndex: 0, // Index of current player in turnOrder
            roundStartPlayer: 0, // Index of player who started this round (rotates each round)
            turnBased: true, // Enable turn-based play
            playersReady: [] // Track which players are ready for their turn
        };
        
        console.log(`🎮 Created new GameSession for room: ${roomName}`);
        console.log(`🔍 Initial condition: ${GameSessions[roomName].currentCondition.name}`);
        console.log(`🔍 Initial culturants: ${GameSessions[roomName].culturantsProduced}`);
        return GameSessions[roomName];
    },
    
    generateRandomGrid: function() {
        // Create 8×8 grid with columns A-H and rows 1-8
        const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const rows = [1, 2, 3, 4, 5, 6, 7, 8];
        const grid = [];
        
        // Create all 64 cells
        for (let row = 1; row <= 8; row++) {
            for (let col = 0; col < 8; col++) {
                const columnLetter = columns[col];
                const rowType = row % 2 === 0 ? 'self-control' : 'impulsive'; // Even rows = self-control, Odd rows = impulsive
                
                grid.push({
                    row: row,
                    column: columnLetter,
                    rowType: rowType,
                    symbol: Math.random() < 0.5 ? '+' : '-', // Random + or - distribution
                    cellId: `${columnLetter}${row}` // e.g., "A1", "B2", etc.
                });
            }
        }
        
        return grid;
    },
    
    // Select a column for the round (auto random or manual selection)
    selectColumnForRound: function(gameSession) {
        const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
        console.log(`🔍 Column selection debug: mode=${gameSession.columnMode}, manualColumn=${gameSession.manualColumn}`);
        
        if (gameSession.columnMode === 'manual' && gameSession.manualColumn) {
            console.log(`📌 Using manually selected column: ${gameSession.manualColumn}`);
            return gameSession.manualColumn;
        } else if (gameSession.columnMode === 'manual' && !gameSession.manualColumn) {
            console.log(`⚠️ Manual mode but no column selected - falling back to random`);
            const randomColumn = columns[Math.floor(Math.random() * columns.length)];
            console.log(`🎲 Fallback random column: ${randomColumn}`);
            return randomColumn;
        } else {
            const randomColumn = columns[Math.floor(Math.random() * columns.length)];
            console.log(`🎲 Auto-selected random column: ${randomColumn}`);
            return randomColumn;
        }
    },
    
    get: function(roomName) {
        return GameSessions[roomName];
    },
    
    assignTriadPositions: function(roomName) {
        const session = GameSessions[roomName];
        if (!session) return;
        
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        
        // Poker table positioning: positions for 3 players + moderator
        const pokerPositions = [
            { x: 100, y: 200, seat: 'left', description: 'Left player' },     // Position 1: Left side
            { x: 250, y: 100, seat: 'top', description: 'Top player' },       // Position 2: Top center
            { x: 400, y: 200, seat: 'right', description: 'Right player' },   // Position 3: Right side
            // Moderator position at bottom center (x: 250, y: 350) - not assigned to players
        ];
        
        playersInRoom.forEach((player, index) => {
            player.triadPosition = index + 1; // 1, 2, 3
            
            // Assign poker table positions
            if (index < 3) { // Only assign to first 3 players
                const position = pokerPositions[index];
                player.x = position.x;
                player.y = position.y;
                player.seatPosition = position.seat;
                
                console.log(`🎯 Assigned ${player.username} to ${position.description} (${position.x}, ${position.y})`);
            }
        });
        
        console.log(`🃏 Poker table setup complete for ${roomName}: ${playersInRoom.length} players positioned`);
        console.log(`   Moderator space available at bottom center (250, 350)`);
    },
    
    // Add AI players to fill empty spots for testing
    fillWithAI: function(roomName, targetPlayerCount = 3) {
        if (!AIConfig.enabled) return;
        
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        const humanPlayers = playersInRoom.filter(p => !p.isAI);
        const currentCount = playersInRoom.length;
        const aiNeeded = Math.min(targetPlayerCount - currentCount, AIConfig.maxAIPlayers);
        
        if (aiNeeded <= 0) return;
        
        console.log(`🤖 Adding ${aiNeeded} AI players to room ${roomName} (current: ${currentCount}/${targetPlayerCount})`);
        
        const behaviorTypes = Object.keys(AIConfig.behaviorTypes);
        for (let i = 0; i < aiNeeded; i++) {
            const behaviorType = behaviorTypes[Math.floor(Math.random() * behaviorTypes.length)];
            const aiPlayer = AIPlayer.create(roomName, currentCount + i + 1, behaviorType);
            
            // No need to add to Player.list here - AIPlayer.create handles it via Player constructor
        }
        
        return aiNeeded;
    },
    
    // Turn-based system functions
    initializeTurnOrder: function(roomName) {
        const session = GameSessions[roomName];
        if (!session) return;
        
        // Get non-moderator players
        const currentRoom = roomList.find(r => r.name === roomName);
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        const votingPlayers = playersInRoom.filter(p => {
            return !(currentRoom && p.username === currentRoom.creator); // Exclude moderator
        });
        
        // Set turn order (shuffle for variety)
        const playerNames = votingPlayers.map(p => p.username);
        // Shuffle the array using Fisher-Yates algorithm
        for (let i = playerNames.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerNames[i], playerNames[j]] = [playerNames[j], playerNames[i]];
        }
        session.turnOrder = playerNames;
        session.currentTurnIndex = 0;
        session.roundStartPlayer = 0;
        session.playersReady = [];
        
        const firstPlayer = session.turnOrder[0];
        console.log(`🎯 Turn order initialized: ${session.turnOrder.join(' → ')}`);
        console.log(`🎯 First player: ${firstPlayer}`);
        
        // If the first player is an AI, trigger their decision after initialization
        setTimeout(() => {
            const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
            const aiPlayer = playersInRoom.find(p => p.username === firstPlayer && p.isAI);
            if (aiPlayer) {
                console.log(`🤖 Triggering initial AI decision for first player ${firstPlayer}`);
                AIPlayer.processAIDecisions(roomName, session);
            }
        }, 2000); // 2 second delay to allow full game setup
        
        return session.turnOrder;
    },
    
    getCurrentTurnPlayer: function(roomName) {
        const session = GameSessions[roomName];
        if (!session || !session.turnOrder.length) return null;
        
        return session.turnOrder[session.currentTurnIndex];
    },
    
    advanceTurn: function(roomName) {
        const session = GameSessions[roomName];
        if (!session || !session.turnOrder.length) return;
        
        session.currentTurnIndex = (session.currentTurnIndex + 1) % session.turnOrder.length;
        const currentPlayer = session.turnOrder[session.currentTurnIndex];
        
        console.log(`🔄 Turn advanced to: ${currentPlayer} (index ${session.currentTurnIndex})`);
        
        // Immediately broadcast turn update to all players when turn advances
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        playersInRoom.forEach(p => {
            if (p.socket) {
                console.log(`📡 Sending turnUpdate to ${p.username} (${p.socket.id}): ${currentPlayer}'s turn`);
                p.socket.emit('turnUpdate', {
                    currentTurnPlayer: currentPlayer,
                    turnOrder: session.turnOrder,
                    round: session.currentRound,
                    turnBased: session.turnBased
                });
            }
        });
        console.log(`📡 Broadcasted turn update: ${currentPlayer}'s turn to all players`);
        
        // If the current player is an AI, trigger their decision after a brief delay
        setTimeout(() => {
            const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
            const aiPlayer = playersInRoom.find(p => p.username === currentPlayer && p.isAI);
            if (aiPlayer) {
                console.log(`🤖 Triggering AI decision for ${currentPlayer} (their turn)`);
                AIPlayer.processAIDecisions(roomName, session);
            }
        }, 1000); // 1 second delay to allow UI updates
        
        return currentPlayer;
    },
    
    startNewRound: function(roomName) {
        const session = GameSessions[roomName];
        if (!session) return;
        
        // Rotate the starting player for this round
        session.roundStartPlayer = (session.roundStartPlayer + 1) % session.turnOrder.length;
        session.currentTurnIndex = session.roundStartPlayer;
        session.playersReady = [];
        
        const startingPlayer = session.turnOrder[session.roundStartPlayer];
        console.log(`🆕 New round started. Starting player: ${startingPlayer}`);
        
        // Clear all player choices and lock-in status
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        playersInRoom.forEach(p => {
            p.currentChoice = null;
            p.isLockedIn = false;
        });
        
        // Immediately broadcast turn update for new round
        playersInRoom.forEach(p => {
            if (p.socket) {
                p.socket.emit('turnUpdate', {
                    currentTurnPlayer: startingPlayer,
                    turnOrder: session.turnOrder,
                    round: session.currentRound,
                    turnBased: session.turnBased
                });
            }
        });
        console.log(`📡 Broadcasted new round turn update: ${startingPlayer}'s turn to all players`);
        
        // Don't trigger AI decision here - let advanceTurn handle it if needed
        // The turn system will handle AI decisions through the normal flow
        
        return startingPlayer;
    },
    
    isPlayerTurn: function(roomName, username) {
        const session = GameSessions[roomName];
        if (!session || !session.turnBased || !session.turnOrder.length) return true; // Allow all if not turn-based
        
        const currentPlayer = session.turnOrder[session.currentTurnIndex];
        return currentPlayer === username;
    }
};

var continentCoords = {
    NorthEast:{
        x:1500,
        y:100,
    },
    NorthWest:{
        x:300,
        y:100,
    },
    SouthEast:{
        x:1400,
        y:650,
    },
    SouthWest:{
        x:300,
        y:700,
    },
    Middle:{
        x:900,
        y:400,
    },
}

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var days   = Math.floor(sec_num / 86400);
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time = days +"d:"+ hours+'h:'+minutes+'m:'+seconds+"s";
    return time;
}

////
// Player logs in
Player.onConnect = function(socket,username,admin,io){
    //console.log(io.of("/").adapter);
    console.log(username +" joined")

    // Store player data but don't create game player object yet
    var playerData = {
        username:username,
        id:socket.id,
        socket:socket,
        io:io,
        admin:admin,
        room:mainChat,
        jointime: new Intl.DateTimeFormat('default',{
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date()),
    };

    // Don't add user to chat system immediately - wait for them to join a room

    socket.on('leaveRoom', (room) => {
        console.log(`🚪 ${playerData.username} leaving room: ${room}`);
        
        const userLeaving = userLeave(socket.id);
        if (userLeaving) {
            // Send users and room info to the room they're leaving
            io.in(room).emit("roomUsers", {
                room: room,
                users: getRoomUsers(room),
                usersCount: Player.getLength() 
            });
            
            // Send a leave message to the room they're leaving
            io.in(room).emit("message", formatMessage({
                username: botName,
                text: `${userLeaving.username} has left the chat`,
                type: "status",
                room: room
            }));
        }
        
        // Remove player from game if they're in one
        if (room !== mainChat && room !== "Global") {
            // Find and remove the player from Player.list
            const leavingPlayer = Object.values(Player.list).find(p => p.socket && p.socket.id === socket.id && p.room === room);
            if (leavingPlayer) {
                console.log(`🎮 Removing ${leavingPlayer.username} from game in room: ${room}`);
                delete Player.list[leavingPlayer.id];
                
                // Update game session - reassign positions for remaining players
                const gameSession = GameSession.get(room);
                if (gameSession) {
                    const remainingPlayers = Object.values(Player.list).filter(p => p.room === room);
                    console.log(`👥 ${remainingPlayers.length} players remaining in ${room}`);
                    
                    // Reassign poker positions for remaining players
                    GameSession.assignTriadPositions(room);
                    
                    // Send updated player list to remaining players
                    const allRoomUsers = getRoomUsers(room);
                    const playersWithModerator = allRoomUsers.map(user => {
                        const currentRoom = roomList.find(r => r.name === room);
                        return {
                            username: user.username,
                            id: user.id,
                            isAI: false,
                            isModerator: currentRoom && user.username === currentRoom.creator
                        };
                    });
                    
                    // Add any AI players that might still be in the room
                    const aiPlayersInRoom = remainingPlayers.filter(p => p.isAI);
                    aiPlayersInRoom.forEach(aiPlayer => {
                        playersWithModerator.push({
                            username: aiPlayer.username,
                            id: aiPlayer.id,
                            isAI: true,
                            isModerator: false
                        });
                    });
                    
                    console.log(`📡 Emitting updated playersInRoom for ${room} after player left:`, playersWithModerator);
                    io.to(room).emit('playersInRoom', {
                        room: room,
                        players: playersWithModerator
                    });
                }
            }
            
            // Tell the leaving player to clear their interface
            socket.emit('leftRoom', {
                room: room,
                message: `You have left ${room}`
            });
        }
        
        // Only auto-join Global if they're leaving a specific room (not Global itself)
        if (room !== mainChat && room !== "Global") {
            const user = userJoin(socket.id, playerData.username, mainChat);
            socket.leave(room);
            socket.join(mainChat);
            playerData.room = mainChat;
            
            // Send welcome message to Global
            socket.emit("message", formatMessage({
                username: botName,
                text: `Welcome back to ${mainChat} chat!`,
                type: "update",
                admin: "admin",
                room: mainChat
            }));
            
            // Update Global room users
            io.in(mainChat).emit("roomUsers", {
                room: mainChat,
                users: getRoomUsers(mainChat),
                usersCount: Player.getLength() 
            });
        }

    });

    socket.on("joinRoom", (room) => {
        //console.log(io.sockets.adapter.rooms);

        //Search roomList array values represnted as lowercase to check if entered room name is valid regardless of case
        const roomIndex = roomList.findIndex(element => {
            return element.name.toLowerCase() === room.toLowerCase();
        });

        if ( roomIndex !== -1 ) {
            room = _.startCase(room);
            const user = userJoin(socket.id, playerData.username, room);
            socket.join(room);
            playerData.room = room;

            // Welcome current user
            socket.emit("message", formatMessage({
                username: botName,
                text: `Welcome to ${room} chat!`,
                type: "update",
                admin: "admin",
                room: room
            }));

            // Broadcast when a user connects
            // io.emit() sends to EVERYONE, this omits the user who joined
            socket.broadcast
                .to(user.room)
                .emit(
                    "message", formatMessage({
                        username: botName,
                        text: `${playerData.username} has joined the chat`,
                        type: "status",
                        admin: "admin"
                    }));

            // Send users and room info
            io.to(user.room).emit("roomUsers", {
                room: room,
                users: getRoomUsers(user.room),
                usersCount: Player.getLength() 
            });

            // Send detailed player info for poker table updates
            const currentRoom = roomList.find(r => r.name === room);
            const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
            const allRoomUsers = getRoomUsers(room);
            
            // Create player list with moderator info
            const playersWithModerator = allRoomUsers.map(user => ({
                username: user.username,
                id: user.id,
                isAI: false, // Users from getRoomUsers are human players
                isModerator: currentRoom && user.username === currentRoom.creator
            }));
            
            // Add any AI players that might be in the room
            const aiPlayersInRoom = playersInRoom.filter(p => p.isAI);
            aiPlayersInRoom.forEach(aiPlayer => {
                playersWithModerator.push({
                    username: aiPlayer.username,
                    id: aiPlayer.id,
                    isAI: true,
                    isModerator: false
                });
            });
            
            console.log(`📡 Emitting playersInRoom for ${room}:`, playersWithModerator);
            io.to(room).emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
            
            // Also emit specifically to the joining player to ensure they get current state
            socket.emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
            
            console.log(`📡 Also sent playersInRoom directly to ${playerData.username}`);

            // Send another playersInRoom event with a slight delay to ensure client is ready
            setTimeout(() => {
                console.log(`⏰ Delayed playersInRoom emission for ${playerData.username} in ${room}`);
                socket.emit('playersInRoom', {
                    room: room,
                    players: playersWithModerator
                });
            }, 200);

            // Check if there's an active game in this room and auto-join the player
            // Only auto-join if the user is joining a room that's not Global and has active players
            if (room !== "Global" && room !== mainChat) {
                const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
                console.log(`🔍 JOIN ROOM DEBUG - User: ${playerData.username}, Room: ${room}, Total Players in list: ${Object.keys(Player.list).length}, Players in this room: ${playersInRoom.length}`);
                
                if (playersInRoom.length > 0) {
                    console.log(`🎮 Auto-joining ${playerData.username} to existing game in room: ${room}`);
                    
                    // Auto-start the game for the joining player (they become a player immediately)
                    Database.getPlayerProgress(playerData.username, function(progress) {
                        Player.onGameStart(playerData.socket, playerData.username, progress, io, room, playerData.admin);
                    });
                } else {
                    console.log(`❌ No active game in room ${room} for ${playerData.username} to join`);
                }
            } else {
                console.log(`⏩ Skipping game init for ${playerData.username} joining ${room} (Global or main chat)`);
            }

            if(room !== "Global")
                socket.emit("joinRoom", room);
        }

        else{
            socket.emit("message", formatMessage({
                username: botName,
                text: "\""+ room +"\" is not a valid room",
                type: "status",
            }));
        }

    });

    socket.on('createRoom', function(){
        const shortName = uniqueNamesGenerator({
            dictionaries: [colors,animals], 
            separator: ' ',
            length: 2
        });

        let roomName = _.startCase(shortName); 
        console.log(roomName)
        //roomList.push(roomName);

        let newRoom = new Room(playerData.username, roomName);
        roomList.push(newRoom);

        console.log("ROOM LIST: ")
        console.log(roomList)

        socket.emit("roomCreated",roomName);

        // Emit initial playersInRoom with the creator as moderator
        socket.emit('playersInRoom', {
            room: roomName,
            players: [{
                username: playerData.username,
                id: socket.id,
                isAI: false,
                isModerator: true
            }]
        });

        // Copy room name to clipboard (will be handled on client side)
        socket.emit('copyToClipboard', { text: roomName });


    });


    socket.on("chatMessage", (data) => {
        io.in(data.room).emit("message", formatMessage({
            username: playerData.username,
            text: data.msg,
            type: "normal",
            admin: playerData.admin,
            room:data.room
        }));
        
    });
    
    socket.on('privateMessage', function (data) {
        var recipientSocket = null;

        for (var i in Player.list)
            if (Player.list[i].username === data.recipient)
                recipientSocket = Player.list[i].socket;
        if (recipientSocket === null) {
            socket.emit("message", formatMessage({
                username: botName,
                text: 'The player ' + data.recipient + ' is not online',
                type: "status",
            }));

        } else {
            recipientSocket.emit("message", formatMessage({
                username: playerData.username + " (whisper)",
                text: data.message,
                type: "pm",
            }));

            socket.emit("message", formatMessage({
                username: botName,
                text: 'PM sent to: ' + data.recipient,
                type: "status",
            }));
        }
    });

    socket.on('commandMessage', function(data){
        const command = data.message.split(" ")[0];
        const param = data.message.replace(command, "").trim()
        console.log("### Username: " + playerData.username, " - Command: " + command)
        
        if (param.length > 1) 
            console.log("Param: " + param)

        let commands = new Commands(command,param,io,playerData,socket);

        //Logic to execute commands
        if (command in commands.normal) {
            commands.runNormalCommand();
        }

        else if (command in commands.admin) {
            //Check if user is admin
            Database.isAdmin({ username: playerData.username }, function (res) {
                if (res !== true) {
                    console.log("NOT Admin " + playerData.username);
                    return;
                }
                //Execute command if they are
                commands.runAdminCommand();
            });
        }

        else{
            socket.emit("message", formatMessage({
                username: botName,
                text: "'"+ command + "'" + "is not a command, run .commands to see list",
                type: "status",
            }));
        }
    });

    // Connection test for debugging
    socket.on('test-connection', function(data) {
        console.log(`🔧 Connection test from ${data.username} (${socket.id})`);
        socket.emit('test-connection-reply', { 
            message: 'Connection OK', 
            socketId: socket.id,
            username: data.username 
        });
    });

    socket.on('evalServer', function(data){
        var res = eval(data);
        socket.emit('evalAnswer',res);
    });

    socket.on("disconnect", () => {
        const user = getCurrentUser(socket.id);
        if (user) {
            console.log(`🔌 ${user.username} disconnected from room: ${user.room}`);
            
            // Send leave message to the room the user was actually in
            io.to(user.room).emit(
                "message",
                formatMessage({
                    username: botName,
                    text: `${user.username} has left the chat`,
                    type: "status",
                    room: user.room
                })
            );
            
            // Remove player from game if they're in one
            const leavingPlayer = Object.values(Player.list).find(p => p.socket && p.socket.id === socket.id && p.room === user.room);
            if (leavingPlayer) {
                console.log(`🎮 Removing disconnected ${leavingPlayer.username} from game in room: ${user.room}`);
                delete Player.list[leavingPlayer.id];
                
                // Update game session - reassign positions for remaining players
                const gameSession = GameSession.get(user.room);
                if (gameSession && user.room !== 'Global') {
                    const remainingPlayers = Object.values(Player.list).filter(p => p.room === user.room);
                    console.log(`👥 ${remainingPlayers.length} players remaining in ${user.room} after disconnect`);
                    
                    // Reassign poker positions for remaining players
                    GameSession.assignTriadPositions(user.room);
                    
                    // Send updated player list to remaining players
                    const allRoomUsers = getRoomUsers(user.room);
                    const playersWithModerator = allRoomUsers.map(roomUser => {
                        const currentRoom = roomList.find(r => r.name === user.room);
                        return {
                            username: roomUser.username,
                            id: roomUser.id,
                            isAI: false,
                            isModerator: currentRoom && roomUser.username === currentRoom.creator
                        };
                    });
                    
                    // Add any AI players that might still be in the room
                    const aiPlayersInRoom = remainingPlayers.filter(p => p.isAI);
                    aiPlayersInRoom.forEach(aiPlayer => {
                        playersWithModerator.push({
                            username: aiPlayer.username,
                            id: aiPlayer.id,
                            isAI: true,
                            isModerator: false
                        });
                    });
                    
                    console.log(`📡 Emitting updated playersInRoom for ${user.room} after disconnect:`, playersWithModerator);
                    io.to(user.room).emit('playersInRoom', {
                        room: user.room,
                        players: playersWithModerator
                    });
                }
            }
            
            // Remove user from the users array
            userLeave(socket.id);
    
            // Send updated room users to the room they left (not Global)
            io.to(user.room).emit("roomUsers", {
                room: user.room,
                users: getRoomUsers(user.room),
                usersCount: Player.getLength() 
            });
        }
    });


    socket.on('startGame', (data) => {
        console.log('🎮 Starting game for room:', data.room);
        
        try {
            // Get all users in the room (chat users, not game players yet)
            const usersInRoom = getRoomUsers(data.room);
            console.log('🎮 Users in room:', usersInRoom.map(u => u.username));
            
            if (!usersInRoom || usersInRoom.length === 0) {
                console.log('❌ No users found in room:', data.room);
                socket.emit('error', { message: 'No users found in room' });
                return;
            }
            
            // Check if players already exist in this room (from previous game start or AI addition)
            const existingPlayers = Object.values(Player.list).filter(p => p.room === data.room);
            console.log('🎮 Existing players in room:', existingPlayers.map(p => `${p.username} (${p.isAI ? 'AI' : 'Human'})`));
            
            // Only create players for users who don't already have a Player object
            const usersNeedingPlayers = usersInRoom.filter(user => 
                !existingPlayers.find(p => p.id === user.id)
            );
            
            console.log('🎮 Users needing Player objects:', usersNeedingPlayers.map(u => u.username));
            
            if (usersNeedingPlayers.length === 0) {
                console.log('🎮 All users already have Player objects, starting game...');
                // All users already have players, just start the game
                startGameForExistingPlayers(data.room, socket);
                return;
            }
            
            let playersCreated = 0;
            const totalPlayersToCreate = usersNeedingPlayers.length;
            
            // Start the game for users who need Player objects
            usersNeedingPlayers.forEach(user => {
                try {
                    // Get the socket for this user from socket.io room members
                    const userSocket = io.sockets.sockets.get(user.id);
                    
                    if (userSocket) {
                        console.log(`🎮 Creating Player object for user: ${user.username} (${user.id})`);
                        Database.getPlayerProgress(user.username, function(progress){
                            try {
                                // Determine if user is admin (only the person who clicked start game is admin for now)
                                const isAdmin = user.id === socket.id;
                                
                                // Create the player but don't send init events yet
                                Player.onGameStart(userSocket, user.username, progress, null, data.room, isAdmin);
                                
                                playersCreated++;
                                
                                // After all players are created, start the game
                                if (playersCreated === totalPlayersToCreate) {
                                    console.log('🎮 All new players created, starting game...');
                                    startGameForExistingPlayers(data.room, socket);
                                }
                            } catch (error) {
                                console.error('❌ Error in Database.getPlayerProgress callback:', error);
                                socket.emit('error', { message: 'Error starting game for player: ' + user.username });
                            }
                        });
                    } else {
                        console.log(`❌ Could not find socket for user: ${user.username} (${user.id})`);
                        // Still count as "processed" so we don't wait forever
                        playersCreated++;
                        if (playersCreated === totalPlayersToCreate) {
                            startGameForExistingPlayers(data.room, socket);
                        }
                    }
                } catch (userError) {
                    console.error('❌ Error processing user in startGame:', userError, 'User:', user);
                    playersCreated++;
                    if (playersCreated === totalPlayersToCreate) {
                        startGameForExistingPlayers(data.room, socket);
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Critical error in startGame handler:', error);
            socket.emit('error', { message: 'Critical error starting game' });
        }
    });
    
    // Helper function to start game for existing players
    function startGameForExistingPlayers(room, initiatingSocket) {
        try {
            console.log('🎮 Starting game for existing players in room:', room);
            
            // Get all players in the room (both human and AI)
            const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const humanPlayers = roomPlayers.filter(p => !p.isAI);
            
            console.log(`🎮 Room ${room} has ${roomPlayers.length} total players (${humanPlayers.length} human, ${roomPlayers.length - humanPlayers.length} AI)`);
            
            // Get or create game session
            const gameSession = GameSession.get(room) || GameSession.create(room);
            gameSession.gameState = 'playing'; // Set to playing state
            
            // Send init data to all human players (AI players don't need init events)
            const roomPlayerData = roomPlayers.map(p => p.getInitPack());
            humanPlayers.forEach(player => {
                if (player.socket && typeof player.socket.emit === 'function') {
                    console.log(`📡 Sending init to ${player.username} (${player.socket.id})`);
                    player.socket.emit('init', {
                        selfId: player.socket.id,
                        player: roomPlayerData,
                    });
                    
                    // Send game start notification
                    console.log(`🎯 Sending triadComplete to ${player.username} (${player.socket.id})`);
                    player.socket.emit('triadComplete', {
                        message: 'Game started! Get ready to make choices.',
                        playerPosition: player.triadPosition,
                        gameSession: {
                            currentRound: gameSession.currentRound,
                            maxRounds: gameSession.maxRounds,
                            condition: gameSession.currentCondition.name,
                            grid: gameSession.grid,
                            totalPlayers: roomPlayers.length,
                            gameState: 'playing'
                        }
                    });
                } else {
                    console.warn(`⚠️ Player ${player.username} has invalid socket`);
                }
            });
            
            // Notify all sockets in the room that the game started
            io.to(room).emit("gameStarted");
            console.log(`🎮 Game started successfully in ${room} with ${roomPlayers.length} players`);
            
            // Start the behavioral experiment rounds
            if (gameSession) {
                gameSession.gameState = 'playing';
                gameSession.currentRound = 1;
                gameSession.activePlayerIndex = 0;
                
                // Initialize turn order for turn-based play
                GameSession.initializeTurnOrder(room);
                
                // Broadcast turn information to all players
                const currentTurnPlayer = GameSession.getCurrentTurnPlayer(room);
                roomPlayers.forEach(p => {
                    if (p.socket) {
                        p.socket.emit('turnUpdate', {
                            turnOrder: gameSession.turnOrder,
                            currentTurnPlayer: currentTurnPlayer,
                            currentTurnIndex: gameSession.currentTurnIndex,
                            turnBased: gameSession.turnBased
                        });
                    }
                });
                
                console.log(`🎯 Turn-based system initialized. Starting player: ${currentTurnPlayer}`);
                
                console.log(`🧪 Starting behavioral experiment Round ${gameSession.currentRound} in ${room}`);
                
                // Clear any previous choices
                roomPlayers.forEach(p => p.currentChoice = null);
                
                // Emit yourTurn event to start gameplay
                roomPlayers.forEach((player, index) => {
                    if (player.socket && typeof player.socket.emit === 'function') {
                        const currentRoom = roomList.find(r => r.name === room);
                        const isModerator = currentRoom && player.username === currentRoom.creator;
                        
                        // In behavioral experiments, all non-moderator players can vote simultaneously
                        const canVote = !isModerator && !player.isAI; // Human participants can vote
                        
                        player.socket.emit('yourTurn', {
                            isYourTurn: canVote, // All participants can vote, not turn-based
                            isModerator: isModerator,
                            activePlayer: canVote ? 'Your turn' : 'Waiting for participants',
                            round: gameSession.currentRound,
                            // Send condition info including token values for conversion display
                            condition: {
                                name: gameSession.currentCondition.name,
                                whiteValue: gameSession.currentCondition.whiteTokenValue,
                                blackValue: gameSession.currentCondition.blackTokenValue
                            },
                            grid: gameSession.grid,
                            playerPosition: player.triadPosition,
                            totalPlayers: roomPlayers.length
                        });
                        console.log(`🎯 Sent yourTurn to ${player.username} (canVote: ${canVote}, moderator: ${isModerator})`);
                    }
                });
                
                // Trigger AI decisions immediately since all players vote simultaneously
                const aiPlayersInRoom = roomPlayers.filter(p => p.isAI);
                if (aiPlayersInRoom.length > 0) {
                    console.log(`🤖 Found ${aiPlayersInRoom.length} AI players, triggering their decisions...`);
                    setTimeout(() => {
                        AIPlayer.processAIDecisions(room, gameSession);
                    }, AIPlayer.decisionDelay);
                }
            }
            
            // Update poker table positions
            updateRoomPlayersDisplay(room);
            
        } catch (error) {
            console.error('❌ Error in startGameForExistingPlayers:', error);
            initiatingSocket.emit('error', { message: 'Error starting game' });
        }
    }
    
    // Helper function to update room players display
    function updateRoomPlayersDisplay(room) {
        try {
            const currentRoom = roomList.find(r => r.name === room);
            const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
            const allRoomUsers = getRoomUsers(room);
            
            // Create player list with moderator info
            const playersWithModerator = allRoomUsers.map(user => ({
                username: user.username,
                id: user.id,
                isAI: false, // Users from getRoomUsers are human players
                isModerator: currentRoom && user.username === currentRoom.creator
            }));
            
            // Add any AI players that might be in the room
            const aiPlayersInRoom = playersInRoom.filter(p => p.isAI);
            aiPlayersInRoom.forEach(aiPlayer => {
                playersWithModerator.push({
                    username: aiPlayer.username,
                    id: aiPlayer.id,
                    isAI: true,
                    isModerator: false
                });
            });
            
            console.log(`🎮 Emitting playersInRoom for ${room}:`, playersWithModerator);
            io.to(room).emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
        } catch (error) {
            console.error('❌ Error updating room players display:', error);
        }
    }

    socket.on('addAIPlayers', (data) => {
        const username = socket.username;
        const room = data.room || "Global";
        
        console.log(`🤖 ${username || 'Unknown user'} requested to add AI players to room: ${room}`);
        
        // Check if the player has permission to add AI
        if (room === "Global") {
            socket.emit('systemMessage', { message: 'Cannot add AI players to Global chat' });
            return;
        }
        
        // Get current room information using the correct Player.list structure
        const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
        const humanPlayers = roomPlayers.filter(player => !player.isAI);
        const aiPlayers = roomPlayers.filter(player => player.isAI);
        
        // Calculate how many AI players we can add
        const maxPlayers = 3; // Triad formation
        const spotsLeft = maxPlayers - roomPlayers.length;
        const maxAI = Math.min(spotsLeft, AIConfig.maxAIPlayers - aiPlayers.length);
        
        if (maxAI <= 0) {
            socket.emit('systemMessage', { message: 'Cannot add more AI players - room is full or AI limit reached' });
            return;
        }
        
        // Add AI players
        for (let i = 0; i < maxAI; i++) {
            const playerNumber = roomPlayers.length + i + 1;
            const behaviorType = i === 0 ? 'COOPERATIVE' : 'RANDOM'; // Mix behaviors
            const aiPlayer = AIPlayer.create(room, playerNumber, behaviorType);
            
            // Add to Player.list using the existing structure
            Player.list[aiPlayer.id] = aiPlayer;
            
            console.log(`✅ Added ${aiPlayer.username} to room ${room}`);
        }
        
        // Reassign positions after adding AI players
        GameSession.assignTriadPositions(room);
        console.log(`🃏 Reassigned positions after adding AI players to ${room}`);
        
        // Notify all players in the room about the new AI players
        // Use the same data format as other playersInRoom events
        const allRoomUsers = getRoomUsers(room);
        const currentRoom = roomList.find(r => r.name === room);
        
        // Create player list with moderator info (human players)
        const playersWithModerator = allRoomUsers.map(user => ({
            username: user.username,
            id: user.id,
            isAI: false,
            isModerator: currentRoom && user.username === currentRoom.creator
        }));
        
        // Add AI players to the list
        const updatedRoomPlayers = Object.values(Player.list).filter(p => p.room === room);
        const aiPlayersInRoom = updatedRoomPlayers.filter(p => p.isAI);
        aiPlayersInRoom.forEach(aiPlayer => {
            playersWithModerator.push({
                username: aiPlayer.username,
                id: aiPlayer.id,
                isAI: true,
                isModerator: false
            });
        });
        
        console.log(`📡 Emitting playersInRoom after AI addition for ${room}:`, playersWithModerator);
        io.to(room).emit('playersInRoom', { 
            room: room, 
            players: playersWithModerator
        });
        
        // Send success message
        socket.emit('systemMessage', { 
            message: `Successfully added ${maxAI} AI player(s) to room ${room}` 
        });
        
        console.log(`🤖 Successfully added ${maxAI} AI players to room ${room}`);
    });

    socket.on('requestRoomState', (data) => {
        const room = data.room;
        const username = socket.username || 'Unknown';
        
        console.log(`🔍 ${username} requesting room state for: ${room}`);
        
        if (room === 'Global') {
            return; // Don't send room state for Global chat
        }
        
        // Get current room info
        const currentRoom = roomList.find(r => r.name === room);
        const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
        const allRoomUsers = getRoomUsers(room);
        
        // Create player list with moderator info
        const playersWithModerator = allRoomUsers.map(user => ({
            username: user.username,
            id: user.id,
            isAI: false,
            isModerator: currentRoom && user.username === currentRoom.creator
        }));
        
        // Add any AI players that might be in the room
        const aiPlayersInRoom = playersInRoom.filter(p => p.isAI);
        aiPlayersInRoom.forEach(aiPlayer => {
            playersWithModerator.push({
                username: aiPlayer.username,
                id: aiPlayer.id,
                isAI: true,
                isModerator: false
            });
        });
        
        console.log(`📡 Sending room state to ${username} for ${room}:`, playersWithModerator);
        socket.emit('playersInRoom', {
            room: room,
            players: playersWithModerator
        });
        
        // Also send game session info if there's an active game
        const gameSession = GameSession.get(room);
        if (gameSession) {
            console.log(`🎮 Sending game session info to ${username}`);
            socket.emit('triadComplete', {
                room: room,
                gameSession: gameSession
            });
        }
    });

    socket.on('beginGame', (data) => {
        // Database.getPlayerProgress(data.username,function(progress){
        //     Player.onGameStart(player.socket,player.username,progress, room);
        // });
        console.log("SOCKET::  ROOM began: "+ data.room)
    });

}

// ===============================================
// HELPER FUNCTIONS FOR PLAYER STATUS UPDATES
// ===============================================

// Automatically broadcast player status updates to moderators in the room
function broadcastPlayerStatusUpdate(roomName) {
    const session = GameSessions[roomName];
    if (!session) return;
    
    const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
    const playerData = playersInRoom.map(p => ({
        name: p.username,
        isAI: p.isAI || false,
        selectedRow: p.currentChoice || null,
        lockedIn: p.isLockedIn || false,
        whiteTokens: p.whiteTokens || 0,
        blackTokens: p.blackTokens || 0,
        totalEarnings: p.totalEarnings || 0,
        activeIncentive: p.activeIncentive || null,
        incentiveBonusTokens: p.incentiveBonusTokens || 0
    }));
    
    const lockedCount = playerData.filter(p => p.lockedIn).length;
    
    const updateData = {
        room: roomName,
        round: session.currentRound,
        players: playerData,
        lockedCount: lockedCount,
        totalCount: playerData.length,
        condition: session.currentCondition.name,
        whiteTokensRemaining: GlobalTokenPool.whiteTokens,
        culturantsProduced: session.culturantsProduced || 0
    };
    
    // Send update to all moderators in the room
    const currentRoom = roomList.find(r => r.name === roomName);
    if (currentRoom) {
        const moderatorSocket = Object.values(Player.list)
            .find(p => p.room === roomName && p.username === currentRoom.creator)?.socket;
        
        if (moderatorSocket) {
            moderatorSocket.emit('playerStatusUpdate', updateData);
            console.log(`📊 Auto-broadcast player status update to moderator in ${roomName}`);
        }
    }
}

////
// Player Starts a Game
Player.onGameStart = function(socket,username, progress, io, room, admin){
    try {
        console.log(`🎯 Player.onGameStart called for ${username} in room ${room}`);
        
        // Check if this player already exists in this room
        const existingPlayer = Object.values(Player.list).find(p => p.room === room && p.username === username);
        if (existingPlayer) {
            console.log(`⚠️ Player ${username} already exists in room ${room}, skipping creation`);
            return existingPlayer; // Return existing player instead of creating new one
        }
        
        // Allow flexible player count - count current players in room more intelligently
        const currentPlayersInRoom = Object.values(Player.list).filter(p => p.room === room);
        const humanPlayersInRoom = currentPlayersInRoom.filter(p => !p.isAI);
        const aiPlayersInRoom = currentPlayersInRoom.filter(p => p.isAI);
        
        console.log(`🔍 Room ${room} capacity check: ${currentPlayersInRoom.length} total (${humanPlayersInRoom.length} human + ${aiPlayersInRoom.length} AI)`);
        
        // More flexible capacity: Allow multiple human players + AI up to reasonable limit
        // For behavioral experiments: typically 1 moderator + 2-3 participants = 3-4 total
        if(currentPlayersInRoom.length >= 4) {
            console.log(`❌ Room ${room} is at maximum capacity! Maximum 4 players allowed`);
            socket.emit('roomFull', { message: 'Room is at maximum capacity (4 players max)' });
            return null;
        }

        var player = Player({
            username:username,
            id:socket.id,
            socket:socket,
            room:room,
            x:0, // Not used in behavioral experiment
            y:0, // Not used in behavioral experiment  
            inventory:progress,
            startingContinent:"", // Not used in behavioral experiment
            admin:admin,
        });

        if (!player) {
            console.error('❌ Failed to create player object');
            socket.emit('error', { message: 'Failed to create player' });
            return;
        }

        player.inventory = new Inventory(progress.items,socket,true);
        player.inventory.refreshRender();

        console.log(`🧠 ${player.username} joined behavioral experiment in room: ${player.room}`);
        
        // Create or get game session for this room
        const gameSession = GameSession.create(room);
        
        if (!gameSession) {
            console.error('❌ Failed to create/get game session for room:', room);
            socket.emit('error', { message: 'Failed to create game session' });
            return;
        }
        
        // Always show triad status and allow experiment to start with 1+ players
        const allPlayersInRoom = Object.values(Player.list).filter(p => p.room === room);
        const humanPlayers = allPlayersInRoom.filter(p => !p.isAI);
        console.log(`👥 Current players in room ${room}: ${allPlayersInRoom.length}/3 (${humanPlayers.length} human, ${allPlayersInRoom.length - humanPlayers.length} AI)`);
        
        // Assign poker table positions immediately when any player joins
        GameSession.assignTriadPositions(room);
        
        // Always set to ready state for flexible testing
        gameSession.gameState = 'ready';
    
    // Notify all human players (AI players don't need notifications)
    humanPlayers.forEach(p => {
        if (p.socket && typeof p.socket.emit === 'function') {
            p.socket.emit('triadComplete', {
                message: `Experiment ready to begin! (${allPlayersInRoom.length}/3 players)`,
                playerPosition: p.triadPosition || allPlayersInRoom.findIndex(ap => ap.id === p.id) + 1,
                gameSession: {
                    currentRound: gameSession.currentRound,
                    maxRounds: gameSession.maxRounds,
                    condition: gameSession.currentCondition.name,
                    grid: gameSession.grid,
                    canAddAI: allPlayersInRoom.length < 3,
                    totalPlayers: allPlayersInRoom.length,
                    players: allPlayersInRoom.map(player => ({
                        id: player.id,
                        username: player.username,
                        triadPosition: player.triadPosition,
                        seatPosition: player.seatPosition,
                        isAI: player.isAI,
                        behaviorType: player.behaviorType
                    }))
                }
            });
        } else {
            console.warn(`⚠️ Player ${p.username} has invalid socket, skipping triadComplete notification`);
        }
    });
    if(allPlayersInRoom.length === 3) {
        console.log(`🎯 Triad complete in ${room}! Initializing behavioral experiment...`);
        
        // Assign positions (P1, P2, P3) for turn order
        GameSession.assignTriadPositions(room);
        
        // Set game state to ready
        gameSession.gameState = 'ready';
        
        // Notify all human players in room that experiment can begin (skip AI players)
        allPlayersInRoom.forEach(p => {
            if (p.socket && typeof p.socket.emit === 'function' && !p.isAI) {
                p.socket.emit('triadComplete', {
                    message: 'Triad complete! Experiment ready to begin.',
                    playerPosition: p.triadPosition,
                    gameSession: {
                        currentRound: gameSession.currentRound,
                        maxRounds: gameSession.maxRounds,
                        condition: gameSession.currentCondition.name,
                        grid: gameSession.grid,
                        totalPlayers: allPlayersInRoom.length,
                        players: allPlayersInRoom.map(player => ({
                            id: player.id,
                            username: player.username,
                            triadPosition: player.triadPosition,
                            seatPosition: player.seatPosition,
                            isAI: player.isAI,
                            behaviorType: player.behaviorType
                        }))
                    }
                });
            } else if (p.isAI) {
                console.log(`🤖 Skipping notification for AI player: ${p.username}`);
            }
        });
    }

    // Behavioral experiment event handlers (replace old key press handlers)
    socket.on('makeChoice', function(data) {
        // Player makes impulsive (odd row) or self-control (even row) choice
        const gameSession = GameSession.get(room);
        if (!gameSession || gameSession.gameState !== 'playing') {
            socket.emit('error', { message: 'Game not in progress' });
            return;
        }
        
        // Check if this player is the moderator (moderators can't vote)
        const currentRoom = roomList.find(r => r.name === room);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (isModerator) {
            socket.emit('error', { message: 'Moderators cannot vote in the experiment' });
            return;
        }
        
        // Check if it's this player's turn (if turn-based is enabled)
        if (gameSession.turnBased && !GameSession.isPlayerTurn(room, player.username)) {
            const currentTurnPlayer = GameSession.getCurrentTurnPlayer(room);
            socket.emit('error', { message: `It's ${currentTurnPlayer}'s turn. Please wait.` });
            return;
        }
        
        // Only process if this is a lock-in
        if (data.lockedIn) {
            // Validate that player has made a choice
            if (!data.choice || data.choice === null || data.choice === undefined) {
                console.log(`🚫 ${player.username} tried to lock in without making a choice`);
                socket.emit('error', { message: 'You must select a row before locking in your choice' });
                return;
            }
            
            player.currentChoice = data.choice; // Row number 1-8
            player.isLockedIn = true;
            console.log(`🔒 ${player.username} locked in choice: ${data.choice}`);
            
            // Check if all non-moderator players have locked in their choices BEFORE advancing turn
            const currentRoomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const currentVotingPlayers = currentRoomPlayers.filter(p => {
                const playerRoom = roomList.find(r => r.name === room);
                return !(playerRoom && p.username === playerRoom.creator); // Exclude moderator
            });
            
            const allLockedInBeforeAI = currentVotingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
            
            // Only advance turn in turn-based mode if not all players have locked in yet
            if (gameSession.turnBased && !allLockedInBeforeAI) {
                console.log(`🔄 Not all players locked in yet, advancing turn...`);
                GameSession.advanceTurn(room);
            } else if (gameSession.turnBased && allLockedInBeforeAI) {
                console.log(`🏁 All players have locked in, pausing turn advancement until round processes`);
            }
            
            // Broadcast lock-in event to all players in the room for visual feedback
            const allRoomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const currentRoom = roomList.find(r => r.name === room);
            
            allRoomPlayers.forEach(p => {
                if (p.socket) {
                    const isModerator = currentRoom && p.username === currentRoom.creator;
                    
                    p.socket.emit('playerLockedIn', {
                        username: player.username,
                        row: data.choice, // Now show row to ALL players, not just moderators
                        isAI: player.isAI || false,
                        showRowDetails: true, // Always show details to everyone
                        currentTurnPlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : null,
                        turnOrder: gameSession.turnOrder || [],
                        turnBased: gameSession.turnBased,
                        column: gameSession.selectedColumn // Show selected column to everyone
                    });
                }
            });
            
            // Immediately broadcast player status update to all players
            broadcastPlayerStatusUpdate(room);
            
            // Check if all non-moderator players have locked in their choices
            const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const votingPlayers = roomPlayers.filter(p => {
                const playerRoom = roomList.find(r => r.name === room);
                return !(playerRoom && p.username === playerRoom.creator); // Exclude moderator
            });
            
            const allLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
            
            console.log(`🎯 Lock-in status: ${votingPlayers.filter(p => p.isLockedIn).length}/${votingPlayers.length} players locked in`);
            
            // AI players auto-lock-in when they make decisions
            if (!allLockedIn) {
                // Trigger AI players to make their decisions and auto-lock-in
                AIPlayer.processAIDecisions(room, gameSession);
            }
            
            // Check again after AI processing
            const allFinallyLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
            
            if (allFinallyLockedIn) {
                console.log(`🎯 All players locked in! Processing round...`);
                // Small delay to ensure all UI updates are complete
                setTimeout(() => {
                    processRound(room, gameSession);
                }, 500);
            }
        } else {
            // Just a selection, not a lock-in yet - still update moderator display
            console.log(`🎯 ${player.username} selected (not locked): ${data.choice}`);
            player.currentChoice = data.choice; // Update selection immediately
            
            // Broadcast the selection update to moderators
            broadcastPlayerStatusUpdate(room);
        }
    });

    // Moderator column mode control
    socket.on('setColumnMode', function(data) {
        const gameSession = GameSession.get(data.room);
        if (!gameSession) return;
        
        const player = Player.list[socket.id];
        if (!player) {
            console.log(`🚫 Unknown player tried to set column mode`);
            return;
        }
        
        // Check if player is moderator by comparing with room creator
        const currentRoom = roomList.find(r => r.name === data.room);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (!isModerator) {
            console.log(`🚫 Non-moderator ${player.username} tried to set column mode`);
            return;
        }
        
        const newMode = data.autoMode ? 'auto' : 'manual';
        
        // If game hasn't started yet, apply immediately
        if (gameSession.currentRound === 0) {
            gameSession.columnMode = newMode;
            console.log(`🎛️ Moderator ${player.username} set column mode to: ${gameSession.columnMode} (immediate - game not started)`);
            
            // Clear manual column when switching to auto
            if (data.autoMode) {
                gameSession.manualColumn = null;
            }
        } else {
            // Game is in progress, schedule change for next round
            gameSession.pendingColumnMode = newMode;
            gameSession.pendingChangeRound = gameSession.currentRound + 1;
            console.log(`🎛️ Moderator ${player.username} scheduled column mode change to: ${newMode} starting round ${gameSession.pendingChangeRound}`);
            
            // Clear manual column when scheduling switch to auto
            if (data.autoMode) {
                gameSession.manualColumn = null;
            }
        }
        
        // Notify all players in room
        const roomSockets = Object.values(Player.list)
            .filter(p => p.room === data.room)
            .map(p => p.socket)
            .filter(s => s); // Filter out null sockets
        
        roomSockets.forEach(sock => {
            if (gameSession.currentRound === 0) {
                // Immediate change
                sock.emit('columnModeChanged', {
                    mode: gameSession.columnMode,
                    moderator: player.username,
                    immediate: true
                });
            } else {
                // Pending change
                sock.emit('columnModeChanged', {
                    mode: gameSession.columnMode,
                    moderator: player.username,
                    immediate: false,
                    pendingMode: gameSession.pendingColumnMode,
                    pendingRound: gameSession.pendingChangeRound
                });
            }
        });
    });
    
    // Manual column selection by moderator
    socket.on('selectColumn', function(data) {
        const gameSession = GameSession.get(data.room);
        if (!gameSession) return;
        
        const player = Player.list[socket.id];
        if (!player) {
            console.log(`🚫 Unknown player tried to select column`);
            return;
        }
        
        // Check if player is moderator by comparing with room creator
        const currentRoom = roomList.find(r => r.name === data.room);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (!isModerator) {
            console.log(`🚫 Non-moderator ${player.username} tried to select column`);
            return;
        }
        
        if (gameSession.columnMode !== 'manual') {
            console.log(`🚫 Column selection ignored - not in manual mode`);
            return;
        }
        
        gameSession.manualColumn = data.column;
        console.log(`📌 Moderator ${player.username} selected column: ${data.column}`);
        
        // Notify all players in room
        const roomSockets = Object.values(Player.list)
            .filter(p => p.room === data.room)
            .map(p => p.socket)
            .filter(s => s); // Filter out null sockets
        
        roomSockets.forEach(sock => {
            sock.emit('columnSelected', {
                column: data.column,
                moderator: player.username
            });
        });
    });

    // Legacy map change handler (keep for compatibility but not used in behavioral experiment)
    socket.on('changeMap',function(data){
        // Disabled for behavioral experiment
        console.log(`🚫 Map change disabled in behavioral experiment mode`);
    });

    // Player Sockets
    
    // Get players in the current room only
    const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
    const roomPlayerData = playersInRoom.map(p => p.getInitPack());
    
    // Only send init events if io is provided (for coordinated multi-user start, io will be null)
    if (io) {
        // Send personalized init data to each player in the room
        playersInRoom.forEach(player => {
            player.socket.emit('init', {
                selfId: player.socket.id,
                player: roomPlayerData,
            });
        });
    }

    // socket.emit('init',{
    //     selfId:socket.id,
    //     player:Player.getAllInitPack(),
    // })

    // ===============================================
    // TESTING PANEL EVENT HANDLERS (MODERATOR ONLY)
    // ===============================================
    
    // System message broadcast
    socket.on('systemMessage', function(data) {
        if (!player || !data.room) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || currentRoom.creator !== player.username) {
            console.log(`🚫 Non-moderator ${player.username} attempted to send system message`);
            return;
        }
        
        console.log(`📢 System message from ${player.username} to room ${data.room}: "${data.message}"`);
        
        // Broadcast to all players in room
        const roomSockets = Object.values(Player.list)
            .filter(p => p.room === data.room)
            .map(p => p.socket)
            .filter(s => s);
        
        roomSockets.forEach(sock => {
            sock.emit('chatMessage', {
                username: '🔧 System',
                text: `📢 ${data.message}`,
                time: formatMessage('System', data.message).time,
                isSystemMessage: true
            });
        });
        
        socket.emit('systemMessageSent', { message: data.message });
    });
    
    // Set player incentive
    socket.on('setPlayerIncentive', function(data) {
        if (!player || !data.room || !data.playerName) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || player.username !== currentRoom.creator) {
            console.log(`❌ ${player.username} tried to set incentive but is not moderator`);
            return;
        }
        
        // Find target player
        const targetPlayer = Object.values(Player.list).find(p => 
            p.room === data.room && p.username === data.playerName
        );
        
        if (!targetPlayer) {
            socket.emit('incentiveSetResult', { 
                success: false, 
                message: `Player ${data.playerName} not found` 
            });
            return;
        }
        
        // Set the incentive
        targetPlayer.activeIncentive = data.incentiveType || null;
        
        console.log(`🎯 ${player.username} set incentive for ${data.playerName}: ${data.incentiveType || 'none'}`);
        
        // Notify moderator
        socket.emit('incentiveSetResult', { 
            success: true, 
            playerName: data.playerName,
            incentiveType: data.incentiveType || null,
            message: `Incentive set for ${data.playerName}` 
        });
        
        // Notify the target player if they have a socket (human player)
        if (targetPlayer.socket) {
            targetPlayer.socket.emit('incentiveChanged', {
                incentiveType: data.incentiveType || null
            });
        }
        
        // Broadcast updated status
        broadcastPlayerStatusUpdate(data.room);
    });
    
    // Request player status for testing view
    socket.on('requestPlayerStatus', function(data) {
        if (!player || !data.room) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || currentRoom.creator !== player.username) {
            console.log(`🚫 Non-moderator ${player.username} requested player status`);
            return;
        }
        
        const playersInRoom = Object.values(Player.list).filter(p => p.room === data.room);
        const playerData = playersInRoom.map(p => ({
            name: p.username,
            isAI: p.isAI || false,
            selectedRow: p.currentChoice || null,
            lockedIn: p.isLockedIn || false
        }));
        
        const lockedCount = playerData.filter(p => p.lockedIn).length;
        
        socket.emit('playerStatusUpdate', {
            room: data.room,
            round: session.currentRound,
            players: playerData,
            lockedCount: lockedCount,
            totalCount: playerData.length
        });
    });
    
    // AI behavior control
    socket.on('setAIBehavior', function(data) {
        if (!player || !data.room) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || currentRoom.creator !== player.username) {
            console.log(`🚫 Non-moderator ${player.username} attempted to change AI behavior`);
            return;
        }
        
        // Store AI behavior setting in session
        session.aiBehaviorMode = data.mode;
        session.aiSpecificRow = data.specificRow;
        
        console.log(`🤖 AI behavior set by ${player.username} in ${data.room}: ${data.mode}`, data.specificRow ? `Row ${data.specificRow}` : '');
        
        socket.emit('aiBehaviorSet', {
            mode: data.mode,
            specificRow: data.specificRow
        });
    });
    
    // Condition selection control
    socket.on('setCondition', function(data) {
        if (!player || !data.room || !data.conditionKey) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || currentRoom.creator !== player.username) {
            console.log(`🚫 Non-moderator ${player.username} attempted to change experimental condition`);
            return;
        }
        
        // Validate condition key
        if (!Conditions[data.conditionKey]) {
            console.log(`🚫 Invalid condition key: ${data.conditionKey}`);
            return;
        }
        
        // Update session condition
        session.currentCondition = Conditions[data.conditionKey];
        
        console.log(`💰 Experimental condition changed to: ${session.currentCondition.name} by ${player.username} in room ${data.room}`);
        
        // Notify only moderators in the room about the condition change (players don't need details)
        const room = roomList.find(r => r.name === data.room);
        if (room) {
            const roomPlayers = Object.values(Player.list).filter(p => p.room === data.room);
            roomPlayers.forEach(p => {
                if (p.socket && p.username === room.creator) {
                    p.socket.emit('conditionChanged', {
                        condition: {
                            name: session.currentCondition.name,
                            whiteValue: session.currentCondition.whiteTokenValue,
                            blackValue: session.currentCondition.blackTokenValue,
                            maxPayout: session.currentCondition.maxPayout
                        }
                    });
                }
            });
        }
    });
    
    // Pause/resume experiment
    socket.on('pauseExperiment', function(data) {
        if (!player || !data.room) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || currentRoom.creator !== player.username) {
            console.log(`🚫 Non-moderator ${player.username} attempted to pause experiment`);
            return;
        }
        
        session.isPaused = true;
        console.log(`⏸️ Experiment paused by ${player.username} in room ${data.room}`);
        
        socket.emit('experimentPaused', { room: data.room });
    });
    
    socket.on('resumeExperiment', function(data) {
        if (!player || !data.room) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || currentRoom.creator !== player.username) {
            console.log(`🚫 Non-moderator ${player.username} attempted to resume experiment`);
            return;
        }
        
        session.isPaused = false;
        console.log(`▶️ Experiment resumed by ${player.username} in room ${data.room}`);
        
        socket.emit('experimentResumed', { room: data.room });
        
        // Trigger AI decisions if we're in the middle of a round
        if (session.currentState === 'waiting_for_players') {
            setTimeout(() => {
                triggerAIDecisions(data.room);
            }, 1000);
        }
    });
    
    // Reset current round
    socket.on('resetRound', function(data) {
        if (!player || !data.room) return;
        
        const session = GameSessions[data.room];
        if (!session) return;
        
        // Verify user is moderator
        const currentRoom = roomList.find(r => r.name === data.room);
        if (!currentRoom || currentRoom.creator !== player.username) {
            console.log(`🚫 Non-moderator ${player.username} attempted to reset round`);
            return;
        }
        
        console.log(`🔄 Round reset by ${player.username} in room ${data.room}`);
        
        // Reset all players in room
        const playersInRoom = Object.values(Player.list).filter(p => p.room === data.room);
        playersInRoom.forEach(p => {
            p.selectedRow = null;
            p.lockedIn = false;
        });
        
        // Reset session state
        session.currentState = 'waiting_for_players';
        session.lockedInCount = 0;
        session.playerChoices = {};
        
        // Notify all players
        const roomSockets = playersInRoom
            .map(p => p.socket)
            .filter(s => s);
        
        roomSockets.forEach(sock => {
            const playerSocket = Object.values(Player.list).find(p => p.socket === sock);
            const isModerator = currentRoom && playerSocket && playerSocket.username === currentRoom.creator;
            const canVote = !isModerator && playerSocket && !playerSocket.isAI;
            
            sock.emit('roundReset', {
                round: session.currentRound,
                message: 'Round has been reset by moderator'
            });
            sock.emit('yourTurn', {
                isYourTurn: canVote,
                isModerator: isModerator,
                activePlayer: session.turnBased ? GameSession.getCurrentTurnPlayer(data.room) : 'All participants',
                round: session.currentRound,
                turnBased: session.turnBased,
                turnOrder: session.turnOrder,
                condition: {
                    name: session.currentCondition.name,
                    whiteValue: session.currentCondition.whiteTokenValue,
                    blackValue: session.currentCondition.blackTokenValue
                },
                grid: session.grid,
                totalPlayers: playersInRoom.length
            });
        });
        
        socket.emit('roundReset', { room: data.room });
    });

    // Save Intentory, if player was in a game
    socket.on('disconnect', function(){
        Database.savePlayerProgress({
            username:player.username,
            items:player.inventory.items,
        });
    });
    
    } catch (error) {
        console.error('❌ Error in Player.onGameStart:', error, 'for user:', username, 'room:', room);
        socket.emit('error', { message: 'Error joining game' });
    }
}

Player.getAllInitPack = function(){
    var players = [];
    for (var i in Player.list)
        players.push(Player.list[i].getInitPack());
    return players;
}

// Runs when client disconnects
Player.onDisconnect = function(socket, io){
    let player = Player.list[socket.id];
    if(!player)
        return;
    delete Player.list[socket.id];
    removePack.player.push(socket.id);

    // Don't duplicate the user leave logic here since it's handled in the disconnect event
    // The user leave and room update is already handled in the socket disconnect event above
}

Player.update = function(){
    var pack = [];
    for(var i in Player.list){
        var player = Player.list[i];
        player.update();
        pack.push(player.getUpdatePack());
    }
    return pack;
}

Player.getLength = function(){
    return Object.keys(Player.list).length;
}

// Behavioral Economics Round Processing Functions
function startNewRound(roomName, gameSession) {
    if (!gameSession) return;
    
    console.log(`🔄 Starting round ${gameSession.currentRound} in room ${roomName}`);
    console.log(`🔍 Round ${gameSession.currentRound} state:`, {
        condition: gameSession.currentCondition?.name,
        culturants: gameSession.culturantsProduced,
        isBaseline: gameSession.currentCondition === Conditions.BASELINE
    });
    
    // Apply any pending column mode changes
    if (gameSession.pendingColumnMode && gameSession.pendingChangeRound === gameSession.currentRound) {
        gameSession.columnMode = gameSession.pendingColumnMode;
        console.log(`🎛️ Applied pending column mode change: ${gameSession.columnMode} for round ${gameSession.currentRound}`);
        
        // Clear pending change
        gameSession.pendingColumnMode = null;
        gameSession.pendingChangeRound = null;
        
        // Notify all players that the mode change has taken effect
        const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
        roomPlayers.forEach(player => {
            if (player.socket) {
                player.socket.emit('columnModeChanged', {
                    mode: gameSession.columnMode,
                    moderator: 'System',
                    immediate: true,
                    applied: true
                });
            }
        });
    }
    
    // Reset player choices and lock-in status for new round
    const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
    roomPlayers.forEach(p => {
        p.currentChoice = null;
        p.isLockedIn = false; // Reset lock-in status for new round
    });
    
    // Start new round with rotating starting player (turn-based system)
    if (gameSession.turnBased && gameSession.turnOrder.length > 0) {
        const currentTurnPlayer = GameSession.startNewRound(roomName);
        console.log(`🔄 Round ${gameSession.currentRound}: ${currentTurnPlayer} starts this round`);
        
        // Broadcast turn information to all players
        roomPlayers.forEach(p => {
            if (p.socket) {
                p.socket.emit('turnUpdate', {
                    turnOrder: gameSession.turnOrder,
                    currentTurnPlayer: currentTurnPlayer,
                    currentTurnIndex: gameSession.currentTurnIndex,
                    roundStartPlayer: gameSession.turnOrder[gameSession.roundStartPlayer],
                    turnBased: gameSession.turnBased
                });
            }
        });
    }
    
    // Immediately broadcast the reset status to moderators
    broadcastPlayerStatusUpdate(roomName);
    
    // Notify all human players about the new round and reset UI
    roomPlayers.forEach((player, index) => {
        if (player.socket) { // Only notify human players with real sockets
            const currentRoom = roomList.find(r => r.name === roomName);
            const isModerator = currentRoom && player.username === currentRoom.creator;
            
            // In turn-based behavioral experiments
            const canVote = !isModerator && !player.isAI; // Human participants can vote
            const isPlayerTurn = gameSession.turnBased ? GameSession.isPlayerTurn(roomName, player.username) : canVote;
            
            player.socket.emit('yourTurn', {
                isYourTurn: isPlayerTurn,
                isModerator: isModerator,
                activePlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(roomName) : 'All participants',
                round: gameSession.currentRound,
                turnBased: gameSession.turnBased,
                turnOrder: gameSession.turnOrder,
                currentTurnIndex: gameSession.currentTurnIndex,
                condition: {
                    name: gameSession.currentCondition.name,
                    whiteValue: gameSession.currentCondition.whiteTokenValue,
                    blackValue: gameSession.currentCondition.blackTokenValue
                },
                grid: gameSession.grid,
                playerPosition: player.triadPosition,
                totalPlayers: roomPlayers.length,
                whiteTokensRemaining: GlobalTokenPool.whiteTokens, // Add token pool data
                culturantsProduced: gameSession.culturantsProduced // Add culturant count
            });
            console.log(`🎯 Sent yourTurn for round ${gameSession.currentRound} to ${player.username} (canVote: ${canVote}, moderator: ${isModerator})`);
        }
    });
    
    // In turn-based mode, trigger AI decision only for the starting player if they're an AI
    // For non-turn-based mode, trigger all AI players
    const aiPlayersInRoom = roomPlayers.filter(p => p.isAI);
    if (aiPlayersInRoom.length > 0) {
        console.log(`🤖 Found ${aiPlayersInRoom.length} AI players for round ${gameSession.currentRound}, triggering their decisions...`);
        
        if (gameSession.turnBased) {
            // Turn-based: Only trigger the starting player if they're an AI
            const startingPlayer = GameSession.getCurrentTurnPlayer(roomName);
            const startingAI = aiPlayersInRoom.find(ai => ai.username === startingPlayer);
            if (startingAI) {
                console.log(`🤖 Triggering initial AI decision for first player ${startingPlayer}`);
                setTimeout(() => {
                    AIPlayer.processAIDecisions(roomName, gameSession);
                }, 2000); // 2 second delay to allow UI setup
            }
        } else {
            // Non-turn-based: Trigger all AI players
            setTimeout(() => {
                AIPlayer.processAIDecisions(roomName, gameSession);
            }, AIPlayer.decisionDelay);
        }
    }
}

// Calculate incentive bonus tokens for a player based on their active incentive
function calculateIncentiveBonus(player, chosenRow, gameSession) {
    if (!player.activeIncentive) return 0;
    
    let bonusTokens = 0;
    const rowType = chosenRow % 2 === 1 ? 'odd' : 'even';
    
    switch (player.activeIncentive) {
        case 'performance':
            // Performance incentive: +1 black token for choosing odd rows (high performance choice)
            if (rowType === 'odd') {
                bonusTokens = 1;
            }
            break;
        case 'collaboration':
            // Collaboration incentive: +1 black token for choosing even rows (cooperative choice)
            if (rowType === 'even') {
                bonusTokens = 1;
            }
            break;
        case 'consistency':
            // Consistency incentive: +1 black token if choice matches previous round choice
            if (gameSession.currentRound > 1 && player.previousChoice) {
                const previousRowType = parseInt(player.previousChoice) % 2 === 1 ? 'odd' : 'even';
                if (rowType === previousRowType) {
                    bonusTokens = 1;
                }
            }
            break;
        case 'leadership':
            // Leadership incentive: +1 black token if this player is the active player (their turn)
            if (player.isActivePlayer) {
                bonusTokens = 1;
            }
            break;
        default:
            bonusTokens = 0;
    }
    
    return bonusTokens;
}

function processRound(roomName, gameSession) {
    // Prevent double processing of the same round
    if (gameSession.roundProcessing) {
        console.log(`⚠️ Round ${gameSession.currentRound} is already being processed, skipping duplicate call`);
        return;
    }
    
    gameSession.roundProcessing = true;
    const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
    console.log(`⚙️ Processing round ${gameSession.currentRound} in room ${roomName}`);
    
    // Select column for this round (experimenter/system picks)
    const selectedColumn = GameSession.selectColumnForRound(gameSession);
    gameSession.selectedColumn = selectedColumn;
    
    console.log(`🎯 Selected column for round ${gameSession.currentRound}: ${selectedColumn}`);
    
    // Notify all players which column was selected
    const roomSockets = roomPlayers.map(p => p.socket).filter(s => s);
    console.log(`📡 Notifying ${roomSockets.length} players about column selection`);
    
    // Always notify all players about the selected column, regardless of mode
    roomSockets.forEach(sock => {
        if (gameSession.columnMode === 'auto') {
            console.log(`📡 Sending autoColumnSelected: ${selectedColumn} to player`);
            sock.emit('autoColumnSelected', {
                column: selectedColumn,
                round: gameSession.currentRound
            });
        } else {
            // Manual mode - notify about the manually selected column
            console.log(`📡 Sending columnSelected: ${selectedColumn} to player`);
            sock.emit('columnSelected', {
                column: selectedColumn,
                round: gameSession.currentRound,
                moderator: 'System' // During round processing
            });
        }
    });
    
    // Calculate tokens based on condition rules - simplified to match specifications
    let whiteTokensAwarded = 0;
    let blackTokensAwarded = 0;
    let culturantProduced = false;
    
    // Check if all voting players (excluding moderator) chose even rows (self-control) = culturant
    const currentRoom = roomList.find(r => r.name === roomName);
    const votingPlayers = roomPlayers.filter(p => {
        return !(currentRoom && p.username === currentRoom.creator); // Exclude moderator
    });
    
    const allChooseEvenRows = votingPlayers.length > 0 && votingPlayers.every(player => {
        if (!player.currentChoice) return false;
        const chosenRow = parseInt(player.currentChoice);
        return chosenRow % 2 === 0; // Even rows (2,4,6,8)
    });
    
    roomPlayers.forEach(player => {
        if (!player.currentChoice) return;
        
        // Skip token/earnings awards for moderators
        const currentRoom = roomList.find(r => r.name === roomName);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (isModerator) {
            console.log(`🎯 ${player.username}: Moderator - no tokens awarded`);
            return; // Skip token awarding for moderators
        }
        
        const chosenRow = parseInt(player.currentChoice); // Player chose row 1-8
        const condition = gameSession.currentCondition;
        
        // Award white tokens based on row choice and current condition
        const whiteTokensEarned = condition.getWhiteTokens(chosenRow);
        player.whiteTokens += whiteTokensEarned;
        whiteTokensAwarded += whiteTokensEarned;
        
        // Award black token if all chose even rows (culturant produced)
        if (allChooseEvenRows) {
            player.blackTokens += 1;
            blackTokensAwarded += 1;
        }
        
        // Award incentive bonus if player has active incentive
        let incentiveBonusAwarded = 0;
        if (player.activeIncentive) {
            incentiveBonusAwarded = calculateIncentiveBonus(player, chosenRow, gameSession);
            if (incentiveBonusAwarded > 0) {
                player.blackTokens += incentiveBonusAwarded;
                player.incentiveBonusTokens += incentiveBonusAwarded;
                blackTokensAwarded += incentiveBonusAwarded;
            }
        }
        
        player.roundsPlayed++;
        
        // Store previous choice for next round incentive calculations
        player.previousChoice = player.currentChoice;
        
        const rowType = chosenRow % 2 === 1 ? 'odd' : 'even';
        const incentiveText = incentiveBonusAwarded > 0 ? ` + ${incentiveBonusAwarded} incentive black token(s)` : '';
        console.log(`🎯 ${player.username}: Row ${chosenRow} (${rowType}) = ${whiteTokensEarned} white tokens${allChooseEvenRows ? ' + 1 black token' : ''}${incentiveText}`);
    });
    
    // Deduct white tokens from global pool (2,500 shared pool)
    console.log(`🎯 Token pool BEFORE deduction: ${GlobalTokenPool.whiteTokens}, deducting: ${whiteTokensAwarded}`);
    GlobalTokenPool.whiteTokens -= whiteTokensAwarded;
    console.log(`🎯 Token pool AFTER deduction: ${GlobalTokenPool.whiteTokens}`);
    
    // Track culturant production (all chose even rows)
    if (allChooseEvenRows) {
        gameSession.culturantsProduced++;
        culturantProduced = true;
        console.log(`🎯 Culturant produced! All players chose even rows. Total culturants: ${gameSession.culturantsProduced}`);
        console.log(`🔍 Current condition: ${gameSession.currentCondition?.name || 'undefined'}`);
        console.log(`🔍 Is baseline condition?`, gameSession.currentCondition === Conditions.BASELINE);
        console.log(`🔍 Baseline reference:`, Conditions.BASELINE?.name);
        
        // Check for automatic condition change after 2 total culturants produced (baseline only) - TEMPORARY FOR TESTING
        if (gameSession.culturantsProduced === 2 && gameSession.currentCondition === Conditions.BASELINE) {
            console.log(`🔄 TRIGGERING AUTOMATIC CONDITION CHANGE: 2 culturants reached in baseline`);
            // Determine next condition - cycle through conditions
            const conditionKeys = Object.keys(Conditions);
            const currentIndex = conditionKeys.findIndex(key => Conditions[key] === gameSession.currentCondition);
            const nextIndex = (currentIndex + 1) % conditionKeys.length;
            const nextConditionKey = conditionKeys[nextIndex];
            const nextCondition = Conditions[nextConditionKey];
            
            console.log(`🔄 Condition change details:`, {
                conditionKeys,
                currentIndex,
                nextIndex,
                nextConditionKey,
                nextConditionName: nextCondition?.name
            });
            
            // Change to next condition
            gameSession.currentCondition = nextCondition;
            console.log(`🔄 AUTOMATIC CONDITION CHANGE: After 2 total culturants produced, changed from BASELINE to ${nextCondition.name}`);
            
            // Notify all players in the room about the automatic condition change
            const currentRoom = roomList.find(r => r.name === roomName);
            if (currentRoom) {
                const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
                roomPlayers.forEach(p => {
                    if (p.socket) {
                        p.socket.emit('conditionChanged', {
                            condition: {
                                name: nextCondition.name,
                                whiteValue: nextCondition.whiteTokenValue,
                                blackValue: nextCondition.blackTokenValue,
                                maxPayout: nextCondition.maxPayout
                            },
                            automatic: true,
                            reason: 'After 2 total culturants produced'
                        });
                    }
                });
                
                // Also send baseline exit notification to moderator only
                const moderatorSocket = Object.values(Player.list)
                    .find(p => p.username === currentRoom.creator && p.room === roomName)?.socket;
                
                if (moderatorSocket) {
                    moderatorSocket.emit('baselineExited', {
                        round: gameSession.currentRound,
                        message: `Baseline condition successfully exited on round ${gameSession.currentRound}.`
                    });
                }
                
                // Log the automatic change
                gameSession.dataLog.push({
                    timestamp: new Date().toISOString(),
                    round: gameSession.currentRound,
                    event: 'automatic_condition_change',
                    from: 'BASELINE',
                    to: nextCondition.name,
                    reason: '2_total_culturants_produced'
                });
            }
        } else {
            console.log(`🔍 Automatic condition change NOT triggered:`, {
                culturantsProduced: gameSession.culturantsProduced,
                needsToBe: 2,
                isExactly2: gameSession.culturantsProduced === 2,
                currentCondition: gameSession.currentCondition?.name,
                isBaseline: gameSession.currentCondition === Conditions.BASELINE,
                baselineName: Conditions.BASELINE?.name
            });
        }
    }
    
    // Convert tokens to money based on current condition (exclude moderators)
    roomPlayers.forEach(player => {
        const currentRoom = roomList.find(r => r.name === roomName);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (isModerator) {
            // Moderators always have 0 earnings
            player.totalEarnings = 0;
        } else {
            const whiteValue = player.whiteTokens * gameSession.currentCondition.whiteTokenValue;
            const blackValue = player.blackTokens * gameSession.currentCondition.blackTokenValue;
            player.totalEarnings = whiteValue + blackValue;
        }
    });
    
    // Log data for export
    gameSession.dataLog.push({
        timestamp: new Date().toISOString(),
        round: gameSession.currentRound,
        condition: gameSession.currentCondition.name,
        players: roomPlayers.map(p => ({
            username: p.username,
            choice: p.currentChoice,
            whiteTokens: p.whiteTokens,
            blackTokens: p.blackTokens,
            earnings: p.totalEarnings
        })),
        culturantProduced: culturantProduced,
        whiteTokensRemaining: GlobalTokenPool.whiteTokens
    });
    
    // Send round results to all human players
    roomPlayers.forEach(player => {
        if (player.socket) { // Only notify human players
            const chosenRow = parseInt(player.currentChoice);
            const condition = gameSession.currentCondition;
            const whiteTokensEarned = condition.getWhiteTokens(chosenRow);
            const incentiveBonusEarned = player.activeIncentive ? calculateIncentiveBonus(player, chosenRow, gameSession) : 0;
            
            // Prepare all player token data for moderators
            const allPlayerTokens = roomPlayers.map(p => ({
                username: p.username,
                isAI: p.isAI || false,
                isModerator: currentRoom && p.username === currentRoom.creator,
                tokensAwarded: {
                    white: condition.getWhiteTokens(parseInt(p.currentChoice)),
                    black: allChooseEvenRows ? 1 : 0,
                    incentiveBonus: p.activeIncentive ? calculateIncentiveBonus(p, parseInt(p.currentChoice), gameSession) : 0
                },
                totalTokens: {
                    white: p.whiteTokens,
                    black: p.blackTokens
                }
            }));
            
            player.socket.emit('roundResult', {
                round: gameSession.currentRound,
                condition: {
                    name: condition.name,
                    whiteValue: condition.whiteTokenValue,
                    blackValue: condition.blackTokenValue,
                    maxPayout: condition.maxPayout
                },
                playerChoice: {
                    row: chosenRow,
                    rowType: chosenRow % 2 === 1 ? 'odd' : 'even'
                },
                choices: roomPlayers.map(p => {
                    const pRow = parseInt(p.currentChoice);
                    return {
                        username: p.username, 
                        choice: p.currentChoice, // Row number 1-8
                        rowType: pRow % 2 === 1 ? 'odd' : 'even',
                        isAI: p.isAI || false,
                        isModerator: currentRoom && p.username === currentRoom.creator
                    };
                }),
                tokensAwarded: {
                    white: whiteTokensEarned,
                    black: allChooseEvenRows ? 1 : 0,
                    incentiveBonus: incentiveBonusEarned
                },
                totalTokens: {
                    white: player.whiteTokens,
                    black: player.blackTokens
                },
                totalEarnings: player.totalEarnings,
                culturantProduced: culturantProduced,
                culturantsProduced: gameSession.culturantsProduced, // Total culturants produced so far
                whiteTokensRemaining: GlobalTokenPool.whiteTokens,
                activeIncentive: player.activeIncentive || null,
                allPlayerTokens: allPlayerTokens, // Add all player data for moderators
                players: roomPlayers.map(p => ({ // Add player wallet data for updateAllWalletDisplays
                    username: p.username,
                    whiteTokens: p.whiteTokens,
                    blackTokens: p.blackTokens,
                    totalEarnings: p.totalEarnings,
                    isAI: p.isAI || false,
                    isModerator: currentRoom && p.username === currentRoom.creator
                }))
            });
        }
    });
    
    // Broadcast final round status to moderators
    broadcastPlayerStatusUpdate(roomName);
    
    // Reset round processing flag
    gameSession.roundProcessing = false;
    
    // Check end conditions
    if (gameSession.currentRound >= gameSession.maxRounds || GlobalTokenPool.whiteTokens <= 0) {
        endExperiment(roomName, gameSession);
    } else {
        // Start next round after delay
        gameSession.currentRound++;
        setTimeout(() => startNewRound(roomName, gameSession), 3000); // 3 second delay
    }
}

function endExperiment(roomName, gameSession) {
    console.log(`🏁 Ending experiment in room ${roomName} after ${gameSession.currentRound} rounds`);
    gameSession.gameState = 'finished';
    
    const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
    
    // Calculate final payouts
    const finalResults = roomPlayers.map(player => ({
        username: player.username,
        whiteTokens: player.whiteTokens,
        blackTokens: player.blackTokens,
        totalEarnings: player.totalEarnings,
        roundsPlayed: player.roundsPlayed
    }));
    
    // Send final results to all human players
    roomPlayers.forEach(player => {
        if (player.socket) { // Only notify human players
            player.socket.emit('experimentEnd', {
                finalResults: finalResults,
                totalRounds: gameSession.currentRound,
                culturantsProduced: gameSession.culturantsProduced,
                sessionDuration: new Date() - gameSession.sessionStartTime,
                exportData: gameSession.dataLog // For CSV export
            });
        }
    });
}

// Export data function (can be called by admin)
function exportGameData(roomName) {
    const gameSession = GameSession.get(roomName);
    if (!gameSession) return null;
    
    return {
        sessionInfo: {
            roomName: roomName,
            startTime: gameSession.sessionStartTime,
            totalRounds: gameSession.currentRound,
            culturantsProduced: gameSession.culturantsProduced,
            finalCondition: gameSession.currentCondition.name
        },
        dataLog: gameSession.dataLog
    };
}
