/**
 * XenoGenesis Client - Main Application
 * Coordinates all modules and initializes the application
 */

import { setState, getMenuContext, currentRoom } from './utils.js';
import { socket } from './socketManager.js';
import initializeSocketHandlers from './socketHandlers.js';
import { initializeTokenSystem } from './tokenSystem.js';
import gameUI from './gameUI.js';
import modals from './modals.js';
import { initializeAuthentication } from './authentication.js';
import { initializeUIManager } from './uiManager.js';
import { 
    initializeAdminFunctions,
    setupModeratorMenuHandlers,
    initializeSwitchboardFunctions,
    showLightningExperimentConfirmation
} from './adminFunctions.js';

/**
 * Initialize the application
 */
export async function initializeApp() {
    console.log('🚀 Initializing XenoGenesis application');
    
    try {
        // Set DOM loaded flag
        setState.setDomLoaded(true);
        
        // Initialize core systems
        await initializeCoreModules();
        
        // Initialize UI components
        initializeUIComponents();
        
        // Set up event listeners
        setupEventListeners();
        
        // Make modules globally available for backwards compatibility
        exposeModulesGlobally();
        
        // Make exposeModulesGlobally available globally for early session restore
        window.exposeModulesGlobally = exposeModulesGlobally;
        
        console.log('✅ Application initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        showInitializationError(error);
    }
}

/**
 * Initialize core modules
 */
async function initializeCoreModules() {
    console.log('🔧 Initializing core modules');
    
    // Initialize authentication module
    initializeAuthentication();
    
    // Initialize UI manager
    initializeUIManager();
    
    // Initialize admin functions
    initializeAdminFunctions();
    
    // Initialize socket handlers
    initializeSocketHandlers();
    
    // Initialize token system
    initializeTokenSystem();
    
    // Wait for socket connection
    await waitForSocketConnection();
}

/**
 * Wait for socket connection
 * @returns {Promise} Promise that resolves when connected
 */
function waitForSocketConnection() {
    return new Promise((resolve, reject) => {
        if (socket.connected) {
            resolve();
            return;
        }
        
        const timeout = setTimeout(() => {
            reject(new Error('Socket connection timeout'));
        }, 10000); // 10 second timeout
        
        socket.on('connect', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}

/**
 * Initialize UI components
 */
function initializeUIComponents() {
    console.log('🎨 Initializing UI components');
    
    // Initialize card visibility based on context
    updateCardVisibility();
    
    // Initialize admin status badge
    updateAdminStatusBadge();
    
    // Set up initial UI state
    setupInitialUIState();
}

/**
 * Set up initial UI state
 */
function setupInitialUIState() {
    const context = getMenuContext();
    console.log(`📱 Setting up UI for context: ${context}`);
    
    switch (context) {
        case 'login':
            setupLoginInterface();
            break;
        case 'chat':
            setupChatInterface();
            break;
        case 'game':
            setupGameInterface();
            break;
        default:
            console.log('Unknown context, showing login interface');
            setupLoginInterface();
    }
}

/**
 * Set up login interface
 */
function setupLoginInterface() {
    const signDiv = document.getElementById('signDiv');
    const chatDiv = document.getElementById('chatDiv');
    const gameDiv = document.getElementById('gameDiv');
    
    if (signDiv) signDiv.style.display = 'block';
    if (chatDiv) chatDiv.style.display = 'none';
    if (gameDiv) gameDiv.style.display = 'none';
}

/**
 * Set up chat interface
 */
function setupChatInterface() {
    const signDiv = document.getElementById('signDiv');
    const chatDiv = document.getElementById('chatDiv');
    const gameDiv = document.getElementById('gameDiv');
    
    if (signDiv) signDiv.style.display = 'none';
    if (chatDiv) chatDiv.style.display = 'block';
    if (gameDiv) gameDiv.style.display = 'none';
}

/**
 * Set up game interface
 */
function setupGameInterface() {
    const signDiv = document.getElementById('signDiv');
    const chatDiv = document.getElementById('chatDiv');
    const gameDiv = document.getElementById('gameDiv');
    
    if (signDiv) signDiv.style.display = 'none';
    if (chatDiv) chatDiv.style.display = 'none';
    if (gameDiv) gameDiv.style.display = 'block';
}

/**
 * Set up global event listeners
 */
function setupEventListeners() {
    console.log('👂 Setting up event listeners');
    
    // Sign in form handling
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', handleSignIn);
    }
    
    // Sign up form handling
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        signUpForm.addEventListener('submit', handleSignUp);
    }
    
    // Room controls
    const createRoomButton = document.getElementById('create-card');
    if (createRoomButton) {
        createRoomButton.addEventListener('click', handleCreateRoom);
    }
    
    const joinRoomButton = document.getElementById('join-card');
    if (joinRoomButton) {
        joinRoomButton.addEventListener('click', handleJoinRoom);
    }
    
    // Invite card
    const inviteCard = document.getElementById('invite-card');
    if (inviteCard) {
        inviteCard.addEventListener('click', handleGenerateInvite);
    }
    
    // Game controls
    const leaveRoomButton = document.getElementById('leaveRoomButton');
    if (leaveRoomButton) {
        leaveRoomButton.addEventListener('click', handleLeaveRoom);
    }

    // Chat form handling
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatMessage);
    }

    // Window events
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('resize', handleWindowResize);
}

