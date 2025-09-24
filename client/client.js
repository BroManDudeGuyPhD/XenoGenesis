// Variables
const socket = io();

// Store pending token updates to apply after players return to poker table positions
let pendingTokenUpdates = null;

// Baseline exit tracking
let previousCondition = null;
let currentRoundNumber = 0;

// Socket connection monitoring
socket.on('disconnect', function() {
    console.error('❌ Socket disconnected from server');
});

socket.on('reconnect', function() {
    console.log('Socket reconnected to server');
});

// Current room tracking

// Monitor gameDiv for any style changes
let currentRoom = "Global"; // Track which room the user is actually in
let gameActive = false; // Track if there's an active game to display

// Selection and lock-in state (global scope)
let selectedChoice = null;
let isLockedIn = false;

// Function to render the 8x8 grid
function renderGrid8x8(gridData) {
    const gridContainer = document.getElementById('grid8x8');
    if (!gridContainer || !gridData) return;
    
    let gridHTML = '';
    
    // Create 8 rows - each row contains only the 8 cells (no row numbers)
    for (let row = 1; row <= 8; row++) {
        gridHTML += `<div class="grid-row-8x8 clickable-row" data-row="${row}" style="display: flex; cursor: pointer; transition: all 0.3s ease; border-radius: 4px;" 
            onmouseover="
                this.style.backgroundColor='rgba(255, 215, 0, 0.2)'; 
                this.style.boxShadow='0 0 12px rgba(255, 215, 0, 0.4)'; 
                this.style.transform='scale(1.02)';
                // Highlight corresponding row header (text only)
                const rowHeader = document.querySelector('.row-header[data-row=\\\\"${row}\\\\"]');
                if (rowHeader) {
                    rowHeader.style.color = '#ffd700';
                    rowHeader.style.textShadow = '0 0 8px rgba(255, 215, 0, 0.8)';
                    rowHeader.style.transform = 'scale(1.1)';
                }
            " 
            onmouseout="
                this.style.backgroundColor='transparent'; 
                this.style.boxShadow='none'; 
                this.style.transform='scale(1)';
                // Reset row header
                const rowHeader = document.querySelector('.row-header[data-row=\\\\"${row}\\\\"]');
                if (rowHeader) {
                    const isOddRow = ${row} % 2 === 1;
                    rowHeader.style.color = isOddRow ? '#ffffff' : '#000000';
                    rowHeader.style.textShadow = 'none';
                    rowHeader.style.transform = 'scale(1)';
                }
            ">`;
        
        // Determine row type: odd rows (white), even rows (black)
        const isOddRow = row % 2 === 1; // Odd rows (1,3,5,7)
        const rowBackgroundColor = isOddRow ? '#ffffff' : '#000000'; // White for odd, black for even
        const textColor = isOddRow ? '#000000' : '#ffffff'; // Black text on white, white text on black
        
        // 8 columns for this row - only the actual grid cells
        for (let colIndex = 0; colIndex < 8; colIndex++) {
            const columnLetter = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][colIndex];
            
            // Find the cell data for this position
            const cellData = gridData.find(cell => cell.row === row && cell.column === columnLetter);
            const symbol = cellData ? cellData.symbol : '+';
            
            gridHTML += `<div class="grid-cell-8x8" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background-color: ${rowBackgroundColor}; color: ${textColor}; border: 1px solid #72767d; font-weight: bold; font-size: 18px; transition: all 0.3s ease;">${symbol}</div>`;
        }
        
        gridHTML += `</div>`;
    }
    
    gridContainer.innerHTML = gridHTML;
    
    // Initialize column hover effects for moderators after grid is rendered
    setTimeout(() => {
        addColumnHoverEffects();
    }, 50);
}

// Function to highlight the selected column
function highlightSelectedColumn(column) {
    // Clear previous column highlighting
    const allHeaders = document.querySelectorAll('.column-header');
    
    allHeaders.forEach(header => {
        header.classList.remove('selected');
    });
    
    // Remove column highlighting from grid cells
    document.querySelectorAll('.grid-row-8x8').forEach(row => {
        row.classList.remove('column-selected');
    });
    
    if (column) {
        // Highlight the column header
        const columnHeader = document.querySelector(`.column-header[data-column="${column}"]`);
        console.log(`🔍 Searching for column header: .column-header[data-column="${column}"]`);
        console.log(`🔍 Found column header for ${column}:`, columnHeader);
        
        if (columnHeader) {
            console.log(`🔍 Header element before styling:`, {
                element: columnHeader,
                classList: columnHeader.classList.toString(),
                style: columnHeader.style.cssText,
                computedStyle: {
                    backgroundColor: window.getComputedStyle(columnHeader).backgroundColor,
                    color: window.getComputedStyle(columnHeader).color,
                    display: window.getComputedStyle(columnHeader).display
                }
            });
            
            columnHeader.classList.add('selected');
            console.log(`✅ Added 'selected' class to column ${column} header`);
            
            console.log(`🔍 Header element after styling:`, {
                classList: columnHeader.classList.toString(),
                computedStyle: {
                    backgroundColor: window.getComputedStyle(columnHeader).backgroundColor,
                    color: window.getComputedStyle(columnHeader).color,
                    display: window.getComputedStyle(columnHeader).display
                }
            });
        } else {
            console.warn(`❌ Column header not found for column ${column}`);
            console.log(`🔍 Available column headers in DOM:`, 
                Array.from(document.querySelectorAll('[data-column]')).map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    column: el.dataset.column,
                    element: el
                }))
            );
        }
        
        // Add subtle highlighting to the column in the grid
        const columnIndex = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].indexOf(column);
        console.log(`🔍 Column ${column} index: ${columnIndex}`);
        if (columnIndex >= 0) {
            const gridRows = document.querySelectorAll('.grid-row-8x8');
            console.log(`🔍 Found ${gridRows.length} grid rows to highlight`);
            gridRows.forEach(row => {
                row.classList.add('column-selected');
                const cells = row.querySelectorAll('.grid-cell-8x8');
                if (cells[columnIndex]) {
                    cells[columnIndex].style.borderColor = '#7289da';
                    cells[columnIndex].style.boxShadow = 'inset 0 0 3px rgba(114, 137, 218, 0.3)';
                }
            });
        }
        
        console.log(`🎯 Highlighted column: ${column}`);
    }
}

// Function to add column hover effects for moderators
function addColumnHoverEffects() {
    // Check if user is moderator
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    const isModerator = moderatorColumnControl && moderatorColumnControl.style.display === 'block';
    
    if (!isModerator) return;
    
    document.querySelectorAll('.column-header').forEach((header, index) => {
        const column = header.getAttribute('data-column');
        
        header.addEventListener('mouseenter', function() {
            // Only show hover effect if in manual mode or if no column is selected
            const autoColumnToggle = document.getElementById('autoColumnToggle');
            const isManualMode = autoColumnToggle && !autoColumnToggle.checked;
            
            if (isManualMode) {
                // Highlight the entire column on hover
                const columnIndex = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].indexOf(column);
                if (columnIndex >= 0) {
                    document.querySelectorAll('.grid-row-8x8').forEach(row => {
                        const cells = row.querySelectorAll('.grid-cell-8x8');
                        if (cells[columnIndex]) {
                            cells[columnIndex].style.backgroundColor = 'rgba(114, 137, 218, 0.2)';
                            cells[columnIndex].style.borderColor = '#7289da';
                            cells[columnIndex].style.boxShadow = '0 0 6px rgba(114, 137, 218, 0.3)';
                            cells[columnIndex].style.transform = 'scale(1.02)';
                        }
                    });
                }
            }
        });
        
        header.addEventListener('mouseleave', function() {
            // Remove hover effect, but preserve selected column highlighting
            const columnIndex = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].indexOf(column);
            if (columnIndex >= 0) {
                document.querySelectorAll('.grid-row-8x8').forEach(row => {
                    const cells = row.querySelectorAll('.grid-cell-8x8');
                    if (cells[columnIndex]) {
                        // Check if this column is currently selected
                        const isSelected = header.classList.contains('selected');
                        if (isSelected) {
                            // Restore selected state styling
                            cells[columnIndex].style.backgroundColor = '';
                            cells[columnIndex].style.borderColor = '#7289da';
                            cells[columnIndex].style.boxShadow = 'inset 0 0 3px rgba(114, 137, 218, 0.3)';
                            cells[columnIndex].style.transform = '';
                        } else {
                            // Restore default styling
                            cells[columnIndex].style.backgroundColor = '';
                            cells[columnIndex].style.borderColor = '';
                            cells[columnIndex].style.boxShadow = '';
                            cells[columnIndex].style.transform = '';
                        }
                    }
                });
            }
        });
    });
}

// Chat Objects (will be initialized when DOM is ready)
let chatForm, globalChatMessages, globalNameText, roomChatMessages, roomNameText, userList, userCount, gameDiv;

// Poker table visualization functions
function clearPokerTable() {
    // Clear all seats
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            const statusDiv = seat.querySelector('.player-status');
            const aiDiv = seat.querySelector('.ai-indicator');
            
            if (nameDiv) nameDiv.textContent = '';
            if (statusDiv) statusDiv.textContent = 'Empty';
            if (aiDiv) aiDiv.style.display = 'none';
            seat.style.borderColor = '#72767d'; // Dim border for empty seats
        }
    });
    
    // Clear moderator seat
    const moderatorSeat = document.getElementById('moderatorPlayer');
    if (moderatorSeat) {
        const nameDiv = moderatorSeat.querySelector('.player-name');
        if (nameDiv) nameDiv.textContent = '';
        moderatorSeat.style.borderColor = '#72767d';
    }
    
    // Clear table round display
    const tableRound = document.getElementById('tableRound');
    if (tableRound) tableRound.textContent = '0';
    
    // Clear player list
    const playerListDiv = document.getElementById('playerList');
    if (playerListDiv) playerListDiv.innerHTML = '<strong>Players in room:</strong><br>None';
    
    // Clear player count
    const playerCountSpan = document.getElementById('playerCount');
    if (playerCountSpan) playerCountSpan.textContent = 'No players';
}

function updatePokerTable(gameSession, currentTurnPlayer = null) {
    // Use provided currentTurnPlayer or fall back to global currentActivePlayer
    const activePlayer = currentTurnPlayer || currentActivePlayer;
    console.log('🃏 Updating poker table - activePlayer:', activePlayer, 'currentTurnPlayer:', currentTurnPlayer, 'currentActivePlayer:', currentActivePlayer);
    
    // Clear all seats first
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            const statusDiv = seat.querySelector('.player-status');
            const aiDiv = seat.querySelector('.ai-indicator');
            
            if (nameDiv) nameDiv.textContent = '';
            if (statusDiv) statusDiv.textContent = 'Empty';
            if (aiDiv) aiDiv.style.display = 'none';
            seat.style.borderColor = '#72767d'; // Dim border for empty seats
        } else {
            console.warn('🃏 Poker seat element not found:', seatId);
        }
    });
    
    // Get players from gameSession or fallback to Player.list
    const players = gameSession.players || Object.values(Player.list || {});
    console.log('🃏 Players to place:', players);
    
    players.forEach(player => {
        console.log('🃏 Processing player:', player.username, 'seatPosition:', player.seatPosition);
        const seatPosition = player.seatPosition || 'center';
        let seatId = '';
        
        // Map seat position to DOM element ID
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
        
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            const statusDiv = seat.querySelector('.player-status');
            const aiDiv = seat.querySelector('.ai-indicator');
            
            if (nameDiv) nameDiv.textContent = player.username;
            if (statusDiv) statusDiv.textContent = `P${player.triadPosition}`;
            
            // Show AI indicator if it's an AI player
            if (aiDiv) {
                if (player.isAI) {
                    aiDiv.style.display = 'block';
                } else {
                    aiDiv.style.display = 'none';
                }
            }
            
            // Set border color - green if active player, blue otherwise
            if (activePlayer && player.username === activePlayer) {
                applyActivePlayerHighlight(seat);
                console.log(`🟢 Set ${player.username} seat to green (active player)`);
            } else {
                seat.style.borderColor = '#7289da';
                seat.style.boxShadow = 'none';
                seat.style.background = '';
                console.log(`🔵 Set ${player.username} seat to blue (inactive player)`);
            }
            
            console.log(`🃏 Placed ${player.username} in ${seatPosition} seat (P${player.triadPosition})`);
        } else {
            console.warn('🃏 Seat element not found:', seatId);
        }
    });
    
    // Update both round display elements (first function)
    const currentRound = document.getElementById('currentRound');
    const tableRound = document.getElementById('tableRound');
    if (currentRound && gameSession) {
        currentRound.textContent = gameSession.currentRound || 0;
    }
    if (tableRound && gameSession) {
        tableRound.textContent = gameSession.currentRound || 0;
    }
}

// DOM elements will be initialized in DOMContentLoaded
let signDiv, signDivUsername, signDivPassword, signDivSignIn, signDivSignUp, chatDiv, landingPage, backgroundIMG;
let modal, loginButton, createRoomButton, joinRoomButton;

// Store current user's username
let currentUsername = null;

// Event handlers will be initialized in DOMContentLoaded

// Join chatroom
socket.on('signInResponse', function (data) {
    if (data.success) {
        // Store the current username globally and in localStorage
        currentUsername = signDivUsername ? signDivUsername.value : null;
        if (currentUsername) {
            localStorage.setItem('username', currentUsername);
        }
        console.log('Signed in as:', currentUsername);
        
        //signDiv.style.display = 'none';
        landingPage.style.display = "none";
        loginButton.style.display = "none";
        chatDiv.style.display = '';
        
        // Stop space animations when user successfully logs in
        if (typeof window.stopSpaceAnimationsOnLogin === 'function') {
            window.stopSpaceAnimationsOnLogin();
        }
        
        socket.emit('joinRoom', 'Global');
        currentRoom = 'Global'; // Update current room tracking
    }

    else
        alert("Sign in unsuccessul.");
});

socket.on('signUpResponse', function (data) {
    if (data.success) {
        alert("Sign up successul.");
    }
    else
        alert("Sign up unsuccessul.");
});

// Get room and users
socket.on('roomUsers', ({ room, users, usersCount }) => {
    // Use actual users array length instead of potentially incorrect usersCount from server
    const actualUserCount = users ? users.length : 0;
    
    // Only update the display if this roomUsers event is for the room the user is actually in
    if (room === currentRoom) {
        if (room === "Global") {
            // Update global chat users
            outputUsers(users);
            if (userCount) {
                userCount.innerText = `${actualUserCount} online`;
            } else {
                console.error('❌ userCount element not found for Global room');
            }
        } else {
            // Update room name and users for specific rooms
            outputRoomName(room);
            outputUsers(users);
            if (userCount) {
                userCount.innerText = `${actualUserCount} in room`;
            } else {
                console.error(`❌ userCount element not found for room ${room}`);
            }
        }
    }
});

