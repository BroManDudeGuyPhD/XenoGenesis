// Variables
const socket = io();

// Current room tracking
let currentRoom = "Global"; // Track which room the user is actually in
let gameActive = false; // Track if there's an active game to display

// Chat Objects (will be initialized when DOM is ready)
let chatForm, globalChatMessages, globalNameText, roomChatMessages, roomNameText, userList, userCount, gameDiv;

// Poker table visualization functions
function clearPokerTable() {
    console.log('🧹 Clearing poker table completely');
    
    // Clear all seats
    ['leftPlayer', 'topPlayer', 'rightPlayer'].forEach(seatId => {
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
    
    console.log('✅ Poker table cleared');
}

function updatePokerTable(gameSession) {
    console.log('🃏 Updating poker table with session data:', gameSession);
    
    // Clear all seats first
    ['leftPlayer', 'topPlayer', 'rightPlayer'].forEach(seatId => {
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
            
            // Highlight active seat
            seat.style.borderColor = '#7289da';
            
            console.log(`🃏 Placed ${player.username} in ${seatPosition} seat (P${player.triadPosition})`);
        } else {
            console.warn('🃏 Seat element not found:', seatId);
        }
    });
    
    // Update table center round display
    const tableRound = document.getElementById('tableRound');
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

// Poker table visualization functions
function updatePokerTable(gameSession) {
    console.log('🃏 Updating poker table with session data:', gameSession);
    
    // Clear all seats first
    ['leftPlayer', 'topPlayer', 'rightPlayer'].forEach(seatId => {
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
            
            // Highlight active seat
            seat.style.borderColor = '#7289da';
            
            console.log(`🃏 Placed ${player.username} in ${seatPosition} seat (P${player.triadPosition})`);
        } else {
            console.warn('🃏 Seat element not found:', seatId);
        }
    });
    
    // Update table center round display
    const tableRound = document.getElementById('tableRound');
    if (tableRound && gameSession) {
        tableRound.textContent = gameSession.currentRound || 0;
    }
}

// Join chatroom
socket.on('signInResponse', function (data) {
    if (data.success) {
        // Store the current username globally
        currentUsername = signDivUsername ? signDivUsername.value : null;
        console.log('✅ Signed in as:', currentUsername);
        
        //signDiv.style.display = 'none';
        landingPage.style.display = "none";
        loginButton.style.display = "none";
        chatDiv.style.display = '';
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
    console.log(`👥 Received roomUsers event - Room: ${room}, Users: ${usersCount}`, users);
    // Only update the display if this roomUsers event is for the room the user is actually in
    if (room === currentRoom) {
        console.log(`👥 Updating room users for ${room}: ${usersCount} users`, users);
        
        if (room === "Global") {
            // Update global chat users
            outputUsers(users);
            if (userCount) userCount.innerText = ` Users:    ${usersCount} online`;
        } else {
            // Update room name and users for specific rooms
            outputRoomName(room);
            outputUsers(users);
            if (userCount) userCount.innerText = usersCount.toString();
        }
    } else {
        console.log(`🚫 Ignoring roomUsers for ${room} - current room is ${currentRoom}`);
    }
});

// Handle players in room updates (including AI players)
socket.on('playersInRoom', function(data) {
    console.log(`🃏 *** PLAYERS IN ROOM EVENT RECEIVED *** for ${data.room}:`, data.players);
    console.log(`🃏 Current room: ${currentRoom}, Event room: ${data.room}`);
    
    // Only update if this is for our current room
    if (data.room === currentRoom) {
        console.log('🎯 Processing playersInRoom for our current room');
        
        // Find the moderator (room creator/first player)
        const moderator = data.players.find(p => p.isModerator) || data.players[0];
        console.log('🎯 Found moderator:', moderator);
        
        // Update moderator position
        const moderatorDiv = document.getElementById('moderatorPosition');
        console.log('🎯 Moderator div found:', !!moderatorDiv);
        
        if (moderatorDiv && moderator) {
            const moderatorNameDiv = moderatorDiv.querySelector('.moderator-name');
            console.log('🎯 Moderator name div found:', !!moderatorNameDiv);
            
            if (moderatorNameDiv) {
                moderatorNameDiv.textContent = moderator.username;
                console.log('✅ Updated moderator name to:', moderator.username);
            } else {
                console.log('⚠️ Moderator name div not found, creating one');
                // Add moderator name if div doesn't exist
                const nameDiv = document.createElement('div');
                nameDiv.className = 'moderator-name';
                nameDiv.style.cssText = 'color: #43b581; font-size: 11px; font-weight: bold;';
                nameDiv.textContent = moderator.username;
                moderatorDiv.appendChild(nameDiv);
                console.log('✅ Added moderator name div:', moderator.username);
            }
        } else {
            console.log('❌ Moderator div or moderator data not found');
        }
        
        // Get non-moderator players for the poker seats
        const participantPlayers = data.players.filter(p => p !== moderator);
        console.log('🎯 Participant players:', participantPlayers);
        
        // Clear all poker seats first
        ['leftPlayer', 'topPlayer', 'rightPlayer'].forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const nameDiv = seat.querySelector('.player-name');
                const statusDiv = seat.querySelector('.player-status');
                const aiDiv = seat.querySelector('.ai-indicator');
                
                if (nameDiv) nameDiv.textContent = '';
                if (statusDiv) statusDiv.textContent = 'Empty';
                if (aiDiv) aiDiv.style.display = 'none';
                seat.style.borderColor = '#72767d';
            }
        });
        
        // Place participant players in seats
        const seatIds = ['leftPlayer', 'topPlayer', 'rightPlayer'];
        participantPlayers.forEach((player, index) => {
            if (index < 3) { // Only place up to 3 participants
                const seatId = seatIds[index];
                const seat = document.getElementById(seatId);
                
                if (seat) {
                    const nameDiv = seat.querySelector('.player-name');
                    const statusDiv = seat.querySelector('.player-status');
                    const aiDiv = seat.querySelector('.ai-indicator');
                    
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
                    
                    // Highlight active seat
                    seat.style.borderColor = '#7289da';
                    
                    console.log(`✅ Placed ${player.username} in seat ${seatId} (P${index + 1})`);
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
        
        console.log('👑 Checking moderator status for button visibility...', {
            currentUser: currentUser ? currentUser.username : 'none',
            currentUsername: currentUsername,
            isCurrentUserModerator: isCurrentUserModerator
        });
        
        // Show/hide "Start Experiment" button based on moderator status
        const startExperimentBtn = document.getElementById('startExperimentBtn');
        if (startExperimentBtn) {
            if (moderator && isCurrentUserModerator) {
                startExperimentBtn.style.display = 'block';
                console.log('✅ Start Experiment button shown (user is moderator)');
            } else {
                startExperimentBtn.style.display = 'none';
                console.log('🚫 Start Experiment button hidden (user is not moderator)');
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
                console.log('✅ Add AI Players button created (user is moderator)');
                
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
            } else if (addAIBtn) {
                addAIBtn.style.display = 'inline-block';
                console.log('✅ Add AI Players button shown (user is moderator)');
            }
        } else if (addAIBtn) {
            // Hide button if user is not moderator
            addAIBtn.style.display = 'none';
            console.log('🚫 Add AI Players button hidden (user is not moderator)');
        }
    } else {
        console.log(`🚫 Ignoring playersInRoom for ${data.room} - current room is ${currentRoom}`);
    }
});

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
    console.log('🏠 Room created, showing game board for moderator');
    
    // Copy room name to clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText(roomName).then(() => {
            console.log(`✅ Room name "${roomName}" copied to clipboard`);
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
        console.log('✅ Landing page hidden');
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
    console.log(`🏠 JOINED ROOM event received: ${room}, updating currentRoom from ${currentRoom} to ${room}`);
    currentRoom = room; // Ensure currentRoom is updated when server confirms room join
    
    // Update room name display if elements are available
    if (roomNameText) {
        roomNameText.innerText = room;
        roomNameText.style.display = "";
        roomNameText.style.backgroundColor = "green";
        console.log(`✅ Updated room name display to: ${room}`);
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
    console.log('🚪 Left room:', data);
    
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
        console.log('✅ Hidden game interface');
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
    
    // Show game div if:
    // 1. We have player data AND
    // 2. (We're not in Global chat OR we are a player ourselves with selfId)
    console.log(`🔍 GAME DISPLAY CONDITIONS:`);
    console.log(`   data.player exists: ${!!data.player}`);
    console.log(`   data.player.length: ${data.player ? data.player.length : 'N/A'}`);
    console.log(`   currentRoom: "${currentRoom}"`);
    console.log(`   currentRoom !== "Global": ${currentRoom !== "Global"}`);
    console.log(`   data.selfId: ${data.selfId}`);
    console.log(`   Final condition: ${data.player && data.player.length > 0 && (currentRoom !== "Global" || data.selfId)}`);
    
    if(data.player && data.player.length > 0 && (currentRoom !== "Global" || data.selfId)) {
        console.log('✅ SHOWING GAME - Players:', data.player.length, 'SelfId:', !!data.selfId, 'Room:', currentRoom);
        
        console.log('🎮 Setting gameDiv.style.display to inline-block...');
        gameDiv.style.display = 'inline-block';
        console.log('🎮 gameDiv.style.display is now:', gameDiv.style.display);
        console.log('🎮 gameDiv.offsetWidth:', gameDiv.offsetWidth, 'gameDiv.offsetHeight:', gameDiv.offsetHeight);
        
        // Add a delay to check if gameDiv stays visible
        setTimeout(() => {
            console.log('🕐 After 100ms - gameDiv.style.display:', gameDiv.style.display);
            console.log('🕐 After 100ms - gameDiv visible dimensions:', gameDiv.offsetWidth, 'x', gameDiv.offsetHeight);
        }, 100);
        
        setTimeout(() => {
            console.log('🕑 After 1000ms - gameDiv.style.display:', gameDiv.style.display);
            console.log('🕑 After 1000ms - gameDiv visible dimensions:', gameDiv.offsetWidth, 'x', gameDiv.offsetHeight);
        }, 1000);
        
        gameActive = true; // Mark game as active
        console.log('🎮 gameActive set to:', gameActive);
        
        // Clear existing players before adding new ones
        console.log('🎮 Clearing Player.list...');
        Player.list = {};
        
        // Initialize players
        console.log('🎮 Initializing', data.player.length, 'players...');
        for (var i = 0; i < data.player.length; i++) {
            console.log('🎮 Creating player', i + 1, ':', data.player[i]);
            new Player(data.player[i]);
        }
        console.log('🎮 Player.list now contains:', Object.keys(Player.list).length, 'players');
        console.log('🎮 Final Player.list:', Player.list);
        
        // Update poker table with current players
        updatePokerTable(data.gameSession || {});
        
        // All players who receive init events are now active players (no more viewers)
        if (data.selfId) {
            console.log('🎮 Player mode - has selfId:', data.selfId);
            // Old start button removed - no longer need to hide it
        } else {
            console.log('⚠️ Warning: Received init without selfId - this should not happen anymore');
        }
    } else {
        console.log('❌ NOT SHOWING GAME - Room:', currentRoom, 'Players:', data.player ? data.player.length : 0, 'SelfId:', !!data.selfId);
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
    
    // Update poker table with player positions
    console.log('🎯 About to call updatePokerTable with:', data.gameSession);
    updatePokerTable(data.gameSession);
    
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
    
    // Update condition info
    document.getElementById('conditionInfo').textContent = `Condition: ${data.gameSession.condition}`;
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

// New round started
socket.on('newRound', function(data) {
    console.log('🔄 New round started:', data);
    
    // Update round info
    document.getElementById('currentRound').textContent = data.round;
    document.getElementById('activePlayer').textContent = data.isYourTurn 
        ? 'Your Turn - Make Your Choice!' 
        : `${data.activePlayer}'s Turn`;
    document.getElementById('conditionInfo').textContent = `Condition: ${data.condition}`;
    document.getElementById('globalTokenPool').textContent = data.whiteTokensRemaining;
    
    // Update poker table round display
    const tableRound = document.getElementById('tableRound');
    if (tableRound) {
        tableRound.textContent = data.round;
    }
    
    // Update UI phases
    document.getElementById('lobbyPhase').style.display = 'none';
    document.getElementById('decisionPhase').style.display = 'block';
    document.getElementById('resultsPhase').style.display = 'none';
    document.getElementById('finalResults').style.display = 'none';
    
    // Enable/disable choice buttons based on turn
    const choiceButtons = document.querySelectorAll('.grid-cell');
    choiceButtons.forEach(button => {
        button.disabled = !data.isYourTurn;
        button.style.opacity = data.isYourTurn ? '1' : '0.5';
    });
    
    // Reset choice status
    document.getElementById('choiceStatus').textContent = data.isYourTurn ? 'Choose your action above' : 'Waiting for other players...';
});

// Round results received
socket.on('roundResult', function(data) {
    console.log('📊 Round results:', data);
    
    // Update token displays
    document.getElementById('whiteTokens').textContent = data.totalTokens.white;
    document.getElementById('blackTokens').textContent = data.totalTokens.black;
    document.getElementById('totalEarnings').textContent = `$${data.totalEarnings.toFixed(2)}`;
    document.getElementById('globalTokenPool').textContent = data.whiteTokensRemaining;
    
    // Show results phase
    document.getElementById('decisionPhase').style.display = 'none';
    document.getElementById('resultsPhase').style.display = 'block';
    
    // Display round results
    let resultsHTML = '<h4>Choices Made:</h4>';
    data.choices.forEach(choice => {
        const aiIndicator = choice.isAI ? ' 🤖' : '';
        resultsHTML += `<div>${choice.username}${aiIndicator}: ${choice.choice}</div>`;
    });
    document.getElementById('roundResults').innerHTML = resultsHTML;
    
    // Display token awards
    let tokenHTML = `You received: ${data.tokensAwarded.white} white tokens`;
    if (data.tokensAwarded.black > 0) {
        tokenHTML += ` and ${data.tokensAwarded.black} black token`;
    }
    document.getElementById('tokenUpdate').textContent = tokenHTML;
    
    // Display culturant status
    if (data.culturantProduced) {
        document.getElementById('culturantCount').textContent = parseInt(document.getElementById('culturantCount').textContent) + 1;
        document.getElementById('culturantStatus').textContent = '🎯 Culturant Produced! All players chose self-control.';
        document.getElementById('culturantStatus').style.color = '#43b581';
    } else {
        document.getElementById('culturantStatus').textContent = '';
    }
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
        console.log('🏠 Initialized room name display:', currentRoom);
    }

    // Set initial user count if available
    if (userCount) {
        userCount.innerText = "0";
    }

    // TEMPORARY: Test game interface visibility
    setTimeout(() => {
        console.log('🔧 Testing game interface visibility...');
        const gameDiv = document.getElementById('gameDiv');
        if (gameDiv) {
            console.log('🔧 Found gameDiv, current display:', gameDiv.style.display);
        } else {
            console.log('❌ gameDiv not found in DOM');
        }
    }, 2000);

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
            console.log('🚪 Leave button clicked, current room:', currentRoom);

            if(currentRoom && currentRoom !== "Global"){
                console.log("🏠 Leaving room:", currentRoom);
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
    
    // Choice buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('grid-cell') && !e.target.disabled) {
            e.preventDefault();
            const choice = e.target.getAttribute('data-choice');
            console.log(`🧠 Player chose: ${choice}`);
            
            // Disable all buttons after choice
            document.querySelectorAll('.grid-cell').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            });
            
            // Highlight chosen button
            e.target.style.backgroundColor = '#7289da';
            
            // Update status
            document.getElementById('choiceStatus').textContent = `You chose: ${choice}. Waiting for other players...`;
            
            // Emit choice to server
            socket.emit('makeChoice', { 
                choice: choice,
                room: currentRoom
            });
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
    
    // Log every 3 seconds instead of every second to reduce spam
    if (drawFrameCount - lastDrawLog >= 180) { // 60fps * 3 seconds
        console.log(`🎨 DRAWING - Frame: ${drawFrameCount}, gameActive: ${gameActive}, players: ${Object.keys(Player.list).length}, selfId: ${selfId || 'null'}`);
        lastDrawLog = drawFrameCount;
    }

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

console.log('🧠 Client.js loaded - Canvas rendering and keyboard controls disabled for behavioral experiment mode');