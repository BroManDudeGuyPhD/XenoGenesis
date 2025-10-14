/**
 * XenoGenesis Client - Game UI
 * Handles all game-specific user interface components
 */

import { createElement, getElement, formatCurrency, selectedChoice, isLockedIn, setState } from './utils.js';
import { socket } from './socketManager.js';

// Game UI state
let currentTurnPlayer = null;
let gameGrid = null;
let selectedColumn = null;

/**
 * Render the 8x8 grid
 * @param {Array} gridData - Grid data to render
 */
export function renderGrid8x8(gridData) {
    console.log('🎮 Rendering 8x8 grid');
    
    const gridContainer = getElement('grid8x8');
    if (!gridContainer) {
        console.warn('Grid container not found');
        return;
    }
    
    gridContainer.innerHTML = '';
    gameGrid = gridData;
    
    // Create grid structure
    const grid = createElement('div', { className: 'grid-8x8' });
    
    // Add column headers (A-H)
    const headerRow = createElement('div', { className: 'grid-row grid-header' });
    headerRow.appendChild(createElement('div', { className: 'grid-cell grid-corner' })); // Corner cell
    
    for (let col = 0; col < 8; col++) {
        const letter = String.fromCharCode(65 + col); // A-H
        const headerCell = createElement('div', {
            className: 'grid-cell grid-column-header',
            'data-column': letter
        }, letter);
        headerRow.appendChild(headerCell);
    }
    grid.appendChild(headerRow);
    
    // Add data rows
    for (let row = 0; row < 8; row++) {
        const gridRow = createElement('div', { className: 'grid-row' });
        
        // Row number header
        const rowHeader = createElement('div', {
            className: 'grid-cell grid-row-header'
        }, (row + 1).toString());
        gridRow.appendChild(rowHeader);
        
        // Data cells
        for (let col = 0; col < 8; col++) {
            const cellData = gridData && gridData[row] ? gridData[row][col] : null;
            const letter = String.fromCharCode(65 + col);
            
            const cell = createElement('div', {
                className: 'grid-cell grid-data-cell',
                'data-row': row + 1,
                'data-column': letter,
                'data-cell-id': `${letter}${row + 1}`
            });
            
            if (cellData) {
                if (cellData.whiteTokens > 0) {
                    const whiteTokens = createElement('div', {
                        className: 'token-display white-tokens'
                    }, `⚪ ${cellData.whiteTokens}`);
                    cell.appendChild(whiteTokens);
                }
                
                if (cellData.blackTokens > 0) {
                    const blackTokens = createElement('div', {
                        className: 'token-display black-tokens'
                    }, `⚫ ${cellData.blackTokens}`);
                    cell.appendChild(blackTokens);
                }
            }
            
            gridRow.appendChild(cell);
        }
        
        grid.appendChild(gridRow);
    }
    
    gridContainer.appendChild(grid);
    addGridInteractivity();
}

/**
 * Add interactivity to the grid
 */
function addGridInteractivity() {
    const rows = document.querySelectorAll('.grid-row:not(.grid-header)');
    
    rows.forEach((row, index) => {
        const rowNumber = index + 1;
        
        row.addEventListener('click', () => {
            if (!isLockedIn && canMakeChoice()) {
                selectRow(rowNumber);
            }
        });
        
        row.addEventListener('mouseenter', () => {
            if (!isLockedIn && canMakeChoice()) {
                row.classList.add('row-hover');
            }
        });
        
        row.addEventListener('mouseleave', () => {
            row.classList.remove('row-hover');
        });
    });
}

/**
 * Select a row in the grid
 * @param {number} rowNumber - Row number (1-8)
 */
function selectRow(rowNumber) {
    if (isLockedIn) return;
    
    console.log(`🎯 Selected row: ${rowNumber}`);
    
    // Remove previous selection
    document.querySelectorAll('.grid-row').forEach(row => {
        row.classList.remove('row-selected');
    });
    
    // Add selection to new row
    const selectedRow = document.querySelector(`.grid-row:nth-child(${rowNumber + 1})`);
    if (selectedRow) {
        selectedRow.classList.add('row-selected');
    }
    
    setState.setSelectedChoice(rowNumber);
    
    // Show lock-in button
    showLockInButton();
}