// Handle players in room updates (including AI players)
socket.on('playersInRoom', function(data) {
    // Only update if this is for our current room
    if (data.room === currentRoom) {
        // Find the moderator (room creator/first player)
        const moderator = data.players.find(p => p.isModerator) || data.players[0];
        
        // Update moderator position
        const moderatorDiv = document.getElementById('moderatorPosition');
        
        if (moderatorDiv && moderator) {
            const moderatorNameDiv = moderatorDiv.querySelector('.moderator-name');
            
            if (moderatorNameDiv) {
                moderatorNameDiv.textContent = moderator.username;
            } else {
                // Add moderator name if div doesn't exist
                const nameDiv = document.createElement('div');
                nameDiv.className = 'moderator-name';
                nameDiv.style.cssText = 'color: #9b59b6; font-size: 13px; font-weight: bold;';
                nameDiv.textContent = moderator.username;
                moderatorDiv.appendChild(nameDiv);
            }
        }
        
        // Get non-moderator players for the poker seats
        const participantPlayers = data.players.filter(p => p !== moderator);
        
        // Clear all poker seats first
        SEAT_IDS.forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const nameDiv = seat.querySelector('.player-name');
                const statusDiv = seat.querySelector('.player-status');
                const aiDiv = seat.querySelector('.ai-indicator');
                const walletDiv = seat.querySelector('.player-wallet');
                
                if (nameDiv) nameDiv.textContent = '';
                if (statusDiv) statusDiv.textContent = 'Empty';
                if (aiDiv) aiDiv.style.display = 'none';
                if (walletDiv) walletDiv.textContent = '';
                seat.style.borderColor = '#72767d';
                seat.removeAttribute('data-player-username');
            }
        });
        
        // Place participant players in seats
        const seatIds = SEAT_IDS;
        participantPlayers.forEach((player, index) => {
            if (index < 3) { // Only place up to 3 participants
                const seatId = seatIds[index];
                const seat = document.getElementById(seatId);
                
                if (seat) {
                    const nameDiv = seat.querySelector('.player-name');
                    const statusDiv = seat.querySelector('.player-status');
                    const aiDiv = seat.querySelector('.ai-indicator');
                    const walletDiv = seat.querySelector('.player-wallet');
                    
                    if (nameDiv) nameDiv.textContent = player.username;
                    if (statusDiv) statusDiv.textContent = `P${index + 1}`;
                    
                    // Show AI indicator if it's an AI player
                    if (aiDiv) {
                        if (player.isAI) {
                            aiDiv.style.display = 'block';
                        } else {
                            aiDiv.style.display = 'none';
                        }
                    }
                    
                    // Display wallet totals
                    if (walletDiv) {
                        const totalEarnings = player.totalEarnings || 0;
                        walletDiv.textContent = `$${totalEarnings.toFixed(2)}`;
                    }
                    
                    // Store player data for wallet updates
                    seat.setAttribute('data-player-username', player.username);
                    
                    // Highlight active seat
                    seat.style.borderColor = '#7289da';
                    
                } else {
                    console.warn('❌ Seat element not found:', seatId);
                }
            }
        });
        
        // Also update the player list display
        const usernames = data.players.map(p => {
            let name = p.isAI ? `🤖 ${p.username}` : p.username;
            if (p === moderator) name += ' (Moderator)';
            return name;
        });
        const playerListDiv = document.getElementById('playerList');
        if (playerListDiv) {
            playerListDiv.innerHTML = `<strong>Players in room:</strong><br>${usernames.join('<br>')}`;
        }
        
        // Update player count - moderator + 3 participants needed
        const playerCountSpan = document.getElementById('playerCount');
        if (playerCountSpan) {
            const participantCount = participantPlayers.length;
            const totalCount = data.players.length;
            playerCountSpan.textContent = participantCount >= 3 ? 
                `Triad Complete! (${totalCount} total: 1 moderator + ${participantCount} participants)` : 
                `Need ${3 - participantCount} more players... (${totalCount} total: 1 moderator + ${participantCount} participants)`;
        }
        
        // Check if current user is the moderator and show/hide buttons accordingly
        const currentUser = data.players.find(p => p.isModerator);
        const isCurrentUserModerator = currentUser && currentUser.username === currentUsername; // Use global currentUsername
        
        // Show/hide "Start Experiment" button based on moderator status
        const startExperimentBtn = document.getElementById('startExperimentBtn');
        if (startExperimentBtn) {
            if (moderator && isCurrentUserModerator) {
                startExperimentBtn.style.display = 'block';
            } else {
                startExperimentBtn.style.display = 'none';
            }
        }
        
        // Show/hide "Add AI Players" button based on moderator status
        let addAIBtn = document.getElementById('addAIBtn');
        if (moderator && isCurrentUserModerator) {
            // Create Add AI button if it doesn't exist and user is moderator
            if (!addAIBtn && startExperimentBtn) {
                addAIBtn = document.createElement('button');
                addAIBtn.id = 'addAIBtn';
                addAIBtn.textContent = 'Add AI Players for Testing';
                addAIBtn.style.cssText = 'background-color: #7289da; color: white; padding: 10px 20px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;';
                startExperimentBtn.parentNode.appendChild(addAIBtn);
                
                // Add event listener for Add AI button
                addAIBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    // Emit request to server to add AI players
                    socket.emit('addAIPlayers', { 
                        room: currentRoom || 'Global'
                    });
                    
                    // Provide user feedback
                    addAIBtn.textContent = 'Adding AI Players...';
                    addAIBtn.disabled = true;
                    
                    // Re-enable after a short delay
                    setTimeout(() => {
                        addAIBtn.textContent = 'Add AI Players for Testing';
                        addAIBtn.disabled = false;
                    }, 2000);
                });
            } else if (addAIBtn) {
                addAIBtn.style.display = 'inline-block';
            }
        } else if (addAIBtn) {
            // Hide button if user is not moderator
            addAIBtn.style.display = 'none';
        }
    } else {
        console.log(`🚫 Ignoring playersInRoom for ${data.room} - current room is ${currentRoom}`);
    }
    
    // Update the incentive player dropdown if this is for our current room
    if (data.room === currentRoom) {
        updateIncentivePlayerDropdown(data.players);
    }
});

// Function to update the incentive player dropdown
function updateIncentivePlayerDropdown(players) {
    const dropdown = document.getElementById('incentivePlayer');
    if (!dropdown) return;
    
    // Store the current selection
    const currentSelection = dropdown.value;
    
    // Clear existing options
    dropdown.innerHTML = '<option value="">Select a player...</option>';
    
    // Add player options (exclude AI players for incentives)
    players.forEach(player => {
        if (!player.isAI) {
            const option = document.createElement('option');
            option.value = player.username;
            option.textContent = `${player.username}${player.isModerator ? ' (Moderator)' : ''}`;
            dropdown.appendChild(option);
        }
    });
    
    // Restore selection if the player is still in the room
    if (currentSelection && players.find(p => p.username === currentSelection)) {
        dropdown.value = currentSelection;
    }
}

socket.on('message', (message) => {
    outputMessage(message);

    // Scroll down
    globalChatMessages.scrollTop = globalChatMessages.scrollHeight;
    roomChatMessages.scrollTop = roomChatMessages.scrollHeight;
});

socket.on('roomCreated', (roomName) => {
    console.log("Room Created: "+roomName)
    roomNameText.style.display ="";
    socket.emit('joinRoom', roomName );
    currentRoom = roomName; // Update current room tracking
    roomNameText.innerText = roomName;
    
    // Show game interface immediately when moderator creates room
    showGameInterface();
    
    // Copy room name to clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText(roomName).then(() => {
            // Show a brief notification
            const notification = document.createElement('div');
            notification.textContent = `Room name "${roomName}" copied to clipboard!`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #43b581;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                z-index: 9999;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 3000);
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
        });
    } else {
        console.warn('Clipboard API not available');
    }
})

// Handle copy to clipboard requests
socket.on('copyToClipboard', (data) => {
    if (navigator.clipboard && data.text) {
        navigator.clipboard.writeText(data.text).then(() => {
            console.log(`✅ "${data.text}" copied to clipboard`);
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
        });
    }
});


// Chat initialization and event handlers will be set up in DOMContentLoaded

// Function to show game interface inline
function showGameInterface() {
    console.log('🎮 showGameInterface() called');
    const gameDiv = document.getElementById('gameDiv');
    const landingPage = document.getElementById('landingPage');
    
    console.log('gameDiv found:', !!gameDiv);
    console.log('landingPage found:', !!landingPage);
    
    // Hide landing page if it exists
    if (landingPage) {
        landingPage.style.display = 'none';
        console.log('Landing page hidden');
    }
    
    if (gameDiv) {
        gameDiv.style.display = 'block';
        console.log('✅ Game interface displayed');
        
        // Don't automatically show buttons - wait for moderator check in playersInRoom handler
        console.log('⏳ Waiting for room state to determine button visibility');
        
        // Small delay to ensure DOM elements are ready, then request room state
        setTimeout(() => {
            if (currentRoom && currentRoom !== 'Global') {
                console.log('🔍 Requesting room state for:', currentRoom);
                socket.emit('requestRoomState', { room: currentRoom });
            }
        }, 100);
    } else {
        console.log('❌ gameDiv not found!');
    }
    
    // Request current room state when showing game interface
    if (currentRoom && currentRoom !== 'Global') {
        console.log('🔍 Requesting room state for:', currentRoom);
        socket.emit('requestRoomState', { room: currentRoom });
    }
    
    gameActive = true;
    console.log('🎮 Game interface setup complete');
}

// Output message to DOM
function outputMessage(message) {

if(message.type == "broadcast"){
    console.log("Broadcast")
    //If message is a broadcast, send to ALL rooms
    const div = document.createElement('div');
    div.id = message.username;
    div.classList.add('message');
    const p = document.createElement('p');
    p.classList.add('meta');
    p.innerText = message.username;
    switch (message.admin) {
        case true:
            p.style.color = "magenta";
            p.innerText = message.username + "  (admin)";
            break;
    }
    p.innerHTML += `<span>  ${message.time}</span>`;
    p.style.fontSize = "12px"
    div.appendChild(p);
    const para = document.createElement('p');
    para.classList.add('text');
    para.innerText = message.text;
    switch (message.type) {
        case "status":
            para.style.color = "green";
            break;
        case "broadcast":
            para.style.color = "yellow";
            break;
        case "pm":
            para.style.color = "magenta";
            break;
    }
    div.appendChild(para)
    document.getElementById("globalChatDiv").appendChild(div);
    document.getElementById("roomChatDiv").appendChild(div);
    return;
}

let roomNameDiv = "globalChatDiv";
let chatMessages = globalChatMessages;

if(message.room !== "Global"){
    roomNameDiv = "roomChatDiv"
    chatMessages = roomChatMessages
}

    // If the previous message was sent by them same user, combine the message div, otherwise seperate
    if (chatMessages.childNodes.length >= 1) {
        let lastMessage = chatMessages.lastElementChild
        if (lastMessage.id == message.username) {
            const p = document.createElement('p');
            p.classList.add('meta');

            const para = document.createElement('p');
            para.classList.add('text');
            para.innerText = message.text;
            switch (message.type) {
                case "status":
                    para.style.color = "green";
                    break;
                case "pm":
                    para.style.color = "magenta";
                    break;
            }
            chatMessages.lastElementChild.appendChild(para)
            return;
        }
    }

    const div = document.createElement('div');
    div.id = message.username;
    div.classList.add('message');
    const p = document.createElement('p');
    p.classList.add('meta');
    p.innerText = message.username;
    switch (message.admin) {
        case true:
            p.style.color = "magenta";
            p.innerText = message.username + "  (admin)";
            break;
    }
    p.innerHTML += `<span>  ${message.time}</span>`;
    p.style.fontSize = "12px"
    div.appendChild(p);
    const para = document.createElement('p');
    para.classList.add('text');
    para.innerText = message.text;
    switch (message.type) {
        case "status":
            para.style.color = "green";
            break;
        case "broadcast":
            para.style.color = "yellow";
            break;
        case "pm":
            para.style.color = "magenta";
            break;
    }
    div.appendChild(para)
    document.getElementById(roomNameDiv).appendChild(div);


}

// Add room name to DOM
function outputRoomName(room) {
    if (!roomNameText) {
        console.log('❌ roomNameText element not found, cannot update room name');
        return;
    }
    
    console.log('🏷️ Updating room name to:', room);
    roomNameText.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
    if (!userList) {
        console.log('❌ userList element not found, cannot update user display');
        return;
    }
    
    console.log('📝 Updating user list with:', users);
    userList.innerHTML = '';
    users.forEach((user) => {
        const li = document.createElement('li');
        li.innerText = user.username;
        userList.appendChild(li);
    });
}

// Leave button handler will be initialized in DOMContentLoaded

// Room button handlers will be initialized in DOMContentLoaded

socket.on("joinRoom", (room) => {
    currentRoom = room; // Ensure currentRoom is updated when server confirms room join
    
    // Update room name display if elements are available
    if (roomNameText) {
        roomNameText.innerText = room;
        roomNameText.style.display = "";
        roomNameText.style.backgroundColor = "green";
    } else {
        console.log(`❌ roomNameText element not found, cannot display room name`);
    }
    
    // Show game interface immediately when joining a room (unless it's Global)
    if (room !== 'Global') {
        showGameInterface();
        console.log('🎮 Showing game board for player joining room');
    }
    
    // Handle chat switching if elements are available  
    if (globalChatMessages) globalChatMessages.style.display = "none";
    if (globalNameText) globalNameText.style.backgroundColor = "#667aff";
    if (roomChatMessages) roomChatMessages.style.display = "";
});

// Handle leaving a room
socket.on('leftRoom', function(data) {
    console.log('Left room:', data);
    
    // Clear room name display
    if (roomNameText) {
        roomNameText.innerText = '';
        roomNameText.style.display = 'none';
        roomNameText.style.backgroundColor = '';
        console.log('✅ Cleared room name display');
    }
    
    // Hide game interface and return to chat
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        gameDiv.style.display = 'none';
    }
    
    // Clear the poker table completely
    clearPokerTable();
    
    // Hide control buttons
    const startBtn = document.getElementById('startExperimentBtn');
    const aiBtn = document.getElementById('addAIPlayersBtn');
    const addAIBtn = document.getElementById('addAIBtn');
    
    if (startBtn) startBtn.style.display = 'none';
    if (aiBtn) aiBtn.style.display = 'none';
    if (addAIBtn) addAIBtn.remove(); // Remove dynamically created button
    
    // Show create/join room buttons again
    if (createRoomButton) createRoomButton.style.display = 'inline-block';
    if (joinRoomButton) joinRoomButton.style.display = 'inline-block';
    
    // Reset game state
    gameActive = false;
    currentRoom = 'Global';
    
    // Switch back to global chat
    if (globalChatMessages) globalChatMessages.style.display = "";
    if (globalNameText) globalNameText.style.backgroundColor = "#667aff";
    if (roomChatMessages) roomChatMessages.style.display = "none";
    
    console.log('✅ Returned to Global chat and cleared all room data');
});

socket.on("gameStarted", function(){
    socket.emit('beginGame', {room: currentRoom});
})




//Remove - (duplicate removed, keeping the one lower in the file)
// socket.on('remove', function (data) {
//     for (var i = 0; i < data.player.length; i++) {
//         delete Player.list[data.player[i]];
//     }
// });



// Navigation handlers are now in DOMContentLoaded

var changeMap = function(){
    console.log("Change Map")
    socket.emit('changeMap');
}

//Game - DISABLED FOR BEHAVIORAL EXPERIMENT
var Img = {};
Img.player = new Image();
Img.player.src = '/client/img/player.png';

