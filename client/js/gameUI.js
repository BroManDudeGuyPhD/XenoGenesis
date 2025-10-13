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
    
    const gridContainer = getElement('gameGrid');
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
    console.log('🃏 Updating poker table');
    
    const pokerTable = getElement('pokerTable');
    if (!pokerTable) return;
    
    currentTurnPlayer = currentTurnPlayer;
    
    // Clear existing table
    pokerTable.innerHTML = '';
    
    if (!gameSession || !gameSession.players) {
        console.log('No game session or players data');
        return;
    }
    
    // Create table layout
    const table = createElement('div', { className: 'poker-table-layout' });
    
    // Add players to table positions
    gameSession.players.forEach((player, index) => {
        const playerPosition = createElement('div', {
            className: `player-position position-${index}`,
            'data-player': player.username
        });
        
        // Player avatar
        const avatar = createElement('div', { className: 'player-avatar' });
        if (player.isAI) {
            avatar.classList.add('ai-player');
            avatar.textContent = '🤖';
        } else {
            avatar.textContent = '👤';
        }
        
        // Player name
        const nameTag = createElement('div', {
            className: 'player-name'
        }, player.username);
        
        // Player status
        const status = createElement('div', { className: 'player-status' });
        if (player.isLockedIn) {
            status.textContent = '🔒 Locked';
            status.classList.add('locked-in');
        } else if (currentTurnPlayer === player.username) {
            status.textContent = '⏰ Turn';
            status.classList.add('current-turn');
        } else {
            status.textContent = '⏳ Waiting';
            status.classList.add('waiting');
        }
        
        // Player wallet
        const wallet = createElement('div', { className: 'player-wallet' });
        wallet.innerHTML = `
            <div class="tokens">⚪ ${player.whiteTokens || 0} ⚫ ${player.blackTokens || 0}</div>
            <div class="earnings">${formatCurrency(player.totalEarnings || 0)}</div>
        `;
        
        playerPosition.appendChild(avatar);
        playerPosition.appendChild(nameTag);
        playerPosition.appendChild(status);
        playerPosition.appendChild(wallet);
        
        table.appendChild(playerPosition);
    });
    
    pokerTable.appendChild(table);
}

/**
 * Clear poker table
 */
export function clearPokerTable() {
    const pokerTable = getElement('pokerTable');
    if (pokerTable) {
        pokerTable.innerHTML = '';
    }
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
    const gridContainer = getElement('gameGrid');
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