/**
 * Handle sign in form submission
 * @param {Event} e - Form submit event
 */
function handleSignIn(e) {
    e.preventDefault();
    
    const username = document.getElementById('signDivUsername')?.value;
    const password = document.getElementById('signDivPassword')?.value;
    
    if (!username || !password) {
        modals.showGlassmorphismAlert('Missing Information', 'Please enter both username and password', 'warning');
        return;
    }
    
    setState.setSigninInProgress(true);
    
    socket.emit('signIn', {
        username: username.trim(),
        password: password
    });
}

/**
 * Handle sign up form submission
 * @param {Event} e - Form submit event
 */
function handleSignUp(e) {
    e.preventDefault();
    
    const username = document.getElementById('signDivUsername')?.value;
    const password = document.getElementById('signDivPassword')?.value;
    
    if (!username || !password) {
        modals.showGlassmorphismAlert('Missing Information', 'Please enter both username and password', 'warning');
        return;
    }
    
    if (password.length < 6) {
        modals.showGlassmorphismAlert('Password Too Short', 'Password must be at least 6 characters long', 'warning');
        return;
    }
    
    setState.setSigninInProgress(true);
    
    socket.emit('signUp', {
        username: username.trim(),
        password: password
    });
}

/**
 * Handle create room
 */
function handleCreateRoom() {
    console.log('🏠 Creating new room...');
    
    // Server will generate the room name using color + animal system
    socket.emit('createRoom');
}

/**
 * Handle join room
 */
function handleJoinRoom() {
    // Use modals system to get room name
    showJoinRoomModal();
}

/**
 * Show join room modal with glassmorphism styling
 */