Img.map = {};
Img.map['forest'] = new Image();
Img.map['forest'].src = '/client/img/map.png';
Img.map['snow'] = new Image();
Img.map['snow'].src = '/client/img/snowMap.png';

// DISABLED: Canvas context initialization
// var ctx = document.getElementById("ctx").getContext("2d");
// var ctxUi = document.getElementById("ctx-ui").getContext("2d");
// ctx.font = '30px Arial';

console.log('🚫 Canvas rendering disabled for behavioral experiment mode');
var ctx = null;
var ctxUi = null;

var Player = function (initPack) {
    var self = {};
    self.id = initPack.id;
    self.number = initPack.number;
    self.x = initPack.x;
    self.y = initPack.y;
    self.hp = initPack.hp;
    self.hpMax = initPack.hpMax;
    self.score = initPack.score;
    self.map = initPack.map;

    self.draw = function(){
        var hpWidth = 50 * self.hp / self.hpMax;

        //HP Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(self.x - 40, self.y - 70,hpWidth,4);

        //Player Image
        var width = Img.player.width;
        var height = Img.player.height;

        ctx.drawImage(Img.player,
            0, 0, Img.player.width, Img.player.height,
            self.x - width / 2, self.y - height / 2, width, height);

        //Score
        //ctx.fillText(self.score,self.x,self.y-60)
    }

    Player.list[self.id] = self;
    return self;
}

Player.list = {};
var selfId = null;

//Initialize - MODIFIED FOR BEHAVIORAL EXPERIMENT
socket.on('init', function(data) {
    console.log(`📡 RECEIVED INIT - Room: ${currentRoom}, Players: ${data.player ? data.player.length : 0}, SelfId: ${!!data.selfId}, Timestamp: ${new Date().toLocaleTimeString()}`);
    
    if(data.selfId){
        selfId = data.selfId;
        console.log('🔑 SelfId set to:', selfId);
    }
    
    
    if(data.player && data.player.length > 0 && (currentRoom !== "Global" || data.selfId)) {
        gameDiv.style.display = 'inline-block';
        gameActive = true; // Mark game as active
        
        // Clear existing players before adding new ones
        Player.list = {};
        
        // Initialize players
        for (var i = 0; i < data.player.length; i++) {
            new Player(data.player[i]);
        }
        
        // Update poker table with current players (preserve active player highlighting)
        updatePokerTable(data.gameSession || {}, currentActivePlayer);
        
        // All players who receive init events are now active players (no more viewers)
        if (data.selfId) {
            console.log('🎮 Player mode - has selfId:', data.selfId);
        }
    } else {
        gameDiv.style.display = 'none';
        gameActive = false; // Mark game as inactive
        Player.list = {};
    }
});


//Update - MODIFIED FOR BEHAVIORAL EXPERIMENT (No Canvas)
socket.on('update', function(data) {
    // Only update player data for tracking, no canvas drawing
    for (var i = 0; i < data.player.length; i++) {
        var pack = data.player[i];
        var p = Player.list[pack.id];
        if (p) {
            if (pack.x !== undefined)
                p.x = pack.x;
            if (pack.y !== undefined)
                p.y = pack.y;
            if (pack.hp !== undefined)
                p.hp = pack.hp;
            if (pack.score !== undefined)
                p.score = pack.score;
            if (pack.map !== undefined)
                p.map = pack.map;
        }
    }
});

//Remove - BEHAVIORAL EXPERIMENT COMPATIBLE
socket.on('remove', function (data) {
    for (var i = 0; i < data.player.length; i++) {
        delete Player.list[data.player[i]];
    }
});

// ========================================
// BEHAVIORAL EXPERIMENT SOCKET HANDLERS
// ========================================

// Triad formation complete - experiment ready to begin
socket.on('triadComplete', function(data) {
    console.log('🎯 Triad complete!', data);
    
    // DEBUG: Check if poker table elements exist when triadComplete is received
    console.log('🔍 DOM Check at triadComplete:');
    console.log('  - leftPlayer exists:', !!document.getElementById('leftPlayer'));
    console.log('  - topPlayer exists:', !!document.getElementById('topPlayer'));
    console.log('  - rightPlayer exists:', !!document.getElementById('rightPlayer'));
    console.log('  - gameDiv display:', document.getElementById('gameDiv') ? document.getElementById('gameDiv').style.display : 'not found');
    
    // Update player position and status
    document.getElementById('playerPosition').textContent = `You are Player ${data.playerPosition}`;
    
    // Update player count text based on data
    const totalPlayers = data.gameSession ? data.gameSession.totalPlayers || 3 : 3;
    document.getElementById('playerCount').textContent = `Players ready: ${totalPlayers}/3`;
    
    // Update poker table with player positions (preserve active player highlighting)
    console.log('🎯 About to call updatePokerTable with:', data.gameSession);
    updatePokerTable(data.gameSession, currentActivePlayer);
    
    // Show start button and add AI button if needed
    document.getElementById('startExperimentBtn').style.display = 'block';
    
    // Show "Add AI Players" button if not at capacity
    if (data.gameSession && data.gameSession.canAddAI) {
        let addAIBtn = document.getElementById('addAIBtn');
        if (!addAIBtn) {
            addAIBtn = document.createElement('button');
            addAIBtn.id = 'addAIBtn';
            addAIBtn.textContent = 'Add AI Players for Testing';
            addAIBtn.style.cssText = 'background-color: #7289da; color: white; padding: 10px 20px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;';
            document.getElementById('startExperimentBtn').parentNode.appendChild(addAIBtn);
            
            // Add event listener for Add AI button
            addAIBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🤖 Add AI Players button clicked');
                
                // Emit request to server to add AI players
                socket.emit('addAIPlayers', { 
                    room: currentRoom || 'Global'
                });
                
                // Provide user feedback
                addAIBtn.textContent = 'Adding AI Players...';
                addAIBtn.disabled = true;
                
                // Re-enable after a short delay
                setTimeout(() => {
                    addAIBtn.textContent = 'Add AI Players for Testing';
                    addAIBtn.disabled = false;
                }, 2000);
            });
        }
        addAIBtn.style.display = 'inline-block';
    }
    
    // Update condition info (only for moderators)
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    const isModerator = moderatorColumnControl && moderatorColumnControl.style.display === 'block';
    const conditionInfoElement = document.getElementById('conditionInfo');
    if (conditionInfoElement && isModerator) {
        conditionInfoElement.textContent = `Condition: ${data.gameSession.condition}`;
    }
    
    document.getElementById('maxRounds').textContent = data.gameSession.maxRounds;
    
    // Set up grid with random symbols
    updateDecisionGrid(data.gameSession.grid);
    
    gameActive = true;
    gameDiv.style.display = 'inline-block';
});

// AI players added
socket.on('aiPlayersAdded', function(data) {
    console.log('🤖 AI players added:', data);
    
    // Update the player count display
    document.getElementById('playerCount').textContent = `Players: ${data.totalPlayers}/3 (${data.totalPlayers - data.aiCount} human, ${data.aiCount} AI)`;
    
    // Hide the Add AI button since we're now at capacity
    const addAIBtn = document.getElementById('addAIBtn');
    if (addAIBtn) {
        addAIBtn.style.display = 'none';
    }
    
    // Show message about AI addition
    const statusDiv = document.createElement('div');
    statusDiv.textContent = data.message;
    statusDiv.style.cssText = 'color: #7289da; font-size: 14px; margin-top: 10px; text-align: center;';
    statusDiv.id = 'aiStatusMessage';
    
    // Remove any existing status message
    const existingStatus = document.getElementById('aiStatusMessage');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    document.getElementById('lobbyPhase').appendChild(statusDiv);
});

// Handle turn-based decision making
socket.on('yourTurn', function(data) {
    
    // IMMEDIATE gameDiv protection at yourTurn start
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
        }
    }
    
    // Restore any floating players from previous round
    restoreFloatingPlayers();
    
    // Reset client-side lock-in state for new round
    selectedChoice = null;
    isLockedIn = false;
    
    // Show decision interface
    const lobbyPhase = document.getElementById('lobbyPhase');
    const decisionPhase = document.getElementById('decisionPhase');
    const resultsPhase = document.getElementById('resultsPhase');
    const finalResults = document.getElementById('finalResults');
    const selectionSectionElement = document.getElementById('selectionSection');
    const tokenConversionDisplay = document.getElementById('tokenConversionDisplay');
    
    if (lobbyPhase) lobbyPhase.style.display = 'none';
    if (decisionPhase) decisionPhase.style.display = 'block';
    // Keep results visible from previous round
    if (finalResults) finalResults.style.display = 'none';
    
    // Show selection section and token conversion display
    if (selectionSectionElement) selectionSectionElement.style.display = 'block';
    if (tokenConversionDisplay) {
        tokenConversionDisplay.style.display = 'block';
        // Update token values from server data if available
        if (data.condition && typeof data.condition === 'object' && 
            data.condition.whiteValue && data.condition.blackValue) {
            updateTokenConversionDisplay(data.condition.whiteValue, data.condition.blackValue);
        } else {
            // Initialize with default baseline values as fallback
            updateTokenConversionDisplay(0.01, 0.05);
        }
    }
    
    // Reset selection UI elements
    const selectedChoiceDiv = document.getElementById('selectedChoice');
    const lockInBtn = document.getElementById('lockInBtn');
    const lockInText = document.getElementById('lockInText');
    
    if (selectedChoiceDiv) {
        selectedChoiceDiv.textContent = 'No selection made';
        selectedChoiceDiv.style.color = '#6c757d';
    }
    if (lockInBtn && lockInText) {
        lockInBtn.disabled = true;
        lockInText.textContent = '🔒 Lock In Choice';
        lockInBtn.style.background = 'linear-gradient(135deg, #5865f2, #4752c4)';
        lockInBtn.style.cursor = 'not-allowed';
    }
    
    // Reset row styles
    document.querySelectorAll('.clickable-row').forEach(row => {
        row.style.opacity = '0.7';
        row.style.transform = 'scale(1)';
        row.style.boxShadow = 'none';
        row.style.backgroundColor = 'transparent';
    });
    
    // Update round info - both the big counter and table center
    const currentRound = document.getElementById('currentRound');
    const tableRound = document.getElementById('tableRound');
    
    if (currentRound) currentRound.textContent = data.round || 1;
    if (tableRound) tableRound.textContent = data.round || 1;
    
    // Enable/disable choice buttons based on turn (moderators can't vote)
    const canVote = data.isYourTurn && !data.isModerator;
    const isParticipant = !data.isModerator; // Participants can see voting interface even when not their turn
    
    // Render the 8x8 grid - now show to everyone including moderators
    if (data.grid) {
        renderGrid8x8(data.grid);
    }
    
    // Show decision grid to everyone, but with different controls for moderators vs participants
    const decisionGrid = document.getElementById('decisionGrid');
    if (decisionGrid) {
        decisionGrid.style.display = 'block'; // Show to everyone now
        
        // Update instruction text based on role
        const playerInstructions = document.getElementById('playerInstructions');
        const moderatorInstructions = document.getElementById('moderatorInstructions');
        if (data.isModerator) {
            if (playerInstructions) playerInstructions.style.display = 'none';
            if (moderatorInstructions) moderatorInstructions.style.display = 'block';
        } else {
            if (playerInstructions) playerInstructions.style.display = 'block';
            if (moderatorInstructions) moderatorInstructions.style.display = 'none';
        }
    }
    
    // Show/hide moderator column control
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    if (moderatorColumnControl) {
        moderatorColumnControl.style.display = data.isModerator ? 'block' : 'none';
        
        // Show/hide testing panel for moderators only
        const testingPanel = document.getElementById('testingPanel');
        if (testingPanel) {
            testingPanel.style.display = data.isModerator ? 'block' : 'none';
        }
        
        // Initialize column hover effects for moderators
        if (data.isModerator) {
            // Add a small delay to ensure DOM is fully updated
            setTimeout(() => {
                addColumnHoverEffects();
            }, 100);
        }
    }
    
    // Only set row interactivity for non-turn-based games
    // In turn-based games, row interactivity is handled by turnUpdate events
    const clickableRows = document.querySelectorAll('.clickable-row');
    
    // Check if we have turn-based info available (if turnUpdate has been received)
    const turnDisplay = document.getElementById('turnDisplay');
    const isTurnBasedGame = turnDisplay && turnDisplay.style.display !== 'none';
    
    if (!isTurnBasedGame) {
        // Traditional simultaneous gameplay - use canVote
        clickableRows.forEach(row => {
            if (canVote) {
                row.style.opacity = '1';
                row.style.cursor = 'pointer';
                row.style.pointerEvents = 'auto';
            } else {
                row.style.opacity = '0.5';
                row.style.cursor = 'not-allowed';
                row.style.pointerEvents = 'none';
            }
        });
    } else {
        // Turn-based game will handle via turnUpdate
    }
        
    // Add visual feedback for active player
    if (canVote) {
        // Additional voting-specific UI updates can go here if needed
    }
    
    // Show/hide selection section based on participant status (not just voting ability)
    const selectionSection = document.getElementById('selectionSection');
    if (selectionSection) {
        selectionSection.style.display = isParticipant ? 'block' : 'none';
    }
    
    // Update choice status message - removed choiceStatus element references
    // Status is now handled by the selection section UI
    
    // Hide moderator controls during gameplay
    const startBtn = document.getElementById('startExperimentBtn');
    const addAIBtn = document.getElementById('addAIBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (addAIBtn) addAIBtn.style.display = 'none';
    
    // Final gameDiv protection at yourTurn end
    const gameDivEnd = document.getElementById('gameDiv');
    if (gameDivEnd) {
        if (gameDivEnd.style.display === 'none' || gameDivEnd.style.display === '') {
            gameDivEnd.style.display = 'inline-block';
        }
    }
});

// New round started
socket.on('newRound', function(data) {
    console.log('🔄 New round started:', data);
    
    // Update current round tracking
    currentRoundNumber = data.round;
    
    // Ensure game interface is visible at start of new round
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        if (gameDiv.style.display === 'none') {
            gameDiv.style.display = 'block';
        }
    }
    
    // Update round info - both big counter and table center
    const currentRound = document.getElementById('currentRound'); // Big round counter at top
    const tableRound = document.getElementById('tableRound'); // Small round counter in table center
    if (currentRound) currentRound.textContent = data.round;
    if (tableRound) tableRound.textContent = data.round;
    
    // Only show condition to moderators
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    const isModerator = moderatorColumnControl && moderatorColumnControl.style.display === 'block';
    const conditionInfoElement = document.getElementById('conditionInfo');
    if (conditionInfoElement && isModerator) {
        conditionInfoElement.textContent = `Condition: ${data.condition}`;
    }
    
    const globalTokenPoolElement = document.getElementById('globalTokenPool');
    console.log('🔄 NEW ROUND - Token pool update data:', {
        whiteTokensRemaining: data.whiteTokensRemaining,
        dataKeys: Object.keys(data),
        elementExists: !!globalTokenPoolElement,
        currentTextContent: globalTokenPoolElement ? globalTokenPoolElement.textContent : 'N/A'
    });
    
    if (globalTokenPoolElement) {
        const oldValue = globalTokenPoolElement.textContent;
        globalTokenPoolElement.textContent = data.whiteTokensRemaining;
        console.log('🔄 NewRound: Token pool updated:', oldValue, '→', data.whiteTokensRemaining);
        console.log('🔄 NewRound: Element after update:', globalTokenPoolElement.textContent);
    } else {
        console.error('❌ NewRound: globalTokenPool element not found!');
    }
    
    // Update culturant count from server data
    if (data.culturantsProduced !== undefined) {
        const culturantCountElement = document.getElementById('culturantCount');
        if (culturantCountElement) {
            culturantCountElement.textContent = data.culturantsProduced;
            console.log('🔄 NewRound: Updated culturant count to:', data.culturantsProduced);
        }
    }
    
    // Round display already updated above
    
    // Update UI phases
    document.getElementById('lobbyPhase').style.display = 'none';
    document.getElementById('decisionPhase').style.display = 'block';
    // Keep results visible from previous round
    document.getElementById('finalResults').style.display = 'none';
    
    console.log('🔄 NewRound', data.round, ': Phase transition to decisionPhase');
    
    // Enable/disable choice buttons based on turn
    const choiceButtons = document.querySelectorAll('.grid-cell');
    choiceButtons.forEach(button => {
        button.disabled = !data.isYourTurn;
        button.style.opacity = data.isYourTurn ? '1' : '0.5';
    });
    
    // Choice status is now handled by the modern selection UI
});