/**
 * Show the lock-in button
 */
function showLockInButton() {
    let lockInButton = getElement('lockInButton');
    
    if (!lockInButton) {
        lockInButton = createElement('button', {
            id: 'lockInButton',
            className: 'lock-in-button',
            style: `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 25px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                z-index: 1000;
                box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                transition: all 0.3s ease;
            `
        }, 'Lock In Choice');
        
        lockInButton.addEventListener('click', lockInChoice);
        document.body.appendChild(lockInButton);
    }
    
    lockInButton.style.display = 'block';
    lockInButton.style.animation = 'slideUpFadeIn 0.3s ease-out';
}

/**
 * Lock in the current choice
 */
function lockInChoice() {
    if (!selectedChoice || isLockedIn) return;
    
    console.log(`🔒 Locking in choice: ${selectedChoice}`);
    
    setState.setLockedIn(true);
    
    // Emit choice to server
    socket.emit('playerChoice', {
        choice: selectedChoice,
        timestamp: Date.now()
    });
    
    // Update UI
    const lockInButton = getElement('lockInButton');
    if (lockInButton) {
        lockInButton.textContent = 'Choice Locked In';
        lockInButton.style.background = 'linear-gradient(135deg, #666, #555)';
        lockInButton.style.cursor = 'not-allowed';
        lockInButton.disabled = true;
    }
    
    // Disable row selection
    document.querySelectorAll('.grid-row').forEach(row => {
        row.style.pointerEvents = 'none';
        row.classList.add('choice-locked');
    });
}

/**
 * Check if player can make a choice
 * @returns {boolean} True if player can choose
 */
function canMakeChoice() {
    // This would be determined by game state and turn order
    return true; // Placeholder
}

/**
 * Highlight the selected column
 * @param {string} column - Column letter (A-H)
 */
export function highlightSelectedColumn(column) {
    console.log(`📍 Highlighting column: ${column}`);
    
    selectedColumn = column;
    
    // Remove previous column highlighting
    document.querySelectorAll('.grid-column-header, .grid-data-cell').forEach(cell => {
        cell.classList.remove('column-selected');
    });
    
    // Add highlighting to selected column
    document.querySelectorAll(`[data-column="${column}"]`).forEach(cell => {
        cell.classList.add('column-selected');
    });
    
    // Show column selection indicator
    showColumnIndicator(column);
}

/**
 * Show column selection indicator
 * @param {string} column - Selected column
 */
function showColumnIndicator(column) {
    let indicator = getElement('columnIndicator');
    
    if (!indicator) {
        indicator = createElement('div', {
            id: 'columnIndicator',
            className: 'column-indicator',
            style: `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #2196F3, #21CBF3);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                z-index: 1000;
                box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3);
            `
        });
        document.body.appendChild(indicator);
    }
    
    indicator.textContent = `Column ${column} Selected`;
    indicator.style.display = 'block';
    indicator.style.animation = 'slideDownFadeIn 0.3s ease-out';
}

/**
 * Update poker table visualization
 * @param {Object} gameSession - Game session data
 * @param {string} currentTurnPlayer - Current turn player name
 */
