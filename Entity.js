var initPack = {player:[]};
var removePack = {player:[]};
const { uniqueNamesGenerator, colors, animals } = require('unique-names-generator');
var _ = require('lodash');
require('./client/Inventory');
let Commands = require('./Commands')
let Room = require('./Room')
const formatMessage = require("./utils/messages");

// Token Pool Configuration Constants
const TOKEN_CONFIG = {
    BASELINE_TOKENS: 100,
    CONDITIONS_TOKENS: 2500,
    MAX_TOKENS: 2500  // Maximum for validation and UI limits
};

const {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
} = require("./utils/users");
const ExperimentScheduler = require('./ExperimentScheduler');

const botName = "Server";
const mainChat = "Global";


// Track recent disconnections to suppress refresh spam notifications
const recentDisconnections = new Map(); // username -> { timestamp, room, timeout }

// Behavioral Economics Experiment State
var GameSessions = {}; // Key: room name, Value: session data

// Experiment Manager - handles scheduling and mode switching
var ExperimentManager = {
    scheduler: new ExperimentScheduler(),
    
    // Initialize experiment for a room
    initializeExperiment: function(roomName, mode = 'baseline') {
        console.log(`🧪 Initializing ${mode} experiment for room: ${roomName}`);
        
        if (mode === 'baseline') {
            // Baseline is now a unified experiment that flows into conditions
            const conditionsSchedule = this.scheduler.generateConditionsSchedule();
            return {
                mode: 'unified', // Changed from 'baseline' to indicate this flows into conditions
                phase: 'baseline', // Current phase: 'baseline' or 'conditions'
                schedule: conditionsSchedule, // Use the conditions schedule for the full experiment
                currentRound: 0,
                baselineRounds: 0, // Track baseline rounds separately
                whiteTokenPool: TOKEN_CONFIG.BASELINE_TOKENS, // Start with baseline pool
                totalWhiteTokenPool: TOKEN_CONFIG.CONDITIONS_TOKENS, // Will switch to this after baseline
                maxBaselineRounds: 500, // Max rounds before forced transition
                maxRounds: 441 // Total experimental rounds after baseline
            };
        } else if (mode === 'conditions') {
            // Direct conditions mode (skip baseline)
            return {
                mode: 'conditions', 
                phase: 'conditions',
                schedule: this.scheduler.generateConditionsSchedule(),
                currentRound: 0,
                whiteTokenPool: TOKEN_CONFIG.CONDITIONS_TOKENS,
                maxRounds: 441
            };
        }
        
        throw new Error(`Unknown experiment mode: ${mode}`);
    },
    
    // Get current experimental condition and incentive for a round
    getCurrentConditionInfo: function(experiment, roundNumber) {
        console.log(`🔍 Getting condition info for experiment:`, {
            mode: experiment.mode,
            phase: experiment.phase,
            currentRound: experiment.currentRound,
            baselineRounds: experiment.baselineRounds,
            roundNumber: roundNumber
        });
        
        // Handle unified experiment (baseline flowing into conditions)
        if (experiment.mode === 'unified') {
            if (experiment.phase === 'baseline') {
                return {
                    condition: Conditions.BASELINE,
                    conditionName: 'Baseline',
                    incentive: 'No Incentive',
                    player: null, // No player assignment in baseline
                    phase: 'baseline'
                };
            } else {
                // In conditions phase - use the schedule
                const currentRound = this.scheduler.getCurrentRound(experiment.schedule, experiment.currentRound);
                if (!currentRound) {
                    console.log(`⚠️ No schedule data found for round ${experiment.currentRound}`);
                    return null;
                }
                
                // Map condition name to condition object
                let condition = this.mapConditionNameToObject(currentRound.condition);
                
                return {
                    condition: condition,
                    conditionName: currentRound.condition,
                    incentive: currentRound.incentive,
                    player: currentRound.player,
                    blockNumber: currentRound.blockNumber,
                    phase: 'conditions'
                };
            }
        }
        
        // Handle legacy baseline mode
        if (experiment.mode === 'baseline') {
            return {
                condition: Conditions.BASELINE,
                conditionName: 'Baseline',
                incentive: 'No Incentive',
                player: null // No player assignment in baseline
            };
        }
        
        // Handle direct conditions mode
        const currentRound = this.scheduler.getCurrentRound(experiment.schedule, roundNumber);
        if (!currentRound) {
            console.log(`⚠️ No schedule data found for round ${roundNumber}`);
            return null;
        }
        
        // Map condition name to condition object
        let condition = this.mapConditionNameToObject(currentRound.condition);
        
        return {
            condition: condition,
            conditionName: currentRound.condition,
            incentive: currentRound.incentive,
            player: currentRound.player,
            blockNumber: currentRound.blockNumber
        };
    },
    
    // Helper function to map condition names to condition objects
    mapConditionNameToObject: function(conditionName) {
        switch (conditionName) {
            case 'High Culturant':
                return Conditions.HIGH_CULTURANT;
            case 'High Operant':
                return Conditions.HIGH_OPERANT;
            case 'Equal Culturant–Operant':
                return Conditions.EQUAL_CULTURANT_OPERANT;
            default:
                console.log(`⚠️ Unknown condition: ${conditionName}`);
                return Conditions.BASELINE;
        }
    },
    
    // Check if experiment should end
    shouldEndExperiment: function(experiment, currentRound, whiteTokensRemaining) {
        return this.scheduler.shouldEndExperiment(
            experiment.mode,
            currentRound,
            whiteTokensRemaining,
            experiment.maxRounds
        );
    }
};

// Token pool - now dynamically managed per experiment mode and phase
var GlobalTokenPool = {
    whiteTokens: 100, // Will be set dynamically based on experiment
    blackTokens: Infinity, // Unlimited black tokens
    
    // Initialize token pool based on experiment mode and phase
    initialize: function(experiment) {
        if (experiment.mode === 'unified') {
            if (experiment.phase === 'baseline') {
                this.whiteTokens = experiment.whiteTokenPool; // 100 for baseline
                console.log(`🪙 Token pool initialized for baseline phase: ${this.whiteTokens} white tokens`);
            } else {
                this.whiteTokens = experiment.whiteTokenPool; // CONDITIONS_TOKENS for conditions
                console.log(`🪙 Token pool initialized for conditions phase: ${this.whiteTokens} white tokens`);
            }
        } else if (experiment.mode === 'conditions') {
            this.whiteTokens = experiment.whiteTokenPool; // CONDITIONS_TOKENS
            console.log(`🪙 Token pool initialized for conditions mode: ${this.whiteTokens} white tokens`);
        } else if (experiment.mode === 'baseline') {
            this.whiteTokens = experiment.whiteTokenPool; // 100
            console.log(`🪙 Token pool initialized for baseline mode: ${this.whiteTokens} white tokens`);
        }
    },
    
    // Transition from baseline to conditions phase
    transitionToConditions: function(experiment) {
        if (experiment.mode === 'unified') {
            // Always reset to full conditions pool when transitioning
            this.whiteTokens = experiment.totalWhiteTokenPool; // CONDITIONS_TOKENS
            console.log(`🔄 Token pool transitioned to conditions phase: ${this.whiteTokens} white tokens`);
        }
    }
};

// Experimental conditions - Token assignment rules and payout calculations  
var Conditions = {
    BASELINE: {
        name: "Baseline",
        whiteTokenValue: 0.01,  // $0.01 each
        blackTokenValue: 0.05,  // $0.05 each
        // Rules: Odd row → 3 white ($0.03), Even row → 1 white ($0.01), All even → +1 black each ($0.05)
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        getBlackTokens: (allChoseEven) => allChoseEven ? 1 : 0,
        maxPayout: 0.06
    },
    HIGH_CULTURANT: {
        name: "High Culturant", 
        whiteTokenValue: 0.02,  // $0.02 each
        blackTokenValue: 0.07,  // $0.07 each
        // Rules: Odd row → 3 white ($0.06), Even row → 1 white ($0.02), All even → +1 black each ($0.07)
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        getBlackTokens: (allChoseEven) => allChoseEven ? 1 : 0,
        maxPayout: 0.09
    },
    HIGH_OPERANT: {
        name: "High Operant",
        whiteTokenValue: 0.03,  // $0.03 each
        blackTokenValue: 0.04,  // $0.04 each
        // Rules: Odd row → 3 white ($0.09), Even row → 1 white ($0.03), All even → +1 black each ($0.04)
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        getBlackTokens: (allChoseEven) => allChoseEven ? 1 : 0,
        maxPayout: 0.09 // Updated to reflect odd choice being higher value
    },
    EQUAL_CULTURANT_OPERANT: {
        name: "Equal Culturant-Operant",
        whiteTokenValue: 0.01,  // $0.01 each
        blackTokenValue: 0.02,  // $0.02 each
        // Rules: Odd row → 3 white ($0.03), Even row → 1 white ($0.01), All even → +1 black each ($0.02)
        getWhiteTokens: (rowChoice) => rowChoice % 2 === 1 ? 3 : 1,
        getBlackTokens: (allChoseEven) => allChoseEven ? 1 : 0,
        maxPayout: 0.03
    }
};