// Function to update token conversion display
function updateTokenConversionDisplay(whiteValue, blackValue) {
    const whiteTokenElement = document.getElementById('whiteTokenValue');
    const blackTokenElement = document.getElementById('blackTokenValue');
    const conversionDisplay = document.getElementById('tokenConversionDisplay');
    
    if (whiteTokenElement && blackTokenElement && conversionDisplay) {
        whiteTokenElement.textContent = `$${whiteValue.toFixed(2)}`;
        blackTokenElement.textContent = `$${blackValue.toFixed(2)}`;
        conversionDisplay.style.display = 'block';
        console.log(`💰 Updated token conversion display: White=$${whiteValue.toFixed(2)}, Black=$${blackValue.toFixed(2)}`);
    }
}

// Function to update all player wallet displays
function updateAllWalletDisplays(playersData) {
    console.log('💰 Updating wallet displays for all players');
    console.log('💰 Players data received:', playersData);
    
    // Check moderator status
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    const isModerator = moderatorColumnControl && moderatorColumnControl.style.display === 'block';
    console.log('💰 Current user is moderator:', isModerator);
    
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const username = seat.getAttribute('data-player-username');
            const walletDiv = seat.querySelector('.player-wallet');
            console.log(`💰 Processing seat ${seatId}: username=${username}, walletDiv=${!!walletDiv}`);
            
            if (username && walletDiv) {
                // Find player data
                const playerData = playersData.find(p => p.username === username);
                console.log(`💰 Player data for ${username}:`, playerData);
                if (playerData) {
                    const totalEarnings = playerData.totalEarnings || 0;
                    const walletText = `$${totalEarnings.toFixed(2)}`;
                    walletDiv.textContent = walletText;
                    console.log(`💰 Updated wallet for ${username}: $${totalEarnings.toFixed(2)}`);
                } else {
                    console.log(`💰 No player data found for ${username}`);
                }
            } else {
                console.log(`💰 Missing data for seat ${seatId}: username=${username}, walletDiv=${!!walletDiv}`);
            }
        } else {
            console.log(`💰 Seat ${seatId} not found`);
        }
    });
}

// Round results received
socket.on('roundResult', function(data) {
    console.log('📊 Round results:', data);
    
    // Detect if user is moderator (used throughout this handler)
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    const isModerator = moderatorColumnControl && moderatorColumnControl.style.display === 'block';
    
    // Ensure gameDiv is visible at start of round result processing
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
        }
    }
    
    // Show results phase immediately - keep both results and selection section visible
    document.getElementById('resultsPhase').style.display = 'block';
    
    // Store token update data to apply when the return animation triggers
    pendingTokenUpdates = {
        totalTokens: data.totalTokens,
        totalEarnings: data.totalEarnings,
        whiteTokensRemaining: data.whiteTokensRemaining,
        isModerator: isModerator
    };
    console.log('🎯 Stored pending token updates for later application:', pendingTokenUpdates);

    // Trigger token updates when return animation starts (after a longer delay)
    setTimeout(() => {
        if (pendingTokenUpdates) {
            console.log('🎯 Applying token updates as return animation begins');
            
            // Update personal token displays (don't update personal tokens for moderators)
            if (!pendingTokenUpdates.isModerator) {
                document.getElementById('whiteTokens').textContent = pendingTokenUpdates.totalTokens.white;
                document.getElementById('blackTokens').textContent = pendingTokenUpdates.totalTokens.black;
                document.getElementById('totalEarnings').textContent = `$${pendingTokenUpdates.totalEarnings.toFixed(2)}`;
            } else {
                document.getElementById('whiteTokens').textContent = '0';
                document.getElementById('blackTokens').textContent = '0';
                document.getElementById('totalEarnings').textContent = '$0.00';
            }

            // Add visual flash animation to highlight the personal token updates
            ['whiteTokens', 'blackTokens', 'totalEarnings'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.style.animation = 'tokenUpdate 0.6s ease-in-out';
                    setTimeout(() => element.style.animation = '', 600);
                }
            });

            console.log('🎯 Token updates applied during return animation');
            pendingTokenUpdates = null;
        }
    }, 2000); // Delay to coincide with return animation start

    // Also update poker table wallet displays with the same delay
    setTimeout(() => {
        console.log('💰 Updating poker table wallet displays during return animation');
        if (data.players && data.players.length > 0) {
            updateAllWalletDisplays(data.players);
        }
    }, 3000); // Same delay as personal wallet updates

    // Delay global token pool update slightly for visual consistency
    setTimeout(() => {
        console.log('🎯 Updating global token pool display');
        
        // ENSURE gameDiv stays visible during token updates
        const gameDiv = document.getElementById('gameDiv');
        if (gameDiv && gameDiv.style.display === 'none') {
            gameDiv.style.display = 'inline-block';
        }
        
        // Update global token pool (everyone sees this)
        const globalTokenPoolElement = document.getElementById('globalTokenPool');
        console.log('🎯 ROUND RESULT - Token pool update data:', {
            whiteTokensRemaining: data.whiteTokensRemaining,
            dataKeys: Object.keys(data),
            elementExists: !!globalTokenPoolElement,
            currentTextContent: globalTokenPoolElement ? globalTokenPoolElement.textContent : 'N/A'
        });
        
        if (globalTokenPoolElement) {
            const oldValue = globalTokenPoolElement.textContent;
            globalTokenPoolElement.textContent = data.whiteTokensRemaining;
            console.log('🎯 Token pool updated:', oldValue, '→', data.whiteTokensRemaining);
            console.log('🎯 Element after update:', globalTokenPoolElement.textContent);
        } else {
            console.error('❌ globalTokenPool element not found!');
        }
        
        // Update token pool progress bar
        const tokenPoolBar = document.getElementById('tokenPoolBar');
        console.log('🎯 Token pool bar element found:', !!tokenPoolBar);
        
        if (tokenPoolBar) {
            const percentage = Math.max(0, (data.whiteTokensRemaining / 2500) * 100);
            const oldWidth = tokenPoolBar.style.width;
            tokenPoolBar.style.width = `${percentage}%`;
            console.log(`🎯 Token pool bar updated: ${oldWidth} → ${percentage}% (${data.whiteTokensRemaining}/2500)`);
            
            // Change color based on remaining tokens
            let gradient;
            if (percentage > 50) {
                gradient = 'linear-gradient(90deg, #faa61a 0%, #ffcc4d 50%, #f1c40f 100%)'; // Yellow/Orange - Good
            } else if (percentage > 25) {
                gradient = 'linear-gradient(90deg, #e67e22 0%, #f39c12 50%, #faa61a 100%)'; // Orange - Warning
            } else {
                gradient = 'linear-gradient(90deg, #e74c3c 0%, #c0392b 50%, #922b21 100%)'; // Red - Critical
            }
            tokenPoolBar.style.background = gradient;
            
            console.log(`🎯 Token pool bar styling applied: ${gradient}`);
        } else {
            console.error('❌ tokenPoolBar element not found!');
        }
        
        // Update condition display (with null check and moderator restriction)
        const conditionInfoElement = document.getElementById('conditionInfo');
        if (conditionInfoElement && isModerator) {
            conditionInfoElement.textContent = `Condition: ${data.condition.name}`;
        } else if (!conditionInfoElement) {
            console.log('❌ conditionInfo element not found - this is normal if not using condition display');
        }
        
        // Add visual flash animation to highlight the global token pool update
        const globalElement = document.getElementById('globalTokenPool');
        if (globalElement) {
            globalElement.style.animation = 'tokenUpdate 0.6s ease-in-out';
            setTimeout(() => globalElement.style.animation = '', 600);
        }
        
        // Debug: Check gameDiv visibility after timeout
        const gameDivAfterTimeout = document.getElementById('gameDiv');
        if (gameDivAfterTimeout) {
            // Ensure gameDiv is still visible after token updates
            if (gameDivAfterTimeout.style.display === 'none') {
                gameDivAfterTimeout.style.display = 'inline-block';
            }
        }
    }, 300); // Short delay for global token pool display
    
    // Update round results title
    const roundResultsTitle = document.getElementById('roundResultsTitle');
    if (roundResultsTitle && data.round) {
        roundResultsTitle.textContent = `Round ${data.round} Results`;
    }
    
    // Display round results
    let resultsHTML = '<h4>Choices Made:</h4>';
    console.log('🎯 Processing choices for display:', data.choices);
    data.choices.forEach(choice => {
        console.log(`🔍 Choice: ${choice.username}, isModerator: ${choice.isModerator}, isAI: ${choice.isAI}`);
        // Skip moderator choices in the display
        if (choice.isModerator) {
            console.log(`🚫 Skipping moderator choice: ${choice.username}`);
            return;
        }
        
        const aiIndicator = choice.isAI ? ' 🤖' : '';
        resultsHTML += `<div>${choice.username}${aiIndicator}: Row ${choice.choice} (${choice.rowType})</div>`;
    });
    
    // For moderators, show everyone's token awards
    if (isModerator && data.allPlayerTokens) {
        resultsHTML += '<h4 style="margin-top: 15px;">Token Awards:</h4>';
        data.allPlayerTokens.forEach(playerTokens => {
            if (!playerTokens.isModerator) { // Don't show moderator's tokens (which should be 0)
                let tokenDisplay = '';
                if (playerTokens.tokensAwarded.white > 0) {
                    tokenDisplay += `${'⚪'.repeat(playerTokens.tokensAwarded.white)}`;
                }
                if (playerTokens.tokensAwarded.black > 0) {
                    if (tokenDisplay) tokenDisplay += ' ';
                    tokenDisplay += `${'⚫'.repeat(playerTokens.tokensAwarded.black)}`;
                }
                // Include incentive bonus in total black tokens without explicit notification
                if (playerTokens.tokensAwarded.incentiveBonus > 0) {
                    tokenDisplay += `${'⚫'.repeat(playerTokens.tokensAwarded.incentiveBonus)}`;
                }
                const aiIndicator = playerTokens.isAI ? ' 🤖' : '';
                resultsHTML += `<div>${playerTokens.username}${aiIndicator}: ${tokenDisplay || 'No tokens'}</div>`;
                console.log(`✅ Added token award to display: ${playerTokens.username}`);
            } else {
                console.log(`🚫 Skipping moderator token award: ${playerTokens.username}`);
            }
        });
    }
    
    document.getElementById('roundResults').innerHTML = resultsHTML;
    
    // Display token awards with earnings inline (hide for moderators)
    const tokenUpdateElement = document.getElementById('tokenUpdate');
    if (tokenUpdateElement) {
        if (isModerator) {
            // Moderators don't receive tokens
            tokenUpdateElement.textContent = 'Moderator - No tokens awarded';
        } else {
            // Calculate earnings from this round's tokens
            const whiteEarnings = (data.tokensAwarded.white || 0) * (data.condition.whiteValue || 0);
            const blackEarnings = ((data.tokensAwarded.black || 0) + (data.tokensAwarded.incentiveBonus || 0)) * (data.condition.blackValue || 0);
            const roundTotalEarnings = whiteEarnings + blackEarnings;
            
            let tokenHTML = `You received: `;
            if (data.tokensAwarded.white > 0) {
                tokenHTML += `${'⚪'.repeat(data.tokensAwarded.white)}`;
            }
            if (data.tokensAwarded.black > 0) {
                if (data.tokensAwarded.white > 0) tokenHTML += ' ';
                tokenHTML += `${'⚫'.repeat(data.tokensAwarded.black)}`;
            }
            // Include incentive bonus in total black tokens without explicit notification
            if (data.tokensAwarded.incentiveBonus > 0) {
                tokenHTML += `${'⚫'.repeat(data.tokensAwarded.incentiveBonus)}`;
            }
            
            // Add earnings inline in green text
            if (roundTotalEarnings > 0) {
                tokenHTML += ` ($${roundTotalEarnings.toFixed(2)})`;
            } else {
                tokenHTML += ` ($0.00)`;
            }
            
            tokenUpdateElement.innerHTML = tokenHTML;
        }
    }

    // Clear the separate round earnings element since we're now showing inline
    const roundEarningsElement = document.getElementById('roundEarnings');
    if (roundEarningsElement) {
        roundEarningsElement.textContent = '';
    }
    
    // Display active incentive status (only for moderators)
    const incentiveElement = document.getElementById('activeIncentive');
    if (incentiveElement) {
        if (isModerator && data.activeIncentive) {
            incentiveElement.textContent = `Active Incentive: ${data.activeIncentive.charAt(0).toUpperCase() + data.activeIncentive.slice(1)}`;
            incentiveElement.style.color = '#faa61a';
        } else if (isModerator && !data.activeIncentive) {
            incentiveElement.textContent = 'No Active Incentive';
            incentiveElement.style.color = '#72767d';
        } else {
            // Hide incentive info for non-moderators
            incentiveElement.textContent = '';
        }
    }
    
    // Update culturant count from server data
    if (data.culturantsProduced !== undefined) {
        const culturantCountElement = document.getElementById('culturantCount');
        if (culturantCountElement) {
            culturantCountElement.textContent = data.culturantsProduced;
            console.log('🎯 Updated culturant count to:', data.culturantsProduced);
        }
    }
    
    // Display culturant status
    if (data.culturantProduced) {
        const culturantStatusElement = document.getElementById('culturantStatus');
        
        // Only show culturant production message to moderators
        if (culturantStatusElement && isModerator) {
            culturantStatusElement.textContent = '🎯 Culturant Produced! All players chose even rows.';
            culturantStatusElement.style.color = '#43b581';
        } else if (culturantStatusElement) {
            culturantStatusElement.textContent = '';
        }
    } else {
        const culturantStatusElement = document.getElementById('culturantStatus');
        if (culturantStatusElement) {
            culturantStatusElement.textContent = '';
        }
    }
    
    // Note: Wallet displays are now updated with delay in playerStatusUpdate event to sync with return animation
});