export function updatePokerTable(gameSession, currentTurnPlayer = null) {
    console.log('🃏 Updating poker table with existing seats (original logic)');
    console.log('🃏 GameSession data:', gameSession);
    console.log('🃏 Players data:', gameSession ? gameSession.players : 'no gameSession');
    
    // Safety check for gameSession
    if (!gameSession) {
        console.log('⚠️ gameSession is undefined, skipping player placement');
        return;
    }
    
    // Get players from gameSession
    const players = gameSession.players || [];
    console.log('🃏 Players to place:', players);
    
    // Validate players array - ensure all items are valid player objects
    const validPlayers = players.filter(player => 
        player && 
        typeof player === 'object' && 
        (player.username || player.name)
    );
    
    if (validPlayers.length !== players.length) {
        console.warn('🔍 Found invalid players in array, filtering them out:', 
            'original:', players.length, 'valid:', validPlayers.length);
        console.warn('🔍 Invalid items:', players.filter(p => !p || typeof p !== 'object' || (!p.username && !p.name)));
    }
    
    // Clear all seats first
    clearPokerSeats();
    
    // Seat IDs for regular players (matching original logic)
    const SEAT_IDS = ['leftPlayer', 'topPlayer', 'rightPlayer'];
    
    // Filter out moderators first (using validated players)
    const regularPlayers = validPlayers.filter(player => !player.isModerator);
    console.log('🃏 Regular players to seat:', regularPlayers);
    
    regularPlayers.forEach((player, index) => {
        // Double-check player validity
        if (!player || typeof player !== 'object') {
            console.warn('🔍 Skipping invalid player at index', index, ':', player);
            return;
        }
        
        console.log('🃏 Processing player:', player.username, 'seatPosition:', player.seatPosition, 'index:', index);
        
        let seatPosition = player.seatPosition;
        
        // If no seat position assigned, assign based on join order
        if (!seatPosition || seatPosition === 'center') {
            const seatOrder = ['left', 'top', 'right'];
            seatPosition = seatOrder[index % 3];
            console.log('🃏 Auto-assigning seat position:', seatPosition, 'for player:', player.username);
        }
        
        // Map seat position to DOM element ID (original logic)
        let seatId = '';
        switch(seatPosition) {
            case 'left':
                seatId = 'leftPlayer';
                break;
            case 'top':
                seatId = 'topPlayer';
                break;
            case 'right':
                seatId = 'rightPlayer';
                break;
            default:
                console.warn('🃏 Unknown seat position:', seatPosition, 'for player:', player.username);
                return;
        }
        
        const seat = getElement(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            const statusDiv = seat.querySelector('.player-status');
            const aiDiv = seat.querySelector('.ai-indicator');
            const walletDiv = seat.querySelector('.player-wallet');
            
            if (nameDiv) nameDiv.textContent = player.username || player.name || 'Unknown';
            if (statusDiv) {
                const triadPos = player.triadPosition || (index + 1); // Auto-assign if missing
                statusDiv.textContent = `P${triadPos}`;
                console.log(`🃏 Set triad position P${triadPos} for ${player.username} (original: ${player.triadPosition})`);
            }
            
            // Show AI indicator if it's an AI player
            if (aiDiv) {
                aiDiv.style.display = player.isAI ? 'block' : 'none';
            }
            
            // Set border color - green if active player, blue otherwise
            if (currentTurnPlayer && (player.username === currentTurnPlayer || player.name === currentTurnPlayer)) {
                seat.style.borderColor = '#43b581'; // Green for active
                seat.style.boxShadow = '0 0 10px rgba(67, 181, 129, 0.5)';
                console.log(`🟢 Set ${player.username} seat to green (active player)`);
            } else {
                seat.style.borderColor = '#7289da'; // Blue for inactive
                seat.style.boxShadow = 'none';
                console.log(`🔵 Set ${player.username} seat to blue (inactive player)`);
            }
            
            // Update wallet info
            if (walletDiv) {
                walletDiv.innerHTML = `⚪${player.whiteTokens || 0} ⚫${player.blackTokens || 0}<br>${formatCurrency(player.totalEarnings || 0)}`;
            }
            
            console.log(`🃏 Placed ${player.username} in ${seatPosition} seat (P${player.triadPosition})`);
        } else {
            console.warn('🃏 Seat element not found:', seatId);
        }
    });
    
    // Update round display (original logic)
    const currentRound = getElement('currentRound');
    const tableRound = getElement('tableRound');
    if (currentRound && gameSession) {
        currentRound.textContent = gameSession.currentRound || 0;
    }
    if (tableRound && gameSession) {
        tableRound.textContent = gameSession.currentRound || 0;
    }
}



/**
 * Clear all poker seat information
 */