function showJoinRoomModal() {
    // Remove any existing modal
    const existingModal = document.getElementById('joinRoomModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'joinRoomModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        padding: 30px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
        color: white;
        animation: modalSlideIn 0.3s ease-out;
    `;

    modalContent.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">Join Room</h2>
        <p style="margin: 0 0 20px 0; opacity: 0.9;">Enter the name of the room you'd like to join:</p>
        <input type="text" id="roomNameInput" placeholder="Room name..." style="
            width: 100%;
            padding: 12px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            color: white;
            font-size: 16px;
            margin-bottom: 20px;
            box-sizing: border-box;
        " />
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="joinRoomConfirm" style="
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s ease;
            ">Join</button>
            <button id="joinRoomCancel" style="
                padding: 12px 24px;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 10px;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s ease;
            ">Cancel</button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Focus on input
    const input = modal.querySelector('#roomNameInput');
    input.focus();

    // Handle Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const roomName = input.value.trim();
            if (roomName) {
                socket.emit('joinRoom', { room: roomName });
                modal.remove();
            }
        }
    });

    // Handle confirm button
    modal.querySelector('#joinRoomConfirm').addEventListener('click', () => {
        const roomName = input.value.trim();
        if (roomName) {
            socket.emit('joinRoom', { room: roomName });
            modal.remove();
        }
    });

    // Handle cancel button
    modal.querySelector('#joinRoomCancel').addEventListener('click', () => {
        modal.remove();
    });

    // Handle click outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Handle leave room
 */
function handleLeaveRoom() {
    socket.emit('leaveRoom');
}

/**
 * Handle generate invite
 */
function handleGenerateInvite() {
    console.log('🎫 Generating invite code...');
    socket.emit('generateInviteCode', { isPermanent: false });
}

/**
 * Handle chat message form submission
 * @param {Event} e - Form submit event
 */
function handleChatMessage(e) {
    e.preventDefault();
    console.log('💬 Handling chat message submission');
    
    // Determine what chat to send message to based on what room is visible
    let roomName = "Global";
    const globalChatDiv = document.getElementById('globalChatDiv');
    const roomChatDiv = document.getElementById('roomChatDiv');
    
    // If room chat is visible and global chat is hidden, send to room
    if (globalChatDiv && roomChatDiv && 
        globalChatDiv.style.display === 'none' && 
        roomChatDiv.style.display !== 'none') {
        roomName = window.gameState?.currentRoom || "Global";
    }

    // Get message text
    let msg = e.target.elements.msg.value;
    msg = msg.trim();

    if (!msg) {
        console.log('❌ Empty message, not sending');
        return false;
    }
    
    // Clear input and refocus
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();

    console.log(`📤 Sending message to room: ${roomName}`);

    // Handle different message types
    if (msg[0] === '@') {
        // Private message: @username:message
        const colonIndex = msg.indexOf(':');
        if (colonIndex > 1) {
            socket.emit('privateMessage', {
                recipient: msg.slice(1, colonIndex),
                message: msg.slice(colonIndex + 1),
                room: roomName
            });
        }
    } else if (msg[0] === '.') {
        // Command message: .command
        socket.emit('commandMessage', {
            message: msg.replaceAll(".", ""),
            room: roomName
        });
    } else {
        // Regular chat message
        socket.emit('chatMessage', {
            msg: msg,
            room: roomName
        });
    }
}

/**
 * Handle before unload
 * @param {Event} e - Before unload event
 */
function handleBeforeUnload(e) {
    // Clean up resources
    if (socket) {
        socket.disconnect();
    }
}

/**
 * Handle window resize
 */
function handleWindowResize() {
    // Responsive adjustments
    updateCardVisibility();
}

/**
 * Update card visibility based on context
 */
function updateCardVisibility() {
    // This would update various UI cards based on current context
    console.log('🃏 Updating card visibility');
}

/**
 * Update admin status badge
 */
function updateAdminStatusBadge() {
    // This would show/hide admin badge
    console.log('👑 Updating admin status badge');
}

/**
 * Expose modules globally for backwards compatibility
 */
function exposeModulesGlobally() {
    console.log('🌐 Exposing modules globally');
    
    // Make modules available on window object for backwards compatibility
    window.gameUI = gameUI;
    window.modals = modals;
    window.socket = socket;
    
    // Legacy functions that might be called from existing code
    window.showSystemNotification = (title, message, type) => {
        modals.showGlassmorphismAlert(title, message, type);
    };
    
    window.showIncentiveBanner = (text) => {
        console.log('🎯 Incentive banner:', text);
        // Implementation would show incentive banner
    };
    
    window.updateLightningTestProgress = (data) => {
        console.log('⚡ Lightning test progress:', data);
        // Implementation would update lightning test progress
    };
    
    window.showLightningTestResults = (message, stats, duration) => {
        console.log('⚡ Lightning test results:', message, stats, duration);
        // Implementation would show lightning test results
    };
    
    // Core game state variables and functions from legacy client.js
    window.gameActive = false;
    window.selfId = null;
    
    // Sync currentRoom with utils.js
    window.currentRoom = currentRoom;
    
    window.currentActivePlayer = null;
    
    // Card visibility function (already implemented in this file)
    window.updateCardVisibility = updateCardVisibility;
    
    // Legacy game functions - will be set by legacy client.js if available
    window.resetGameVisuals = window.resetGameVisuals || function() {
        console.log('🔄 resetGameVisuals called but not implemented in modular version');
    };
    
    window.initializePlayerNamesInTracker = window.initializePlayerNamesInTracker || function(players) {
        console.log('🎯 initializePlayerNamesInTracker called but not implemented in modular version:', players);
    };
    
    // Expose Player constructor if available from legacy client.js
    window.Player = window.Player || {
        list: {}
    };
    
    // Room management functions
    window.handleCreateRoom = handleCreateRoom;
    window.handleJoinRoom = handleJoinRoom;
    window.handleLeaveRoom = handleLeaveRoom;
    window.handleGenerateInvite = handleGenerateInvite;
    
    // Admin/moderator functions
    window.initializeAdminFunctions = initializeAdminFunctions;
    window.setupModeratorMenuHandlers = setupModeratorMenuHandlers;
    window.initializeSwitchboardFunctions = initializeSwitchboardFunctions;
    
    // Start Experiment functions
    window.showStartExperimentConfirmation = showStartExperimentConfirmation;
    window.confirmStartExperiment = confirmStartExperiment;
    window.cancelStartExperiment = cancelStartExperiment;
    
    // Authentication module (also available as window.authModule from authentication.js)
    window.authentication = window.authModule;
    
    // Chat UI functions for socket handlers
    window.chatUI = {
        updateRoomUsers: function(room, users, usersCount) {
            console.log(`👥 Updating user count for ${room}: ${usersCount} users`);
            
            // Update user count display
            const userCountText = document.getElementById('header-user-count-text');
            if (userCountText) {
                userCountText.textContent = `${usersCount} online`;
            }
            
            // Show room UI when joining a room (not Global)
            if (room && room !== 'Global') {
                console.log(`🏠 Entering room: ${room} - showing room UI`);
                
                // Hide landing page
                const landingPage = document.getElementById('landingPage');
                if (landingPage) {
                    landingPage.style.display = 'none';
                }
                
                // Show chat container
                const chatContainer = document.getElementById('chat-container');
                if (chatContainer) {
                    chatContainer.style.display = '';
                }
                
                // Show game div (this is the main game UI)
                const gameDiv = document.getElementById('gameDiv');
                if (gameDiv) {
                    gameDiv.style.display = 'block';
                    console.log('🎮 Game div now visible');
                }
                
                // Update room name display if there's a room header
                const roomHeader = document.getElementById('room-name') || document.querySelector('.room-name');
                if (roomHeader) {
                    roomHeader.textContent = room;
                }
                
                // Update authentication module's current room
                if (window.authentication && window.authentication.setCurrentRoom) {
                    window.authentication.setCurrentRoom(room);
                }
            }
        },
        
        displayMessage: function(message) {
            console.log(`💬 Displaying message:`, message);
            console.log('🔍 Admin property value:', message.admin, 'Type:', typeof message.admin);
            console.log('🔍 Message from user:', message.username);
            console.log('🔍 Will show admin badge:', message.admin === true);
            
            // Handle broadcast messages (sent to all rooms)
            if (message.type === "broadcast") {
                console.log("📢 Processing broadcast message:", message);
                
                const div = document.createElement('div');
                div.id = message.username;
                div.classList.add('message', 'broadcast-message');
                
                // Special broadcast styling
                div.style.cssText = `
                    border: 2px solid #ff6b35;
                    border-radius: 8px;
                    background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(255, 140, 0, 0.1));
                    margin: 8px 0;
                    padding: 12px;
                    box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
                    position: relative;
                `;
                
                // Add broadcast icon
                const broadcastIcon = document.createElement('span');
                broadcastIcon.innerHTML = '📢';
                broadcastIcon.style.cssText = `
                    position: absolute;
                    top: -2px;
                    right: 8px;
                    font-size: 16px;
                    opacity: 0.7;
                `;
                div.appendChild(broadcastIcon);
                
                const p = document.createElement('p');
                p.classList.add('meta');
                p.innerText = "Server Broadcast";
                p.style.cssText = `
                    color: #ff6b35;
                    font-weight: bold;
                    font-size: 13px;
                    margin: 0 0 6px 0;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                `;
                div.appendChild(p);
                
                const para = document.createElement('p');
                para.classList.add('text');
                para.innerText = message.text;
                para.style.cssText = `
                    color: #ff6b35;
                    font-weight: 600;
                    font-size: 14px;
                    margin: 0;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                `;
                div.appendChild(para);
                
                // Add to both global and room chat
                const globalChatDiv = document.getElementById('globalChatDiv');
                const roomChatDiv = document.getElementById('roomChatDiv');
                
                if (globalChatDiv) {
                    const globalDiv = div.cloneNode(true);
                    globalChatDiv.appendChild(globalDiv);
                    globalChatDiv.scrollTop = globalChatDiv.scrollHeight;
                }
                
                if (roomChatDiv) {
                    const roomDiv = div.cloneNode(true);
                    roomChatDiv.appendChild(roomDiv);
                    roomChatDiv.scrollTop = roomChatDiv.scrollHeight;
                }
                
                return;
            }
            
            // Determine chat container based on room
            let chatContainer;
            if (message.room === "Global") {
                chatContainer = document.getElementById('globalChatDiv');
            } else {
                chatContainer = document.getElementById('roomChatDiv');
            }
            
            if (!chatContainer) {
                console.error('❌ Chat container not found for room:', message.room);
                return;
            }
            
            // Check if we can combine with previous message from same user
            if (chatContainer.childNodes.length >= 1) {
                let lastMessage = chatContainer.lastElementChild;
                if (lastMessage && lastMessage.id === message.username) {
                    const para = document.createElement('p');
                    para.classList.add('text');
                    para.innerText = message.text;
                    
                    // Apply message type styling
                    switch (message.type) {
                        case "status":
                            para.style.color = "green";
                            break;
                        case "pm":
                            para.style.color = "magenta";
                            break;
                    }
                    
                    lastMessage.appendChild(para);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                    return;
                }
            }
            
            // Create new message div
            const div = document.createElement('div');
            div.id = message.username;
            div.classList.add('message');
            
            // Create username/meta element
            const p = document.createElement('p');
            p.classList.add('meta');
            p.innerText = message.username;
            
            // Add admin indicator if needed
            if (message.admin === true) {
                p.style.color = "magenta";
                p.innerText = message.username + "  (admin)";
            }
            
            // Add timestamp
            p.innerHTML += `<span>  ${message.time}</span>`;
            p.style.fontSize = "12px";
            div.appendChild(p);
            
            // Create message text element
            const para = document.createElement('p');
            para.classList.add('text');
            para.innerText = message.text;
            
            // Apply message type styling
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
            
            div.appendChild(para);
            chatContainer.appendChild(div);
            
            // Auto-scroll
            chatContainer.scrollTop = chatContainer.scrollHeight;
        },
        
        updatePlayersInRoom: function(data) {
            console.log(`🎮 Players in room ${data.room}:`, data.players);
            console.log('🔍 DETAILED PLAYERS DATA:', JSON.stringify(data.players, null, 2));
            console.log('🔍 Player count:', data.players?.length || 0);
            console.log('🔍 Player usernames:', data.players?.map(p => p.username) || []);
            
            // Update moderator name display (original logic)
            const moderator = data.players?.find(p => p.isModerator) || data.players?.[0];
            console.log('👑 Found moderator:', moderator);
            
            if (moderator) {
                const moderatorDiv = document.getElementById('moderatorPosition');
                console.log('👑 ModeratorPosition element:', moderatorDiv);
                
                if (moderatorDiv) {
                    const moderatorNameDiv = moderatorDiv.querySelector('.moderator-name');
                    console.log('👑 ModeratorName div:', moderatorNameDiv);
                    console.log('👑 Current moderator name in div:', moderatorNameDiv?.textContent);
                    
                    if (moderatorNameDiv) {
                        // Always update moderator name when we get new moderator data
                        moderatorNameDiv.textContent = moderator.username;
                        console.log('👑 Updated moderator name to:', moderator.username);
                        console.log('👑 ModeratorName div content now:', moderatorNameDiv.textContent);
                    } else {
                        console.warn('👑 .moderator-name element not found inside moderatorPosition');
                    }
                } else {
                    console.warn('👑 moderatorPosition element not found');
                }
            } else {
                console.warn('👑 No moderator found in players data');
            }
            
            // Add a small delay to ensure we process the most recent moderator status
            // Server sends multiple playersInRoom events, we want the final one
            setTimeout(() => {
                const currentUsername = window.authModule?.getCurrentUsername();
                console.log('🔍 Checking moderator status for:', currentUsername, 'in players:', data.players);
                const currentPlayer = data.players?.find(p => p.username === currentUsername);
                console.log('🔍 Current player found:', currentPlayer);
            
            // Update poker table - create gameSession if needed
            if (window.gameUI && window.gameUI.updatePokerTable) {
                let gameSessionForTable = data.gameSession;
                
                // If no gameSession, create a mock one from players data
                if (!gameSessionForTable && data.players && data.players.length > 0) {
                    console.log('🃏 Creating mock gameSession from players data');
                    gameSessionForTable = {
                        players: data.players,
                        currentRound: 0
                    };
                }
                
                if (gameSessionForTable && gameSessionForTable.players) {
                    console.log('🃏 Updating poker table from playersInRoom event');
                    window.gameUI.updatePokerTable(gameSessionForTable);
                } else {
                    console.warn('❌ No players data available for poker table');
                }
            } else {
                console.warn('❌ gameUI.updatePokerTable not available');
            }

            if (currentPlayer && currentPlayer.isModerator) {
                console.log('👑 Current user is moderator - showing moderator UI');
                
                // Show moderator switchboard
                const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
                if (moderatorSwitchboard) {
                    // Force visibility with important styles
                    moderatorSwitchboard.style.display = 'block';
                    moderatorSwitchboard.style.visibility = 'visible';
                    moderatorSwitchboard.style.opacity = '1';
                    moderatorSwitchboard.style.position = 'relative';
                    moderatorSwitchboard.style.zIndex = '1000';
                    

                    
                    // Create moderator buttons for pre-game
                    createModeratorButtons();
                    
                    console.log('✅ Moderator switchboard shown');
                    console.log('🔍 Switchboard element:', moderatorSwitchboard);
                    console.log('🔍 Switchboard computed styles:', window.getComputedStyle(moderatorSwitchboard));
                } else {
                    console.log('❌ moderatorSwitchboard element not found');
                    console.log('🔍 Available elements with "moderator" in ID:');
                    const allElements = document.querySelectorAll('[id*="moderator"]');
                    allElements.forEach(el => console.log('  -', el.id, el));
                }
                
                // Initialize admin functions for moderator
                if (window.initializeAdminFunctions) {
                    window.initializeAdminFunctions();
                    console.log('✅ Admin functions initialized');
                } else {
                    console.log('❌ initializeAdminFunctions not available');
                }
                
                // Setup moderator menu handlers
                if (window.setupModeratorMenuHandlers) {
                    window.setupModeratorMenuHandlers();
                    console.log('✅ Moderator menu handlers setup');
                } else {
                    console.log('❌ setupModeratorMenuHandlers not available');
                }
            } else {
                console.log('ℹ️ Current user is not a moderator - hiding moderator UI');
                
                // Hide moderator switchboard
                const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
                if (moderatorSwitchboard) {
                    moderatorSwitchboard.style.display = 'none';
                }
            }
            }, 100); // Close setTimeout with 100ms delay
        },
        
        handleRoomCreated: function(roomName) {
            console.log(`🏠 Room created and joined: ${roomName}`);
            
            // Update current room state
            setState.setCurrentRoom(roomName);
            if (window.authentication && window.authentication.setCurrentRoom) {
                window.authentication.setCurrentRoom(roomName);
            }
            
            // Set moderator name immediately for room creator (with retry logic)
            let retryCount = 0;
            const setModeratorName = () => {
                const currentUsername = window.authModule?.getCurrentUsername() || localStorage.getItem('username');
                console.log('👑 Room creator username attempt', retryCount + 1, ':', currentUsername);
                
                if (currentUsername) {
                    const moderatorDiv = document.getElementById('moderatorPosition');
                    console.log('👑 ModeratorPosition element:', moderatorDiv);
                    
                    if (moderatorDiv) {
                        const moderatorNameDiv = moderatorDiv.querySelector('.moderator-name');
                        console.log('👑 ModeratorName div:', moderatorNameDiv);
                        
                        if (moderatorNameDiv) {
                            moderatorNameDiv.textContent = currentUsername;
                            console.log('👑 ✅ Set room creator as moderator:', currentUsername);
                            console.log('👑 Moderator name div content:', moderatorNameDiv.textContent);
                            return; // Success, no need to retry
                        } else {
                            console.warn('👑 .moderator-name element not found');
                        }
                    } else {
                        console.warn('👑 moderatorPosition element not found');
                    }
                } else {
                    console.warn('👑 No current username found for room creator');
                }
                
                // Retry up to 3 times with increasing delays
                if (retryCount < 3) {
                    retryCount++;
                    setTimeout(setModeratorName, 300 * retryCount);
                }
            };
            
            setTimeout(setModeratorName, 100);
            
            // Show game interface immediately when moderator creates room (original logic)
            showGameInterface(roomName);
            
            // No confirmation popup - jump straight into the room
            console.log(`✅ Room ${roomName} created and joined successfully`);
            
            // The room creator automatically joins their own room, so the server 
            // will send a 'joinRoom' event which will trigger the proper room setup
        },

        handleJoinRoom: function(room) {
            // The server may send a string ("Global") or an object ({ room: 'Global' })
            const roomName = (typeof room === 'object' && room && room.room) ? room.room : room;
            console.log('🔄 Joined room:', roomName);
            
            // Update current room tracking
            setState.setCurrentRoom(roomName);
            if (window.authentication && window.authentication.setCurrentRoom) {
                window.authentication.setCurrentRoom(roomName);
            }
            
            // Update room name display (original logic)
            const roomNameText = document.getElementById('roomNameText');
            if (roomName !== 'Global') {
                if (roomNameText) {
                    roomNameText.innerText = roomName;
                    roomNameText.style.display = "";
                    roomNameText.style.backgroundColor = "green";
                    console.log('✅ Updated room name display to:', roomName);
                } else {
                    console.log('❌ roomNameText element not found');
                }
                
                // Show game interface immediately when joining a room (original logic)
                showGameInterface(roomName);
                console.log('🎮 Showing game board for player joining room');
            } else {
                console.log('🌐 Joined Global - staying in chat interface');
                
                // Clear room name display for Global
                if (roomNameText) {
                    roomNameText.innerText = '';
                    roomNameText.style.display = 'none';
                    roomNameText.style.backgroundColor = '';
                }
            }
        }
    };
}

/**
 * Show game interface (equivalent to original showGameInterface function)
 * @param {string} roomName - Room name
 */
function showGameInterface(roomName) {
    console.log('🎮 showGameInterface() called for room:', roomName);
    
    // Only show game interface for non-Global rooms
    if (roomName === 'Global' || !roomName) {
        console.log('🚫 Not showing game interface - user is in Global chat or no room');
        return;
    }
    
    const gameDiv = document.getElementById('gameDiv');
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chat-container');
    
    console.log('gameDiv found:', !!gameDiv);
    console.log('landingPage found:', !!landingPage);
    console.log('chatContainer found:', !!chatContainer);
    
    // Hide landing page if it exists
    if (landingPage) {
        landingPage.style.display = 'none';
        console.log('Landing page hidden');
    }
    
    // Show both chat and game interfaces for rooms
    if (chatContainer) {
        chatContainer.style.display = 'block';
        console.log('✅ Chat container displayed');
    }
    
    if (gameDiv) {
        gameDiv.style.display = 'block';
        console.log('✅ Game interface displayed');
        
        // Request room state after showing interface (original logic)
        setTimeout(() => {
            console.log('🔍 Requesting room state for:', roomName);
            socket.emit('requestRoomState', { room: roomName });
            
            // Also request game state if there's an active game
            console.log('🎮 Requesting game state for:', roomName);
            socket.emit('requestGameState', { room: roomName });
        }, 100);
    } else {
        console.log('❌ gameDiv not found!');
    }
}

/**
 * Show initialization error
 * @param {Error} error - Error that occurred
 */
function showInitializationError(error) {
    console.error('💥 Initialization error:', error);
    
    // Create error display
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, rgba(244, 67, 54, 0.9), rgba(183, 28, 28, 0.9));
        color: white;
        padding: 30px;
        border-radius: 20px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(20px);
    `;
    
    errorDiv.innerHTML = `
        <h2 style="margin: 0 0 20px 0;">⚠️ Initialization Failed</h2>
        <p style="margin: 0 0 20px 0;">The application failed to start properly.</p>
        <p style="margin: 0 0 20px 0; font-family: monospace; font-size: 12px; opacity: 0.8;">${error.message}</p>
        <button onclick="window.location.reload()" style="
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 10px 20px;
            border-radius: 10px;
            cursor: pointer;
        ">Refresh Page</button>
    `;
    
    document.body.appendChild(errorDiv);
}