// Experiment ended
socket.on('experimentEnd', function(data) {
    console.log('🏁 Experiment ended:', data);
    
    // Show final results phase
    document.getElementById('decisionPhase').style.display = 'none';
    document.getElementById('resultsPhase').style.display = 'none';
    document.getElementById('finalResults').style.display = 'block';
    
    // Display final statistics
    let statsHTML = `<h3>Final Statistics</h3>`;
    statsHTML += `<div>Total Rounds: ${data.totalRounds}</div>`;
    statsHTML += `<div>Culturants Produced: ${data.culturantsProduced}</div>`;
    statsHTML += `<div>Session Duration: ${Math.floor(data.sessionDuration / 60000)} minutes</div>`;
    statsHTML += `<h4>Final Scores:</h4>`;
    
    data.finalResults.forEach(result => {
        statsHTML += `<div>${result.username}: ${result.whiteTokens}W, ${result.blackTokens}B = $${result.totalEarnings.toFixed(2)}</div>`;
    });
    
    document.getElementById('finalStats').innerHTML = statsHTML;
    
    // Store export data for later use
    window.experimentData = data.exportData;
});

// Room full error
socket.on('roomFull', function(data) {
    alert(data.message);
    console.log('❌ Room full:', data.message);
});

// Generic error handler
socket.on('error', function(data) {
    alert(`Error: ${data.message}`);
    console.log('❌ Server error:', data);
});

// Column mode changed
socket.on('columnModeChanged', function(data) {
    console.log(`🎛️ Column mode changed to: ${data.mode} by ${data.moderator}`);
    
    // Update UI based on mode change
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    if (moderatorColumnControl && moderatorColumnControl.style.display === 'block') {
        const autoColumnToggle = document.getElementById('autoColumnToggle');
        if (autoColumnToggle) {
            autoColumnToggle.checked = (data.mode === 'auto');
            // Don't trigger change event - this would cause infinite loop!
            // Instead, manually update UI elements
            const manualColumnSelection = document.getElementById('manualColumnSelection');
            const autoColumnDisplay = document.getElementById('autoColumnDisplay');
            
            if (autoColumnToggle.checked) {
                // Auto mode UI
                if (manualColumnSelection) manualColumnSelection.style.display = 'none';
                if (autoColumnDisplay) autoColumnDisplay.style.display = 'block';
            } else {
                // Manual mode UI
                if (manualColumnSelection) manualColumnSelection.style.display = 'block';
                if (autoColumnDisplay) autoColumnDisplay.style.display = 'none';
            }
        }
        
        // Show pending change notification
        const pendingInfo = document.getElementById('pendingModeInfo');
        if (data.immediate === false && data.pendingMode && data.pendingRound) {
            if (pendingInfo) {
                pendingInfo.textContent = `Mode will change to ${data.pendingMode} starting Round ${data.pendingRound}`;
                pendingInfo.style.display = 'block';
                pendingInfo.style.color = '#ffa500';
            }
        } else if (data.applied) {
            if (pendingInfo) {
                pendingInfo.textContent = `Mode changed to ${data.mode}`;
                pendingInfo.style.color = '#4CAF50';
                setTimeout(() => {
                    pendingInfo.style.display = 'none';
                }, 3000);
            }
        } else if (data.immediate) {
            if (pendingInfo) {
                pendingInfo.style.display = 'none';
            }
        }
    }
});

// Function to show baseline exit notification to moderators
function showBaselineExitNotification(turnNumber) {
    // Check if user is moderator
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    const isModerator = moderatorColumnControl && moderatorColumnControl.style.display === 'block';
    
    if (!isModerator) return;
    
    const notification = document.getElementById('baselineExitNotification');
    const notificationText = document.getElementById('baselineExitText');
    
    if (notification && notificationText) {
        // Use current round if turnNumber is 0 or invalid
        const displayTurn = turnNumber > 0 ? turnNumber : currentRoundNumber;
        notificationText.textContent = `Baseline condition exited on turn ${displayTurn}`;
        notification.style.display = 'block';
        console.log('🎯 Baseline exit notification displayed for turn:', displayTurn);
        
        // Add a subtle animation to draw attention
        notification.style.transform = 'scale(0.95)';
        setTimeout(() => {
            notification.style.transform = 'scale(1)';
        }, 100);
    }
}

// Experimental condition changed
socket.on('conditionChanged', function(data) {
    console.log('🔄 conditionChanged event received:', data);
    console.log(`💰 Experimental condition changed: ${data.condition.name}`);
    console.log('🔍 Previous condition:', previousCondition);
    console.log('🔍 Current round number:', currentRoundNumber);
    
    // Check for baseline exit (case insensitive)
    const currentConditionName = data.condition.name.toLowerCase();
    const wasBaseline = previousCondition && previousCondition.toLowerCase().includes('baseline');
    const isBaseline = currentConditionName.includes('baseline');
    
    console.log('🔍 Baseline exit check:', {
        wasBaseline: wasBaseline,
        isBaseline: isBaseline,
        currentConditionName: currentConditionName,
        willTrigger: wasBaseline && !isBaseline
    });
    
    if (wasBaseline && !isBaseline) {
        console.log('🎯 Detected baseline exit from:', previousCondition, 'to:', data.condition.name);
        showBaselineExitNotification(currentRoundNumber);
    }
    
    // Update previous condition tracking
    previousCondition = data.condition.name;
    
    // Update token conversion display for all players
    updateTokenConversionDisplay(data.condition.whiteValue, data.condition.blackValue);
    
    // Update condition status display in moderator testing panel only
    const statusDiv = document.getElementById('conditionStatus');
    if (statusDiv) {
        statusDiv.textContent = `Current: ${data.condition.name}`;
        statusDiv.style.color = '#b9bbbe';
    }
    
    // Update condition dropdown if visible (moderator only)
    const conditionSelect = document.getElementById('experimentalCondition');
    if (conditionSelect) {
        // Find matching option by condition name
        for (let option of conditionSelect.options) {
            if (option.text.startsWith(data.condition.name)) {
                conditionSelect.value = option.value;
                break;
            }
        }
    }
    
    // No notification to players - they don't need to see condition changes
});

// Column selected notification
socket.on('columnSelected', function(data) {
    console.log(`📌 Column selected: ${data.column} by ${data.moderator}`);
    
    // Attempt highlighting the selected column for all players
    attemptColumnHighlight(data.column);
    
    // Update moderator UI if visible
    const selectedColumnDisplay = document.getElementById('selectedColumnDisplay');
    if (selectedColumnDisplay) {
        selectedColumnDisplay.textContent = `Selected: Column ${data.column}`;
    }
    
    // Update manual button selection for moderator
    const moderatorColumnControl = document.getElementById('moderatorColumnControl');
    if (moderatorColumnControl && moderatorColumnControl.style.display === 'block') {
        // Clear previous selections
        document.querySelectorAll('.column-select-btn').forEach(btn => {
            btn.style.backgroundColor = '#7289da';
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        });
        
        // Highlight selected button
        const correspondingBtn = document.querySelector(`.column-select-btn[data-column="${data.column}"]`);
        if (correspondingBtn) {
            correspondingBtn.style.backgroundColor = '#43b581';
            correspondingBtn.style.transform = 'scale(1.1)';
            correspondingBtn.style.boxShadow = '0 0 10px rgba(67, 181, 129, 0.5)';
        }
    }
});

// Auto column selected (for showing which column was randomly picked)
socket.on('autoColumnSelected', function(data) {
    console.log(`🎲 Auto-selected column: ${data.column} for round ${data.round}`);
    
    // Attempt highlighting with retry mechanism
    attemptColumnHighlight(data.column);
    
    // Show which column was automatically selected
    const autoColumnDisplay = document.getElementById('autoColumnDisplay');
    if (autoColumnDisplay && autoColumnDisplay.style.display !== 'none') {
        autoColumnDisplay.innerHTML = `System automatically selected: <strong>Column ${data.column}</strong> (Round ${data.round})`;
    }
});

// ========================================
// BEHAVIORAL EXPERIMENT UI FUNCTIONS
// ========================================

// Update decision grid with random symbols
function updateDecisionGrid(gridData) {
    gridData.forEach(cell => {
        const buttons = document.querySelectorAll(`[data-choice="${cell.row === 'odd' ? 'impulsive' : 'self-control'}"][data-col="${cell.col}"]`);
        buttons.forEach(button => {
            button.querySelector('.grid-symbol').textContent = cell.symbol;
        });
    });
}