function clearPokerSeats() {
    const seats = ['leftPlayer', 'topPlayer', 'rightPlayer'];
    
    seats.forEach(seatId => {
        const seat = getElement(seatId);
        if (seat) {
            const nameElement = seat.querySelector('.player-name');
            const statusElement = seat.querySelector('.player-status');
            const aiIndicator = seat.querySelector('.ai-indicator');
            const walletElement = seat.querySelector('.player-wallet');
            
            if (nameElement) nameElement.textContent = '';
            if (statusElement) statusElement.textContent = '';
            if (aiIndicator) aiIndicator.style.display = 'none';
            if (walletElement) walletElement.textContent = '';
        }
    });
    
    // Don't reset moderator position - it should maintain the actual moderator name
    // This was causing the moderator name to be reset to "Waiting for Moderator..." 
    // when updatePokerTable() was called
}

/**
 * Clear poker table
 */
export function clearPokerTable() {
    clearPokerSeats();
}

/**
 * Update turn display
 * @param {Object} turnData - Turn information
 */
export function updateTurnDisplay(turnData) {
    console.log('🔄 Updating turn display:', turnData);
    
    const turnIndicator = getElement('turnIndicator');
    if (!turnIndicator) return;
    
    if (turnData.currentPlayer) {
        turnIndicator.innerHTML = `
            <div class="turn-info">
                <div class="current-player">${turnData.currentPlayer}</div>
                <div class="turn-status">It's their turn to choose</div>
                <div class="round-info">Round ${turnData.round || '?'}</div>
            </div>
        `;
        turnIndicator.classList.add('active');
    } else {
        turnIndicator.innerHTML = '<div class="waiting-info">Waiting for game to start...</div>';
        turnIndicator.classList.remove('active');
    }
}

/**
 * Update active player highlight
 * @param {string} activePlayerName - Name of active player
 */
export function updateActivePlayerHighlight(activePlayerName) {
    console.log(`👆 Highlighting active player: ${activePlayerName}`);
    
    // Remove previous highlights
    document.querySelectorAll('.player-position').forEach(position => {
        position.classList.remove('active-player');
    });
    
    // Add highlight to active player
    if (activePlayerName) {
        const activePosition = document.querySelector(`[data-player="${activePlayerName}"]`);
        if (activePosition) {
            activePosition.classList.add('active-player');
        }
    }
}

/**
 * Update row interactivity based on turn data
 * @param {Object} turnData - Turn information
 */
export function updateRowInteractivity(turnData) {
    const isMyTurn = turnData.isMyTurn || false;
    const rows = document.querySelectorAll('.grid-row:not(.grid-header)');
    
    rows.forEach(row => {
        if (isMyTurn && !isLockedIn) {
            row.style.pointerEvents = 'auto';
            row.classList.remove('disabled');
        } else {
            row.style.pointerEvents = 'none';
            row.classList.add('disabled');
        }
    });
}

/**
 * Reset game visuals
 */
export function resetGameVisuals() {
    console.log('🔄 Resetting game visuals');
    
    // Reset selections
    setState.setSelectedChoice(null);
    setState.setLockedIn(false);
    selectedColumn = null;
    currentTurnPlayer = null;
    
    // Remove UI elements
    const lockInButton = getElement('lockInButton');
    if (lockInButton) lockInButton.remove();
    
    const columnIndicator = getElement('columnIndicator');
    if (columnIndicator) columnIndicator.remove();
    
    // Clear grid
    const gridContainer = getElement('grid8x8');
    if (gridContainer) gridContainer.innerHTML = '';
    
    // Clear poker table
    clearPokerTable();
    
    // Reset turn display
    const turnIndicator = getElement('turnIndicator');
    if (turnIndicator) {
        turnIndicator.innerHTML = '<div class="waiting-info">Waiting for game to start...</div>';
        turnIndicator.classList.remove('active');
    }
}