// Incentive bonuses - additional payouts based on incentive type
var IncentiveBonuses = {
    'No Incentive': {
        bonus: 0,
        description: 'No additional bonus',
        displayName: 'No Incentive'
    },
    'Culturant Incentive': {
        bonus: 0.02, // $0.02 bonus for culturant behavior (choosing even rows when all do)
        description: 'Bonus for cooperative behavior (all choose even rows)',
        displayName: 'Bonus: Choose Even Rows (2, 4, 6, 8)',
        appliesWhen: 'allChoseEven'
    },
    'Operant Incentive': {
        bonus: 0.02, // $0.02 bonus for individual choice
        description: 'Bonus for individual operant choice',
        displayName: 'Bonus: Choose Odd Rows (1, 3, 5, 7)',
        appliesWhen: 'always'
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
            
            // Send targeted player status update only to moderator after AI decision
            // to avoid disrupting other players' UI during AI gameplay
            const session = GameSessions[room];
            if (session) {
                const currentRoom = roomList.find(r => r.name === room);
                if (currentRoom) {
                    const moderatorPlayer = Object.values(Player.list)
                        .find(p => p.room === room && p.username === currentRoom.creator);
                    
                    if (moderatorPlayer && moderatorPlayer.socket) {
                        const roomPlayersForUpdate = Object.values(Player.list).filter(p => p.room === room);
                        const playerData = roomPlayersForUpdate.map(p => ({
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
                            room: room,
                            round: session.currentRound,
                            players: playerData,
                            lockedCount: lockedCount,
                            totalCount: playerData.length,
                            condition: session.currentCondition.name,
                            whiteTokensRemaining: GlobalTokenPool.whiteTokens,
                            culturantsProduced: session.culturantsProduced || 0
                        };
                        
                        moderatorPlayer.socket.emit('playerStatusUpdate', updateData);
                        console.log(`📊 Targeted AI player status update sent to moderator ${currentRoom.creator} only`);
                    }
                }
            }
            
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
    self.isLockedIn = false;        // Whether player has locked in their choice
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
    create: function(roomName, experimentMode = 'baseline') {
        if (GameSessions[roomName]) {
            return GameSessions[roomName];
        }
        
        // Initialize experiment
        const experiment = ExperimentManager.initializeExperiment(roomName, experimentMode);
        
        GameSessions[roomName] = {
            roomName: roomName,
            currentRound: 0,
            maxRounds: experiment.maxRounds,
            currentCondition: Conditions.BASELINE,
            currentIncentive: 'No Incentive',
            currentPlayer: null,
            currentBlockNumber: null,
            activePlayerIndex: 0, // Which player's turn (0, 1, 2)
            roundChoices: [], // Store choices for current round
            gameState: 'lobby', // 'lobby', 'playing', 'finished'
            culturantsProduced: 0,
            sessionStartTime: new Date(),
            dataLog: [], // For CSV export
            roundHistory: [], // Store completed round results for reconnection restoration
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
            playersReady: [], // Track which players are ready for their turn
            // Experiment properties
            experiment: experiment,
            whiteTokenPool: experiment.whiteTokenPool,
            initialWhiteTokens: experiment.whiteTokenPool
        };
        
        // Initialize the global token pool based on experiment
        GlobalTokenPool.initialize(experiment);
        
        console.log(`🎮 Created new GameSession for room: ${roomName}`);
        console.log(`🧪 Experiment mode: ${experiment.mode}`);
        console.log(`🔍 Initial condition: ${GameSessions[roomName].currentCondition.name}`);
        console.log(`� Initial white token pool: ${experiment.whiteTokenPool}`);
        console.log(`🔍 Max rounds: ${experiment.maxRounds}`);
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
    },
    
    // Update experimental condition for the current round
    updateConditionForRound: function(roomName, roundNumber) {
        const session = GameSessions[roomName];
        if (!session || !session.experiment) return;
        
        const conditionInfo = ExperimentManager.getCurrentConditionInfo(session.experiment, roundNumber);
        if (!conditionInfo) return;
        
        // Update session with new condition information
        session.currentCondition = conditionInfo.condition;
        session.currentIncentive = conditionInfo.incentive;
        session.currentPlayer = conditionInfo.player;
        session.currentBlockNumber = conditionInfo.blockNumber;
        
        // Helper function to map scheduler player letters (A, B, C) to actual player names
        const currentRoom = roomList.find(r => r.name === roomName);
        const mapSchedulerPlayerToName = (schedulerPlayer, roomPlayersList) => {
            // Include both human and AI players, but exclude moderator
            const eligiblePlayers = roomPlayersList.filter(p => !(currentRoom && p.username === currentRoom.creator));
            const playerIndex = schedulerPlayer === 'A' ? 0 : schedulerPlayer === 'B' ? 1 : 2;
            const selectedPlayer = eligiblePlayers[playerIndex];
            
            if (selectedPlayer) {
                // Handle AI players that might have null usernames
                return selectedPlayer.username || `AI_Player_${schedulerPlayer}`;
            }
            
            return `Player ${schedulerPlayer}`;
        };
        
        // Broadcast condition update to all players in room
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        
        // Only assign a player name if there's an actual incentive (not "No Incentive")
        const actualPlayerName = (conditionInfo.incentive && conditionInfo.incentive !== 'No Incentive') 
            ? mapSchedulerPlayerToName(conditionInfo.player, playersInRoom)
            : null;
        
        console.log(`🧪 Updated condition for round ${roundNumber}:`);
        console.log(`   Condition: ${conditionInfo.conditionName}`);
        console.log(`   Incentive: ${conditionInfo.incentive}`);
        console.log(`   Player: ${actualPlayerName} (scheduler: ${conditionInfo.player})`);
        if (conditionInfo.blockNumber) {
            console.log(`   Block: ${conditionInfo.blockNumber}/7`);
        }
        
        // Broadcast condition update to all players in room        
        playersInRoom.forEach(p => {
            if (p.socket) {
                const incentiveDisplayName = IncentiveBonuses[conditionInfo.incentive] ? 
                    IncentiveBonuses[conditionInfo.incentive].displayName : conditionInfo.incentive;
                
                const isModerator = currentRoom && p.username === currentRoom.creator;
                
                console.log(`📡 Sending conditionUpdate to ${p.username}: player=${actualPlayerName}, incentive=${conditionInfo.incentive}`);
                
                // Prepare conditionUpdate data
                const conditionUpdateData = {
                    round: roundNumber,
                    condition: conditionInfo.conditionName,
                    incentive: conditionInfo.incentive,
                    incentiveDisplay: incentiveDisplayName,
                    player: actualPlayerName, // Always send actual player name for proper targeting
                    blockNumber: conditionInfo.blockNumber,
                    phase: conditionInfo.phase,
                    tokenValues: {
                        white: conditionInfo.condition.whiteTokenValue,
                        black: conditionInfo.condition.blackTokenValue
                    }
                };
                
                // For moderators, add players array for LED tracker
                if (isModerator) {
                    const roomPlayers = Object.values(Player.list).filter(player => player.room === roomName);
                    conditionUpdateData.players = roomPlayers.map(player => ({
                        name: player.username,
                        id: player.id,
                        isAI: player.id.startsWith('AI_')
                    }));
                    console.log(`📡 LED TRACKER: Added ${conditionUpdateData.players.length} players for moderator ${p.username}`);
                    console.log(`📡 LED TRACKER DEBUG: Players array for ${p.username}:`, JSON.stringify(conditionUpdateData.players, null, 2));
                }
                
                console.log(`📡 conditionUpdate data for ${p.username}:`, JSON.stringify(conditionUpdateData, null, 2));
                
                p.socket.emit('conditionUpdate', conditionUpdateData);
                
                // Also send targeted incentiveChanged event to the specific player
                if (p.username === actualPlayerName && conditionInfo.incentive && conditionInfo.incentive !== 'No Incentive') {
                    console.log(`🎯 Sending targeted incentiveChanged to ${p.username}: ${incentiveDisplayName}`);
                    p.socket.emit('incentiveChanged', {
                        incentiveType: conditionInfo.incentive,
                        incentiveDisplay: incentiveDisplayName,
                        message: `You now have an active incentive: ${incentiveDisplayName}`
                    });
                }
            }
        });
        
        return conditionInfo;
    },
    
    // Check if experiment should end and handle end game
    checkExperimentEnd: function(roomName) {
        const session = GameSessions[roomName];
        if (!session || !session.experiment) return false;
        
        const endStatus = ExperimentManager.shouldEndExperiment(
            session.experiment,
            session.currentRound,
            session.whiteTokenPool
        );
        
        if (endStatus.shouldEnd) {
            console.log(`🏁 Experiment ending: ${endStatus.reason}`);
            session.gameState = 'finished';
            
            // Broadcast experiment end to all players
            const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
            playersInRoom.forEach(p => {
                if (p.socket) {
                    p.socket.emit('experimentEnded', {
                        reason: endStatus.reason,
                        totalRounds: session.currentRound,
                        finalTokenPool: session.whiteTokenPool
                    });
                }
            });
            
            return true;
        }
        
        return false;
    }
};

// Redundant legacy map coordinates (unused in behavioral experiment)
// Keeping commented for reference; safe to remove later
// var continentCoords = {
//     NorthEast:{ x:1500, y:100 },
//     NorthWest:{ x:300, y:100 },
//     SouthEast:{ x:1400, y:650 },
//     SouthWest:{ x:300, y:700 },
//     Middle:{ x:900, y:400 },
// }

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
        
        // Handle player in game sessions - PRESERVE player state for potential reconnection
        if (room !== mainChat && room !== "Global") {
            const leavingPlayer = Object.values(Player.list).find(p => p.socket && p.socket.id === socket.id && p.room === room);
            if (leavingPlayer) {
                console.log(`🔌 ${leavingPlayer.username} disconnected from active game in room: ${room} - preserving player state for reconnection`);
                
                // Instead of deleting, just mark socket as disconnected and set to null
                leavingPlayer.socket = null;  // Clear socket but keep player data
                console.log(`🔄 Player ${leavingPlayer.username} state preserved: isLockedIn=${leavingPlayer.isLockedIn}, currentChoice=${leavingPlayer.currentChoice}`);
                
                // Don't delete the player - they can reconnect and resume their game state
                // delete Player.list[leavingPlayer.id]; // ❌ REMOVED - this was causing state loss
                
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

    socket.on("joinRoom", (roomData) => {
        // Handle both string format ("roomName") and object format ({ room: "roomName" })
        let room = typeof roomData === 'string' ? roomData : roomData.room;
        
        if (!room || typeof room !== 'string') {
            console.log('❌ Invalid room data received:', roomData);
            return;
        }

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

            // Check for quick reconnection (page refresh detection)
            if (recentDisconnections.has(playerData.username)) {
                const disconnectionData = recentDisconnections.get(playerData.username);
                const timeSinceDisconnect = Date.now() - disconnectionData.timestamp;
                
                if (timeSinceDisconnect < 5000) { // 5 second window for reconnection
                    console.log(`🔄 Quick reconnection detected for ${playerData.username} (${timeSinceDisconnect}ms) - suppressing leave/join messages`);
                    
                    // Cancel the delayed leave message
                    if (disconnectionData.timeout) {
                        clearTimeout(disconnectionData.timeout);
                    }
                    
                    // Clean up tracking
                    recentDisconnections.delete(playerData.username);
                    
                    // Skip join message for quick reconnections
                    var skipJoinMessage = true;
                } else {
                    console.log(`🔄 Reconnection detected for ${playerData.username} but too slow (${timeSinceDisconnect}ms) - showing join message`);
                    var skipJoinMessage = false;
                }
            } else {
                var skipJoinMessage = false;
            }

            // Welcome current user
            socket.emit("message", formatMessage({
                username: botName,
                text: `Welcome to ${room} chat!`,
                type: "update",
                admin: "admin",
                room: room
            }));

            // Send detailed player info for poker table updates
            const currentRoom = roomList.find(r => r.name === room);
            const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
            const allRoomUsers = getRoomUsers(room);
            
            // Check if this is a reconnection (same username, different socket ID) for join message suppression
            const isReconnectingUser = allRoomUsers.some(user => user.username === playerData.username && user.id !== socket.id);
            
            // Only broadcast join message if this is NOT a reconnection AND not a quick refresh
            if (!isReconnectingUser && !skipJoinMessage) {
                console.log(`📡 Broadcasting join message for ${playerData.username} (new join, not reconnection or refresh)`);
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
            } else {
                console.log(`🔄 Suppressing join message for ${playerData.username} (reconnection: ${isReconnectingUser}, refresh: ${skipJoinMessage})`);
            }

            // Send users and room info
            io.to(user.room).emit("roomUsers", {
                room: room,
                users: getRoomUsers(user.room),
                usersCount: Player.getLength() 
            });

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
            
            console.log(`📡 Emitting playersInRoom to individual socket for ${playerData.username} in ${room}:`, playersWithModerator);
            // Only send playersInRoom to the specific joining/reconnecting player
            // Don't disrupt other players' UIs who are already in the room
            socket.emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
            
            console.log(`📡 Also sent playersInRoom directly to ${playerData.username}`);
            
            // If this is a new player joining (not reconnecting), broadcast to room so moderator sees the new player
            const isReconnection = allRoomUsers.some(user => user.username === playerData.username && user.id !== socket.id);
            if (!isReconnection && room !== "Global") {
                console.log(`📡 Broadcasting new player join to room ${room} (not a reconnection)`);
                io.to(room).emit('playersInRoom', {
                    room: room,
                    players: playersWithModerator
                });
            }

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
                        try {
                            Player.onGameStart(playerData.socket, playerData.username, progress, io, room, playerData.admin);
                            
                            // After successful reconnection, broadcast updated player list to everyone in room
                            // This ensures all players see the updated socket ID for the reconnecting player
                            const reconnectionRoomUsers = getRoomUsers(room);
                            const allReconnectionPlayersData = reconnectionRoomUsers.map(user => ({
                                username: user.username,
                                id: user.id,
                                isAI: false,
                                isModerator: user.admin || false
                            }));
                            
                            // Add AI players to the list
                            const roomAIPlayers = Object.values(Player.list).filter(p => p.room === room && p.isAI);
                            roomAIPlayers.forEach(aiPlayer => {
                                allReconnectionPlayersData.push({
                                    username: aiPlayer.username,
                                    id: aiPlayer.id,
                                    isAI: true,
                                    isModerator: false
                                });
                            });
                            
                            console.log(`📡 Broadcasting playersInRoom after ${playerData.username} reconnected to ${room}:`, allReconnectionPlayersData);
                            io.to(room).emit('playersInRoom', {
                                room: room,
                                players: allReconnectionPlayersData
                            });
                            
                        } catch (error) {
                            console.error(`❌ Error reconnecting ${playerData.username} to game in ${room}:`, error);
                            // Still allow the user to join the room even if game join fails
                        }
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

        //Logic to execute commands - check admin status first for commands that exist in both
        if (command in commands.admin) {
            //Check if user is admin
            Database.isAdmin({ username: playerData.username }, function (res) {
                if (res === true) {
                    //Execute admin command if they are admin
                    commands.runAdminCommand();
                } else if (command in commands.normal) {
                    //Fall back to normal command if they're not admin but command exists in normal
                    commands.runNormalCommand();
                } else {
                    console.log("NOT Admin " + playerData.username);
                }
            });
        }

        else if (command in commands.normal) {
            commands.runNormalCommand();
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
            
            // Store disconnection info and delay the leave message
            const disconnectionData = {
                timestamp: Date.now(),
                room: user.room,
                timeout: null
            };
            
            // Cancel any existing timeout for this user
            if (recentDisconnections.has(user.username)) {
                const existingData = recentDisconnections.get(user.username);
                if (existingData.timeout) {
                    clearTimeout(existingData.timeout);
                }
            }
            
            // Set a delay before showing the leave message
            disconnectionData.timeout = setTimeout(() => {
                // Check if user is still disconnected (not reconnected)
                if (recentDisconnections.has(user.username)) {
                    console.log(`📤 Showing delayed leave message for ${user.username} (no quick reconnect detected)`);
                    // Send leave message to the room the user was in
                    io.to(user.room).emit(
                        "message",
                        formatMessage({
                            username: botName,
                            text: `${user.username} has left the chat`,
                            type: "status",
                            room: user.room
                        })
                    );
                    
                    // Clean up tracking
                    recentDisconnections.delete(user.username);
                }
            }, 3000); // 3 second delay to detect quick reconnections (page refresh)
            
            recentDisconnections.set(user.username, disconnectionData);
            
            // Handle player in game sessions - PRESERVE player state for potential reconnection  
            const leavingPlayer = Object.values(Player.list).find(p => p.socket && p.socket.id === socket.id && p.room === user.room);
            if (leavingPlayer) {
                console.log(`🔌 ${leavingPlayer.username} disconnected from active game in room: ${user.room} - preserving player state for reconnection`);
                
                // Instead of deleting, just mark socket as disconnected  
                leavingPlayer.socket = null;  // Clear socket but keep player data
                console.log(`🔄 Player ${leavingPlayer.username} state preserved: isLockedIn=${leavingPlayer.isLockedIn}, currentChoice=${leavingPlayer.currentChoice}`);
                
                // Don't delete the player - they can reconnect and resume their game state
                // delete Player.list[leavingPlayer.id]; // ❌ REMOVED - this was causing state loss
                
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
        console.log('🧪 Experiment mode:', data.experimentMode || 'baseline (default)');
        
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
                startGameForExistingPlayers(data.room, socket, data.experimentMode);
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
                                    startGameForExistingPlayers(data.room, socket, data.experimentMode);
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
                            startGameForExistingPlayers(data.room, socket, data.experimentMode);
                        }
                    }
                } catch (userError) {
                    console.error('❌ Error processing user in startGame:', userError, 'User:', user);
                    playersCreated++;
                    if (playersCreated === totalPlayersToCreate) {
                        startGameForExistingPlayers(data.room, socket, data.experimentMode);
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Critical error in startGame handler:', error);
            socket.emit('error', { message: 'Critical error starting game' });
        }
    });
    
    // Helper function to start game for existing players
    function startGameForExistingPlayers(room, initiatingSocket, experimentMode = 'baseline') {
        try {
            console.log('🎮 Starting game for existing players in room:', room);
            console.log('🧪 Using experiment mode:', experimentMode);
            
            // Get all players in the room (both human and AI)
            const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const humanPlayers = roomPlayers.filter(p => !p.isAI);
            
            console.log(`🎮 Room ${room} has ${roomPlayers.length} total players (${humanPlayers.length} human, ${roomPlayers.length - humanPlayers.length} AI)`);
            
            // Get or create game session with experiment mode
            const gameSession = GameSession.get(room) || GameSession.create(room, experimentMode);
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
                            gameState: 'playing',
                            experiment: gameSession.experiment ? {
                                mode: gameSession.experiment.mode,
                                whiteTokenPool: gameSession.whiteTokenPool,
                                initialWhiteTokens: gameSession.initialWhiteTokens
                            } : null
                        }
                    });
                } else {
                    console.warn(`⚠️ Player ${player.username} has invalid socket`);
                }
            });
            
            // Notify all sockets in the room that the game started
            io.to(room).emit("gameStarted");
            console.log(`🎮 Game started successfully in ${room} with ${roomPlayers.length} players`);
            
            // Send updated playersInRoom to all players so they see the complete player list
            const gameStartRoomUsers = getRoomUsers(room);
            const allPlayersData = gameStartRoomUsers.map(user => ({
                username: user.username,
                id: user.id,
                isAI: false,
                isModerator: user.admin || false
            }));
            
            // Add AI players to the list
            roomPlayers.filter(p => p.isAI).forEach(aiPlayer => {
                allPlayersData.push({
                    username: aiPlayer.username,
                    id: aiPlayer.id,
                    isAI: true,
                    isModerator: false
                });
            });
            
            console.log(`📡 Emitting playersInRoom after game start for ${room}:`, allPlayersData);
            io.to(room).emit('playersInRoom', {
                room: room,
                players: allPlayersData
            });
            
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
            
            // Update poker table positions for reconnecting player only
            // Don't broadcast to everyone to avoid disrupting existing players' UI
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
            
            console.log(`🎮 Emitting playersInRoom for ${room} to reconnecting player only:`, playersWithModerator);
            initiatingSocket.emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
            
        } catch (error) {
            console.error('❌ Error in startGameForExistingPlayers:', error);
            initiatingSocket.emit('error', { message: 'Error starting game' });
        }
    }
    
    // Helper function to update room players display - NEVER BROADCAST
    // This function should only be used for targeted individual socket updates
    function updateRoomPlayersDisplay(room, targetSocket = null) {
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
            
            // ONLY emit to specific target socket, NEVER broadcast to room
            if (targetSocket && typeof targetSocket.emit === 'function') {
                console.log(`� Targeted playersInRoom emission for ${room}:`, playersWithModerator);
                targetSocket.emit('playersInRoom', {
                    room: room,
                    players: playersWithModerator
                });
            } else {
                console.log(`⚠️ updateRoomPlayersDisplay called without valid target socket - skipping emission to prevent UI disruption`);
            }
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
        
        // Smart triad formation logic
        const maxTriadSize = 3; // Triad formation requires exactly 3 players (excluding moderator)
        const currentTotalPlayers = roomPlayers.length; // Current human + AI players
        
        // Calculate how many AI players are needed to reach triad formation
        const aiPlayersNeeded = Math.max(0, maxTriadSize - currentTotalPlayers);
        
        // Ensure we don't exceed the configured AI limit
        const maxAI = Math.min(aiPlayersNeeded, AIConfig.maxAIPlayers - aiPlayers.length);
        
        if (maxAI <= 0) {
            if (currentTotalPlayers >= maxTriadSize) {
                socket.emit('systemMessage', { 
                    message: `Triad formation complete - room already has ${currentTotalPlayers} players (${humanPlayers.length} human, ${aiPlayers.length} AI)` 
                });
            } else {
                socket.emit('systemMessage', { 
                    message: 'Cannot add more AI players - AI limit reached' 
                });
            }
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
        
        // Send success message with detailed information
        const finalTotalPlayers = currentTotalPlayers + maxAI;
        const finalHumanPlayers = humanPlayers.length;
        const finalAIPlayers = aiPlayers.length + maxAI;
        
        socket.emit('systemMessage', { 
            message: `Successfully added ${maxAI} AI player(s) to room ${room}. Triad formation: ${finalTotalPlayers}/3 players (${finalHumanPlayers} human, ${finalAIPlayers} AI)` 
        });
        
        console.log(`🤖 Successfully added ${maxAI} AI players to room ${room}. Final count: ${finalTotalPlayers} total (${finalHumanPlayers} human, ${finalAIPlayers} AI)`);
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
        
        // Debug: Show all players in Player.list
        const allPlayers = Object.values(Player.list);
        console.log(`🔍 All players in Player.list (${allPlayers.length}):`, allPlayers.map(p => `${p.username} (room: ${p.room}, id: ${p.id})`));
        
        // Check if this player already exists in this room
        const existingPlayer = Object.values(Player.list).find(p => p.room === room && p.username === username);
        console.log(`🔍 Looking for existing player: ${username} in room ${room}, found: ${!!existingPlayer}`);
        
        if (existingPlayer) {
            console.log(`🔄 Player ${username} already exists in room ${room}, updating socket reference`);
            console.log(`🔍 Before socket update - ${username}: isLockedIn=${existingPlayer.isLockedIn}, currentChoice=${existingPlayer.currentChoice}`);
            
            // Update the existing player with the new socket
            existingPlayer.socket = socket;
            existingPlayer.id = socket.id;
            
            console.log(`🔍 After socket update - ${username}: isLockedIn=${existingPlayer.isLockedIn}, currentChoice=${existingPlayer.currentChoice}`);
            console.log(`✅ Updated socket reference for ${username} in room ${room}`);
            
            // RE-REGISTER ESSENTIAL SOCKET HANDLERS for reconnected player
            console.log(`🔗 Re-registering essential socket handlers for ${username}`);
            
            // Re-register makeChoice handler using the same logic as the original
            socket.on('makeChoice', function(data) {
                const gameSession = GameSession.get(room);
                if (!gameSession || (gameSession.gameState !== 'playing' && gameSession.gameState !== 'ready')) {
                    socket.emit('error', { message: 'Game not in progress' });
                    return;
                }
                
                // Check if this player is the moderator (moderators can't vote)
                const currentRoom = roomList.find(r => r.name === room);
                const isModerator = currentRoom && existingPlayer.username === currentRoom.creator;
                
                if (isModerator) {
                    socket.emit('error', { message: 'Moderators cannot vote in the experiment' });
                    return;
                }
                
                // Check if it's this player's turn (if turn-based is enabled)
                if (gameSession.turnBased && !GameSession.isPlayerTurn(room, existingPlayer.username)) {
                    const currentTurnPlayer = GameSession.getCurrentTurnPlayer(room);
                    socket.emit('error', { message: `It's ${currentTurnPlayer}'s turn. Please wait.` });
                    return;
                }
                
                // Only process if this is a lock-in
                if (data.lockedIn) {
                    // Validate that player has made a choice
                    if (!data.choice || data.choice === null || data.choice === undefined) {
                        console.log(`🚫 ${existingPlayer.username} tried to lock in without making a choice`);
                        socket.emit('error', { message: 'You must select a row before locking in your choice' });
                        return;
                    }
                    
                    existingPlayer.currentChoice = data.choice; // Row number 1-8
                    existingPlayer.isLockedIn = true;
                    console.log(`🔒 ${existingPlayer.username} locked in choice: ${data.choice} - AFTER SETTING: currentChoice=${existingPlayer.currentChoice}, isLockedIn=${existingPlayer.isLockedIn}`);
                    
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
                                username: existingPlayer.username,
                                row: data.choice,
                                isAI: existingPlayer.isAI || false,
                                showRowDetails: true,
                                currentTurnPlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : null,
                                turnOrder: gameSession.turnOrder || [],
                                turnBased: gameSession.turnBased,
                                column: gameSession.selectedColumn
                            });
                        }
                    });
                    
                    // Auto-notify moderator about player lock-ins with details
                    if (currentRoom && currentRoom.creator) {
                        const moderatorPlayer = allRoomPlayers.find(p => p.username === currentRoom.creator && p.socket);
                        
                        if (moderatorPlayer) {
                            // Send status to moderator showing all player choices and earnable tokens
                            const updateData = {
                                players: currentVotingPlayers.map(p => ({
                                    username: p.username,
                                    currentChoice: p.currentChoice,
                                    isLockedIn: p.isLockedIn,
                                    isAI: p.isAI || false,
                                    tokens: p.whiteTokens || 0,
                                    totalEarnings: p.totalEarnings || 0
                                })),
                                allLockedIn: allLockedInBeforeAI
                            };
                            
                            moderatorPlayer.socket.emit('playerStatusUpdate', updateData);
                            console.log(`📊 Targeted player status update sent to moderator ${currentRoom.creator} only`);
                        }
                    }
                    
                    // Use the same logic as the original handler for checking lock-in status
                    const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
                    const votingPlayers = roomPlayers.filter(p => {
                        const playerRoom = roomList.find(r => r.name === room);
                        return !(playerRoom && p.username === playerRoom.creator); // Exclude moderator
                    });
                    const allLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
                    console.log(`🎯 Lock-in status: ${votingPlayers.filter(p => p.isLockedIn).length}/${votingPlayers.length} players locked in, allLockedIn=${allLockedIn}`);
                    
                    // AI players auto-lock-in when they make decisions
                    if (!allLockedIn) {
                        // Trigger AI players to make their decisions and auto-lock-in
                        AIPlayer.processAIDecisions(room, gameSession);
                    }
                    
                    const allFinallyLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);

                    if (allFinallyLockedIn) {
                        console.log(`🎯 All players locked in! Processing round...`);
                        // Small delay to ensure all UI updates are complete
                        setTimeout(() => {
                            processRound(room, gameSession);
                        }, 500);
                    } else {
                        console.log(`🚫 DEBUG: Not all players locked in, cannot process round`);
                    }
                } else {
                    // Just a selection, not a lock-in yet
                    console.log(`🎯 ${existingPlayer.username} selected (not locked): ${data.choice}`);
                    existingPlayer.currentChoice = data.choice; // Update selection immediately
                }
            });
            
            // Re-register disconnect handler  
            socket.removeAllListeners('disconnect');
            console.log(`🧹 Cleared existing disconnect handlers for ${username}`);
            socket.on('disconnect', () => {
                console.log(`🔌 Preserving player ${existingPlayer.username} state in room ${room} for potential reconnection`);
                existingPlayer.socket = null;
                console.log(`🔄 Preserved state: isLockedIn=${existingPlayer.isLockedIn}, currentChoice=${existingPlayer.currentChoice}, totalEarnings=${existingPlayer.totalEarnings}`);
            });
            
            console.log(`🔗 Essential socket handlers re-registered for ${username}`);
            // TRIGGER COMPREHENSIVE GAME STATE RESTORATION
            console.log(`🎮 Triggering comprehensive game state restoration for reconnecting ${username}`);
            Player.sendCompleteGameState(existingPlayer, room);
            const gameSession = GameSessions[room];
            if (gameSession) {
                // Send game state restoration events
                console.log(`🔄 Restoring game state for reconnecting player: ${existingPlayer.username} in room ${room}`);
                
                // Send init event to restore game UI
                existingPlayer.socket.emit('init', { 
                    selfId: existingPlayer.id 
                });
                
                // Send triad complete to restore game state
                existingPlayer.socket.emit('triadComplete', {
                    roomName: room,
                    players: Object.values(Player.list).filter(p => p.room === room).map(p => ({
                        username: p.username,
                        isAI: p.isAI || false,
                        isModerator: false // Will be corrected in playersInRoom
                    }))
                });
                
                // Send comprehensive game state restoration
                console.log(`🎮 Sending comprehensive game state restoration to reconnecting ${existingPlayer.username}`);
                
                // Get all players in the room for wallet and state restoration
                const currentPlayersInRoom = Object.values(Player.list).filter(p => p.room === room);
                const currentRoom = roomList.find(r => r.name === room);
                
                // 1. Send complete game session info
                existingPlayer.socket.emit('gameStateRestore', {
                    gameSession: {
                        roomName: room,
                        currentRound: gameSession.currentRound,
                        maxRounds: gameSession.maxRounds,
                        currentCondition: gameSession.currentCondition,
                        gameState: gameSession.gameState,
                        culturantsProduced: gameSession.culturantsProduced || 0,
                        selectedColumn: gameSession.selectedColumn,
                        turnBased: gameSession.turnBased,
                        turnOrder: gameSession.turnOrder,
                        roundChoices: gameSession.roundChoices || []
                    },
                    globalTokenPool: {
                        whiteTokens: GlobalTokenPool.whiteTokens,
                        blackTokens: GlobalTokenPool.blackTokens
                    }
                });
                
                // 2. Send all player wallets (for complete UI restoration)
                const allPlayersWalletData = currentPlayersInRoom.map(roomPlayer => ({
                    username: roomPlayer.username,
                    whiteTokens: roomPlayer.whiteTokens || 0,
                    blackTokens: roomPlayer.blackTokens || 0,
                    totalEarnings: roomPlayer.totalEarnings || 0,
                    isAI: roomPlayer.isAI || false,
                    isModerator: currentRoom && roomPlayer.username === currentRoom.creator
                }));
                
                console.log(`� Sending complete wallet data for all ${allPlayersWalletData.length} players to ${existingPlayer.username}`);
                existingPlayer.socket.emit('allPlayersWalletRestore', {
                    players: allPlayersWalletData
                });
                
                // 3. Send locked-in states for all players
                console.log(`�🔍 Checking ${currentPlayersInRoom.length} players for locked-in status:`);
                currentPlayersInRoom.forEach(roomPlayer => {
                    console.log(`🔍 Player ${roomPlayer.username}: isLockedIn=${roomPlayer.isLockedIn}, currentChoice=${roomPlayer.currentChoice}`);
                    
                    if (roomPlayer.isLockedIn && roomPlayer.currentChoice !== null) {
                        console.log(`📡 Sending playerLockedIn for ${roomPlayer.username} to reconnecting ${existingPlayer.username}`);
                        existingPlayer.socket.emit('playerLockedIn', {
                            username: roomPlayer.username,
                            row: roomPlayer.currentChoice,
                            isAI: roomPlayer.isAI,
                            showRowDetails: true,
                            currentTurnPlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : null,
                            turnOrder: gameSession.turnOrder || [],
                            turnBased: gameSession.turnBased,
                            column: gameSession.selectedColumn
                        });
                    } else {
                        console.log(`❌ ${roomPlayer.username} not locked in or has no choice`);
                    }
                });
                
                // 4. Send turn update to sync current turn state
                if (gameSession.turnBased) {
                    const currentTurnPlayer = GameSession.getCurrentTurnPlayer(room);
                    console.log(`📡 Sending turnUpdate to reconnecting ${existingPlayer.username}: currentTurnPlayer=${currentTurnPlayer}`);
                    existingPlayer.socket.emit('turnUpdate', {
                        currentTurnPlayer: currentTurnPlayer,
                        turnOrder: gameSession.turnOrder,
                        round: gameSession.currentRound,
                        turnBased: gameSession.turnBased
                    });
                } else {
                    console.log(`❌ No turnUpdate sent - game not turn-based`);
                }
                
                // 5. Send previous round results for history display
                if (gameSession.roundHistory && gameSession.roundHistory.length > 0) {
                    console.log(`📚 Sending ${gameSession.roundHistory.length} previous round results to ${existingPlayer.username}`);
                    existingPlayer.socket.emit('roundHistoryRestore', {
                        username: existingPlayer.username,
                        roundHistory: gameSession.roundHistory,
                        currentRound: gameSession.currentRound
                    });
                } else {
                    console.log(`📚 No previous round results to send to ${existingPlayer.username}`);
                }
                
                // Send yourTurn event to restore game controls
                const isPlayerTurn = gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) === existingPlayer.username : true;
                // Safe fallback for moderator status to avoid crashes
                let isModerator = false;
                try {
                    const currentRoom = roomList?.find(r => r.name === room);
                    isModerator = currentRoom && existingPlayer.username === currentRoom.creator;
                } catch (error) {
                    console.log(`⚠️ Could not determine moderator status for ${existingPlayer.username}, defaulting to false`);
                    isModerator = false;
                }
                console.log(`📡 Sending yourTurn to reconnecting ${existingPlayer.username}: isPlayerTurn=${isPlayerTurn}, isModerator=${isModerator}`);
                console.log(`🔄 Player ${existingPlayer.username} restoration: currentChoice=${existingPlayer.currentChoice}, isLockedIn=${existingPlayer.isLockedIn}`);
                existingPlayer.socket.emit('yourTurn', {
                    isYourTurn: isPlayerTurn,
                    isModerator: isModerator,
                    activePlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : 'All participants',
                    round: gameSession.currentRound,
                    turnBased: gameSession.turnBased,
                    turnOrder: gameSession.turnOrder,
                    condition: {
                        name: gameSession.currentCondition.name,
                        whiteValue: gameSession.currentCondition.whiteTokenValue,
                        blackValue: gameSession.currentCondition.blackTokenValue
                    },
                    grid: gameSession.grid,
                    playerPosition: existingPlayer.triadPosition,
                    totalPlayers: currentPlayersInRoom.length,
                    whiteTokensRemaining: GlobalTokenPool.whiteTokens,
                    culturantsProduced: gameSession.culturantsProduced,
                    // Restore player's current choice and locked-in status
                    currentChoice: existingPlayer.currentChoice,
                    isLockedIn: existingPlayer.isLockedIn
                });
                
                console.log(`✅ Game state restoration complete for ${existingPlayer.username}`);
            } else {
                console.log(`❌ No game session found for room ${room}`);
            }
            
            return existingPlayer; // Return existing player with updated socket
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
        
        // Send comprehensive game state to the new player
        console.log(`🎮 Sending comprehensive game state to new player ${player.username}`);
        Player.sendCompleteGameState(player, room);
    
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
        if (!gameSession || (gameSession.gameState !== 'playing' && gameSession.gameState !== 'ready')) {
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
            console.log(`🔒 ${player.username} locked in choice: ${data.choice} - AFTER SETTING: currentChoice=${player.currentChoice}, isLockedIn=${player.isLockedIn}`);
            
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
            
            // Send targeted player status update only to moderators in room (not all players)
            // to avoid disrupting other players' UI during gameplay
            const session = GameSessions[room];
            if (session) {
                const currentRoom = roomList.find(r => r.name === room);
                if (currentRoom) {
                    const moderatorPlayer = Object.values(Player.list)
                        .find(p => p.room === room && p.username === currentRoom.creator);
                    
                    if (moderatorPlayer && moderatorPlayer.socket) {
                        const roomPlayersForUpdate = Object.values(Player.list).filter(p => p.room === room);
                        const playerData = roomPlayersForUpdate.map(p => ({
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
                            room: room,
                            round: session.currentRound,
                            players: playerData,
                            lockedCount: lockedCount,
                            totalCount: playerData.length,
                            condition: session.currentCondition.name,
                            whiteTokensRemaining: GlobalTokenPool.whiteTokens,
                            culturantsProduced: session.culturantsProduced || 0
                        };
                        
                        moderatorPlayer.socket.emit('playerStatusUpdate', updateData);
                        console.log(`📊 Targeted player status update sent to moderator ${currentRoom.creator} only`);
                    }
                }
            }
            
            // Check if all non-moderator players have locked in their choices
            const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const votingPlayers = roomPlayers.filter(p => {
                const playerRoom = roomList.find(r => r.name === room);
                return !(playerRoom && p.username === playerRoom.creator); // Exclude moderator
            });
            
            const allLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
            
            console.log(`🎯 Lock-in status: ${votingPlayers.filter(p => p.isLockedIn).length}/${votingPlayers.length} players locked in, allLockedIn=${allLockedIn}`);
            
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
            } else {
                console.log(`🚫 DEBUG: Not all players locked in, cannot process round`);
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
    
    // Set token pool for experiment fast-forward (moderator only)
    socket.on('setTokenPool', function(data) {
        const player = Player.list[socket.id];
        if (!player) return;
        
        // Check if player is moderator
        const currentRoom = roomList.find(r => r.name === player.room);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (!isModerator) {
            console.log(`🚫 Non-moderator ${player.username} tried to set token pool`);
            return;
        }
        
        const gameSession = GameSession.get(player.room);
        if (!gameSession || !gameSession.experiment) {
            console.log(`🚫 No active experiment to modify`);
            return;
        }
        
        const newTokens = Math.max(0, Math.min(TOKEN_CONFIG.MAX_TOKENS, data.tokens));
        const oldTokens = GlobalTokenPool.whiteTokens;
        
        GlobalTokenPool.whiteTokens = newTokens;
        gameSession.whiteTokenPool = newTokens;
        
        console.log(`⚡ Moderator ${player.username} set token pool: ${oldTokens} → ${newTokens}`);
        
        // Notify all players in room about token pool change
        const roomPlayers = Object.values(Player.list).filter(p => p.room === player.room);
        roomPlayers.forEach(p => {
            if (p.socket) {
                p.socket.emit('newRound', {
                    whiteTokensRemaining: newTokens,
                    round: gameSession.currentRound,
                    message: `Token pool updated to ${newTokens} by moderator`
                });
                
                // Send status update to moderator
                if (p.username === currentRoom.creator) {
                    p.socket.emit('experimentStatusUpdate', {
                        phase: gameSession.experiment.phase || gameSession.experiment.mode,
                        tokens: newTokens,
                        round: gameSession.currentRound
                    });
                }
            }
        });
    });
    
    // Force phase transition from baseline to conditions (moderator only)
    socket.on('forcePhaseTransition', function() {
        const player = Player.list[socket.id];
        if (!player) return;
        
        // Check if player is moderator
        const currentRoom = roomList.find(r => r.name === player.room);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (!isModerator) {
            console.log(`🚫 Non-moderator ${player.username} tried to force phase transition`);
            return;
        }
        
        const gameSession = GameSession.get(player.room);
        if (!gameSession || !gameSession.experiment) {
            console.log(`🚫 No active experiment to modify`);
            return;
        }
        
        if (gameSession.experiment.mode !== 'unified' || gameSession.experiment.phase !== 'baseline') {
            console.log(`🚫 Cannot force transition - not in unified baseline phase`);
            return;
        }
        
        console.log(`⚡ Moderator ${player.username} forcing baseline to conditions transition`);
        
        // Force the transition
        gameSession.experiment.phase = 'conditions';
        gameSession.experiment.currentRound = 0;
        gameSession.experiment.whiteTokenPool = gameSession.experiment.totalWhiteTokenPool;
        
        // Update global token pool
        GlobalTokenPool.transitionToConditions(gameSession.experiment);
        
        // Update game session token pool to match global pool
        gameSession.whiteTokenPool = GlobalTokenPool.whiteTokens;
        
        // Notify all players about the transition
        const roomPlayers = Object.values(Player.list).filter(p => p.room === player.room);
        roomPlayers.forEach(p => {
            if (p.socket) {
                p.socket.emit('phaseTransition', {
                    from: 'baseline',
                    to: 'conditions',
                    newTokenPool: gameSession.experiment.whiteTokenPool,
                    message: `Moderator advanced to experimental conditions phase with ${gameSession.experiment.whiteTokenPool} tokens.`
                });
                
                // Send status update to moderator
                if (p.username === currentRoom.creator) {
                    p.socket.emit('experimentStatusUpdate', {
                        phase: 'conditions',
                        tokens: gameSession.experiment.whiteTokenPool,
                        round: gameSession.currentRound
                    });
                }
            }
        });
    });
    
    // Force end experiment (moderator only)
    socket.on('forceEndExperiment', function() {
        const player = Player.list[socket.id];
        if (!player) return;
        
        // Check if player is moderator
        const currentRoom = roomList.find(r => r.name === player.room);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (!isModerator) {
            console.log(`🚫 Non-moderator ${player.username} tried to force end experiment`);
            return;
        }
        
        const gameSession = GameSession.get(player.room);
        if (!gameSession) {
            console.log(`🚫 No active game session to end`);
            return;
        }
        
        console.log(`⚡ Moderator ${player.username} forcing experiment end`);
        endExperiment(player.room, gameSession);
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
        playersInRoom.forEach(existingPlayer => {
            // Check if player has a valid socket before emitting
            if (existingPlayer.socket && existingPlayer.socket.connected) {
                existingPlayer.socket.emit('init', {
                    selfId: existingPlayer.socket.id,
                    player: roomPlayerData,
                });
                
                // Only restore game state for the CURRENT player who is joining/reconnecting
                // Don't mess up other players' states who are already in the game
                console.log(`🔍 Checking restoration condition for ${existingPlayer.username}: existingPlayer.socket.id=${existingPlayer.socket.id}, socket.id=${socket.id}`);
                if (existingPlayer.socket.id === socket.id) {
                    console.log(`✅ Restoration condition passed for ${existingPlayer.username}`);
                    // Check if there's an active game session and restore game state for reconnecting player
                    const gameSession = GameSession.get(room);
                    if (gameSession && (gameSession.gameState === 'playing' || gameSession.gameState === 'ready')) {
                        console.log(`🔄 Restoring game state for reconnecting player: ${existingPlayer.username} in room ${room}`);
                        
                        // Determine if player is moderator
                        const currentRoom = roomList.find(r => r.name === room);
                        const isModerator = currentRoom && existingPlayer.username === currentRoom.creator;
                        
                        // Send triadComplete to show the proper game board
                        existingPlayer.socket.emit('triadComplete', {
                            message: gameSession.gameState === 'playing' ? 'Game in progress - you have rejoined!' : 'Game ready to continue!',
                            playerPosition: existingPlayer.triadPosition,
                            gameSession: {
                                currentRound: gameSession.currentRound,
                                maxRounds: gameSession.maxRounds,
                                condition: gameSession.currentCondition.name,
                                grid: gameSession.grid,
                                totalPlayers: playersInRoom.length,
                                gameState: gameSession.gameState,
                                turnBased: gameSession.turnBased,
                                turnOrder: gameSession.turnOrder,
                                currentTurnPlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : null
                            }
                        });
                        
                        // Send yourTurn to set up the proper UI state
                        const canVote = !isModerator && !existingPlayer.isAI && (gameSession.gameState === 'playing' || gameSession.gameState === 'ready');
                        const isPlayerTurn = gameSession.turnBased ? GameSession.isPlayerTurn(room, existingPlayer.username) : canVote;
                        
                        existingPlayer.socket.emit('yourTurn', {
                            isYourTurn: isPlayerTurn,
                            isModerator: isModerator,
                            activePlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : 'All participants',
                            round: gameSession.currentRound,
                            turnBased: gameSession.turnBased,
                            turnOrder: gameSession.turnOrder,
                            condition: {
                                name: gameSession.currentCondition.name,
                                whiteValue: gameSession.currentCondition.whiteTokenValue,
                                blackValue: gameSession.currentCondition.blackTokenValue
                            },
                            grid: gameSession.grid,
                            playerPosition: existingPlayer.triadPosition,
                            totalPlayers: playersInRoom.length,
                            whiteTokensRemaining: GlobalTokenPool.whiteTokens,
                            culturantsProduced: gameSession.culturantsProduced
                        });
                        
                        // Send current player status and lock-in information
                        const currentPlayersInRoom = Object.values(Player.list).filter(p => p.room === room);
                        console.log(`🔍 Checking ${currentPlayersInRoom.length} players for locked-in status:`);
                        
                        currentPlayersInRoom.forEach(roomPlayer => {
                            console.log(`🔍 Player ${roomPlayer.username}: isLockedIn=${roomPlayer.isLockedIn}, currentChoice=${roomPlayer.currentChoice}`);
                            
                            if (roomPlayer.isLockedIn && roomPlayer.currentChoice !== null) {
                                // Show locked in players to moderator or to all players if game rules allow
                                const showChoice = isModerator || !gameSession.turnBased; // Show details to moderator or in simultaneous mode
                                
                                console.log(`📡 Sending playerLockedIn for ${roomPlayer.username} to reconnecting ${existingPlayer.username}`);
                                existingPlayer.socket.emit('playerLockedIn', {
                                    username: roomPlayer.username,
                                    row: showChoice ? roomPlayer.currentChoice : null, // Only show choice if allowed
                                    isAI: roomPlayer.isAI,
                                    showRowDetails: showChoice,
                                    currentTurnPlayer: gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : null,
                                    turnOrder: gameSession.turnOrder || [],
                                    turnBased: gameSession.turnBased,
                                    column: gameSession.selectedColumn
                                });
                            } else {
                                console.log(`❌ ${roomPlayer.username} not locked in or has no choice`);
                            }
                        });
                        
                        // Send turn update to sync current turn state
                        if (gameSession.turnBased) {
                            const currentTurnPlayer = GameSession.getCurrentTurnPlayer(room);
                            console.log(`📡 Sending turnUpdate to reconnecting ${existingPlayer.username}: currentTurnPlayer=${currentTurnPlayer}`);
                            existingPlayer.socket.emit('turnUpdate', {
                                currentTurnPlayer: currentTurnPlayer,
                                turnOrder: gameSession.turnOrder,
                                round: gameSession.currentRound,
                                turnBased: gameSession.turnBased
                            });
                        } else {
                            console.log(`❌ No turnUpdate sent - game not turn-based`);
                        }
                        
                        // Send wallet restoration specifically for the reconnecting player
                        console.log(`💰 Sending wallet restoration to ${existingPlayer.username}: earnings=${existingPlayer.totalEarnings}, white=${existingPlayer.whiteTokens}, black=${existingPlayer.blackTokens}`);
                        existingPlayer.socket.emit('walletRestore', {
                            username: existingPlayer.username,
                            whiteTokens: existingPlayer.whiteTokens || 0,
                            blackTokens: existingPlayer.blackTokens || 0,
                            totalEarnings: existingPlayer.totalEarnings || 0
                        });
                        
                        // Send previous round results for reconnection restoration
                        if (gameSession.roundHistory && gameSession.roundHistory.length > 0) {
                            console.log(`📚 Sending ${gameSession.roundHistory.length} previous round results to ${existingPlayer.username}`);
                            existingPlayer.socket.emit('roundHistoryRestore', {
                                username: existingPlayer.username,
                                roundHistory: gameSession.roundHistory,
                                currentRound: gameSession.currentRound
                            });
                        } else {
                            console.log(`📚 No previous round results to send to ${existingPlayer.username}`);
                        }
                        
                        // Send targeted player status update to only the reconnecting player
                        // (not to all moderators) to avoid disrupting other players' UI
                        const session = GameSessions[room];
                        if (session) {
                            const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
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
                                room: room,
                                round: session.currentRound,
                                players: playerData,
                                lockedCount: lockedCount,
                                totalCount: playerData.length,
                                condition: session.currentCondition.name,
                                whiteTokensRemaining: GlobalTokenPool.whiteTokens,
                                culturantsProduced: session.culturantsProduced || 0
                            };
                            
                            // Send update only to the reconnecting player (not room-wide broadcast)
                            existingPlayer.socket.emit('playerStatusUpdate', updateData);
                            console.log(`📊 Targeted player status update sent to reconnecting player ${existingPlayer.username}`);
                        }
                        
                        console.log(`✅ Restored game state for ${existingPlayer.username} - moderator: ${isModerator}, canVote: ${canVote}, turn: ${gameSession.turnBased ? GameSession.getCurrentTurnPlayer(room) : 'simultaneous'}`);
                    }
                } else {
                    console.log(`❌ Restoration condition failed for ${existingPlayer.username}: not the reconnecting player`);
                }
            } else {
                console.log(`⚠️ Skipping init emit for ${existingPlayer.username} - socket not available`);
            }
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
            // Send chat message
            sock.emit('chatMessage', {
                username: '🔧 System',
                text: `📢 ${data.message}`,
                time: formatMessage('System', data.message).time,
                isSystemMessage: true
            });
            
            // Send notification popup
            sock.emit('systemNotification', {
                title: '📢 System Announcement',
                message: data.message,
                type: 'info'
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
            const incentiveDisplayName = data.incentiveType && IncentiveBonuses[data.incentiveType] ? 
                IncentiveBonuses[data.incentiveType].displayName : 'No Incentive';
            
            targetPlayer.socket.emit('incentiveChanged', {
                incentiveType: data.incentiveType || null,
                incentiveDisplay: incentiveDisplayName,
                message: data.incentiveType ? 
                    `You now have an active incentive: ${incentiveDisplayName}` : 
                    'Your incentive has been removed'
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
    
    // For game sessions, preserve player state instead of deleting
    if (player.room !== 'Global' && player.room !== mainChat) {
        console.log(`🔌 Preserving player ${player.username} state in room ${player.room} for potential reconnection`);
        player.socket = null; // Clear socket but keep all game data
        console.log(`🔄 Preserved state: isLockedIn=${player.isLockedIn}, currentChoice=${player.currentChoice}, totalEarnings=${player.totalEarnings}`);
        return; // Don't delete player or add to removePack
    }
    
    // Only delete players from non-game rooms (Global chat, etc.)
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
                initialWhiteTokens: gameSession.experiment ? (
                    gameSession.experiment.phase === 'baseline' ? 
                    gameSession.experiment.whiteTokenPool : 
                    gameSession.experiment.totalWhiteTokenPool
                ) : gameSession.initialWhiteTokens,
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
        case 'Operant Incentive':
            // Operant incentive: +1 black token for choosing odd rows (high performance choice)
            if (rowType === 'odd') {
                bonusTokens = 1;
            }
            break;
        case 'Culturant Incentive':
            // Culturant incentive: +1 black token for choosing even rows (cooperative choice)
            if (rowType === 'even') {
                bonusTokens = 1;
            }
            break;
        case 'performance':
            // Legacy: Performance incentive (map to Operant)
            if (rowType === 'odd') {
                bonusTokens = 1;
            }
            break;
        case 'collaboration':
            // Legacy: Collaboration incentive (map to Culturant)
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
    
    // Sort players by turn order for consistent token distribution
    // Token distribution should follow the same order as the round that just ended
    const orderedRoomPlayers = gameSession.turnOrder ? 
        gameSession.turnOrder.map(username => roomPlayers.find(p => p.username === username)).filter(p => p) :
        roomPlayers;
    
    console.log(`🎯 DEBUG: Token distribution will use player order: ${orderedRoomPlayers.map(p => p.username).join(' → ')}`);
    
    // Update experimental condition for this round
    if (gameSession.experiment && (
        gameSession.experiment.mode === 'conditions' || 
        (gameSession.experiment.mode === 'unified' && gameSession.experiment.phase === 'conditions')
    )) {
        GameSession.updateConditionForRound(roomName, gameSession.experiment.currentRound);
    } else if (gameSession.experiment && gameSession.experiment.mode === 'unified' && gameSession.experiment.phase === 'baseline') {
        // For baseline phase in unified experiments, send basic condition info
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        playersInRoom.forEach(p => {
            if (p.socket) {
                const currentRoom = roomList.find(room => room.name === roomName);
                const isModerator = currentRoom && p.username === currentRoom.creator;
                
                // Prepare baseline conditionUpdate data
                const baselineUpdateData = {
                    round: gameSession.experiment.baselineRounds + 1,
                    condition: 'Baseline',
                    incentive: 'No Incentive',
                    incentiveDisplay: 'No Incentive',
                    player: null,
                    blockNumber: null,
                    phase: 'baseline',
                    tokenValues: {
                        white: Conditions.BASELINE.whiteTokenValue,
                        black: Conditions.BASELINE.blackTokenValue
                    }
                };
                
                // For moderators, add players array for LED tracker
                if (isModerator) {
                    const roomPlayers = Object.values(Player.list).filter(player => player.room === roomName);
                    baselineUpdateData.players = roomPlayers.map(player => ({
                        name: player.username,
                        id: player.id,
                        isAI: player.id.startsWith('AI_')
                    }));
                    console.log(`📡 LED TRACKER (Baseline): Added ${baselineUpdateData.players.length} players for moderator ${p.username}`);
                }
                
                p.socket.emit('conditionUpdate', baselineUpdateData);
            }
        });
    }
    
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
    
    // Calculate tokens based on current experimental condition and incentives
    let whiteTokensAwarded = 0;
    let blackTokensAwarded = 0;
    let culturantProduced = false;
    
    // Check available token pool for distribution limiting
    const availableTokens = gameSession.experiment ? gameSession.whiteTokenPool : GlobalTokenPool.whiteTokens;
    console.log(`🎯 DEBUG: Available token pool before distribution: ${availableTokens}`);
    
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
    
    if (allChooseEvenRows) {
        culturantProduced = true;
        gameSession.culturantsProduced++;
        console.log(`🎯 Culturant produced! All players chose even rows. Total culturants: ${gameSession.culturantsProduced}`);
    }
    
    // Pre-calculate all player token requirements to implement order-based distribution
    const playerTokenRequests = [];
    orderedRoomPlayers.forEach(player => {
        if (!player.currentChoice) return;
        
        // Skip token/earnings awards for moderators
        const isModerator = currentRoom && player.username === currentRoom.creator;
        if (isModerator) return;
        
        const chosenRow = parseInt(player.currentChoice);
        const condition = gameSession.currentCondition;
        const whiteTokensEarned = condition.getWhiteTokens(chosenRow);
        
        playerTokenRequests.push({
            player: player,
            chosenRow: chosenRow,
            whiteTokensEarned: whiteTokensEarned,
            condition: condition
        });
    });
    
    console.log(`🎯 DEBUG: ${playerTokenRequests.length} players requesting total ${playerTokenRequests.reduce((sum, req) => sum + req.whiteTokensEarned, 0)} white tokens`);
    
    // Distribute tokens in turn order, limited by available pool
    let remainingTokens = availableTokens;
    let tokenDistributionLog = [];
    
    // Calculate individual player payouts with pool limitation
    orderedRoomPlayers.forEach(player => {
        if (!player.currentChoice) return;
        
        // Skip token/earnings awards for moderators
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (isModerator) {
            console.log(`🎯 ${player.username}: Moderator - no tokens awarded`);
            return; // Skip token awarding for moderators
        }
        
        const chosenRow = parseInt(player.currentChoice); // Player chose row 1-8
        const condition = gameSession.currentCondition;
        const currentIncentive = gameSession.currentIncentive || 'No Incentive';
        
        // Base token calculation from experimental condition
        const whiteTokensDesired = condition.getWhiteTokens(chosenRow);
        
        // Limit white tokens to available pool (distribute in turn order)
        const whiteTokensEarned = Math.min(whiteTokensDesired, remainingTokens);
        remainingTokens = Math.max(0, remainingTokens - whiteTokensEarned);
        
        // Black tokens are not limited by pool (they're bonus tokens)
        const blackTokensEarned = condition.getBlackTokens(allChooseEvenRows);
        
        // Log token distribution for debugging
        if (whiteTokensEarned < whiteTokensDesired) {
            console.log(`🎯 DEBUG: ${player.username} limited to ${whiteTokensEarned}/${whiteTokensDesired} white tokens (pool depleted)`);
        }
        tokenDistributionLog.push(`${player.username}: ${whiteTokensEarned}/${whiteTokensDesired} white tokens`);
        
        // Calculate incentive bonus
        let incentiveBonus = 0;
        const incentiveInfo = IncentiveBonuses[currentIncentive];
        if (incentiveInfo && incentiveInfo.bonus > 0) {
            if (incentiveInfo.appliesWhen === 'always') {
                incentiveBonus = incentiveInfo.bonus;
            } else if (incentiveInfo.appliesWhen === 'allChoseEven' && allChooseEvenRows) {
                incentiveBonus = incentiveInfo.bonus;
            }
        }
        
        // Calculate player incentive bonus (set by moderator)
        const playerIncentiveBonus = calculateIncentiveBonus(player, chosenRow, gameSession);
        
        // Award tokens to player
        player.whiteTokens += whiteTokensEarned;
        player.blackTokens += blackTokensEarned + playerIncentiveBonus; // Add player incentive bonus to black tokens
        
        // Track incentive bonus tokens for display
        if (playerIncentiveBonus > 0) {
            player.incentiveBonusTokens = (player.incentiveBonusTokens || 0) + playerIncentiveBonus;
        }
        
        // Calculate earnings based on current condition's token values
        const whiteEarnings = whiteTokensEarned * condition.whiteTokenValue;
        const blackEarnings = (blackTokensEarned + playerIncentiveBonus) * condition.blackTokenValue;
        const incentiveEarnings = incentiveBonus;
        const totalEarnings = whiteEarnings + blackEarnings + incentiveEarnings;
        
        player.totalEarnings += totalEarnings;
        
        // Track totals for token pool deduction
        whiteTokensAwarded += whiteTokensEarned;
        blackTokensAwarded += blackTokensEarned;
        
        // Store player choice for data logging
        player.roundsPlayed++;
        player.previousChoice = player.currentChoice;
        
        const rowType = chosenRow % 2 === 1 ? 'odd' : 'even';
        console.log(`🎯 ${player.username}: Row ${chosenRow} (${rowType})`);
        console.log(`   White tokens: ${whiteTokensEarned} ($${whiteEarnings.toFixed(2)})`);
        console.log(`   Black tokens: ${blackTokensEarned} ($${blackEarnings.toFixed(2)})`);
        if (incentiveBonus > 0) {
            console.log(`   Incentive bonus: $${incentiveBonus.toFixed(2)} (${currentIncentive})`);
        }
        console.log(`   Total earnings: $${totalEarnings.toFixed(2)}`);
    });
    
    // Log token distribution summary
    console.log(`🎯 DEBUG: Token distribution summary:`);
    tokenDistributionLog.forEach(log => console.log(`   ${log}`));
    console.log(`🎯 DEBUG: Remaining tokens after distribution: ${remainingTokens}`);
    
    // Deduct white tokens from experiment's token pool
    if (gameSession.experiment) {
        console.log(`🎯 Token pool BEFORE deduction: ${gameSession.whiteTokenPool}, deducting: ${whiteTokensAwarded}`);
        gameSession.whiteTokenPool -= whiteTokensAwarded;
        console.log(`🎯 Token pool AFTER deduction: ${gameSession.whiteTokenPool}`);
        
        // Also update global pool for backward compatibility
        GlobalTokenPool.whiteTokens = gameSession.whiteTokenPool;
    } else {
        // Legacy behavior for non-experiment sessions
        console.log(`🎯 Token pool BEFORE deduction: ${GlobalTokenPool.whiteTokens}, deducting: ${whiteTokensAwarded}`);
        GlobalTokenPool.whiteTokens -= whiteTokensAwarded;
        console.log(`🎯 Token pool AFTER deduction: ${GlobalTokenPool.whiteTokens}`);
    }
    
    // Log data for CSV export with experimental context
    const currentConditionInfo = gameSession.experiment 
        ? ExperimentManager.getCurrentConditionInfo(gameSession.experiment, gameSession.currentRound)
        : null;
    
    gameSession.dataLog.push({
        timestamp: new Date().toISOString(),
        round: gameSession.currentRound,
        condition: gameSession.currentCondition.name,
        incentive: gameSession.currentIncentive || 'No Incentive',
        player: gameSession.currentPlayer || null,
        blockNumber: gameSession.currentBlockNumber || null,
        experimentMode: gameSession.experiment ? gameSession.experiment.mode : 'legacy',
        players: roomPlayers.map(p => ({
            username: p.username,
            choice: p.currentChoice,
            whiteTokens: p.whiteTokens,
            blackTokens: p.blackTokens,
            earnings: p.totalEarnings,
            isAI: p.isAI || false,
            isModerator: currentRoom && p.username === currentRoom.creator
        })),
        culturantProduced: culturantProduced,
        whiteTokensRemaining: gameSession.whiteTokenPool || GlobalTokenPool.whiteTokens
    });
    
    // Store round result for reconnection restoration
    const roundResult = {
        round: gameSession.currentRound,
        selectedColumn: selectedColumn,
        condition: {
            name: gameSession.currentCondition.name,
            whiteValue: gameSession.currentCondition.whiteTokenValue,
            blackValue: gameSession.currentCondition.blackTokenValue,
            maxPayout: gameSession.currentCondition.maxPayout
        },
        incentive: gameSession.currentIncentive || 'No Incentive',
        choices: orderedRoomPlayers.map(p => {
            const pRow = parseInt(p.currentChoice);
            return {
                username: p.username,
                choice: p.currentChoice,
                rowType: pRow % 2 === 1 ? 'odd' : 'even',
                isAI: p.isAI || false
            };
        }),
        culturantProduced: culturantProduced,
        whiteTokensRemaining: gameSession.whiteTokenPool || GlobalTokenPool.whiteTokens,
        timestamp: new Date().toISOString()
    };
    gameSession.roundHistory.push(roundResult);
    console.log(`📚 Saved round ${gameSession.currentRound} result to history`);
    
    // Send round results to all human players
    orderedRoomPlayers.forEach(player => {
        if (player.socket) { // Only notify human players
            const chosenRow = parseInt(player.currentChoice);
            const condition = gameSession.currentCondition;
            const whiteTokensEarned = condition.getWhiteTokens(chosenRow);
            const blackTokensEarned = condition.getBlackTokens(allChooseEvenRows);
            
            // Calculate incentive bonus for this player
            let incentiveBonusEarned = 0;
            const currentIncentive = gameSession.currentIncentive || 'No Incentive';
            const incentiveInfo = IncentiveBonuses[currentIncentive];
            if (incentiveInfo && incentiveInfo.bonus > 0) {
                if (incentiveInfo.appliesWhen === 'always') {
                    incentiveBonusEarned = incentiveInfo.bonus;
                } else if (incentiveInfo.appliesWhen === 'allChoseEven' && allChooseEvenRows) {
                    incentiveBonusEarned = incentiveInfo.bonus;
                }
            }
            
            // Add player incentive bonus (set by moderator)
            const playerIncentiveBonus = calculateIncentiveBonus(player, chosenRow, gameSession);
            incentiveBonusEarned += playerIncentiveBonus;
            
            // Prepare all player token data for moderators
            const allPlayerTokens = orderedRoomPlayers.map(p => ({
                username: p.username,
                isAI: p.isAI || false,
                isModerator: currentRoom && p.username === currentRoom.creator,
                tokensAwarded: {
                    white: condition.getWhiteTokens(parseInt(p.currentChoice)),
                    black: condition.getBlackTokens(allChooseEvenRows),
                    incentiveBonus: 0 // Legacy compatibility
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
                incentive: currentIncentive,
                playerChoice: {
                    row: chosenRow,
                    rowType: chosenRow % 2 === 1 ? 'odd' : 'even'
                },
                choices: orderedRoomPlayers.map(p => {
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
                    black: blackTokensEarned,
                    incentiveBonus: incentiveBonusEarned
                },
                totalTokens: {
                    white: player.whiteTokens,
                    black: player.blackTokens
                },
                totalEarnings: player.totalEarnings,
                culturantProduced: culturantProduced,
                culturantsProduced: gameSession.culturantsProduced,
                whiteTokensRemaining: gameSession.whiteTokenPool || GlobalTokenPool.whiteTokens,
                initialWhiteTokens: gameSession.experiment ? (
                    gameSession.experiment.phase === 'baseline' ? 
                    gameSession.experiment.whiteTokenPool : 
                    gameSession.experiment.totalWhiteTokenPool
                ) : gameSession.initialWhiteTokens,
                activeIncentive: currentIncentive,
                allPlayerTokens: allPlayerTokens,
                players: orderedRoomPlayers.map(p => ({
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
    
    // Check if experiment should end
    if (gameSession.experiment) {
        if (GameSession.checkExperimentEnd(roomName)) {
            return; // Experiment has ended
        }
    } else {
        // Legacy end conditions
        if (gameSession.currentRound >= gameSession.maxRounds || GlobalTokenPool.whiteTokens <= 0) {
            endExperiment(roomName, gameSession);
            return;
        }
    }

    // Handle transition from baseline to conditions in unified experiments BEFORE starting next round
    if (gameSession.experiment && gameSession.experiment.mode === 'unified' && gameSession.experiment.phase === 'baseline') {
        // Check if we should transition from baseline to conditions
        const currentTokenPool = gameSession.experiment ? gameSession.whiteTokenPool : GlobalTokenPool.whiteTokens;
        
        console.log(`🔍 DEBUG: Baseline transition check after round ${gameSession.currentRound}:`);
        console.log(`   Using token pool: ${gameSession.experiment ? 'gameSession.whiteTokenPool' : 'GlobalTokenPool.whiteTokens'} = ${currentTokenPool}`);
        console.log(`   Baseline rounds completed: ${gameSession.experiment.baselineRounds}/${gameSession.experiment.maxBaselineRounds}`);
        
        const shouldTransition = (
            currentTokenPool <= 0 || // Token pool depleted
            gameSession.experiment.baselineRounds >= gameSession.experiment.maxBaselineRounds // Hit max baseline rounds
        );
        
        console.log(`🔍 DEBUG: Should transition? ${shouldTransition} (pool depleted: ${currentTokenPool <= 0}, max rounds: ${gameSession.experiment.baselineRounds >= gameSession.experiment.maxBaselineRounds})`);
        
        if (shouldTransition) {
            console.log(`🔄 Transitioning from baseline to conditions phase after ${gameSession.experiment.baselineRounds} baseline rounds (token pool: ${currentTokenPool})`);
            
            // Update experiment phase
            gameSession.experiment.phase = 'conditions';
            gameSession.experiment.currentRound = 1; // Start with round 1 (schedule starts from 1, not 0)
            gameSession.experiment.whiteTokenPool = gameSession.experiment.totalWhiteTokenPool; // Switch to CONDITIONS_TOKENS tokens
            
            // Update global token pool
            GlobalTokenPool.transitionToConditions(gameSession.experiment);
            
            // Update game session token pool to match global pool
            gameSession.whiteTokenPool = GlobalTokenPool.whiteTokens;
            
            // Update condition information for the first conditions round (round 1)
            console.log(`🧪 Setting up first conditions round (experiment round ${gameSession.experiment.currentRound})`);
            GameSession.updateConditionForRound(roomName, gameSession.experiment.currentRound);
            
            // Notify all players about the transition
            const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
            const currentRoom = roomList.find(r => r.name === roomName);
            
            // Helper function to map scheduler player letters (A, B, C) to actual player names
            const mapSchedulerPlayerToName = (schedulerPlayer, roomPlayersList) => {
                // Include both human and AI players, but exclude moderator
                const eligiblePlayers = roomPlayersList.filter(p => !(currentRoom && p.username === currentRoom.creator));
                const playerIndex = schedulerPlayer === 'A' ? 0 : schedulerPlayer === 'B' ? 1 : 2;
                const selectedPlayer = eligiblePlayers[playerIndex];
                
                if (selectedPlayer) {
                    // Handle AI players that might have null usernames
                    return selectedPlayer.username || `AI_Player_${schedulerPlayer}`;
                }
                
                return `Player ${schedulerPlayer}`;
            };
            
            roomPlayers.forEach(player => {
                if (!player.isAI) {
                    const isModerator = currentRoom && player.username === currentRoom.creator;
                    
                    // Get the current condition info for the first conditions round
                    const conditionInfo = ExperimentManager.getCurrentConditionInfo(gameSession.experiment, gameSession.experiment.currentRound);
                    
                    const transitionMessage = {
                        from: 'baseline',
                        to: 'conditions',
                        newTokenPool: gameSession.experiment.whiteTokenPool,
                        initialWhiteTokens: gameSession.experiment.totalWhiteTokenPool,
                        message: `Baseline phase complete! Starting experimental conditions with ${gameSession.experiment.whiteTokenPool} tokens.`
                    };
                    
                    // Add moderator-specific information
                    if (isModerator && conditionInfo) {
                        const incentiveDisplayName = IncentiveBonuses[conditionInfo.incentive] ? 
                            IncentiveBonuses[conditionInfo.incentive].displayName : conditionInfo.incentive;
                        
                        // Only assign a player name if there's an actual incentive (not "No Incentive")
                        const actualPlayerName = (conditionInfo.incentive && conditionInfo.incentive !== 'No Incentive') 
                            ? mapSchedulerPlayerToName(conditionInfo.player, roomPlayers)
                            : null;
                            
                        transitionMessage.moderatorInfo = {
                            currentCondition: conditionInfo.conditionName,
                            currentIncentive: conditionInfo.incentive,
                            incentiveDisplay: incentiveDisplayName,
                            incentivePlayer: actualPlayerName, // Use actual player name instead of A/B/C
                            blockNumber: conditionInfo.blockNumber,
                            message: `🧪 MODERATOR: First conditions round starts with condition "${conditionInfo.conditionName}", incentive "${incentiveDisplayName}" for player "${actualPlayerName}"`
                        };
                        
                        console.log(`🧪 MODERATOR INFO for ${player.username}:`);
                        console.log(`   Condition: ${conditionInfo.conditionName}`);
                        console.log(`   Incentive: ${incentiveDisplayName} for player ${actualPlayerName} (scheduler: ${conditionInfo.player})`);
                        console.log(`   Block: ${conditionInfo.blockNumber || 'N/A'}`);
                    }
                    
                    player.socket.emit('phaseTransition', transitionMessage);
                }
            });
            
            // Skip normal round increment and start next round directly since we're transitioning
            setTimeout(() => startNewRound(roomName, gameSession), 3000); // 3 second delay
            return;
        } else {
            // Still in baseline phase, increment baseline round counter
            gameSession.experiment.baselineRounds++;
        }
    }
    
    // Start next round after delay
    gameSession.currentRound++;
    
    // For conditions phase in unified experiments, also increment experiment round counter
    if (gameSession.experiment && gameSession.experiment.mode === 'unified' && gameSession.experiment.phase === 'conditions') {
        gameSession.experiment.currentRound++;
        console.log(`🧪 Advanced to experiment round ${gameSession.experiment.currentRound} for conditions phase`);
        
        // Update condition for the next round
        console.log(`🔄 Updating condition for next experiment round ${gameSession.experiment.currentRound}`);
        GameSession.updateConditionForRound(roomName, gameSession.experiment.currentRound);
    }
    
    setTimeout(() => startNewRound(roomName, gameSession), 3000); // 3 second delay
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

/**
 * Comprehensive Game State Restoration Function
 * Sends all game elements to reconnecting players in an organized, extensible way.
 * Add new game elements here to automatically include them in reconnection restoration.
 */
Player.sendCompleteGameState = function(player, roomName) {
    console.log(`🎮 Starting comprehensive game state restoration for ${player.username} in room ${roomName}`);
    
    const gameSession = GameSessions[roomName];
    if (!gameSession) {
        console.log(`❌ No game session found for room ${roomName}`);
        return;
    }

    // Get room data for restoration
    const currentPlayersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
    const currentRoom = roomList.find(r => r.name === roomName);
    const isPlayerTurn = gameSession.turnBased ? GameSession.getCurrentTurnPlayer(roomName) === player.username : true;
    const currentTurnPlayer = gameSession.turnBased ? GameSession.getCurrentTurnPlayer(roomName) : null;
    
    // Determine moderator status safely
    let isModerator = false;
    try {
        isModerator = currentRoom && player.username === currentRoom.creator;
    } catch (error) {
        console.log(`⚠️ Could not determine moderator status for ${player.username}, defaulting to false`);
    }

    console.log(`🔄 Restoring complete game state for: ${player.username} in room: ${roomName}`);
    
    // 1. BASIC GAME UI INITIALIZATION
    console.log(`🎮 Step 1: Basic UI initialization`);
    player.socket.emit('init', { 
        selfId: player.id 
    });
    
    player.socket.emit('triadComplete', {
        roomName: roomName,
        players: currentPlayersInRoom.map(p => ({
            username: p.username,
            isAI: p.isAI || false,
            isModerator: false // Will be corrected in playersInRoom
        }))
    });

    // 2. CORE GAME SESSION STATE
    console.log(`🎯 Step 2: Core game session restoration`);
    player.socket.emit('gameStateRestore', {
        gameSession: {
            roomName: roomName,
            currentRound: gameSession.currentRound,
            maxRounds: gameSession.maxRounds,
            currentCondition: gameSession.currentCondition,
            gameState: gameSession.gameState,
            culturantsProduced: gameSession.culturantsProduced || 0,
            selectedColumn: gameSession.selectedColumn,
            turnBased: gameSession.turnBased,
            turnOrder: gameSession.turnOrder,
            roundChoices: gameSession.roundChoices || [],
            sessionStartTime: gameSession.sessionStartTime
        },
        globalTokenPool: {
            whiteTokens: GlobalTokenPool.whiteTokens,
            blackTokens: GlobalTokenPool.blackTokens,
            totalTokens: GlobalTokenPool.whiteTokens + GlobalTokenPool.blackTokens,
            initialWhiteTokens: gameSession.initialWhiteTokens,
            remainingPercentage: gameSession.initialWhiteTokens ? 
                ((GlobalTokenPool.whiteTokens + GlobalTokenPool.blackTokens) / gameSession.initialWhiteTokens) * 100 : 
                ((GlobalTokenPool.whiteTokens + GlobalTokenPool.blackTokens) / TOKEN_CONFIG.CONDITIONS_TOKENS) * 100
        }
    });

    // 3. ALL PLAYER WALLETS AND STATUS (with slight delay)
    console.log(`💰 Step 3: All player wallets restoration`);
    setTimeout(() => {
        const allPlayersWalletData = currentPlayersInRoom.map(roomPlayer => ({
            username: roomPlayer.username,
            whiteTokens: roomPlayer.whiteTokens || 0,
            blackTokens: roomPlayer.blackTokens || 0,
            totalEarnings: roomPlayer.totalEarnings || 0,
            isAI: roomPlayer.isAI || false,
            isModerator: currentRoom && roomPlayer.username === currentRoom.creator,
            isLockedIn: roomPlayer.isLockedIn || false,
            currentChoice: roomPlayer.currentChoice
        }));
        
        player.socket.emit('allPlayersWalletRestore', {
            players: allPlayersWalletData
        });
        console.log(`💰 Sent wallet data for ${allPlayersWalletData.length} players to ${player.username}`);
    }, 100);

    // 4. PLAYER LOCKED-IN STATES
    console.log(`🔒 Step 4: Player lock-in states restoration`);
    currentPlayersInRoom.forEach(roomPlayer => {
        if (roomPlayer.isLockedIn && roomPlayer.currentChoice !== null) {
            console.log(`📡 Restoring locked-in state for ${roomPlayer.username} (choice: ${roomPlayer.currentChoice})`);
            player.socket.emit('playerLockedIn', {
                username: roomPlayer.username,
                row: roomPlayer.currentChoice,
                isAI: roomPlayer.isAI,
                showRowDetails: true,
                currentTurnPlayer: currentTurnPlayer,
                turnOrder: gameSession.turnOrder || [],
                turnBased: gameSession.turnBased,
                column: gameSession.selectedColumn
            });
        }
    });

    // 5. TURN SYSTEM STATE
    console.log(`🔄 Step 5: Turn system restoration`);
    if (gameSession.turnBased && currentTurnPlayer) {
        player.socket.emit('turnUpdate', {
            currentTurnPlayer: currentTurnPlayer,
            turnOrder: gameSession.turnOrder,
            round: gameSession.currentRound,
            turnBased: gameSession.turnBased
        });
    }

    // 6. ROUND HISTORY AND RESULTS - REMOVED (now handled by unified restoration)
    console.log(`📚 Step 6: Round history restoration (handled by unified event)`);
    // Round history is now included in the unified comprehensive data

    // 7. CURRENT PLAYER CONTROLS AND STATUS
    console.log(`🎮 Step 7: Player controls restoration`);
    player.socket.emit('yourTurn', {
        isYourTurn: isPlayerTurn,
        isModerator: isModerator,
        activePlayer: gameSession.turnBased ? currentTurnPlayer : 'All participants',
        round: gameSession.currentRound,
        turnBased: gameSession.turnBased,
        turnOrder: gameSession.turnOrder,
        condition: {
            name: gameSession.currentCondition.name,
            whiteValue: gameSession.currentCondition.whiteTokenValue,
            blackValue: gameSession.currentCondition.blackTokenValue
        },
        grid: gameSession.grid,
        playerPosition: player.triadPosition,
        totalPlayers: currentPlayersInRoom.length,
        whiteTokensRemaining: GlobalTokenPool.whiteTokens,
        culturantsProduced: gameSession.culturantsProduced,
        currentChoice: player.currentChoice,
        isLockedIn: player.isLockedIn
    });

    // 8. FUTURE EXTENSIBILITY SECTION
    // Add new game state elements here as they are implemented:
    
    // TODO: Achievement system restoration
    // TODO: Player statistics restoration  
    // TODO: Bonus conditions restoration
    // TODO: Special events restoration
    // TODO: Custom status trackers restoration
    
    // 9. UNIFIED COMPREHENSIVE RESTORATION (New approach)
    console.log(`🔄 Step 9: Sending unified comprehensive restoration event`);
    setTimeout(() => {
        const comprehensiveData = {
            // Game session data
            gameSession: {
                roomName: gameSession.roomName,
                currentRound: gameSession.currentRound,
                maxRounds: gameSession.maxRounds,
                gameState: gameSession.gameState,
                turnBased: gameSession.turnBased,
                turnOrder: gameSession.turnOrder,
                activePlayerIndex: gameSession.activePlayerIndex,
                currentCondition: gameSession.currentCondition,
                culturantsProduced: gameSession.culturantsProduced
            },
            
            // Global token pool
            globalTokenPool: {
                whiteTokens: gameSession.experiment ? gameSession.whiteTokenPool : GlobalTokenPool.whiteTokens,
                blackTokens: GlobalTokenPool.blackTokens,
                initialWhiteTokens: gameSession.experiment ? gameSession.experiment.whiteTokenPool : GlobalTokenPool.whiteTokens,
                totalWhiteTokens: gameSession.experiment ? gameSession.experiment.totalWhiteTokenPool || gameSession.experiment.whiteTokenPool : TOKEN_CONFIG.CONDITIONS_TOKENS
            },
            
            // All players wallet data
            playersWalletData: currentPlayersInRoom.map(p => ({
                username: p.username,
                whiteTokens: p.whiteTokens || 0,
                blackTokens: p.blackTokens || 0,
                totalEarnings: p.totalEarnings || 0,
                isAI: p.isAI || false,
                isModerator: p.isModerator || false
            })),
            
            // Round history data - just the last completed round
            lastRoundResult: gameSession.roundHistory && gameSession.roundHistory.length > 0 
                ? gameSession.roundHistory[gameSession.roundHistory.length - 1] 
                : null,
            
            // Turn system data
            turnData: gameSession.turnBased ? {
                currentTurnPlayer: currentTurnPlayer,
                turnOrder: gameSession.turnOrder,
                round: gameSession.currentRound,
                turnBased: gameSession.turnBased,
                isYourTurn: isPlayerTurn
            } : null,
            
            // Player-specific data
            playerData: {
                username: player.username,
                isYourTurn: isPlayerTurn,
                isModerator: isModerator,
                activePlayer: currentTurnPlayer,
                round: gameSession.currentRound
            }
        };
        
        player.socket.emit('unifiedGameStateRestore', comprehensiveData);
        console.log(`✅ Unified comprehensive restoration sent to ${player.username}`);
    }, 300); // Delay to ensure it comes after other events
    
    console.log(`✅ Comprehensive game state restoration completed for ${player.username}`);
    console.log(`📊 Restoration summary: ${currentPlayersInRoom.length} players, round ${gameSession.currentRound}/${gameSession.maxRounds}, ${gameSession.roundHistory?.length || 0} historical rounds`);
};

// Helper function to check if a room has an active game session
Player.hasActiveGameSession = function(roomName) {
    if (!roomName || roomName === 'Global') {
        return false;
    }
    
    const gameSession = GameSessions[roomName];
    if (!gameSession) {
        console.log(`🔍 No game session found for room "${roomName}"`);
        return false;
    }
    
    // Consider a game session active if:
    // 1. It exists
    // 2. Game state is not 'finished'  
    // 3. Game has been started (currentRound > 0 or has players)
    const isActive = gameSession.gameState !== 'finished' && 
                    (gameSession.currentRound > 0 || 
                     (gameSession.players && Object.keys(gameSession.players).length > 0));
                    
    console.log(`🔍 Checking active game session for room "${roomName}": ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`🔍 Game session details - State: ${gameSession.gameState}, Round: ${gameSession.currentRound || 0}, Players: ${gameSession.players ? Object.keys(gameSession.players).length : 0}`);
    
    if (isActive) {
        console.log(`🎮 Active game details - State: ${gameSession.gameState}, Round: ${gameSession.currentRound}, Players: ${gameSession.players ? Object.keys(gameSession.players).length : 0}`);
    }
    
    return isActive;
};

// Function to clean up a room when experiment ends
Player.cleanupRoom = function(roomName) {
    console.log(`🧹 Starting cleanup for room: ${roomName}`);
    
    try {
        // Remove the game session for this room
        if (GameSessions[roomName]) {
            delete GameSessions[roomName];
            console.log(`🧹 Cleaned up game session for room: ${roomName}`);
        }
        
        // Remove players from this room in the Player.list
        const playersToRemove = [];
        Object.keys(Player.list).forEach(playerId => {
            const player = Player.list[playerId];
            if (player && player.room === roomName) {
                playersToRemove.push(playerId);
            }
        });
        
        playersToRemove.forEach(playerId => {
            delete Player.list[playerId];
        });
        
        if (playersToRemove.length > 0) {
            console.log(`🧹 Removed ${playersToRemove.length} players from room ${roomName}`);
        }
        
        // Remove the room from roomList (if accessible)
        if (typeof roomList !== 'undefined') {
            const roomIndex = roomList.findIndex(r => r.name === roomName);
            if (roomIndex !== -1) {
                roomList.splice(roomIndex, 1);
                console.log(`🧹 Removed room "${roomName}" from roomList`);
            }
        }
        
        console.log(`✅ Room cleanup completed for: ${roomName}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error cleaning up room ${roomName}:`, error);
        return false;
    }
};

// Export the Player object so it can be used in other modules
module.exports = {
    Player: Player,
    GameSession: GameSession,
    hasActiveGameSession: Player.hasActiveGameSession,
    cleanupRoom: Player.cleanupRoom
};