// Set up event listeners for behavioral experiment
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chat system elements
    chatForm = document.getElementById('chat-form');
    globalChatMessages = document.getElementById('globalChatDiv');
    globalNameText = document.getElementById('global-name');
    roomChatMessages = document.getElementById('roomChatDiv');
    roomNameText = document.getElementById('room-name');
    userList = document.getElementById('users');
    userCount = document.getElementById('userCount');
    gameDiv = document.getElementById('gameDiv');
    
    // Initialize UI elements  
    modal = document.getElementById('id01');
    loginButton = document.getElementById('loginNav');
    createRoomButton = document.getElementById('create-btn');
    joinRoomButton = document.getElementById('join-btn');

    // Initialize login elements
    signDiv = document.getElementById('signDiv');
    signDivUsername = document.getElementById('username');
    signDivPassword = document.getElementById('password');
    signDivSignIn = document.getElementById('signIn');
    signDivSignUp = document.getElementById('signUp');
    chatDiv = document.getElementById('chat-container');
    landingPage = document.getElementById('landingPage');
    backgroundIMG = document.getElementById('backgroundIMG');

    // Debug chat elements
    console.log('💬 Chat system initialization:');
    console.log('chatForm:', !!chatForm);
    console.log('globalChatMessages:', !!globalChatMessages);
    console.log('roomChatMessages:', !!roomChatMessages);
    console.log('roomNameText:', !!roomNameText);
    console.log('currentRoom at init:', currentRoom);

    // Initialize room name display if we have current room info
    if (roomNameText && currentRoom && currentRoom !== "Global") {
        roomNameText.innerText = currentRoom;
        roomNameText.style.display = "";
    }

    // Set initial user count if available
    if (userCount) {
        userCount.innerText = "0 online";
    }

    // TEMPORARY: Test game interface visibility
    // Set up modal and login handlers
    if (modal) {
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }
    }

    if (loginButton) {
        loginButton.onclick = function(event) {
            if (modal) modal.style.display='block';
            if (signDivUsername) signDivUsername.focus();
        }
    }

    if (signDivSignIn) {
        signDivSignIn.addEventListener('click', function (e) {
            e.preventDefault();
            if (signDivUsername && signDivPassword) {
                socket.emit('signIn', { username: signDivUsername.value, password: signDivPassword.value });
                if (modal) modal.style.display = "none";
                if (typeof closeMenu === 'function') closeMenu();
            }
        });
    }

    if (signDivSignUp) {
        signDivSignUp.addEventListener('click', function (e) {
            e.preventDefault();
            if (signDivUsername && signDivPassword) {
                socket.emit('signUp', { username: signDivUsername.value, password: signDivPassword.value });
                if (modal) modal.style.display = "none";
                if (typeof closeMenu === 'function') closeMenu();
            }
        });
    }

    if (signDivPassword) {
        signDivPassword.addEventListener("keypress", function (event) {
            if (event.key === "Enter" && signDivSignIn) {
                signDivSignIn.click();
            }
        });
    }

    // Set up chat form event listener if form exists
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();

            //Determine what chat to send message to based on what room is visible
            let roomName = "Global"
            if (globalNameText && globalChatMessages && globalChatMessages.style.display.match("none")) {
                roomName = roomNameText ? roomNameText.innerText : currentRoom;
            }

            // Get message text
            let msg = e.target.elements.msg.value;
            msg = msg.trim();

            if (!msg)
                return false;
            
            // Clear input
            e.target.elements.msg.value = '';
            e.target.elements.msg.focus();

            // Handle different message types
            if(msg[0]==='@'){
                socket.emit('privateMessage',{
                    recipient:msg.slice(1,msg.indexOf(':')),
                    message:msg.slice(msg.indexOf(':') + 1),
                    room:roomName
                });
            }
            else if(msg[0]==='.'){
                socket.emit('commandMessage',{
                    message:msg.replaceAll(".",""),
                    room:roomName
                });
            }
            else {
                socket.emit('chatMessage', {
                    msg:msg,
                    room:roomName
                });
            }
        });
    }

    // Set up chat switching handlers if elements exist
    if (globalNameText) {
        globalNameText.onclick = function(){
            if (roomChatMessages) roomChatMessages.style.display = "none";
            if (roomNameText) roomNameText.style.backgroundColor = "#667aff";
            if (globalChatMessages) globalChatMessages.style.display = "";
            globalNameText.style.backgroundColor = "green";
            
            // Hide game when switching to Global chat
            if (gameDiv) gameDiv.style.display = 'none';
        }
    }

    if (roomNameText) {
        roomNameText.onclick = function(){
            if (globalChatMessages) globalChatMessages.style.display = "none";
            if (globalNameText) globalNameText.style.backgroundColor = "#667aff";
            if (roomChatMessages) roomChatMessages.style.display = "";
            roomNameText.style.backgroundColor = "green";
            
            // Show game if there's an active game
            if(gameActive && currentRoom !== "Global" && gameDiv) {
                gameDiv.style.display = 'inline-block';
            }
        }
    }

    // Set up leave button handler
    const leaveBtn = document.getElementById('leave-btn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            const globalChat = document.getElementById('globalChatDiv');
            console.log('Leave button clicked, current room:', currentRoom);

            if(currentRoom && currentRoom !== "Global"){
                socket.emit('leaveRoom', currentRoom);
                
                // Hide game interface and return to chat
                const gameDiv = document.getElementById('gameDiv');
                if (gameDiv) gameDiv.style.display = 'none';
                gameActive = false;
                currentRoom = "Global";
            }
            else {
                console.log("🌍 Leaving global chat");
                const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
                if (leaveRoom) {
                    socket.emit('leaveRoom', "Global");
                    window.location.href = '/';
                }
            }
        });
    }

    // Set up room button handlers
    if (createRoomButton) {
        createRoomButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            socket.emit("createRoom");
            if (roomNameText) roomNameText.click();
            createRoomButton.style.display = "none";
            // Old start button removed - no longer need to show it
        });
    }

    if (joinRoomButton) {
        joinRoomButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            let roomName = prompt("Enter room name", '');
            socket.emit('joinRoom', roomName);
            if (roomName) {
                currentRoom = roomName; // Update current room tracking
            }
        });
    }

    // Set up navigation menu handlers
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    const navLink = document.querySelectorAll(".nav-link");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", mobileMenu);
        
        function mobileMenu() {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        }
    }

    if (navLink.length > 0) {
        navLink.forEach(n => n.addEventListener("click", closeMenu));
        
        function closeMenu() {
            if (hamburger) hamburger.classList.remove("active");
            if (navMenu) navMenu.classList.remove("active");
        }
    }

    // Start Experiment button (inside game interface)
    const startExperimentBtn = document.getElementById('startExperimentBtn');
    if (startExperimentBtn) {
        startExperimentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🚀 Starting behavioral experiment');
            
            // This button is now for starting the actual experiment
            // Could emit a startExperiment event or trigger existing startGame logic
            socket.emit('startGame', {room: currentRoom});
            
            // Hide this button since experiment is starting
            this.style.display = 'none';
            
            // Hide Add AI button if it exists
            const addAIBtn = document.getElementById('addAIBtn');
            if (addAIBtn) {
                addAIBtn.style.display = 'none';
            }
        });
    }
    
    // Add AI Players button (dynamically added, so use event delegation)
    document.addEventListener('click', function(e) {
        if (e.target.id === 'addAIBtn') {
            e.preventDefault();
            console.log('🤖 Adding AI players for testing');
            
            // This triggers the server to add AI players during experiment start
            // For now, just start the experiment which will auto-add AI players
            socket.emit('startExperiment', { room: currentRoom });
            
            e.target.style.display = 'none';
            document.getElementById('startExperimentBtn').style.display = 'none';
        }
    });
    
    // Row choice - Selection phase for 8x8 grid system
    document.addEventListener('click', function(e) {
        if (e.target.closest('.clickable-row') && e.target.closest('.clickable-row').style.pointerEvents !== 'none') {
            e.preventDefault();
            const row = e.target.closest('.clickable-row');
            const rowNumber = row.getAttribute('data-row');
            
            // Store selection but don't submit yet
            selectedChoice = rowNumber;
            
            // Clear previous selections
            document.querySelectorAll('.clickable-row').forEach(r => {
                r.style.opacity = '0.7';
                r.style.transform = 'scale(1)';
                r.style.boxShadow = 'none';
                r.style.backgroundColor = 'transparent';
            });
            
            // Highlight selected row
            row.style.opacity = '1';
            row.style.transform = 'scale(1.02)';
            row.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
            row.style.backgroundColor = '#40444b';
            
            // Show selection status and enable lock-in button
            const selectedChoiceDiv = document.getElementById('selectedChoice');
            const lockInBtn = document.getElementById('lockInBtn');
            
            if (selectedChoiceDiv) {
                selectedChoiceDiv.textContent = `Selected: Row ${rowNumber}`;
                selectedChoiceDiv.style.color = '#faa61a';
            }
            
            if (lockInBtn && !isLockedIn) {
                const lockInText = document.getElementById('lockInText');
                lockInBtn.disabled = false;
                if (lockInText) {
                    lockInText.textContent = '🔒 Lock In Choice';
                }
                lockInBtn.style.background = 'linear-gradient(135deg, #5865f2, #4752c4)';
                lockInBtn.style.cursor = 'pointer';
            }
        }
    });
    
    // Lock In button handler
    document.addEventListener('click', function(e) {
        if (e.target.id === 'lockInBtn' || e.target.closest('#lockInBtn')) {
            const lockInBtn = document.getElementById('lockInBtn');
            if (lockInBtn && !lockInBtn.disabled && selectedChoice && !isLockedIn) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('🔒 Lock-in button clicked - processing...');
                
                // Mark as locked in
                isLockedIn = true;
                
                // Disable all rows after lock-in
                document.querySelectorAll('.clickable-row').forEach(row => {
                    row.style.opacity = '0.5';
                    row.style.cursor = 'not-allowed';
                    row.style.pointerEvents = 'none';
                });
                
                // Update lock-in button immediately
                const lockInText = document.getElementById('lockInText');
                if (lockInBtn && lockInText) {
                    lockInText.textContent = '✓ Choice Locked In';
                    lockInBtn.style.background = 'linear-gradient(135deg, #43b581, #3a9068)';
                    lockInBtn.disabled = true;
                    lockInBtn.style.cursor = 'not-allowed';
                }
                
                // Emit choice to server
                socket.emit('makeChoice', { 
                    choice: selectedChoice,
                    room: currentRoom,
                    lockedIn: true
                });
                
                console.log('✅ Lock-in processed successfully');
                
                // Reset for next round
                selectedChoice = null;
            } else {
                console.log('🚫 Lock-in button click ignored:', {
                    disabled: lockInBtn?.disabled,
                    selectedChoice: selectedChoice,
                    isLockedIn: isLockedIn
                });
            }
        }
    });
    
    // Moderator column selection toggle
    const autoColumnToggle = document.getElementById('autoColumnToggle');
    const manualColumnSelection = document.getElementById('manualColumnSelection');
    const autoColumnDisplay = document.getElementById('autoColumnDisplay');
    
    if (autoColumnToggle && manualColumnSelection && autoColumnDisplay) {
        autoColumnToggle.addEventListener('change', function() {
            if (this.checked) {
                // Auto mode
                manualColumnSelection.style.display = 'none';
                autoColumnDisplay.style.display = 'block';
                
                // Clear any manual selection
                document.querySelectorAll('.column-select-btn').forEach(btn => {
                    btn.style.backgroundColor = '#7289da';
                    btn.style.transform = 'scale(1)';
                    btn.style.boxShadow = 'none';
                });
                
                socket.emit('setColumnMode', { 
                    room: currentRoom, 
                    autoMode: true 
                });
            } else {
                // Manual mode
                manualColumnSelection.style.display = 'block';
                autoColumnDisplay.style.display = 'none';
                
                socket.emit('setColumnMode', { 
                    room: currentRoom, 
                    autoMode: false 
                });
            }
        });
    }
    
    // Manual column selection buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('column-select-btn')) {
            e.preventDefault();
            const column = e.target.getAttribute('data-column');
            
            // Clear previous selections
            document.querySelectorAll('.column-select-btn').forEach(btn => {
                btn.style.backgroundColor = '#7289da';
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = 'none';
            });
            
            // Highlight selected column
            e.target.style.backgroundColor = '#43b581';
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 0 10px rgba(67, 181, 129, 0.5)';
            
            // Update display
            const selectedColumnDisplay = document.getElementById('selectedColumnDisplay');
            if (selectedColumnDisplay) {
                selectedColumnDisplay.textContent = `Selected: Column ${column}`;
            }
            
            // Highlight in the main grid
            highlightSelectedColumn(column);
            
            // Send to server
            socket.emit('selectColumn', { 
                room: currentRoom, 
                column: column 
            });
        }
        
        // Column header clicks (for moderators in manual mode)
        if (e.target.classList.contains('column-header')) {
            // Only allow moderators to click column headers
            const moderatorColumnControl = document.getElementById('moderatorColumnControl');
            const autoColumnToggle = document.getElementById('autoColumnToggle');
            
            if (moderatorColumnControl && moderatorColumnControl.style.display === 'block' && 
                autoColumnToggle && !autoColumnToggle.checked) {
                e.preventDefault();
                const column = e.target.getAttribute('data-column');
                
                // Clear manual column button selections
                document.querySelectorAll('.column-select-btn').forEach(btn => {
                    btn.style.backgroundColor = '#7289da';
                    btn.style.transform = 'scale(1)';
                    btn.style.boxShadow = 'none';
                });
                
                // Highlight the corresponding manual button
                const correspondingBtn = document.querySelector(`.column-select-btn[data-column="${column}"]`);
                if (correspondingBtn) {
                    correspondingBtn.style.backgroundColor = '#43b581';
                    correspondingBtn.style.transform = 'scale(1.1)';
                    correspondingBtn.style.boxShadow = '0 0 10px rgba(67, 181, 129, 0.5)';
                }
                
                // Update display
                const selectedColumnDisplay = document.getElementById('selectedColumnDisplay');
                if (selectedColumnDisplay) {
                    selectedColumnDisplay.textContent = `Selected: Column ${column}`;
                }
                
                // Highlight in the main grid
                highlightSelectedColumn(column);
                
                // Send to server
                socket.emit('selectColumn', { 
                    room: currentRoom, 
                    column: column 
                });
            }
        }
    });
    
    // Export data button
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.experimentData) {
                downloadCSV(window.experimentData, `experiment_data_${currentRoom}_${new Date().toISOString().slice(0,10)}.csv`);
            }
        });
    }
});