// Socket event handlers for game UI
export const gameUIHandlers = {
    handleNewRound: function(data) {
        console.log('🎮 Handling new round:', data);
        resetGameVisuals();
        if (data.grid) {
            renderGrid8x8(data.grid);
        }
    },
    
    handleYourTurn: function(data) {
        console.log('🎯 Handling your turn:', data);
        updateTurnDisplay(data);
        updateRowInteractivity({ isMyTurn: true });
    },
    
    handleTurnUpdate: function(data) {
        console.log('🔄 Handling turn update:', data);
        updateTurnDisplay(data);
        updateActivePlayerHighlight(data.currentPlayer);
        updateRowInteractivity({ isMyTurn: data.isMyTurn });
    },
    
    handlePlayerLockedIn: function(data) {
        console.log('🔒 Handling player locked in:', data);
        if (data.player) {
            const playerPosition = document.querySelector(`[data-player="${data.player}"]`);
            if (playerPosition) {
                const status = playerPosition.querySelector('.player-status');
                if (status) {
                    status.textContent = '🔒 Locked';
                    status.classList.add('locked-in');
                }
            }
        }
        
        // Also update poker table to reflect locked-in status
        if (data.gameSession) {
            updatePokerTable(data.gameSession, window.currentActivePlayer);
        }
    },
    
    handlePlayerStatusUpdate: function(data) {
        console.log('👥 Handling player status update:', data);
        
        // Update poker table with new player status
        if (data.gameSession) {
            updatePokerTable(data.gameSession, window.currentActivePlayer);
        }
        
        // Update any specific player status indicators
        if (data.players) {
            data.players.forEach(player => {
                if (player.username) {
                    const playerPosition = document.querySelector(`[data-player="${player.username}"]`);
                    if (playerPosition) {
                        const status = playerPosition.querySelector('.player-status');
                        if (status) {
                            if (player.isLockedIn) {
                                status.textContent = '🔒 Locked';
                                status.classList.add('locked-in');
                            } else if (player.currentChoice !== null && player.currentChoice !== undefined) {
                                status.textContent = `📍 ${player.currentChoice}`;
                                status.classList.remove('locked-in');
                            } else {
                                status.textContent = '⏳ Choosing';
                                status.classList.remove('locked-in');
                            }
                        }
                    }
                }
            });
        }
    },
    
    handleColumnSelected: function(data) {
        console.log('📍 Handling column selected:', data);
        if (data.column) {
            highlightSelectedColumn(data.column);
        }
    },
    
    handleAutoColumnSelected: function(data) {
        console.log('🎲 Handling auto column selected:', data);
        if (data.column) {
            highlightSelectedColumn(data.column);
        }
    },
    
    handleGameInit: function(data) {
        console.log('🎮 Handling game init:', data);
        console.log(`📡 MODULAR INIT - Players: ${data.player ? data.player.length : 0}, SelfId: ${!!data.selfId}`);
        
        // Initialize game UI based on received data
        if (data.player && data.player.length > 0) {
            // Reset all game visuals for fresh experiment start (from legacy client.js)
            if (window.currentRoom !== 'Global') {
                if (typeof window.resetGameVisuals === 'function') {
                    window.resetGameVisuals();
                    console.log('🔄 Reset game visuals for experiment initialization');
                }
            }
            
            // Set selfId (crucial for player identification)
            if (data.selfId) {
                window.selfId = data.selfId;
                console.log('🔑 SelfId set to:', data.selfId);
            }
            
            // Show game div and set game as active
            const gameDiv = document.getElementById('gameDiv');
            if (gameDiv) {
                gameDiv.style.display = 'inline-block';
                console.log('🎮 Game div displayed');
            }
            
            // Mark game as active (from legacy client.js)
            window.gameActive = true;
            console.log('🎯 Game marked as active');
            
            // Add game-active class to body for styling
            document.body.classList.add('game-active');
            
            // Update card visibility for game context
            if (typeof window.updateCardVisibility === 'function') {
                window.updateCardVisibility();
            }
            
            // Clear existing players before adding new ones (from legacy client.js)
            if (window.Player && window.Player.list) {
                window.Player.list = {};
                console.log('🗑️ Cleared existing Player.list');
            }
            
            // Initialize players (from legacy client.js)
            for (var i = 0; i < data.player.length; i++) {
                if (window.Player) {
                    new window.Player(data.player[i]);
                    console.log('👤 Created player:', data.player[i].username);
                }
            }
            
            // Initialize LED tracker with real player names (from legacy client.js)
            if (data.player && data.player.length > 0) {
                console.log('🎯 INIT: Initializing LED tracker with players from init event');
                
                // Filter out moderators from init event players
                const allPlayers = data.player.map(p => ({ 
                    name: p.username, 
                    isAI: p.id && p.id.startsWith('AI_'),
                    isModerator: p.isModerator || false
                }));
                
                // Filter out moderators - only include actual participants
                const players = allPlayers.filter(p => !p.isModerator);
                
                if (players.length > 0 && typeof window.initializePlayerNamesInTracker === 'function') {
                    window.initializePlayerNamesInTracker(players);
                    console.log('🎯 LED tracker initialized with players:', players.map(p => p.name));
                } else {
                    console.warn('⚠️ No non-moderator players found for LED tracker or function not available');
                }
            }
            
            // Create a gameSession object for updatePokerTable
            const gameSession = data.gameSession || {
                players: data.player
            };
            
            // Update poker table with current players (preserve active player highlighting)
            updatePokerTable(gameSession, window.currentActivePlayer);
            console.log('🃏 Poker table updated with game session');
            
            // Show the decision phase (game UI)
            const lobbyPhase = document.getElementById('lobbyPhase');
            const decisionPhase = document.getElementById('decisionPhase');
            
            if (lobbyPhase) {
                lobbyPhase.style.display = 'none';
                console.log('🏠 Hiding lobby phase');
            }
            
            if (decisionPhase) {
                decisionPhase.style.display = 'block';
                console.log('🎮 Showing decision phase (game UI)');
            }
            
            console.log('✅ Complete game initialization finished');
        } else {
            // No players - hide game and reset state (from legacy client.js)
            const gameDiv = document.getElementById('gameDiv');
            if (gameDiv) {
                gameDiv.style.display = 'none';
            }
            
            window.gameActive = false;
            if (window.Player && window.Player.list) {
                window.Player.list = {};
            }
            
            // Remove game-active class from body
            document.body.classList.remove('game-active');
            
            // Update card visibility for non-game context
            if (typeof window.updateCardVisibility === 'function') {
                window.updateCardVisibility();
            }
            
            console.log('🚫 No players - game initialization skipped');
        }
    },
    
    handleTriadComplete: function(data) {
        console.log('🔺 Handling triad complete:', data);
        
        // Handle triad completion - initialize game board with grid and animations
        if (data.message) {
            console.log('📢 Triad message:', data.message);
        }
        
        // Initialize the game grid with animations when experiment starts
        if (data.gameSession && data.gameSession.grid) {
            console.log('🎮 Initializing game board grid with animations');
            renderGrid8x8(data.gameSession.grid);
            
            // Add visual indication that the game has started
            const decisionPhase = document.getElementById('decisionPhase');
            if (decisionPhase) {
                decisionPhase.classList.add('game-started');
                
                // Add a subtle animation to indicate game start
                decisionPhase.style.animation = 'fadeIn 0.8s ease-in-out';
                setTimeout(() => {
                    decisionPhase.style.animation = '';
                }, 800);
            }
            
            // Show a brief "Game Started" notification
            if (data.message && data.message.includes('Game started')) {
                const notification = document.createElement('div');
                notification.className = 'game-start-notification';
                notification.textContent = '🚀 Experiment Started!';
                notification.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: linear-gradient(135deg, #4ade80, #22c55e);
                    color: white;
                    padding: 20px 40px;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 18px;
                    z-index: 10000;
                    box-shadow: 0 8px 25px rgba(34, 197, 94, 0.4);
                    animation: gameStartPulse 0.6s ease-out;
                `;
                
                document.body.appendChild(notification);
                
                // Remove notification after 2 seconds
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translate(-50%, -50%) scale(0.8)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 2000);
            }
        }
        
        // Update poker table if we have gameSession data
        if (data.gameSession && data.gameSession.players) {
            console.log('🃏 Updating poker table from triadComplete');
            updatePokerTable(data.gameSession);
        }
    },
    
    handleGameUpdate: function(data) {
        // Handle real-time game updates (from legacy client.js update handler)
        if (data && data.player && window.Player && window.Player.list) {
            for (var i = 0; i < data.player.length; i++) {
                var pack = data.player[i];
                var p = window.Player.list[pack.id];
                if (p) {
                    if (pack.x !== undefined) p.x = pack.x;
                    if (pack.y !== undefined) p.y = pack.y;
                    if (pack.hp !== undefined) p.hp = pack.hp;
                    if (pack.score !== undefined) p.score = pack.score;
                    if (pack.map !== undefined) p.map = pack.map;
                    
                    // Update any additional game state properties
                    if (pack.currentChoice !== undefined) p.currentChoice = pack.currentChoice;
                    if (pack.isLockedIn !== undefined) p.isLockedIn = pack.isLockedIn;
                    if (pack.tokens !== undefined) p.tokens = pack.tokens;
                }
            }
            
            // Trigger poker table update to reflect any changes
            if (data.gameSession) {
                updatePokerTable(data.gameSession, window.currentActivePlayer);
            } else if (data.player.length > 0) {
                // Create minimal gameSession for poker table update
                const gameSession = { players: data.player };
                updatePokerTable(gameSession, window.currentActivePlayer);
            }
        }
    },

    handleGameStateRestore: function(data) {
        console.log('💾 Handling game state restore:', data);
        // Restore game state - grid, players, etc.
        if (data.grid) {
            renderGrid8x8(data.grid);
        }
        if (data.gameSession && data.gameSession.players) {
            updatePokerTable(data.gameSession);
        } else if (data.players) {
            // Create mock gameSession if we only have players array
            const gameSession = { players: data.players };
            updatePokerTable(gameSession);
        }
        
        // Ensure game UI is visible
        const lobbyPhase = document.getElementById('lobbyPhase');
        const decisionPhase = document.getElementById('decisionPhase');
        
        if (lobbyPhase) {
            lobbyPhase.style.display = 'none';
        }
        
        if (decisionPhase) {
            decisionPhase.style.display = 'block';
            console.log('🎮 Game UI restored and visible');
        }
    },
    
    handleUnifiedGameStateRestore: function(data) {
        console.log('🔄 Handling unified game state restore:', data);
        // Handle comprehensive game state restoration
        if (data.gameSession && data.gameSession.grid) {
            renderGrid8x8(data.gameSession.grid);
        }
        if (data.gameSession && data.gameSession.players) {
            updatePokerTable(data.gameSession);
        } else if (data.playerData) {
            // Create mock gameSession from playerData
            const gameSession = { players: Object.values(data.playerData) };
            updatePokerTable(gameSession);
        }
        if (data.turnData) {
            updateTurnDisplay(data.turnData);
        }
        
        // Ensure game UI is visible
        const lobbyPhase = document.getElementById('lobbyPhase');
        const decisionPhase = document.getElementById('decisionPhase');
        
        if (lobbyPhase) {
            lobbyPhase.style.display = 'none';
        }
        
        if (decisionPhase) {
            decisionPhase.style.display = 'block';
            console.log('🎮 Unified game UI restored and visible');
        }
    },
    
    handleAiPlayersAdded: function(data) {
        console.log('🤖 AI players added event received:', data);
        
        // Request updated room state to ensure all players are visible
        if (data.room) {
            console.log('🔄 Requesting updated room state after AI added');
            socket.emit('requestRoomState', { room: data.room });
            
            // Also request game state
            socket.emit('requestGameState', { room: data.room });
        }
        
        // Show success message
        if (window.modals && window.modals.showGlassmorphismAlert) {
            window.modals.showGlassmorphismAlert(
                'AI Players Added!', 
                `Successfully added ${data.count || 'AI'} players to the room.`, 
                'success'
            );
        }
    }
};

// Export all game UI functions
export default {
    renderGrid8x8,
    highlightSelectedColumn,
    updatePokerTable,
    clearPokerTable,
    updateTurnDisplay,
    updateActivePlayerHighlight,
    updateRowInteractivity,
    resetGameVisuals,
    ...gameUIHandlers
};