/**
 * Show Start Experiment confirmation modal
 */
function showStartExperimentConfirmation() {
    // Prevent multiple modals
    if (document.getElementById('startExperimentConfirmModal')) {
        return;
    }
    
    const modalHTML = `
        <div id="startExperimentConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
            backdrop-filter: blur(8px);
        ">
            <div style="
                background: linear-gradient(135deg, rgba(20, 25, 35, 0.95) 0%, rgba(30, 40, 55, 0.95) 100%);
                border: 2px solid rgba(34, 197, 94, 0.4);
                border-radius: 20px;
                padding: 30px;
                max-width: 450px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 
                    0 25px 50px rgba(0, 0, 0, 0.7),
                    0 12px 25px rgba(34, 197, 94, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                transform-origin: center bottom;
            ">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="
                        font-size: 48px;
                        margin-bottom: 16px;
                        color: #22c55e;
                        text-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
                        filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
                    ">🚀</div>
                    
                    <h2 style="
                        color: #22c55e;
                        margin: 0 0 8px 0;
                        font-size: 24px;
                        font-weight: 700;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">Start Experiment</h2>
                    
                    <p style="
                        color: rgba(255, 255, 255, 0.8);
                        margin: 0;
                        font-size: 16px;
                        line-height: 1.4;
                    ">Ready to begin the behavioral experiment?</p>
                </div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 2px solid rgba(34, 197, 94, 0.4);
                    border-radius: 16px;
                    padding: 24px;
                    margin: 25px 0;
                    backdrop-filter: blur(12px);
                ">
                    <div style="
                        color: rgba(255, 255, 255, 0.9);
                        font-size: 15px;
                        line-height: 1.6;
                        margin-bottom: 16px;
                    ">
                        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <span style="color: #22c55e; font-size: 16px;">✅</span>
                            <span>All players will enter the experiment phase</span>
                        </div>
                        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <span style="color: #22c55e; font-size: 16px;">⏱️</span>
                            <span>Timer and rounds will begin automatically</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #22c55e; font-size: 16px;">🎯</span>
                            <span>Experiment settings will be locked in</span>
                        </div>
                    </div>
                    
                    <div style="
                        background: rgba(34, 197, 94, 0.1);
                        border: 1px solid rgba(34, 197, 94, 0.3);
                        border-radius: 12px;
                        padding: 16px;
                        color: rgba(255, 255, 255, 0.85);
                        font-size: 14px;
                        line-height: 1.5;
                    ">
                        <strong style="color: #22c55e;">Note:</strong> Once started, the experiment cannot be paused or modified. Make sure all settings are configured correctly.
                    </div>
                </div>
                
                <div style="
                    display: flex;
                    gap: 16px;
                    margin-top: 30px;
                ">
                    <button onclick="cancelStartExperiment()" style="
                        background: rgba(30, 30, 30, 0.8);
                        color: rgba(255, 255, 255, 0.8);
                        padding: 16px 28px;
                        border: 2px solid rgba(100, 100, 100, 0.4);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s ease;
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    ">
                        <span style="font-size: 14px;">❌</span>
                        Cancel
                    </button>
                    
                    <button onclick="confirmStartExperiment()" style="
                        background: linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(22, 163, 74, 0.95) 100%);
                        color: white;
                        padding: 16px 28px;
                        border: 2px solid rgba(34, 197, 94, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 700;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(34, 197, 94, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                    ">
                        <span style="font-size: 14px;">🚀</span>
                        Start Experiment
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Confirm Start Experiment
 */
function confirmStartExperiment() {
    console.log('🚀 Starting experiment with confirmation');
    
    // Close the confirmation modal
    cancelStartExperiment();
    
    // Emit start game event to server
    const room = currentRoom || window.authModule?.getCurrentRoom() || 'Global';
    socket.emit('startGame', { 
        room: room,
        experimentMode: 'conditions'
    });
    
    // Hide UI elements after starting
    const startBtn = document.getElementById('startExperimentBtn');
    if (startBtn) {
        startBtn.style.display = 'none';
    }
    
    // Hide Add AI button if it exists
    const addAIBtn = document.getElementById('addAIBtn');
    if (addAIBtn) {
        addAIBtn.style.display = 'none';
    }
    
    console.log('🚀 Experiment start request sent to server for room:', room);
}

/**
 * Cancel Start Experiment
 */
function cancelStartExperiment() {
    const modal = document.getElementById('startExperimentConfirmModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Create moderator buttons for pre-game phase
 */
function createModeratorButtons() {
    const startExperimentBtn = document.getElementById('startExperimentBtn');
    if (!startExperimentBtn) {
        console.log('❌ startExperimentBtn not found - cannot create moderator buttons');
        return;
    }

    // Show Start Experiment button
    startExperimentBtn.style.display = 'block';
    console.log('✅ Showing Start Experiment button for moderator');

    // Add event listener for Start Experiment button (if not already added)
    if (!startExperimentBtn.hasEventListener) {
        startExperimentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🚀 Start experiment button clicked - showing confirmation');
            showStartExperimentConfirmation();
        });
        startExperimentBtn.hasEventListener = true;
        console.log('✅ Added Start Experiment button event listener');
    }

    // Create Add AI button if it doesn't exist
    let addAIBtn = document.getElementById('addAIBtn');
    if (!addAIBtn) {
        addAIBtn = document.createElement('button');
        addAIBtn.id = 'addAIBtn';
        addAIBtn.textContent = '🤖 Add AI Players';
        addAIBtn.style.cssText = 'background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%); color: white; padding: 10px 20px; font-size: 16px; border: none; border-radius: 6px; cursor: pointer; margin-left: 10px; font-weight: 600; box-shadow: 0 2px 8px rgba(88, 101, 242, 0.3); transition: all 0.2s ease;';
        
        // Add hover effects
        addAIBtn.addEventListener('mouseover', () => {
            addAIBtn.style.transform = 'translateY(-1px)';
            addAIBtn.style.boxShadow = '0 4px 12px rgba(88, 101, 242, 0.4)';
        });
        addAIBtn.addEventListener('mouseout', () => {
            addAIBtn.style.transform = 'translateY(0)';
            addAIBtn.style.boxShadow = '0 2px 8px rgba(88, 101, 242, 0.3)';
        });
        
        startExperimentBtn.parentNode.appendChild(addAIBtn);
        
        // Add event listener for Add AI button
        addAIBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🤖 Add AI Players button clicked');
            console.log('🤖 Current room for AI:', currentRoom);
            
            // Emit request to server to add AI players
            socket.emit('addAIPlayers', { 
                room: currentRoom || 'Global'
            });
            
            // Provide user feedback
            addAIBtn.textContent = 'Adding AI Players...';
            addAIBtn.disabled = true;
            
            // Re-enable after a short delay
            setTimeout(() => {
                addAIBtn.textContent = '🤖 Add AI Players';
                addAIBtn.disabled = false;
            }, 2000);
        });
        
        console.log('✅ Created Add AI Players button for moderator');
    } else {
        addAIBtn.style.display = 'block';
        console.log('✅ Showing Add AI Players button for moderator');
    }

    // Create Lightning Test button if it doesn't exist (admin only)
    const currentUsername = window.authModule?.getCurrentUsername();
    const isCurrentUserAdmin = window.authModule?.isGlobalAdmin() || false;
    console.log('⚡ Checking admin status for lightning button:', currentUsername, 'isAdmin:', isCurrentUserAdmin);
    
    let lightningBtn = document.getElementById('lightningBtn');
    
    // Only show lightning button for admins
    if (isCurrentUserAdmin && !lightningBtn) {
        lightningBtn = document.createElement('button');
        lightningBtn.id = 'lightningBtn';
        lightningBtn.textContent = '⚡ Lightning Test';
        lightningBtn.style.cssText = 'background: linear-gradient(135deg, #c026d3 0%, #7c3aed 100%); color: white; padding: 8px 16px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; margin-left: 8px; font-weight: 500; box-shadow: 0 2px 8px rgba(192, 38, 211, 0.3); transition: all 0.2s ease;';
        
        // Add hover effects
        lightningBtn.addEventListener('mouseover', () => {
            lightningBtn.style.transform = 'translateY(-1px)';
            lightningBtn.style.boxShadow = '0 4px 12px rgba(192, 38, 211, 0.4)';
        });
        lightningBtn.addEventListener('mouseout', () => {
            lightningBtn.style.transform = 'translateY(0)';
            lightningBtn.style.boxShadow = '0 2px 8px rgba(192, 38, 211, 0.3)';
        });
        
        startExperimentBtn.parentNode.appendChild(lightningBtn);
        
        // Add event listener for Lightning Experiment button
        lightningBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('⚡ Lightning Test button clicked');
            
            // Call the imported function directly
            showLightningExperimentConfirmation();
        });
        
        console.log('✅ Created Lightning Experiment button for admin');
    } else if (isCurrentUserAdmin && lightningBtn) {
        lightningBtn.style.display = 'block';
        console.log('✅ Showing Lightning Experiment button for admin');
    } else if (!isCurrentUserAdmin && lightningBtn) {
        lightningBtn.style.display = 'none';
        console.log('🚫 Hiding Lightning Experiment button from non-admin user');
    }
}

// Export main functions
export default {
    initializeApp,
    handleSignIn,
    handleSignUp,
    handleCreateRoom,
    handleJoinRoom,
    handleLeaveRoom
};