// CSV export function
function downloadCSV(data, filename) {
    if (!data || data.length === 0) return;
    
    // Convert JSON to CSV
    const headers = ['timestamp', 'round', 'condition', 'username', 'choice', 'whiteTokens', 'blackTokens', 'earnings', 'culturantProduced', 'whiteTokensRemaining'];
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(row => {
        row.players.forEach(player => {
            const csvRow = [
                row.timestamp,
                row.round,
                row.condition,
                player.username,
                player.choice,
                player.whiteTokens,
                player.blackTokens,
                player.earnings,
                row.culturantProduced,
                row.whiteTokensRemaining
            ];
            csvContent += csvRow.join(',') + '\n';
        });
    });
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

//Draw Map
var drawMap = function(){
    var player = Player.list[selfId];
    if (!player) return; // Safety check
    ctx.drawImage(Img.map[player.map],0,0);
}

//Draw GAME

var drawScore = function(){
    if (!Player.list[selfId]) return; // Safety check
    if(lastScore === Player.list[selfId].score)
        return;
    
    lastScore = Player.list[selfId].score;
    ctxUi.clearRect(0, 0, 500, 500);
    ctxUi.fillStyle = 'white';
    ctxUi.font = "20px Arial";
    ctxUi.fillText("Score: "+Player.list[selfId].score,0,30);
}

var lastScore = -1;

var drawFrameCount = 0;
var lastDrawLog = 0;

// DISABLED: Drawing loop for behavioral experiment
console.log('🚫 Drawing loop disabled for behavioral experiment mode');
/*
setInterval(function () {
    // Only draw if we have an active game (either as player or viewer)
    if(!gameActive || Object.keys(Player.list).length === 0) {
        return;
    }

    drawFrameCount++;
    
    ctx.clearRect(0, 0, 800, 1600);
    
    // Draw map - use any player's map if we don't have selfId
    if (selfId && Player.list[selfId]) {
        drawMap();
        drawScore();
    } else if (Object.keys(Player.list).length > 0) {
        // For viewers, draw map from any available player
        var anyPlayer = Object.values(Player.list)[0];
        if (anyPlayer) {
            ctx.drawImage(Img.map[anyPlayer.map],0,0);
        }
    }
    
    // Draw all players (works for both players and viewers)
    for (var i in Player.list) {
        Player.list[i].draw();
    }
}, 20);
*/

// DISABLED: Keyboard controls for behavioral experiment
console.log('🚫 Keyboard controls disabled for behavioral experiment mode');
/*
document.onkeydown = function (event) {
    if (event.keyCode === 68) //d
        socket.emit('keyPress', { inputId: 'right', state: true });
    else if (event.keyCode === 83) //s
        socket.emit('keyPress', { inputId: 'down', state: true });
    else if (event.keyCode === 65) //a
        socket.emit('keyPress', { inputId: 'left', state: true });
    else if (event.keyCode === 87) // w
        socket.emit('keyPress', { inputId: 'up', state: true });
}

document.onkeyup = function (event) {
    if (event.keyCode === 68) //d
        socket.emit('keyPress', { inputId: 'right', state: false });
    else if (event.keyCode === 83) //s
        socket.emit('keyPress', { inputId: 'down', state: false });
    else if (event.keyCode === 65) //a
        socket.emit('keyPress', { inputId: 'left', state: false });
    else if (event.keyCode === 87) // w
        socket.emit('keyPress', { inputId: 'up', state: false });

//Block right-click
document.oncontextmenu = function(event){
    event.preventDefault();
}
*/

// ===============================================
// TESTING PANEL FUNCTIONS (MODERATOR ONLY)
// ===============================================

function toggleTestingPanel() {
    const controls = document.getElementById('testingControls');
    const toggle = document.getElementById('testingPanelToggle');
    
    if (controls.style.display === 'none') {
        controls.style.display = 'block';
        toggle.textContent = '[Click to Collapse]';
    } else {
        controls.style.display = 'none';
        toggle.textContent = '[Click to Expand]';
    }
}

function sendSystemMessage() {
    const messageText = document.getElementById('systemMessageText').value.trim();
    if (!messageText) {
        alert('Please enter a message to send.');
        return;
    }
    
    console.log(`📢 Sending system message: "${messageText}"`);
    socket.emit('systemMessage', {
        message: messageText,
        room: currentRoom
    });
    
    // Clear the input
    document.getElementById('systemMessageText').value = '';
    
    // Show confirmation
    const statusDiv = document.getElementById('experimentStatus');
    statusDiv.textContent = `Message sent: "${messageText}"`;
    statusDiv.style.color = '#43b581';
    setTimeout(() => {
        statusDiv.textContent = '';
    }, 3000);
}

function refreshPlayerStatus() {
    console.log('🔄 Requesting player status update...');
    socket.emit('requestPlayerStatus', { room: currentRoom });
}

function pauseExperiment() {
    console.log('⏸️ Pausing experiment AI...');
    socket.emit('pauseExperiment', { room: currentRoom });
    
    document.getElementById('pauseExperimentBtn').style.display = 'none';
    document.getElementById('resumeExperimentBtn').style.display = 'block';
    
    const statusDiv = document.getElementById('experimentStatus');
    statusDiv.textContent = '⏸️ AI Paused';
    statusDiv.style.color = '#e74c3c';
}

function resumeExperiment() {
    console.log('▶️ Resuming experiment AI...');
    socket.emit('resumeExperiment', { room: currentRoom });
    
    document.getElementById('pauseExperimentBtn').style.display = 'block';
    document.getElementById('resumeExperimentBtn').style.display = 'none';
    
    const statusDiv = document.getElementById('experimentStatus');
    statusDiv.textContent = '▶️ AI Active';
    statusDiv.style.color = '#43b581';
}

function resetExperiment() {
    if (!confirm('Are you sure you want to reset the current round? All player choices will be cleared.')) {
        return;
    }
    
    console.log('🔄 Resetting experiment round...');
    socket.emit('resetRound', { room: currentRoom });
    
    const statusDiv = document.getElementById('experimentStatus');
    statusDiv.textContent = '🔄 Round Reset';
    statusDiv.style.color = '#faa61a';
    setTimeout(() => {
        statusDiv.textContent = '';
    }, 3000);
}

function setCondition() {
    const conditionSelect = document.getElementById('experimentalCondition');
    const selectedCondition = conditionSelect.value;
    
    console.log(`💰 Setting experimental condition to: ${selectedCondition}`);
    socket.emit('setCondition', { 
        room: currentRoom, 
        conditionKey: selectedCondition 
    });
    
    const statusDiv = document.getElementById('conditionStatus');
    const conditionName = conditionSelect.options[conditionSelect.selectedIndex].text.split(' (')[0];
    statusDiv.textContent = `Applied: ${conditionName}`;
    statusDiv.style.color = '#43b581';
    setTimeout(() => {
        statusDiv.textContent = `Current: ${conditionName}`;
        statusDiv.style.color = '#b9bbbe';
    }, 3000);
}

function setPlayerIncentive() {
    const playerSelect = document.getElementById('incentivePlayer');
    const typeSelect = document.getElementById('incentiveType');
    const selectedPlayer = playerSelect.value;
    const selectedType = typeSelect.value;
    
    if (!selectedPlayer) {
        const statusDiv = document.getElementById('incentiveStatus');
        statusDiv.textContent = 'Please select a player first';
        statusDiv.style.color = '#e74c3c';
        setTimeout(() => statusDiv.textContent = '', 3000);
        return;
    }
    
    console.log(`⭐ Setting incentive for ${selectedPlayer}: ${selectedType || 'none'}`);
    socket.emit('setPlayerIncentive', { 
        room: currentRoom, 
        playerName: selectedPlayer,
        incentiveType: selectedType || null
    });
}

// Handle incentive set result
socket.on('incentiveSetResult', function(data) {
    const statusDiv = document.getElementById('incentiveStatus');
    if (data.success) {
        const incentiveText = data.incentiveType ? data.incentiveType : 'removed';
        statusDiv.textContent = `${data.playerName}: ${incentiveText}`;
        statusDiv.style.color = '#43b581';
    } else {
        statusDiv.textContent = data.message || 'Failed to set incentive';
        statusDiv.style.color = '#e74c3c';
    }
    setTimeout(() => statusDiv.textContent = '', 5000);
});

// Handle AI behavior mode changes
document.addEventListener('DOMContentLoaded', function() {
    const aiBehaviorSelect = document.getElementById('aiBehaviorMode');
    const specificRowInput = document.getElementById('specificRowNumber');
    
    if (aiBehaviorSelect) {
        aiBehaviorSelect.addEventListener('change', function() {
            const mode = this.value;
            console.log(`🤖 AI behavior mode changed to: ${mode}`);
            
            // Show/hide specific row input
            if (mode === 'specific_row') {
                specificRowInput.style.display = 'inline-block';
            } else {
                specificRowInput.style.display = 'none';
            }
            
            // Send to server
            const rowNumber = mode === 'specific_row' ? parseInt(specificRowInput.value) || 1 : null;
            socket.emit('setAIBehavior', {
                room: currentRoom,
                mode: mode,
                specificRow: rowNumber
            });
        });
        
        // Handle specific row input changes
        specificRowInput.addEventListener('input', function() {
            if (aiBehaviorSelect.value === 'specific_row') {
                const rowNumber = parseInt(this.value) || 1;
                socket.emit('setAIBehavior', {
                    room: currentRoom,
                    mode: 'specific_row',
                    specificRow: rowNumber
                });
            }
        });
    }
});

// Socket event handlers for testing features
socket.on('systemMessageSent', function(data) {
    console.log('📢 System message confirmed sent:', data.message);
});

socket.on('playerStatusUpdate', function(data) {
    const display = document.getElementById('playerStatusGameDisplay');
    if (!display) return;
    
    // Update global token pool display if available
    if (data.whiteTokensRemaining !== undefined) {
        document.getElementById('globalTokenPool').textContent = data.whiteTokensRemaining;
    }
    
    // Update condition display if available (only for moderators)
    if (data.condition) {
        const moderatorColumnControl = document.getElementById('moderatorColumnControl');
        const isModerator = moderatorColumnControl && moderatorColumnControl.style.display === 'block';
        const conditionInfoElement = document.getElementById('conditionInfo');
        if (conditionInfoElement && isModerator) {
            conditionInfoElement.textContent = `Condition: ${data.condition}`;
        }
    }
    
    let statusHTML = `<div style="color: #43b581; margin-bottom: 8px; font-weight: bold; text-align: center; border-bottom: 1px solid #43b581; padding-bottom: 4px;">Round ${data.round || '?'} • Locked: ${data.lockedCount || 0}/${data.totalCount || 0}</div>`;
    
    // Add condition and pool info
    if (data.condition || data.whiteTokensRemaining !== undefined) {
        statusHTML += `<div style="color: #b9bbbe; margin-bottom: 8px; text-align: center; font-size: 12px;">`;
        if (data.condition) statusHTML += `${data.condition}`;
        if (data.whiteTokensRemaining !== undefined) statusHTML += ` • Pool: ${data.whiteTokensRemaining}`;
        if (data.culturantsProduced !== undefined) statusHTML += ` • Culturants: ${data.culturantsProduced}`;
        statusHTML += `</div>`;
    }
    
    if (data.players && data.players.length > 0) {
        // Sort players: humans first, then AI
        const sortedPlayers = [...data.players].sort((a, b) => {
            if (a.isAI && !b.isAI) return 1;
            if (!a.isAI && b.isAI) return -1;
            return a.name.localeCompare(b.name);
        });
        
        sortedPlayers.forEach(player => {
            const choiceText = player.selectedRow ? `Row ${player.selectedRow}` : 'No choice';
            const lockedIcon = player.lockedIn ? '🔒' : '⏳';
            const typeColor = player.isAI ? '#ffa500' : '#ffffff';
            const choiceColor = player.selectedRow ? 
                (player.selectedRow % 2 === 1 ? '#e74c3c' : '#43b581') : '#72767d';
            
            // Add earnings and incentive info
            let earningsText = '';
            if (player.totalEarnings !== undefined) {
                earningsText = `$${player.totalEarnings.toFixed(2)}`;
            }
            let incentiveText = '';
            if (player.activeIncentive) {
                incentiveText = `⭐${player.activeIncentive.charAt(0).toUpperCase()}`;
            }
            
            statusHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 6px 0; padding: 6px 8px; background-color: rgba(64, 68, 75, 0.5); border-radius: 4px; border-left: 3px solid ${player.isAI ? '#ffa500' : '#43b581'};">
                    <div style="display: flex; align-items: center; flex: 1;">
                        <span style="color: ${typeColor}; font-weight: bold; min-width: 100px;">${player.name}</span>
                        <span style="color: ${choiceColor}; margin-left: 8px; font-weight: bold; min-width: 70px;">${choiceText}</span>
                        ${earningsText ? `<span style="color: #faa61a; margin-left: 8px; font-size: 12px;">${earningsText}</span>` : ''}
                        ${incentiveText ? `<span style="color: #faa61a; margin-left: 4px; font-size: 12px;" title="Active Incentive">${incentiveText}</span>` : ''}
                    </div>
                    <span style="color: ${player.lockedIn ? '#43b581' : '#faa61a'}; font-size: 16px;">${lockedIcon}</span>
                </div>
            `;
        });
    } else {
        statusHTML += '<div style="color: #72767d; text-align: center; font-style: italic;">No player data available</div>';
    }
    
    display.innerHTML = statusHTML;
    
    // Delay wallet displays on poker table to sync with return animation
    setTimeout(() => {
        console.log('💰 Updating poker table wallet displays after return animation starts');
        if (data.players && data.players.length > 0) {
            updateAllWalletDisplays(data.players);
        }
    }, 2000); // Same delay as personal wallet updates to sync timing
});

// Handle incentive changes
socket.on('incentiveChanged', function(data) {
    const incentiveElement = document.getElementById('activeIncentive');
    if (incentiveElement) {
        if (isModerator && data.incentiveType) {
            incentiveElement.textContent = `${data.incentiveType.charAt(0).toUpperCase() + data.incentiveType.slice(1)}`;
            incentiveElement.style.color = '#faa61a';
        } else if (isModerator && !data.incentiveType) {
            incentiveElement.textContent = 'No Active Incentive';
            incentiveElement.style.color = '#72767d';
        } else {
            // Hide incentive info for non-moderators
            incentiveElement.textContent = '';
        }
    }
    
    // Show notification only to moderators
    if (isModerator) {
        console.log(`🎯 Incentive changed: ${data.incentiveType || 'none'}`);
    }
});

socket.on('experimentPaused', function(data) {
    console.log('⏸️ Experiment paused confirmed');
    const statusDiv = document.getElementById('experimentStatus');
    if (statusDiv) {
        statusDiv.textContent = '⏸️ AI Paused';
        statusDiv.style.color = '#e74c3c';
    }
});

socket.on('experimentResumed', function(data) {
    console.log('▶️ Experiment resumed confirmed');
    const statusDiv = document.getElementById('experimentStatus');
    if (statusDiv) {
        statusDiv.textContent = '▶️ AI Active';
        statusDiv.style.color = '#43b581';
    }
});

socket.on('roundReset', function(data) {
    console.log('🔄 Round reset confirmed');
    const statusDiv = document.getElementById('experimentStatus');
    if (statusDiv) {
        statusDiv.textContent = '🔄 Round Reset Complete';
        statusDiv.style.color = '#43b581';
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 3000);
    }
    
    // Clear player status if visible
    const display = document.getElementById('playerStatusGameDisplay');
    if (display) {
        refreshPlayerStatus();
    }
});

socket.on('aiBehaviorSet', function(data) {
    console.log(`🤖 AI behavior confirmed: ${data.mode}`, data.specificRow ? `Row ${data.specificRow}` : '');
    const statusDiv = document.getElementById('experimentStatus');
    if (statusDiv) {
        let modeText = {
            'random': 'Random',
            'all_impulsive': 'All Odd Rows',
            'all_selfcontrol': 'All Even Rows',
            'mixed': 'Mixed Pattern',
            'specific_row': `Row ${data.specificRow}`
        }[data.mode] || data.mode;
        
        statusDiv.textContent = `🤖 AI Mode: ${modeText}`;
        statusDiv.style.color = '#faa61a';
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 4000);
    }
});

// Track locked-in players for floating animation system
let lockedInPlayers = new Map(); // username -> { seat, originalStyles, isFloating, cleanupTimeout }

// Global helper functions for common operations
function attemptColumnHighlight(column, maxRetries = 3, retryDelay = 500) {
    const columnHeaders = document.querySelectorAll('.column-header');
    const gridRows = document.querySelectorAll('.grid-row-8x8');
    console.log(`🔍 Column highlight: Found ${columnHeaders.length} column headers, ${gridRows.length} grid rows for column ${column}`);
    
    if (columnHeaders.length > 0 && gridRows.length > 0) {
        highlightSelectedColumn(column);
    } else if (maxRetries > 0) {
        console.log(`⏳ Grid not ready, retrying in ${retryDelay}ms (${maxRetries} retries left)`);
        setTimeout(() => {
            attemptColumnHighlight(column, maxRetries - 1, retryDelay);
        }, retryDelay);
    } else {
        console.warn(`❌ Failed to highlight column ${column} - grid elements not found`);
    }
}

function applyActivePlayerHighlight(seatElement) {
    seatElement.style.borderColor = '#43b581';
    seatElement.style.boxShadow = `
        0 0 20px rgba(67, 181, 129, 0.4),
        0 0 40px rgba(67, 181, 129, 0.2)
    `;
    seatElement.style.background = 'linear-gradient(145deg, rgba(67, 181, 129, 0.1), rgba(67, 181, 129, 0.05))';
}

// Helper function to get seat elements
function getSeatElements(seat) {
    return {
        nameDiv: seat.querySelector('.player-name'),
        statusDiv: seat.querySelector('.player-status'),
        aiDiv: seat.querySelector('.ai-indicator'),
        walletDiv: seat.querySelector('.player-wallet')
    };
}

const SEAT_IDS = ['leftPlayer', 'topPlayer', 'rightPlayer'];

// Global variable to track current active player
let currentActivePlayer = null;

// Turn-based system updates
socket.on('turnUpdate', function(data) {
    console.log(`🎯 Turn update received:`, data);
    console.log(`🎯 Current player: ${data.currentTurnPlayer}, Turn order: ${data.turnOrder?.join(' → ')}`);
    console.log(`🎯 Turn based: ${data.turnBased}, Round: ${data.round}`);
    
    // CRITICAL: Check gameDiv BEFORE processing turn update
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
        }
    }
    
    // Update global active player tracker
    currentActivePlayer = data.currentTurnPlayer;
    
    // Update turn display
    updateTurnDisplay(data);
    
    // Enable/disable row clicking based on whose turn it is
    updateRowInteractivity(data);
    
    // Check gameDiv AFTER processing turn update
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
        }
    }
});

function updateTurnDisplay(turnData) {
    console.log(`🎯 updateTurnDisplay called with:`, turnData);
    
    // Update turn display element
    let turnDisplay = document.getElementById('turnDisplay');
    if (!turnDisplay) {
        console.log(`🎯 Creating new turnDisplay element`);
        turnDisplay = document.createElement('div');
        turnDisplay.id = 'turnDisplay';
        turnDisplay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(72, 47, 247, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 2px solid rgba(92, 63, 255, 0.5);
        `;
        document.body.appendChild(turnDisplay);
        console.log(`✅ turnDisplay element created and added to DOM`);
    } else {
        console.log(`🎯 Using existing turnDisplay element`);
    }
    
    // Highlight active player's seat in green (with small delay to ensure DOM is ready)
    setTimeout(() => {
        updateActivePlayerHighlight(turnData.currentTurnPlayer);
    }, 10);
    
    if (turnData.turnBased && turnData.currentTurnPlayer) {
        const currentUsername = localStorage.getItem('username');
        const isMyTurn = turnData.currentTurnPlayer === currentUsername;
        
        // Add glow effect if it's the current user's turn
        if (isMyTurn) {
            turnDisplay.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: linear-gradient(145deg, rgba(67, 181, 129, 0.95), rgba(52, 144, 103, 0.95));
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: 'Inter', sans-serif;
                font-size: 14px;
                z-index: 1000;
                box-shadow: 
                    0 0 25px rgba(67, 181, 129, 0.8),
                    0 0 50px rgba(67, 181, 129, 0.4),
                    0 4px 12px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(67, 181, 129, 0.9);
                animation: pulseGlow 2s infinite alternate;
            `;
        } else {
            turnDisplay.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: rgba(72, 47, 247, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: 'Inter', sans-serif;
                font-size: 14px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(92, 63, 255, 0.5);
            `;
        }
        
        const displayHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${isMyTurn ? '🎯 YOUR TURN!' : '🎯 Current Turn'}</div>
            <div style="font-size: 16px; color: ${isMyTurn ? '#ffffff' : '#faa61a'};">${turnData.currentTurnPlayer}</div>
        `;
        turnDisplay.innerHTML = displayHTML;
        turnDisplay.style.display = 'block';
        console.log(`✅ Turn display updated:`, { 
            currentPlayer: turnData.currentTurnPlayer, 
            visible: turnDisplay.style.display,
            isMyTurn: isMyTurn
        });
    } else {
        turnDisplay.style.display = 'none';
        console.log(`❌ Turn display hidden - turnBased: ${turnData.turnBased}, currentTurnPlayer: ${turnData.currentTurnPlayer}`);
    }
}

function updateActivePlayerHighlight(activePlayerName) {
    // Reset all player seat styles to default
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            if (nameDiv && nameDiv.textContent) {
                // Reset to default blue border for occupied seats
                seat.style.borderColor = '#7289da';
                seat.style.boxShadow = 'none';
                seat.style.background = '';
            } else {
                // Keep dim border for empty seats
                seat.style.borderColor = '#72767d';
            }
        }
    });
    
    // Highlight the active player's seat in green
    if (activePlayerName) {
        SEAT_IDS.forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const nameDiv = seat.querySelector('.player-name');
                if (nameDiv && nameDiv.textContent === activePlayerName) {
                    applyActivePlayerHighlight(seat);
                    console.log(`🟢 Highlighted ${activePlayerName}'s seat (${seatId}) in green`);
                }
            }
        });
    }
}

function updateRowInteractivity(turnData) {
    // Small delay to ensure this runs after any conflicting UI updates
    setTimeout(() => {
        const rows = document.querySelectorAll('.grid-row-8x8, .clickable-row');
        const currentUsername = localStorage.getItem('username');
        const isMyTurn = turnData.currentTurnPlayer === currentUsername;
        
        console.log(`🎯 UpdateRowInteractivity: Current user: ${currentUsername}, Current turn: ${turnData.currentTurnPlayer}, Is my turn: ${isMyTurn}, Found ${rows.length} rows, turnBased: ${turnData.turnBased}`);
        
        rows.forEach((row, index) => {
            if (turnData.turnBased) {
                if (isMyTurn) {
                    row.style.pointerEvents = 'auto';
                    row.style.opacity = '1';
                    row.style.cursor = 'pointer';
                    row.classList.remove('disabled-turn');
                    if (index === 0) console.log(`🔓 Enabled row interactions for ${currentUsername}'s turn`);
                } else {
                    row.style.pointerEvents = 'none';
                    row.style.opacity = '0.5';
                    row.style.cursor = 'not-allowed';
                    row.classList.add('disabled-turn');
                    if (index === 0) console.log(`🔒 Disabled row interactions - waiting for ${turnData.currentTurnPlayer}'s turn`);
                }
            } else {
                // Non turn-based - all players can interact
                row.style.pointerEvents = 'auto';
                row.style.opacity = '1';
                row.classList.remove('disabled-turn');
            }
        });
        
        // Ensure lock-in button remains accessible when player has made a selection
        const lockInBtn = document.getElementById('lockInBtn');
        if (lockInBtn && selectedChoice && !isLockedIn && isMyTurn) {
            lockInBtn.style.pointerEvents = 'auto';
            lockInBtn.disabled = false;
            console.log('🔒 Lock-in button ensured clickable');
        }
    }, 100); // 100ms delay to ensure this runs after other UI updates
}

// Visual feedback when players lock in their choices
socket.on('playerLockedIn', function(data) {
    console.log(`🔒 Player locked in: ${data.username}, Row: ${data.row}, AI: ${data.isAI}, Column: ${data.column}`);
    
    // Update turn display if provided
    if (data.currentTurnPlayer && data.turnBased) {
        updateTurnDisplay({
            currentTurnPlayer: data.currentTurnPlayer,
            turnOrder: data.turnOrder || [],
            turnBased: data.turnBased
        });
        
        // Update row interactivity for new current player
        const currentUsername = localStorage.getItem('username');
        const isMyTurn = data.currentTurnPlayer === currentUsername;
        updateRowInteractivity({
            currentTurnPlayer: data.currentTurnPlayer,
            turnBased: data.turnBased
        });
    }
    
    // 1. PLAYER SEAT VISUAL EFFECT WITH FLOATING ANIMATION (visible to everyone)
    // Find which seat this player occupies and add lock-in effect around them
    const allSeats = SEAT_IDS;
    let playerSeat = null;
    
    allSeats.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            if (nameDiv && nameDiv.textContent === data.username) {
                playerSeat = seat;
            }
        }
    });
    
    if (playerSeat) {
        // Store original position and styles for restoration later
        const originalStyles = {
            position: playerSeat.style.position || 'absolute',
            left: playerSeat.style.left,
            top: playerSeat.style.top,
            right: playerSeat.style.right,
            transform: playerSeat.style.transform,
            zIndex: playerSeat.style.zIndex || 'auto',
            transition: playerSeat.style.transition
        };
        
        // Store player info for round end restoration
        lockedInPlayers.set(data.username, {
            seat: playerSeat,
            originalStyles: originalStyles,
            isFloating: false,
            cleanupTimeout: null
        });
        
        // Remove any existing lock indicators
        const existingLocks = playerSeat.querySelectorAll('.player-lock-indicator');
        existingLocks.forEach(lock => lock.remove());
        
        // Create lock-in indicator on the player seat
        const lockIcon = document.createElement('div');
        lockIcon.innerHTML = data.isAI ? '🤖🔒' : '🔒';
        lockIcon.className = 'player-lock-indicator';
        lockIcon.style.cssText = `
            position: absolute;
            top: -12px;
            right: -12px;
            font-size: 14px;
            z-index: 30;
            background: linear-gradient(135deg, ${data.isAI ? '#faa61a' : '#5865f2'}, ${data.isAI ? '#ff8c42' : '#4752c4'});
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 
                0 4px 12px rgba(${data.isAI ? '250, 166, 26' : '88, 101, 242'}, 0.3),
                0 0 0 0 rgba(${data.isAI ? '250, 166, 26' : '88, 101, 242'}, 0.5);
            border: 2px solid rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(8px);
            color: white;
            font-weight: 600;
        `;
        
        // Ensure seat has relative positioning
        playerSeat.style.position = 'absolute';
        playerSeat.appendChild(lockIcon);
        
        // Add immediate glow effect to the player seat
        const glowColor = data.isAI ? '#faa61a' : '#5865f2';
        const glowColorSecondary = data.isAI ? '#ff8c42' : '#4752c4';
        playerSeat.style.border = `3px solid ${glowColor}`;
        playerSeat.style.boxShadow = `
            0 0 25px ${data.isAI ? 'rgba(250, 166, 26, 0.6)' : 'rgba(88, 101, 242, 0.6)'},
            0 0 50px ${data.isAI ? 'rgba(250, 166, 26, 0.3)' : 'rgba(88, 101, 242, 0.3)'},
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `;
        playerSeat.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        playerSeat.style.background = `linear-gradient(145deg, rgba(${data.isAI ? '250, 166, 26' : '88, 101, 242'}, 0.05), rgba(${data.isAI ? '255, 140, 66' : '71, 82, 196'}, 0.1))`;
        
        // Phase 1: Brief initial scale effect (0.5s)
        setTimeout(() => {
            playerSeat.style.transform = (originalStyles.transform || '') + ' scale(1.15)';
        }, 200);
        
        // Phase 2: Simple gentle movement toward center (stops at boundary)
        setTimeout(() => {
            playerSeat.style.zIndex = '25'; // Float above other elements
            
            // Move all players to just outside the counter boundary in the middle
            // All should end up at roughly the same distance from center
            
            if (playerSeat.id === 'leftPlayer') {
                // Left player moves right to just outside counter boundary
                let moveDistance = 320; // P1 needs to move farther in
                playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateX(${moveDistance}px)`;
            } else if (playerSeat.id === 'rightPlayer') {
                // Right player moves left to just outside counter boundary
                let moveDistance = 320; // P3 needs to move farther in
                playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateX(-${moveDistance}px)`;
            } else if (playerSeat.id === 'topPlayer') {
                // Top player moves down to just outside counter boundary
                let moveDistance = 40; // P2 moves less
                playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateY(${moveDistance}px)`;
            } else {
                // Fallback: just scale
                playerSeat.style.transform = (originalStyles.transform || '') + ' scale(1.1)';
            }
            
            // Set transition for smooth but faster movement
            playerSeat.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            
            if (lockedInPlayers.has(data.username)) {
                lockedInPlayers.get(data.username).isFloating = true;
            }
            
        }, 1000);
        
        // Lock icon will stay visible until next round (no timeout removal)
    }
    
    // 2. GRID ROW DETAILS (now visible to ALL players)
    if (data.row) {
        const rowElement = document.querySelector(`[data-row="${data.row}"]`);
        if (rowElement) {
            // Create a lock-in indicator on the row (visible to everyone)
            const rowLockIcon = document.createElement('div');
            rowLockIcon.innerHTML = data.isAI ? '🤖🔒' : `🔒 ${data.username}`;
            rowLockIcon.style.cssText = `
                position: absolute;
                top: 50%;
                left: 480px;
                transform: translateY(-50%);
                font-size: 12px;
                z-index: 15;
                background: linear-gradient(135deg, ${data.isAI ? '#faa61a' : '#5865f2'}, ${data.isAI ? '#ff8c42' : '#4752c4'});
                border-radius: 18px;
                padding: 6px 12px;
                box-shadow: 
                    0 3px 12px rgba(${data.isAI ? '250, 166, 26' : '88, 101, 242'}, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-family: 'Inter', -apple-system, system-ui, sans-serif;
                font-weight: 500;
                color: white;
                backdrop-filter: blur(6px);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                white-space: nowrap;
            `;
            rowLockIcon.className = 'row-lock-indicator';
            
            // Make sure row has relative positioning for absolute child
            rowElement.style.position = 'relative';
            
            // Remove any existing row lock indicators for this row
            const existingRowLocks = rowElement.querySelectorAll('.row-lock-indicator');
            existingRowLocks.forEach(lock => lock.remove());
            
            // Add the new row lock indicator
            rowElement.appendChild(rowLockIcon);
            
            // Add temporary highlight effect to the row
            const originalBackground = rowElement.style.backgroundColor;
            const highlightColor = data.isAI ? 'rgba(250, 166, 26, 0.2)' : 'rgba(88, 101, 242, 0.2)';
            const glowColor = data.isAI ? 'rgba(250, 166, 26, 0.4)' : 'rgba(88, 101, 242, 0.4)';
            
            rowElement.style.backgroundColor = highlightColor;
            rowElement.style.boxShadow = `
                0 0 25px ${glowColor},
                0 4px 15px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `;
            rowElement.style.transform = 'scale(1.02)';
            rowElement.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            
            // Restore original styling after animation
            setTimeout(() => {
                rowElement.style.backgroundColor = originalBackground;
                rowElement.style.boxShadow = 'none';
                rowElement.style.transform = 'scale(1)';
                rowElement.style.transition = '';
            }, 2000);
            
            // Row lock icon stays visible until next round (no timeout removal)
        }
    }
    
    // 3. COLUMN SELECTION DISPLAY (now visible to ALL players)
    if (data.column) {
        // Find or create column display element
        let columnDisplay = document.getElementById('selectedColumnDisplay');
        if (!columnDisplay) {
            columnDisplay = document.createElement('div');
            columnDisplay.id = 'selectedColumnDisplay';
            columnDisplay.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(92, 63, 255, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: 'Inter', sans-serif;
                font-size: 16px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(72, 47, 247, 0.8);
                font-weight: 600;
            `;
            document.body.appendChild(columnDisplay);
        }
        
        columnDisplay.innerHTML = `📍 Selected Column: <span style="color: #faa61a; font-size: 18px;">${data.column}</span>`;
        
        // Highlight the selected column in the grid
        highlightSelectedColumn(data.column);
    }
    
    // 4. STATUS NOTIFICATION (now shows detailed info to everyone)
    const statusDiv = document.getElementById('experimentStatus');
    if (statusDiv) {
        const playerType = data.isAI ? '🤖 AI Player' : '👤 Player';
        let message = `${playerType} ${data.username} selected Row ${data.row || '?'}`;
        if (data.column) {
            message += ` (Column ${data.column})`;
        }
        
        statusDiv.textContent = message;
        statusDiv.style.color = data.isAI ? '#faa61a' : '#28a745';
        setTimeout(() => {
            if (statusDiv.textContent.includes(data.username)) {
                statusDiv.textContent = '';
            }
        }, 3500);
    }
});

// Function to restore all floating players to original positions (call on new round)
function restoreFloatingPlayers() {
    console.log('🔄 Restoring floating players to original positions');
    
    // Enhanced fallback: Force reset all player seats to known positions
    const seatResetData = {
        'leftPlayer': {
            left: '20px',
            top: '50%',
            right: '',
            transform: 'translateY(-50%)',
            zIndex: 'auto'
        },
        'topPlayer': {
            left: '50%',
            top: '20px',
            right: '',
            transform: 'translateX(-50%)',
            zIndex: 'auto'
        },
        'rightPlayer': {
            left: '',
            top: '50%',
            right: '20px',
            transform: 'translateY(-50%)',
            zIndex: 'auto'
        }
    };
    
    // First pass: Restore tracked floating players
    lockedInPlayers.forEach((playerData, username) => {
        const { seat, originalStyles } = playerData;
        
        if (seat && seat.parentNode) {
            console.log(`🔄 Restoring ${username} to original position`);
            
            // STEP 1: Apply smooth transition back to original position
            seat.style.transition = 'all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            
            // STEP 2: Restore original transform (removes scale and translation)
            seat.style.transform = originalStyles.transform || '';
            seat.style.zIndex = originalStyles.zIndex || 'auto';
            
            // STEP 3: Fade out lock-in effects
            const lockIndicator = seat.querySelector('.player-lock-indicator');
            if (lockIndicator) {
                lockIndicator.style.opacity = '0';
                lockIndicator.style.transition = 'opacity 0.8s ease-out';
                setTimeout(() => {
                    if (lockIndicator.parentNode) {
                        lockIndicator.remove();
                    }
                }, 800);
            }
            
            // STEP 4: Clear enhanced styling after transition completes (but preserve active player highlighting)
            setTimeout(() => {
                const nameDiv = seat.querySelector('.player-name');
                if (currentActivePlayer && nameDiv && nameDiv.textContent === currentActivePlayer) {
                    // Preserve active player highlighting
                    seat.style.border = '2px solid #43b581';
                    applyActivePlayerHighlight(seat);
                    console.log(`🟢 Preserved active player highlight during restoration for: ${currentActivePlayer}`);
                } else {
                    // Reset to default for non-active players
                    seat.style.border = originalStyles.border || '2px solid #7289da';
                    seat.style.boxShadow = originalStyles.boxShadow || 'none';
                }
                seat.style.transition = originalStyles.transition || '';
                console.log(`✅ Finished restoring ${username} to original position`);
            }, 1200);
        }
    });
    
    // Second pass: Fallback reset for ALL seats (in case tracking failed)
    setTimeout(() => {
        SEAT_IDS.forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const resetData = seatResetData[seatId];
                
                // Force reset position properties
                seat.style.position = 'absolute';
                seat.style.left = resetData.left;
                seat.style.top = resetData.top;
                seat.style.right = resetData.right;
                seat.style.transform = resetData.transform;
                seat.style.zIndex = resetData.zIndex;
                
                // Clear any errant styling
                seat.style.transition = '';
            }
        });
    }, 1500); // Run after the main restoration is complete
    
    // Clear all row lock indicators
    const allRowLocks = document.querySelectorAll('.row-lock-indicator');
    allRowLocks.forEach(indicator => {
        indicator.style.opacity = '0';
        indicator.style.transition = 'opacity 0.8s ease-out';
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, 800);
    });
    
    // Reset all player seat highlighting to default (but preserve active player highlighting)
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            if (nameDiv && nameDiv.textContent) {
                // Check if this seat belongs to the current active player
                if (currentActivePlayer && nameDiv.textContent === currentActivePlayer) {
                    // Keep green highlighting for active player
                    applyActivePlayerHighlight(seat);
                    console.log(`🟢 Preserved green highlighting for active player: ${currentActivePlayer}`);
                } else {
                    // Reset to default blue border for non-active occupied seats
                    seat.style.borderColor = '#7289da';
                    seat.style.boxShadow = 'none';
                    seat.style.background = '';
                }
            } else {
                // Keep dim border for empty seats
                seat.style.borderColor = '#72767d';
            }
        }
    });
    
    // Clear the global active player tracker
    currentActivePlayer = null;
    
    // Clear the tracking map
    lockedInPlayers.clear();
    
    // Re-apply active player highlighting after restoration (with delay to ensure DOM updates complete)
    setTimeout(() => {
        if (currentActivePlayer) {
            console.log(`🔄 Re-applying active player highlighting for: ${currentActivePlayer}`);
            updateActivePlayerHighlight(currentActivePlayer);
        }
    }, 100);
}

console.log('🧠 Client.js loaded - Canvas rendering and keyboard controls disabled for behavioral experiment mode');