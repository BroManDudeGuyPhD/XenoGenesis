// Token Pool Configuration Constants (must match server-side)
const TOKEN_CONFIG = {
    BASELINE_TOKENS: 100, // Legacy - no longer used
    CONDITIONS_TOKENS: 1250, // Updated from 2500
    MAX_TOKENS: 1250  // Maximum for validation and UI limits (updated from 2500)
};

// Store user admin status globally so we can use it for invite visibility
let isGlobalAdmin = false;

// Global function to update token pool display
function updateTokenPoolDisplay(currentTokens, maxTokens) {
    // Ensure gameDiv is visible so we can access the token pool elements
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv && (gameDiv.style.display === 'none' || gameDiv.style.display === '')) {
        gameDiv.style.display = 'inline-block';
    }
    
    const globalTokenPoolElement = document.getElementById('globalTokenPool');
    const tokenPoolMaxElement = document.getElementById('tokenPoolMax');
    const tokenPoolBar = document.getElementById('tokenPoolBar');
    
    if (globalTokenPoolElement) {
        globalTokenPoolElement.textContent = currentTokens;
    }
    
    if (tokenPoolMaxElement && maxTokens) {
        tokenPoolMaxElement.textContent = `/${maxTokens}`;
    }
    
    // Update progress bar if it exists
    if (tokenPoolBar && maxTokens > 0) {
        const percentage = (currentTokens / maxTokens) * 100;
        tokenPoolBar.style.width = `${percentage}%`;
    }
}

// Function to determine current menu context
function getMenuContext() {
    // Check if we're in an active game
    const isInGame = gameActive || document.body.classList.contains('game-active');
    
    // Check if we're in global chat (not in a room and not in game)
    const isInGlobalChat = currentRoom === 'Global' && !isInGame;
    
    // Check if we're in a room but not in an active game  
    const isInRoomLobby = currentRoom !== 'Global' && !isInGame;
    
    return {
        isInGame,
        isInGlobalChat, 
        isInRoomLobby,
        context: isInGame ? 'game' : (isInGlobalChat ? 'global' : 'room')
    };
}

// Function to update card visibility based on menu context
function updateCardVisibility() {
    const menuContext = getMenuContext();
    const createCard = document.getElementById('create-card');
    const joinCard = document.getElementById('join-card');
    const inviteCard = document.getElementById('invite-card');
    
    // Check if admin status was set early from session data - but don't override login response
    if (window.isGlobalAdmin !== undefined && window.isGlobalAdmin === true && isGlobalAdmin !== window.isGlobalAdmin) {
        isGlobalAdmin = window.isGlobalAdmin;
    }
    
    // Create and Join cards should only show in global chat context
    if (createCard && joinCard) {
        if (menuContext.isInGlobalChat) {
            // Show create/join in global chat
            createCard.classList.remove('card-hidden');
            createCard.classList.add('card-visible');
            joinCard.classList.remove('card-hidden'); 
            joinCard.classList.add('card-visible');
        } else {
            // Hide create/join in game or room contexts
            createCard.classList.remove('card-visible');
            createCard.classList.add('card-hidden');
            joinCard.classList.remove('card-visible');
            joinCard.classList.add('card-hidden');
        }
    }
    
    // Update invite visibility
    updateInviteVisibility();
}

// Function to update invite card visibility based on admin status only
function updateInviteVisibility() {
    const inviteCard = document.getElementById('invite-card');
    const inviteFab = document.getElementById('invite-fab');
    const menuContext = getMenuContext();
    
    // Show invite options ONLY if user is a global admin
    // Removed moderator access - invite cards are admin-only feature
    let shouldShowInvite = false;
    
    if (isGlobalAdmin && (menuContext.isInGlobalChat || menuContext.isInRoomLobby)) {
        shouldShowInvite = true; // Global admin in global chat or room lobby
    }
    // Note: Never show invite during active games
    
    if (inviteCard) {
        if (shouldShowInvite) {
            inviteCard.classList.remove('invite-hidden');
            inviteCard.classList.add('invite-visible');
            inviteCard.style.display = 'block';
            inviteCard.style.visibility = 'visible';
            inviteCard.style.opacity = '1';
        } else {
            inviteCard.classList.remove('invite-visible');
            inviteCard.classList.add('invite-hidden');
            inviteCard.style.display = 'none';
        }
    }
    
    if (inviteFab) {
        inviteFab.style.display = shouldShowInvite ? 'block' : 'none';
    }
    
    // Also update admin build status badge visibility
    updateAdminStatusBadge();
}

// Function to show/hide admin build status badge
function updateAdminStatusBadge() {
    const adminBuildPill = document.getElementById('admin-build-pill');
    
    if (adminBuildPill) {
        if (isGlobalAdmin) {
            adminBuildPill.style.display = 'flex';
        } else {
            adminBuildPill.style.display = 'none';
        }
    }
}

// Function to check if current user is moderator of current room
function isCurrentRoomModerator() {
    // This will be set by the playersInRoom handler
    return window.currentUserIsModerator || false;
}
const socket = io();

// Store pending token updates to apply after players return to poker table positions
let pendingTokenUpdates = null;

// Baseline exit tracking
let previousCondition = null;
let currentRoundNumber = 0;
let domLoaded = false;
let pendingSessionRestore = null;

// Signin debounce to prevent double-submission
let signinInProgress = false;

// Global handleSignIn function
function handleSignIn(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent multiple rapid signin attempts
    if (signinInProgress) {
        return;
    }
    
    const signDivUsername = document.getElementById('username');
    const signDivPassword = document.getElementById('password');
    const signDivSignIn = document.getElementById('signIn');
        
    if (signDivUsername && signDivPassword && signDivUsername.value && signDivPassword.value) {
        signinInProgress = true;
        
        // Simple visual feedback
        if (signDivSignIn) {
            signDivSignIn.style.background = '#16a34a';
            signDivSignIn.textContent = 'Logging in...';
        }
        
        socket.emit('signIn', { 
            username: signDivUsername.value, 
            password: signDivPassword.value 
        });
        
        // Close modal
        const modal = document.getElementById('id01');
        if (modal) modal.style.display = "none";
        
        // Reset button after delay
        setTimeout(() => {
            signinInProgress = false;
            if (signDivSignIn) {
                signDivSignIn.style.background = '#22c55e';
                signDivSignIn.innerHTML = '<span style="font-size: 12px;">🔐</span> Login';
            }
        }, 2000);
        
    } else {
        console.error('❌ Username or password missing!');
        alert('Please enter both username and password');
    }
}

// Socket connection monitoring
socket.on('disconnect', function() {
    console.error('❌ Socket disconnected from server');
});

socket.on('reconnect', function() {
    console.log('Socket reconnected to server (no forced session restore)');
    // Reconnects now happen silently; session is only restored on initial page load or explicit refresh.
    // Server preserves game state for reconnecting players automatically via socket.id matching.
});

// Handle session restoration
socket.on('sessionRestored', function(data) {
    if (data.success) {
        // If DOM isn't loaded yet, store the session data for later
        if (!domLoaded) {
            pendingSessionRestore = data;
            return;
        }
        
        // Store player position if provided by server
        if (data.playerPosition) {
            console.log('📍 Server provided player position:', data.playerPosition);
            window.storedPlayerPosition = data.playerPosition;
        }
        
        performSessionRestore(data);
    }
});

// Handle session invalid (expired/missing)
socket.on('sessionInvalid', function(data) {
    // Clear any cached session data
    currentUsername = null;
    currentRoom = null;
    
    // Only show alert and reset UI if we're not already on the login screen
    if (domLoaded) {
        const landingPage = document.getElementById('landingPage');
        const chatContainer = document.getElementById('chatContainer');
        const gameDiv = document.getElementById('gameDiv');
        
        // Check if user is already on login screen (landingPage visible)
        const isOnLoginScreen = landingPage && landingPage.style.display !== 'none';
        
        if (!isOnLoginScreen) {
            // User was trying to access game content, show alert and reset UI
            if (landingPage) landingPage.style.display = 'block';
            if (chatContainer) chatContainer.style.display = 'none';
            if (gameDiv) gameDiv.style.display = 'none';
            
            // Show custom session expired modal to user
            showSessionExpiredModal();
        }
        // If user is already on login screen, don't show alert - they probably just refreshed
    }
});

// Function to create and show a glassmorphism session expired modal
function showSessionExpiredModal() {
    const modalHTML = `
        <div id="sessionExpiredModal" class="modal" style="
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: block;
            z-index: 10000;
        ">
            <div class="modal-content animate" style="
                max-width: 420px;
                background: linear-gradient(145deg, 
                    rgba(43, 45, 59, 0.98) 0%, 
                    rgba(54, 57, 63, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 8px 32px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                margin: 10% auto;
                position: relative;
            ">
                <div class="imgcontainer" style="text-align: center; padding: 20px 20px 0 20px;">
                    <span onclick="closeSessionExpiredModal()" 
                          class="close"
                          title="Close Modal"
                          style="
                              position: absolute;
                              top: 15px;
                              right: 20px;
                              color: #b9bbbe;
                              font-size: 28px;
                              font-weight: bold;
                              cursor: pointer;
                              transition: all 0.2s ease;
                          "
                          onmouseover="this.style.color='#ffffff'; this.style.transform='scale(1.1)'"
                          onmouseout="this.style.color='#b9bbbe'; this.style.transform='scale(1)'">&times;</span>
                </div>

                <div class="container" style="text-align: center; padding: 30px;">
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        margin-bottom: 8px;
                    ">
                        <div style="
                            width: 3px;
                            height: 3px;
                            background: linear-gradient(135deg, #f39c12, #e67e22);
                            border-radius: 50%;
                            animation: subtlePulse 2s infinite;
                        "></div>
                        <h3 style="
                            color: #dcddde; 
                            font-weight: 600; 
                            font-size: 20px;
                            margin: 0;
                            background: linear-gradient(135deg, #e74c3c, #f39c12);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                        ">Session Expired</h3>
                        <div style="
                            width: 3px;
                            height: 3px;
                            background: linear-gradient(135deg, #f39c12, #e67e22);
                            border-radius: 50%;
                            animation: subtlePulse 2s infinite;
                        "></div>
                    </div>
                    
                    <div style="
                        font-size: 48px;
                        margin-bottom: 16px;
                        opacity: 0.8;
                    ">🔒</div>
                    
                    <p style="
                        color: #b9bbbe; 
                        margin-bottom: 24px; 
                        font-size: 14px;
                        opacity: 0.9;
                        line-height: 1.5;
                    ">Your session has expired for security purposes.<br>Please log in again to continue.</p>
                    
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button type="button" 
                                onclick="closeSessionExpiredModal(); document.getElementById('id01').style.display='block';"
                                style="
                                    background: linear-gradient(135deg, rgba(67, 181, 129, 0.9) 0%, rgba(52, 168, 107, 0.9) 100%);
                                    color: white;
                                    padding: 12px 20px;
                                    border: none;
                                    border-radius: 7px;
                                    cursor: pointer;
                                    font-weight: 500;
                                    font-size: 14px;
                                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                                    box-shadow: 0 3px 8px rgba(67, 181, 129, 0.3);
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                "
                                onmouseover="
                                    this.style.background='linear-gradient(135deg, rgba(52, 168, 107, 0.95) 0%, rgba(39, 174, 96, 0.95) 100%)';
                                    this.style.transform='translateY(-1px)';
                                    this.style.boxShadow='0 4px 12px rgba(67, 181, 129, 0.4)';
                                "
                                onmouseout="
                                    this.style.background='linear-gradient(135deg, rgba(67, 181, 129, 0.9) 0%, rgba(52, 168, 107, 0.9) 100%)';
                                    this.style.transform='translateY(0)';
                                    this.style.boxShadow='0 3px 8px rgba(67, 181, 129, 0.3)';
                                ">
                            <span style="font-size: 12px;">🔑</span>
                            Log In Again
                        </button>
                        <button type="button" 
                                onclick="closeSessionExpiredModal()"
                                style="
                                    background: rgba(114, 118, 125, 0.15);
                                    color: #b9bbbe;
                                    padding: 12px 20px;
                                    border: 1px solid rgba(114, 118, 125, 0.4);
                                    border-radius: 7px;
                                    cursor: pointer;
                                    font-size: 14px;
                                    font-weight: 500;
                                    transition: all 0.2s ease;
                                    backdrop-filter: blur(10px);
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                "
                                onmouseover="
                                    this.style.background='rgba(114, 118, 125, 0.25)';
                                    this.style.color='#dcddde';
                                    this.style.borderColor='rgba(114, 118, 125, 0.6)';
                                    this.style.transform='translateY(-1px)';
                                "
                                onmouseout="
                                    this.style.background='rgba(114, 118, 125, 0.15)';
                                    this.style.color='#b9bbbe';
                                    this.style.borderColor='rgba(114, 118, 125, 0.4)';
                                    this.style.transform='translateY(0)';
                                ">
                            <span style="font-size: 12px;">✖️</span>
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to close the session expired modal
function closeSessionExpiredModal() {
    const modal = document.getElementById('sessionExpiredModal');
    if (modal) {
        modal.remove();
    }
}

// Function to create and show a glassmorphism alert modal
function showGlassmorphismAlert(title, message, type = 'info', onConfirm = null) {
    // Remove any existing alert modal
    const existingModal = document.getElementById('glassmorphismAlertModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Set colors and icons based on type
    let gradient, icon;
    switch(type) {
        case 'success':
            gradient = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            icon = '✅';
            break;
        case 'error':
            gradient = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            icon = '❌';
            break;
        case 'warning':
            gradient = 'linear-gradient(135deg, #f39c12, #e67e22)';
            icon = '⚠️';
            break;
        default:
            gradient = 'linear-gradient(135deg, #667aff, #7386ff)';
            icon = 'ℹ️';
            break;
    }

    const modalHTML = `
        <div id="glassmorphismAlertModal" class="modal" style="
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: block;
            z-index: 10001;
        ">
            <div class="modal-content animate" style="
                max-width: 400px;
                background: linear-gradient(145deg, 
                    rgba(43, 45, 59, 0.98) 0%, 
                    rgba(54, 57, 63, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 8px 32px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                margin: 15% auto;
                position: relative;
            ">
                <div class="container" style="text-align: center; padding: 30px;">
                    <div style="
                        font-size: 36px;
                        margin-bottom: 12px;
                        opacity: 0.9;
                    ">${icon}</div>
                    
                    <h3 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        font-size: 18px;
                        margin: 0 0 12px 0;
                        background: ${gradient};
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    ">${title}</h3>
                    
                    <p style="
                        color: #b9bbbe; 
                        margin-bottom: 24px; 
                        font-size: 14px;
                        opacity: 0.9;
                        line-height: 1.4;
                    ">${message}</p>
                    
                    <button type="button" 
                            onclick="closeGlassmorphismAlert(); ${onConfirm ? onConfirm : ''}"
                            style="
                                background: ${gradient};
                                color: white;
                                padding: 10px 20px;
                                border: none;
                                border-radius: 7px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 14px;
                                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                margin: 0 auto;
                            "
                            onmouseover="
                                this.style.transform='translateY(-1px)';
                                this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)';
                            "
                            onmouseout="
                                this.style.transform='translateY(0)';
                                this.style.boxShadow='0 3px 8px rgba(0, 0, 0, 0.3)';
                            ">
                        OK
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to close the glassmorphism alert modal
function closeGlassmorphismAlert() {
    const modal = document.getElementById('glassmorphismAlertModal');
    if (modal) {
        modal.remove();
    }
}

// Neon-styled room join notification (matches welcome animation style)
function showNeonRoomJoinAlert(roomName) {
    // Remove any existing neon alert
    const existingAlert = document.getElementById('neonRoomJoinAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const existingStyle = document.getElementById('neonRoomJoinStyle');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const alertHTML = `
        <div id="neonRoomJoinAlert">
            <div class="neon-alert-scanlines"></div>
            <div class="neon-alert-content">
                <div class="neon-alert-border-top"></div>
                <div class="neon-alert-icon">
                    <i class="fas fa-door-open"></i>
                </div>
                <div class="neon-alert-title">CONNECTING</div>
                <div class="neon-alert-room">
                    <span class="neon-alert-bracket">[</span>
                    <span class="neon-alert-room-name">${roomName}</span>
                    <span class="neon-alert-bracket">]</span>
                </div>
                <div class="neon-alert-status">
                    <span class="neon-alert-dot"></span>
                    <span class="neon-alert-status-text">ESTABLISHING LINK</span>
                </div>
                <div class="neon-alert-border-bottom"></div>
            </div>
        </div>
    `;
    
    const style = document.createElement('style');
    style.id = 'neonRoomJoinStyle';
    style.textContent = `
        #neonRoomJoinAlert {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 5, 15, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100000;
            opacity: 0;
            animation: neonAlertFadeIn 0.4s ease forwards;
            cursor: pointer;
        }
        
        @keyframes neonAlertFadeIn {
            to { opacity: 1; }
        }
        
        @keyframes neonAlertFadeOut {
            to { opacity: 0; transform: scale(0.95); }
        }
        
        .neon-alert-scanlines {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.1) 0px,
                rgba(0, 0, 0, 0.1) 1px,
                transparent 1px,
                transparent 3px
            );
            pointer-events: none;
        }
        
        .neon-alert-content {
            text-align: center;
            padding: 40px 50px;
            position: relative;
            animation: neonAlertSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }
        
        @keyframes neonAlertSlideUp {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .neon-alert-border-top, .neon-alert-border-bottom {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 300px;
            height: 2px;
            background: linear-gradient(90deg, 
                transparent, 
                #00ffff, 
                #ff00ff, 
                #00ffff, 
                transparent);
            box-shadow: 
                0 0 10px #00ffff,
                0 0 20px #ff00ff;
            animation: neonBorderPulse 1.5s ease infinite;
        }
        
        .neon-alert-border-top { top: 0; }
        .neon-alert-border-bottom { bottom: 0; }
        
        @keyframes neonBorderPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        .neon-alert-icon {
            font-size: 48px;
            color: #00ffff;
            margin-bottom: 15px;
            text-shadow: 
                0 0 10px #00ffff,
                0 0 20px #00ffff,
                0 0 40px #00ffff;
            animation: neonIconFloat 2s ease-in-out infinite;
        }
        
        @keyframes neonIconFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        
        .neon-alert-title {
            font-size: 28px;
            font-weight: 900;
            font-family: 'Arial Black', Arial, sans-serif;
            color: #fff;
            letter-spacing: 8px;
            margin-bottom: 20px;
            text-shadow: 
                0 0 10px #fff,
                0 0 20px #ff00ff,
                0 0 40px #ff00ff;
            animation: neonTitlePulse 2s ease infinite;
        }
        
        @keyframes neonTitlePulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
        }
        
        .neon-alert-room {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .neon-alert-bracket {
            font-size: 40px;
            font-family: 'Courier New', monospace;
            color: #ff00ff;
            text-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff;
            animation: neonBracketPulse 1s ease infinite;
        }
        
        .neon-alert-bracket:last-child {
            animation-delay: 0.5s;
        }
        
        @keyframes neonBracketPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
        
        .neon-alert-room-name {
            font-family: 'Courier New', monospace;
            font-size: 24px;
            font-weight: bold;
            color: #00ffff;
            letter-spacing: 3px;
            padding: 10px 20px;
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            text-shadow: 
                0 0 10px #00ffff,
                0 0 20px #00ffff;
        }
        
        .neon-alert-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .neon-alert-dot {
            width: 8px;
            height: 8px;
            background: #00ff00;
            border-radius: 50%;
            box-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00;
            animation: neonDotBlink 0.8s ease infinite;
        }
        
        @keyframes neonDotBlink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.3; }
        }
        
        .neon-alert-status-text {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #00ff00;
            letter-spacing: 2px;
            text-shadow: 0 0 5px #00ff00;
        }
    `;
    
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    const alertElement = document.getElementById('neonRoomJoinAlert');
    
    // Function to dismiss the alert
    function dismissAlert() {
        if (alertElement) {
            alertElement.style.animation = 'neonAlertFadeOut 0.3s ease forwards';
            setTimeout(() => {
                alertElement.remove();
                style.remove();
            }, 300);
        }
    }
    
    // Dismiss on click anywhere
    alertElement.addEventListener('click', dismissAlert);
    
    // After 2 seconds, change to "CONNECTED" state
    setTimeout(() => {
        if (!alertElement || !document.contains(alertElement)) return;
        
        const titleEl = alertElement.querySelector('.neon-alert-title');
        const iconEl = alertElement.querySelector('.neon-alert-icon');
        const statusDot = alertElement.querySelector('.neon-alert-dot');
        const statusText = alertElement.querySelector('.neon-alert-status-text');
        
        if (titleEl) {
            titleEl.textContent = 'CONNECTED';
            titleEl.style.color = '#00ff00';
            titleEl.style.textShadow = '0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 40px #00ff00';
        }
        if (iconEl) {
            iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
            iconEl.style.color = '#00ff00';
            iconEl.style.textShadow = '0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 40px #00ff00';
        }
        if (statusText) {
            statusText.textContent = 'LINK ESTABLISHED';
        }
        
        // Dismiss after showing "CONNECTED" for 1.5 seconds
        setTimeout(dismissAlert, 1500);
    }, 2000);
}

// Neon-styled welcome alert for new account creation (matches room join styling)
function showNeonWelcomeAlert() {
    // Remove any existing neon alert
    const existingAlert = document.getElementById('neonWelcomeAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const existingStyle = document.getElementById('neonWelcomeStyle');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const alertHTML = `
        <div id="neonWelcomeAlert">
            <div class="neon-welcome-scanlines"></div>
            <div class="neon-welcome-content">
                <div class="neon-welcome-border-top"></div>
                <div class="neon-welcome-icon">
                    <i class="fas fa-user-check"></i>
                </div>
                <div class="neon-welcome-title">WELCOME</div>
                <div class="neon-welcome-subtitle">
                    <span class="neon-welcome-text">ACCOUNT CREATED</span>
                </div>
                <div class="neon-welcome-status">
                    <span class="neon-welcome-dot"></span>
                    <span class="neon-welcome-status-text">SYSTEM ONLINE</span>
                </div>
                <div class="neon-welcome-border-bottom"></div>
            </div>
        </div>
    `;
    
    const style = document.createElement('style');
    style.id = 'neonWelcomeStyle';
    style.textContent = `
        #neonWelcomeAlert {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 5, 15, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100000;
            opacity: 0;
            animation: neonWelcomeFadeIn 0.4s ease forwards;
            cursor: pointer;
        }
        
        @keyframes neonWelcomeFadeIn {
            to { opacity: 1; }
        }
        
        @keyframes neonWelcomeFadeOut {
            to { opacity: 0; transform: scale(0.95); }
        }
        
        .neon-welcome-scanlines {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.1) 0px,
                rgba(0, 0, 0, 0.1) 1px,
                transparent 1px,
                transparent 3px
            );
            pointer-events: none;
        }
        
        .neon-welcome-content {
            text-align: center;
            padding: 40px 50px;
            position: relative;
            animation: neonWelcomeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }
        
        @keyframes neonWelcomeSlideUp {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .neon-welcome-border-top, .neon-welcome-border-bottom {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 300px;
            height: 2px;
            background: linear-gradient(90deg, 
                transparent, 
                #00ffff, 
                #ff00ff, 
                #00ffff, 
                transparent);
            box-shadow: 
                0 0 10px #00ffff,
                0 0 20px #ff00ff;
            animation: neonWelcomeBorderPulse 1.5s ease infinite;
        }
        
        .neon-welcome-border-top { top: 0; }
        .neon-welcome-border-bottom { bottom: 0; }
        
        @keyframes neonWelcomeBorderPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        .neon-welcome-icon {
            font-size: 48px;
            color: #00ff00;
            margin-bottom: 15px;
            text-shadow: 
                0 0 10px #00ff00,
                0 0 20px #00ff00,
                0 0 40px #00ff00;
            animation: neonWelcomeIconFloat 2s ease-in-out infinite;
        }
        
        @keyframes neonWelcomeIconFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        
        .neon-welcome-title {
            font-size: 32px;
            font-weight: 900;
            font-family: 'Arial Black', Arial, sans-serif;
            color: #fff;
            letter-spacing: 10px;
            margin-bottom: 15px;
            text-shadow: 
                0 0 10px #fff,
                0 0 20px #ff00ff,
                0 0 40px #ff00ff;
            animation: neonWelcomeTitlePulse 2s ease infinite;
        }
        
        @keyframes neonWelcomeTitlePulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
        }
        
        .neon-welcome-subtitle {
            margin-bottom: 20px;
        }
        
        .neon-welcome-text {
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            color: #00ffff;
            letter-spacing: 4px;
            padding: 10px 25px;
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            text-shadow: 
                0 0 10px #00ffff,
                0 0 20px #00ffff;
        }
        
        .neon-welcome-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .neon-welcome-dot {
            width: 8px;
            height: 8px;
            background: #00ff00;
            border-radius: 50%;
            box-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00;
            animation: neonWelcomeDotBlink 0.8s ease infinite;
        }
        
        @keyframes neonWelcomeDotBlink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.3; }
        }
        
        .neon-welcome-status-text {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #00ff00;
            letter-spacing: 2px;
            text-shadow: 0 0 5px #00ff00;
        }
    `;
    
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    const alertElement = document.getElementById('neonWelcomeAlert');
    
    // Function to dismiss the alert
    function dismissAlert() {
        if (alertElement) {
            alertElement.style.animation = 'neonWelcomeFadeOut 0.3s ease forwards';
            setTimeout(() => {
                alertElement.remove();
                style.remove();
            }, 300);
        }
    }
    
    // Dismiss on click anywhere
    alertElement.addEventListener('click', dismissAlert);
    
    // Auto-dismiss after 5 seconds
    setTimeout(dismissAlert, 5000);
}

// Function to show invite code with copy functionality
function showInviteCodeAlert(inviteCode, codeType = 'Single-Use', targetRoom = null) {
    // Remove any existing alert modal
    const existingModal = document.getElementById('inviteCodeModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Generate the shareable invite link
    const inviteLink = `${window.location.origin}/invite?code=${inviteCode}`;
    
    // Description based on whether there's a target room
    const hasRoom = targetRoom && targetRoom !== 'Global';
    const description = hasRoom 
        ? `New users will automatically join room "<strong>${targetRoom}</strong>" after signing up`
        : (codeType === 'Permanent' ? 'This code never expires and can be used multiple times' : 'Share this code with a user to let them create an account');

    const modalHTML = `
        <div id="inviteCodeModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                max-width: 480px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(43, 45, 59, 0.98) 0%, 
                    rgba(54, 57, 63, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 8px 32px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                padding: 30px;
                text-align: center;
                animation: modalSlideIn 0.3s ease-out;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        width: 3px;
                        height: 3px;
                        background: linear-gradient(135deg, #667aff, #7386ff);
                        border-radius: 50%;
                        animation: subtlePulse 2s infinite;
                    "></div>
                    <h3 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        margin: 0;
                        font-size: 24px;
                        letter-spacing: -0.5px;
                    ">${hasRoom ? '🚪' : '✨'} ${codeType} Invite Code Generated!</h3>
                    <div style="
                        width: 3px;
                        height: 3px;
                        background: linear-gradient(135deg, #667aff, #7386ff);
                        border-radius: 50%;
                        animation: subtlePulse 2s infinite 0.5s;
                    "></div>
                </div>
                
                <p style="
                    color: #b9bbbe; 
                    font-size: 14px; 
                    margin-bottom: 25px; 
                    opacity: 0.8;
                ">${description}</p>

                <div style="
                    background: rgba(32, 34, 37, 0.8);
                    border: 2px solid rgba(102, 122, 255, 0.4);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 20px 0;
                    position: relative;
                ">
                    <div style="
                        font-family: 'Courier New', monospace;
                        font-size: 28px;
                        font-weight: bold;
                        color: #667aff;
                        letter-spacing: 3px;
                        margin-bottom: 10px;
                        text-shadow: 0 0 10px rgba(102, 122, 255, 0.3);
                    " id="inviteCodeText">${inviteCode}</div>
                    
                    <button onclick="copyInviteCode('${inviteCode}')" style="
                        background: linear-gradient(135deg, rgba(102, 122, 255, 0.9), rgba(115, 134, 255, 0.9));
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        margin-top: 10px;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(102, 122, 255, 1), rgba(115, 134, 255, 1))';
                        this.style.transform='translateY(-1px)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(102, 122, 255, 0.9), rgba(115, 134, 255, 0.9))';
                        this.style.transform='translateY(0)';
                    "
                    id="copyInviteBtn">
                        📋 Copy Code
                    </button>
                </div>
                
                <!-- Shareable Link Section -->
                <div style="
                    background: rgba(46, 204, 113, 0.1);
                    border: 2px solid rgba(46, 204, 113, 0.3);
                    border-radius: 12px;
                    padding: 15px;
                    margin: 15px 0;
                ">
                    <p style="
                        color: #2ecc71;
                        font-size: 12px;
                        font-weight: 600;
                        margin: 0 0 10px 0;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    ">🔗 Shareable Invite Link</p>
                    
                    <div style="
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        color: #b9bbbe;
                        word-break: break-all;
                        margin-bottom: 10px;
                        padding: 8px;
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 6px;
                    " id="inviteLinkText">${inviteLink}</div>
                    
                    <button onclick="copyInviteLink('${inviteLink}')" style="
                        background: linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9));
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 1), rgba(39, 174, 96, 1))';
                        this.style.transform='translateY(-1px)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9))';
                        this.style.transform='translateY(0)';
                    "
                    id="copyInviteLinkBtn">
                        🔗 Copy Link
                    </button>
                </div>

                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                    <button onclick="closeInviteCodeAlert()" style="
                        background: rgba(114, 118, 125, 0.2);
                        color: #b9bbbe;
                        padding: 12px 24px;
                        border: 1px solid rgba(114, 118, 125, 0.4);
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        backdrop-filter: blur(10px);
                    "
                    onmouseover="
                        this.style.background='rgba(114, 118, 125, 0.3)';
                        this.style.borderColor='rgba(114, 118, 125, 0.6)';
                    "
                    onmouseout="
                        this.style.background='rgba(114, 118, 125, 0.2)';
                        this.style.borderColor='rgba(114, 118, 125, 0.4)';
                    ">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add click-outside-to-close functionality
    const modal = document.getElementById('inviteCodeModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            // Only close if clicking the backdrop (not the inner content)
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

// Function to copy invite code to clipboard
function copyInviteCode(code) {
    navigator.clipboard.writeText(code).then(function() {
        const copyBtn = document.getElementById('copyInviteBtn');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ Copied!';
            copyBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.background = 'linear-gradient(135deg, rgba(102, 122, 255, 0.9), rgba(115, 134, 255, 0.9))';
            }, 2000);
        }
        
        showGlassmorphismAlert('Copied!', 'Invite code copied to clipboard.', 'success');
    }).catch(function() {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showGlassmorphismAlert('Copied!', 'Invite code copied to clipboard.', 'success');
        } catch (err) {
            showGlassmorphismAlert('Copy Failed', 'Please manually copy the invite code.', 'error');
        }
        document.body.removeChild(textArea);
    });
}

// Function to copy invite link to clipboard
function copyInviteLink(link) {
    navigator.clipboard.writeText(link).then(function() {
        const copyBtn = document.getElementById('copyInviteLinkBtn');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ Link Copied!';
            copyBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            copyBtn.style.transform = 'scale(1.05)';
            copyBtn.style.transition = 'all 0.2s ease';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.background = 'linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9))';
                copyBtn.style.transform = 'scale(1)';
            }, 1500);
        }
    }).catch(function() {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById('copyInviteLinkBtn');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '✅ Link Copied!';
                copyBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                copyBtn.style.transform = 'scale(1.05)';
                copyBtn.style.transition = 'all 0.2s ease';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.style.background = 'linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9))';
                    copyBtn.style.transform = 'scale(1)';
                }, 1500);
            }
        } catch (err) {
            showGlassmorphismAlert('Copy Failed', 'Please manually copy the invite link.', 'error');
        }
        document.body.removeChild(textArea);
    });
}

// Function to close invite code modal
function closeInviteCodeAlert() {
    const modal = document.getElementById('inviteCodeModal');
    if (modal) {
        modal.remove();
    }
}

// Function to show experiment ended modal with retro-future neon stat screen
function showExperimentEndedModal(data) {
    // Remove any existing modal
    const existingModal = document.getElementById('experimentEndedModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Extract data with defaults
    const reason = data.reason || 'Experiment completed';
    const totalRounds = data.totalRounds || 0;
    const maxRounds = data.maxRounds || 189;
    const tokensUsed = data.tokensUsed || 0;
    const startingTokenPool = data.startingTokenPool || 1250;
    const finalTokenPool = data.finalTokenPool || 0;
    const culturantsProduced = data.culturantsProduced || 0;
    const selfControlChoices = data.selfControlChoices || 0;
    const impulsiveChoices = data.impulsiveChoices || 0;
    const sessionDuration = data.sessionDuration || 0;
    const playerStats = data.playerStats || [];
    const isModerator = data.isModerator || window.currentUserIsModerator || false;
    const roomName = data.roomName || currentRoom || 'Unknown';
    
    // Format session duration
    const minutes = Math.floor(sessionDuration / 60);
    const seconds = sessionDuration % 60;
    const durationStr = `${minutes}m ${seconds}s`;
    
    // Calculate choice percentages
    const totalChoices = selfControlChoices + impulsiveChoices;
    const selfControlPct = totalChoices > 0 ? Math.round((selfControlChoices / totalChoices) * 100) : 0;
    const impulsivePct = totalChoices > 0 ? Math.round((impulsiveChoices / totalChoices) * 100) : 0;
    
    // Generate player stats HTML
    const playerStatsHTML = playerStats.map(p => `
        <div class="exp-end-player-row">
            <span class="exp-end-player-name">${p.isAI ? '🤖' : '👤'} ${p.username}</span>
            <span class="exp-end-player-tokens">
                <span class="exp-end-white-token">⚪ ${p.whiteTokens}</span>
                <span class="exp-end-black-token">⚫ ${p.blackTokens}</span>
            </span>
        </div>
    `).join('');
    
    // CSV download button (moderator only)
    const csvButtonHTML = isModerator ? `
        <button onclick="downloadExperimentCSVFromModal('${roomName}')" class="exp-end-csv-btn">
            <span>📊</span> Download CSV Data
        </button>
    ` : '';

    const modalHTML = `
        <div id="experimentEndedModal" class="exp-end-overlay">
            <div class="exp-end-container">
                <!-- Scanline overlay -->
                <div class="exp-end-scanlines"></div>
                
                <!-- Neon border glow -->
                <div class="exp-end-neon-border"></div>
                
                <!-- Header -->
                <div class="exp-end-header">
                    <div class="exp-end-title-glow">EXPERIMENT COMPLETE</div>
                    <div class="exp-end-subtitle">${reason}</div>
                </div>
                
                <!-- Main stats grid -->
                <div class="exp-end-stats-grid">
                    <div class="exp-end-stat-card exp-end-stat-rounds">
                        <div class="exp-end-stat-icon">🔄</div>
                        <div class="exp-end-stat-value">${totalRounds}<span class="exp-end-stat-max">/${maxRounds}</span></div>
                        <div class="exp-end-stat-label">ROUNDS</div>
                    </div>
                    
                    <div class="exp-end-stat-card exp-end-stat-duration">
                        <div class="exp-end-stat-icon">⏱️</div>
                        <div class="exp-end-stat-value">${durationStr}</div>
                        <div class="exp-end-stat-label">DURATION</div>
                    </div>
                    
                    <div class="exp-end-stat-card exp-end-stat-tokens">
                        <div class="exp-end-stat-icon">🪙</div>
                        <div class="exp-end-stat-value">${tokensUsed}<span class="exp-end-stat-max">/${startingTokenPool}</span></div>
                        <div class="exp-end-stat-label">TOKENS USED</div>
                    </div>
                    
                    <div class="exp-end-stat-card exp-end-stat-culturants">
                        <div class="exp-end-stat-icon">⚫</div>
                        <div class="exp-end-stat-value">${culturantsProduced}</div>
                        <div class="exp-end-stat-label">CULTURANTS</div>
                    </div>
                </div>
                
                <!-- Choice breakdown -->
                <div class="exp-end-choices-section">
                    <div class="exp-end-section-title">CHOICE BREAKDOWN</div>
                    <div class="exp-end-choice-bar-container">
                        <div class="exp-end-choice-bar">
                            <div class="exp-end-choice-self-control" style="width: ${selfControlPct}%"></div>
                            <div class="exp-end-choice-impulsive" style="width: ${impulsivePct}%"></div>
                        </div>
                        <div class="exp-end-choice-labels">
                            <span class="exp-end-choice-label-sc">🧘 Self-Control: ${selfControlPct}%</span>
                            <span class="exp-end-choice-label-imp">⚡ Impulsive: ${impulsivePct}%</span>
                        </div>
                    </div>
                </div>
                
                <!-- Player leaderboard -->
                <div class="exp-end-players-section">
                    <div class="exp-end-section-title">PLAYER RESULTS</div>
                    <div class="exp-end-players-list">
                        ${playerStatsHTML}
                    </div>
                </div>
                
                <!-- Action buttons -->
                <div class="exp-end-actions">
                    ${csvButtonHTML}
                    <button onclick="closeExperimentEndedModal()" class="exp-end-return-btn">
                        <span>🏠</span> Return to Global Chat
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            .exp-end-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.92);
                backdrop-filter: blur(8px);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: expEndFadeIn 0.4s ease-out;
            }
            
            .exp-end-container {
                max-width: 600px;
                width: 95%;
                max-height: 90vh;
                overflow-y: auto;
                background: linear-gradient(180deg, 
                    rgba(10, 12, 20, 0.98) 0%, 
                    rgba(15, 18, 30, 0.98) 100%);
                border: 2px solid rgba(0, 255, 255, 0.3);
                border-radius: 12px;
                padding: 30px;
                position: relative;
                box-shadow: 
                    0 0 40px rgba(0, 255, 255, 0.15),
                    0 0 80px rgba(255, 0, 128, 0.1),
                    inset 0 0 60px rgba(0, 0, 0, 0.5);
                animation: expEndSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .exp-end-scanlines {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 255, 255, 0.02) 2px,
                    rgba(0, 255, 255, 0.02) 4px
                );
                pointer-events: none;
                border-radius: 12px;
            }
            
            .exp-end-neon-border {
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 14px;
                background: linear-gradient(45deg, 
                    rgba(0, 255, 255, 0.5), 
                    rgba(255, 0, 128, 0.5), 
                    rgba(0, 255, 255, 0.5));
                z-index: -1;
                animation: expEndNeonPulse 3s ease-in-out infinite;
                filter: blur(3px);
            }
            
            .exp-end-header {
                text-align: center;
                margin-bottom: 25px;
            }
            
            .exp-end-title-glow {
                font-size: 28px;
                font-weight: 800;
                letter-spacing: 4px;
                color: #00ffff;
                text-shadow: 
                    0 0 10px rgba(0, 255, 255, 0.8),
                    0 0 20px rgba(0, 255, 255, 0.6),
                    0 0 40px rgba(0, 255, 255, 0.4);
                animation: expEndTitleFlicker 4s ease-in-out infinite;
                font-family: 'Courier New', monospace;
            }
            
            .exp-end-subtitle {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 10px;
                font-family: 'Courier New', monospace;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            
            .exp-end-stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin-bottom: 25px;
            }
            
            .exp-end-stat-card {
                background: rgba(0, 20, 40, 0.6);
                border: 1px solid rgba(0, 255, 255, 0.2);
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .exp-end-stat-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.5), transparent);
            }
            
            .exp-end-stat-icon {
                font-size: 24px;
                margin-bottom: 5px;
            }
            
            .exp-end-stat-value {
                font-size: 28px;
                font-weight: 700;
                color: #00ffff;
                font-family: 'Courier New', monospace;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            }
            
            .exp-end-stat-max {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .exp-end-stat-label {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
                letter-spacing: 2px;
                margin-top: 5px;
                font-family: 'Courier New', monospace;
            }
            
            .exp-end-stat-culturants {
                border-color: rgba(255, 0, 128, 0.3);
            }
            
            .exp-end-stat-culturants .exp-end-stat-value {
                color: #ff0080;
                text-shadow: 0 0 10px rgba(255, 0, 128, 0.5);
            }
            
            .exp-end-stat-culturants::before {
                background: linear-gradient(90deg, transparent, rgba(255, 0, 128, 0.5), transparent);
            }
            
            .exp-end-section-title {
                font-size: 12px;
                color: rgba(0, 255, 255, 0.8);
                letter-spacing: 3px;
                margin-bottom: 12px;
                font-family: 'Courier New', monospace;
                text-align: center;
            }
            
            .exp-end-choices-section {
                margin-bottom: 25px;
            }
            
            .exp-end-choice-bar-container {
                background: rgba(0, 20, 40, 0.6);
                border: 1px solid rgba(0, 255, 255, 0.2);
                border-radius: 8px;
                padding: 15px;
            }
            
            .exp-end-choice-bar {
                height: 20px;
                border-radius: 10px;
                overflow: hidden;
                display: flex;
                background: rgba(0, 0, 0, 0.5);
            }
            
            .exp-end-choice-self-control {
                background: linear-gradient(90deg, #00ff88, #00cc6a);
                box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
                transition: width 1s ease-out;
            }
            
            .exp-end-choice-impulsive {
                background: linear-gradient(90deg, #ff4444, #cc0000);
                box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
                transition: width 1s ease-out;
            }
            
            .exp-end-choice-labels {
                display: flex;
                justify-content: space-between;
                margin-top: 10px;
                font-size: 12px;
                font-family: 'Courier New', monospace;
            }
            
            .exp-end-choice-label-sc {
                color: #00ff88;
            }
            
            .exp-end-choice-label-imp {
                color: #ff4444;
            }
            
            .exp-end-players-section {
                margin-bottom: 25px;
            }
            
            .exp-end-players-list {
                background: rgba(0, 20, 40, 0.6);
                border: 1px solid rgba(0, 255, 255, 0.2);
                border-radius: 8px;
                padding: 10px;
            }
            
            .exp-end-player-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 10px;
                border-bottom: 1px solid rgba(0, 255, 255, 0.1);
            }
            
            .exp-end-player-row:last-child {
                border-bottom: none;
            }
            
            .exp-end-player-name {
                color: rgba(255, 255, 255, 0.9);
                font-family: 'Courier New', monospace;
                font-size: 14px;
            }
            
            .exp-end-player-tokens {
                display: flex;
                gap: 15px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
            }
            
            .exp-end-white-token {
                color: #ffffff;
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
            }
            
            .exp-end-black-token {
                color: #ff0080;
                text-shadow: 0 0 5px rgba(255, 0, 128, 0.5);
            }
            
            .exp-end-actions {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .exp-end-csv-btn {
                background: linear-gradient(135deg, rgba(255, 165, 0, 0.2) 0%, rgba(255, 140, 0, 0.2) 100%);
                border: 1px solid rgba(255, 165, 0, 0.5);
                color: #ffa500;
                padding: 14px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                text-shadow: 0 0 10px rgba(255, 165, 0, 0.5);
            }
            
            .exp-end-csv-btn:hover {
                background: linear-gradient(135deg, rgba(255, 165, 0, 0.4) 0%, rgba(255, 140, 0, 0.4) 100%);
                box-shadow: 0 0 20px rgba(255, 165, 0, 0.3);
                transform: translateY(-2px);
            }
            
            .exp-end-return-btn {
                background: linear-gradient(135deg, rgba(0, 255, 255, 0.2) 0%, rgba(0, 200, 200, 0.2) 100%);
                border: 1px solid rgba(0, 255, 255, 0.5);
                color: #00ffff;
                padding: 14px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            }
            
            .exp-end-return-btn:hover {
                background: linear-gradient(135deg, rgba(0, 255, 255, 0.4) 0%, rgba(0, 200, 200, 0.4) 100%);
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
                transform: translateY(-2px);
            }
            
            @keyframes expEndFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes expEndSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-30px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes expEndNeonPulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 0.8; }
            }
            
            @keyframes expEndTitleFlicker {
                0%, 100% { opacity: 1; }
                92% { opacity: 1; }
                93% { opacity: 0.8; }
                94% { opacity: 1; }
                95% { opacity: 0.9; }
                96% { opacity: 1; }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Download CSV from the experiment end modal
function downloadExperimentCSVFromModal(roomName) {
    const downloadUrl = `/api/download-experiment-csv/${encodeURIComponent(roomName)}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `experiment_${roomName}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`📊 CSV download initiated from experiment end modal for room: ${roomName}`);
}

// Function to close experiment ended modal and return to global chat
function closeExperimentEndedModal() {
    // Soft-return to global chat when "Return to Global Chat" is clicked
    console.log('🔄 Soft-returning to global chat after experiment end (no full reload)');

    // Ensure proper UI state when returning to global chat
    // Hide the login screen (landing page) and show the chat interface
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chat-container');

    if (landingPage) {
        landingPage.style.display = 'none';
        console.log('✅ Hidden landing page (login screen background)');
    }

    if (chatContainer) {
        chatContainer.style.display = 'block';
        console.log('✅ Shown chat container');
    }
    
    // Ensure we're showing the global chat tab
    const globalChatMessages = document.getElementById('globalChatMessages');
    const roomChatMessages = document.getElementById('roomChatMessages');
    const globalNameText = document.getElementById('globalNameText');
    
    if (globalChatMessages) {
        globalChatMessages.style.display = '';
        console.log('✅ Shown global chat messages');
    }
    
    if (roomChatMessages) {
        roomChatMessages.style.display = 'none';
        console.log('✅ Hidden room chat messages');
    }
    
    if (globalNameText) {
        globalNameText.style.backgroundColor = '#667aff';
        console.log('✅ Activated global chat tab styling');
    }
    
    // Reset current room state
    currentRoom = 'Global';
    gameActive = false;
    document.body.classList.remove('game-active');
    
    // Update card visibility for global context - this includes invite visibility
    updateCardVisibility();
    
    // Hide room pill in global chat (inline implementation)  
    const roomPill = document.getElementById('room-pill');
    if (roomPill) {
        roomPill.style.display = 'none';
    }
    
    // Double-check invite visibility specifically
    setTimeout(() => {
        updateInviteVisibility();
    }, 100);
}

// Function to properly return user to global chat
function returnToGlobalChat() {
    console.log('🏠 Returning user to global chat...');
    
    // Hide game interface
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        gameDiv.style.display = 'none';
    }
    
    // Show chat interface
    const chatContainer = document.getElementById('chat-container');
    const landingPage = document.getElementById('landingPage');
    
    // Determine which interface to show based on login status
    const isLoggedIn = currentUsername && currentUsername !== null && currentUsername !== '';
    
    if (isLoggedIn && chatContainer) {
        // User is logged in, show chat interface
        chatContainer.style.display = 'block';
        if (landingPage) {
            landingPage.style.display = 'none';
        }
        console.log('✅ Returned logged-in user to chat interface');
    } else if (landingPage) {
        // User is not logged in or session lost, show landing page
        landingPage.style.display = 'block';
        if (chatContainer) {
            chatContainer.style.display = 'none';
        }
        console.log('✅ Returned user to landing page (not logged in)');
    } else {
        console.warn('⚠️ Could not find proper interface elements to show');
    }
    
    // Ensure we're in Global room state
    currentRoom = 'Global';
    gameActive = false;
    document.body.classList.remove('game-active');
    
    // Update card visibility
    updateCardVisibility();
    
    // Emit joinRoom to Global to ensure server state is correct
    if (typeof socket !== 'undefined' && socket.connected) {
        socket.emit('joinRoom', 'Global');
    }
}

// Function to show Lightning Test results modal
function showLightningTestResults(message, stats, duration, csvData) {
    // Remove any existing modal
    const existingModal = document.getElementById('lightningTestResultsModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="lightningTestResultsModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                background: linear-gradient(145deg, 
                    rgba(30, 25, 50, 0.98) 0%, 
                    rgba(45, 35, 65, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 2px solid rgba(192, 38, 211, 0.4);
                border-radius: 20px;
                box-shadow: 
                    0 25px 80px rgba(0, 0, 0, 0.7),
                    0 10px 40px rgba(192, 38, 211, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                padding: 30px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 25px;
                ">
                    <div style="
                        font-size: 48px;
                        margin-bottom: 10px;
                        animation: lightningBounce 2s infinite;
                    ">⚡</div>
                    <h2 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        margin: 0;
                        font-size: 24px;
                        letter-spacing: -0.5px;
                        background: linear-gradient(135deg, #c026d3, #7c3aed);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    ">Lightning Test Complete</h2>
                </div>
                
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 1px solid rgba(192, 38, 211, 0.3);
                    border-radius: 16px;
                    padding: 20px;
                    margin: 20px 0;
                    backdrop-filter: blur(10px);
                    text-align: left;
                ">
                    <div style="
                        color: #dcddde; 
                        font-size: 14px; 
                        margin: 0; 
                        line-height: 1.6;
                        font-family: 'Courier New', monospace;
                        background: none;
                        border: none;
                        padding: 0;
                    ">${message}</div>
                </div>
                
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 30px;
                    align-items: center;
                ">
                    <!-- Download CSV Button -->
                    <button onclick="downloadLightningTestCSV()" style="
                        background: linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%);
                        color: white;
                        padding: 15px 28px;
                        border: 2px solid rgba(34, 197, 94, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(34, 197, 94, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        min-width: 200px;
                        justify-content: center;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(16, 185, 129, 1) 0%, rgba(5, 150, 105, 1) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 8px 25px rgba(34, 197, 94, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(34, 197, 94, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.98)'"
                    onmouseup="this.style.transform='translateY(-2px) scale(1)'">
                        <span style="font-size: 14px;">📊</span>
                        Download CSV Results
                    </button>
                    
                    <!-- Continue Button -->
                    <button onclick="closeLightningTestResults()" style="
                        background: linear-gradient(135deg, rgba(192, 38, 211, 0.9) 0%, rgba(124, 58, 237, 0.9) 100%);
                        color: white;
                        padding: 15px 28px;
                        border: 2px solid rgba(192, 38, 211, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(192, 38, 211, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        min-width: 200px;
                        justify-content: center;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(124, 58, 237, 1) 0%, rgba(147, 51, 234, 1) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 8px 25px rgba(192, 38, 211, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(192, 38, 211, 0.9) 0%, rgba(124, 58, 237, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(192, 38, 211, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.98)'"
                    onmouseup="this.style.transform='translateY(-2px) scale(1)'">
                        <span style="font-size: 14px;">✨</span>
                        Continue
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes lightningShimmer {
                0%, 100% { background: linear-gradient(90deg, #c026d3, #7c3aed, #c026d3); }
                50% { background: linear-gradient(90deg, #7c3aed, #c026d3, #7c3aed); }
            }
            
            @keyframes lightningBounce {
                0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                50% { transform: translateY(-8px) scale(1.1) rotate(5deg); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to close lightning test results modal
function closeLightningTestResults() {
    const modal = document.getElementById('lightningTestResultsModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to download lightning test CSV results
function downloadLightningTestCSV() {
    try {
        // Check if CSV data is available
        if (!window.lightningTestCsvData) {
            console.error('No CSV data available for download');
            alert('CSV data is not available. Please run the lightning test again.');
            return;
        }
        
        // Create filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `lightning_test_results_${timestamp}.csv`;
        
        // Create blob and download
        const blob = new Blob([window.lightningTestCsvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            // Create download link
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`📊 Lightning test CSV downloaded: ${filename}`);
            
            // Show success feedback
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<span style="font-size: 14px;">✅</span> Downloaded!';
            button.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 1) 0%, rgba(16, 185, 129, 1) 100%)';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%)';
            }, 2000);
        } else {
            // Fallback for older browsers
            console.error('File download not supported in this browser');
            alert('File download not supported in this browser. Please copy the CSV data manually.');
        }
        
    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Error downloading CSV file. Please try again.');
    }
}

// Function to download experiment CSV from moderator panel
function downloadExperimentCSV() {
    try {
        // Check if we have an active experiment room
        if (!currentRoom || currentRoom === 'Global') {
            console.error('No active experiment found');
            alert('No active experiment found. Join an experiment room to enable CSV download.');
            return;
        }

        // Create direct download URL with room ID as parameter
        const downloadUrl = `/api/download-experiment-csv/${encodeURIComponent(currentRoom)}`;
        
        // Create filename with timestamp and room ID
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `experiment_data_${currentRoom}_${timestamp}.csv`;
        
        // Create temporary link for download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`📊 Experiment CSV download initiated: ${filename}`);
        
        // Show success feedback
        const button = document.getElementById('csvDownloadBtn');
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<span style="font-size: 14px;">✅</span> Downloaded!';
            button.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 1) 0%, rgba(16, 185, 129, 1) 100%)';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = 'linear-gradient(135deg, rgba(46, 159, 255, 0.9) 0%, rgba(0, 123, 255, 0.85) 100%)';
            }, 2000);
        }
        
        // Update status
        updateCSVStatus(`Downloaded ${filename}`);
        
    } catch (error) {
        console.error('Error downloading experiment CSV:', error);
        alert('Error downloading CSV file. Please try again.');
        updateCSVStatus('Error downloading CSV');
    }
}

// Helper function to update CSV status display
function updateCSVStatus(message) {
    const statusElement = document.getElementById('csvStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = message.includes('Error') ? '#e74c3c' : '#43b581';
    }
}

// Function to show Lightning Test progress modal
function showLightningTestProgressModal(data) {
    // Remove any existing modal
    const existingModal = document.getElementById('lightningTestProgressModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="lightningTestProgressModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 500px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(30, 25, 50, 0.98) 0%, 
                    rgba(45, 35, 65, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 2px solid rgba(192, 38, 211, 0.4);
                border-radius: 20px;
                box-shadow: 
                    0 25px 80px rgba(0, 0, 0, 0.7),
                    0 10px 40px rgba(192, 38, 211, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                padding: 30px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                <!-- Decorative lightning border -->
                <div style="
                    position: absolute;
                    top: -2px;
                    left: -2px;
                    right: -2px;
                    height: 4px;
                    background: linear-gradient(90deg, #c026d3, #7c3aed, #c026d3);
                    border-radius: 20px 20px 0 0;
                    opacity: 0.8;
                    animation: lightningShimmer 3s infinite;
                "></div>
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 25px;
                ">
                    <div style="
                        font-size: 36px;
                        animation: lightningBounce 2s infinite;
                    ">⚡</div>
                    <h2 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        margin: 0;
                        font-size: 20px;
                        letter-spacing: -0.5px;
                        background: linear-gradient(135deg, #c026d3, #7c3aed);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    ">Lightning Test Running</h2>
                </div>
                
                <!-- Fixed: progress modal decorative border -->  
                <div style="
                    position: absolute;
                    top: 0px;
                    left: 0px;
                    right: 0px;
                    height: 4px;
                    background: linear-gradient(90deg, #c026d3, #7c3aed, #c026d3);
                    border-radius: 20px 20px 0 0;
                    opacity: 0.8;
                    animation: lightningShimmer 3s infinite;
                "></div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 1px solid rgba(192, 38, 211, 0.3);
                    border-radius: 16px;
                    padding: 20px;
                    margin: 20px 0;
                    backdrop-filter: blur(10px);
                ">
                    <!-- Wallet Totals -->
                    <div id="walletTotals" style="
                        background: rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(124, 58, 237, 0.3);
                        border-radius: 12px;
                        padding: 15px;
                        margin-bottom: 20px;
                        text-align: left;
                    ">
                        <div style="
                            color: #7c3aed;
                            font-size: 14px;
                            font-weight: 600;
                            margin-bottom: 10px;
                            text-align: center;
                        ">� TOTAL EARNINGS</div>
                        <div id="walletContent" style="
                            color: #dcddde;
                            font-size: 13px;
                            line-height: 1.4;
                            font-family: 'Courier New', monospace;
                        ">
                            ${data.playerEarnings ? Object.entries(data.playerEarnings).map(([player, amount]) => 
                                `${player}: <span style="color: #22c55e;">$${amount.toFixed(2)}</span>`
                            ).join('<br>') : 'Calculating...'}
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div style="
                        background: rgba(0, 0, 0, 0.4);
                        border-radius: 10px;
                        height: 12px;
                        overflow: hidden;
                        margin-bottom: 10px;
                        border: 1px solid rgba(192, 38, 211, 0.3);
                    ">
                        <div id="progressBar" style="
                            height: 100%;
                            background: linear-gradient(90deg, #c026d3, #7c3aed);
                            border-radius: 10px;
                            width: ${data.progress}%;
                            transition: width 0.1s ease-out;
                            box-shadow: 0 0 10px rgba(192, 38, 211, 0.5);
                        "></div>
                    </div>
                    
                    <div style="
                        color: #b9bbbe;
                        font-size: 12px;
                        text-align: center;
                    ">
                        <span id="progressPercent">${data.progress.toFixed(1)}%</span> Complete
                    </div>
                </div>
                
                <div style="
                    color: #b9bbbe; 
                    font-size: 14px; 
                    margin-top: 20px;
                    opacity: 0.8;
                ">Running experimental simulation...</div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to update Lightning Test progress
function updateLightningTestProgress(data) {
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const walletContent = document.getElementById('walletContent');
    
    if (progressBar) {
        progressBar.style.width = `${data.progress}%`;
    }
    if (progressPercent) progressPercent.textContent = `${data.progress.toFixed(1)}%`;
    
    // Update wallet totals if provided
    if (walletContent && data.playerEarnings) {
        const earningsHTML = Object.entries(data.playerEarnings)
            .map(([player, amount]) => `${player}: <span style="color: #22c55e;">$${amount.toFixed(2)}</span>`)
            .join('<br>');
        walletContent.innerHTML = earningsHTML;
    }
}

// Function to close Lightning Test progress modal
function closeLightningTestProgressModal() {
    const modal = document.getElementById('lightningTestProgressModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to reset all visual components and animations for fresh room start
function resetGameVisuals() {
    console.log('🔄 Resetting all game visuals and animations...');
    
    try {
        // Reset all player animations and states
        const players = document.querySelectorAll('.player');
        players.forEach(player => {
            player.classList.remove('thinking', 'active', 'winner', 'loser', 'highlighted', 'turn-active');
            player.style.transform = '';
            player.style.opacity = '';
            player.style.animation = '';
            player.style.filter = '';
            
            // Reset any player-specific visual effects
            const playerAvatar = player.querySelector('.player-avatar');
            const playerName = player.querySelector('.player-name');
            const playerStatus = player.querySelector('.player-status');
            
            if (playerAvatar) {
                playerAvatar.style.animation = '';
                playerAvatar.style.transform = '';
                playerAvatar.style.filter = '';
            }
            
            if (playerName) {
                playerName.style.color = '';
                playerName.style.fontWeight = '';
            }
            
            if (playerStatus) {
                playerStatus.textContent = '';
                playerStatus.style.display = 'none';
            }
        });
        
        // Reset game board and table visuals
        const gameBoard = document.getElementById('gameBoard');
        const pokerTable = document.querySelector('.poker-table');
        
        if (gameBoard) {
            gameBoard.classList.remove('game-in-progress', 'round-active', 'decision-phase');
            gameBoard.style.filter = '';
            gameBoard.style.opacity = '';
        }
        
        if (pokerTable) {
            pokerTable.classList.remove('active', 'highlighted', 'game-active');
            pokerTable.style.animation = '';
            pokerTable.style.transform = '';
        }
        
        // Reset all cards and card animations
        const cards = document.querySelectorAll('.card, .poker-card, .action-card');
        cards.forEach(card => {
            card.classList.remove('flipped', 'highlighted', 'selected', 'dealt', 'revealed');
            card.style.animation = '';
            card.style.transform = '';
            card.style.transition = '';
            card.style.opacity = '';
            card.style.zIndex = '';
        });
        
        // Reset community cards area
        const communityCards = document.querySelector('.community-cards');
        if (communityCards) {
            communityCards.innerHTML = '';
            communityCards.style.opacity = '';
            communityCards.style.animation = '';
        }
        
        // Reset pot and betting areas
        const pot = document.querySelector('.pot, #pot');
        const bettingArea = document.querySelector('.betting-area');
        
        if (pot) {
            pot.textContent = '$0';
            pot.style.animation = '';
            pot.style.transform = '';
        }
        
        if (bettingArea) {
            bettingArea.style.opacity = '';
            bettingArea.style.display = '';
        }
        
        // Reset action buttons and controls
        const actionButtons = document.querySelectorAll('.action-button, .game-button, .control-button');
        actionButtons.forEach(button => {
            button.classList.remove('active', 'disabled', 'highlighted', 'pulsing');
            button.style.animation = '';
            button.style.transform = '';
            button.disabled = false;
        });
        
        // Reset progress bars and timers
        const progressBars = document.querySelectorAll('.progress-bar, .timer-bar, .countdown');
        progressBars.forEach(bar => {
            bar.style.width = '0%';
            bar.style.animation = '';
            bar.style.transform = '';
        });
        
        // Reset any overlays or modals (except our own system modals)
        const gameOverlays = document.querySelectorAll('.game-overlay, .turn-overlay, .result-overlay');
        gameOverlays.forEach(overlay => {
            if (!overlay.id.includes('Modal') && !overlay.id.includes('Alert')) {
                overlay.remove();
            }
        });
        
        // Reset round and turn indicators
        const roundIndicator = document.querySelector('.round-indicator, #currentRound');
        const turnIndicator = document.querySelector('.turn-indicator, #currentTurn');
        
        if (roundIndicator) {
            roundIndicator.textContent = '';
            roundIndicator.style.opacity = '';
        }
        
        if (turnIndicator) {
            turnIndicator.textContent = '';
            turnIndicator.style.opacity = '';
        }
        
        // Reset any sound or audio elements
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        // Reset any particle effects or canvas animations
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
        
        // Clear any inline styles that might interfere
        document.body.style.filter = '';
        document.body.style.animation = '';
        
        // Reset game state variables
        currentRoundNumber = 0;
        isGameInProgress = false;
        
        console.log('✅ Game visuals reset completed');
        
    } catch (error) {
        console.error('❌ Error resetting game visuals:', error);
    }
}

// Function to create and show the triad formation status popup
function showTriadFormationPopup(playerCount, playerPosition, playersInRoom) {
    // Remove any existing triad popup
    const existingPopup = document.getElementById('triadFormationPopup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create player list HTML
    let playerListHTML = '';
    if (playersInRoom && playersInRoom.length > 0) {
        playerListHTML = playersInRoom.map(player => {
            const aiIndicator = player.isAI ? ' 🤖' : '';
            const moderatorIndicator = player.isModerator ? ' 👑' : '';
            return `<div style="
                color: ${player.isModerator ? '#9b59b6' : (player.isAI ? '#faa61a' : '#7289da')};
                font-size: 14px;
                margin: 4px 0;
                padding: 4px 8px;
                background: rgba(54, 57, 63, 0.3);
                border-radius: 4px;
                backdrop-filter: blur(5px);
            ">${player.username}${aiIndicator}${moderatorIndicator}</div>`;
        }).join('');
    } else {
        playerListHTML = '<div style="color: #b9bbbe; font-size: 14px; opacity: 0.7;">No players in room</div>';
    }

    const popupHTML = `
        <div id="triadFormationPopup" style="
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: linear-gradient(145deg, 
                rgba(43, 45, 59, 0.95) 0%, 
                rgba(54, 57, 63, 0.92) 100%);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            padding: 16px;
            box-shadow: 
                0 10px 30px rgba(0, 0, 0, 0.4),
                0 4px 16px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <div style="
                        width: 3px;
                        height: 3px;
                        background: linear-gradient(135deg, #667aff, #7386ff);
                        border-radius: 50%;
                        animation: subtlePulse 2s infinite;
                    "></div>
                    <h4 style="
                        color: #dcddde;
                        margin: 0;
                        font-size: 16px;
                        font-weight: 600;
                        background: linear-gradient(135deg, #dcddde, #ffffff);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    ">Triad Formation</h4>
                    <div style="
                        width: 3px;
                        height: 3px;
                        background: linear-gradient(135deg, #667aff, #7386ff);
                        border-radius: 50%;
                        animation: subtlePulse 2s infinite;
                    "></div>
                </div>
                <button onclick="closeTriadFormationPopup()" style="
                    background: none;
                    border: none;
                    color: #b9bbbe;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                " onmouseover="this.style.color='#ffffff'; this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.color='#b9bbbe'; this.style.background='none'">×</button>
            </div>
            
            <div style="
                color: #b9bbbe;
                font-size: 13px;
                margin-bottom: 12px;
                text-align: center;
                opacity: 0.8;
            ">${playerCount}</div>
            
            ${playerPosition ? `<div style="
                color: #7289da;
                font-size: 12px;
                margin-bottom: 12px;
                text-align: center;
                font-weight: 500;
            ">${playerPosition}</div>` : ''}
            
            <div style="
                max-height: 150px;
                overflow-y: auto;
                padding-right: 4px;
            ">
                <div style="color: #ffffff; font-size: 13px; font-weight: 500; margin-bottom: 8px;">Players:</div>
                ${playerListHTML}
            </div>
        </div>
        
        <style>
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', popupHTML);
}

// Function to close the triad formation popup
function closeTriadFormationPopup() {
    const popup = document.getElementById('triadFormationPopup');
    if (popup) {
        popup.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 300);
    }
}

// Function to perform session restoration
function performSessionRestore(data) {
    // Update UI to reflect logged-in state
    currentUsername = data.username;
    
    // Set admin status if provided in session data
    if (data.isAdmin !== undefined) {
        isGlobalAdmin = data.isAdmin;
        
        // Immediately update invite visibility since admin status is now known
        updateInviteVisibility();
    }
    
    // Hide login elements and show logged-in state
    const signDiv = document.getElementById('signDiv');
    const loginButton = document.getElementById('loginNav');
    const logoutButton = document.getElementById('logoutNav');
    const modal = document.querySelector('.modal');
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chat-container');
    
    console.log('🔄 Setting UI elements for logged-in state...');
    if (signDiv) signDiv.style.display = 'none';
    switchToLoggedInUI(data.username);
    if (modal) modal.style.display = 'none';
    if (landingPage) landingPage.style.display = 'none';
    if (chatContainer) {
        chatContainer.style.display = '';
    }
    
    // Check if user has an active game session - stay in the game room
    if (data.room && data.room !== 'Global' && data.hasActiveGame) {
        console.log('🎮 User has active game in room:', data.room, '- staying in game room');
        currentRoom = data.room;
        
        // Show game interface immediately for active games
        const gameDiv = document.getElementById('gameDiv');
        if (gameDiv) {
            gameDiv.style.display = 'block';
            console.log('🎮 Game interface shown - staying in active game room');
        }
        
        // Join the active game room directly
        socket.emit('joinRoom', { room: data.room });
        
        // Show brief reconnection notification
        const gameReconnectionNotice = document.createElement('div');
        gameReconnectionNotice.innerHTML = `
            <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                        background: linear-gradient(135deg, #43b581, #5bc0de); color: white; 
                        padding: 12px 20px; border-radius: 8px; font-weight: bold; z-index: 9999;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);
                        font-size: 14px; text-align: center;">
                🎮 Reconnected to active game in ${data.room}
            </div>
        `;
        document.body.appendChild(gameReconnectionNotice);
        
        // Remove notification after brief display
        setTimeout(() => {
            if (gameReconnectionNotice && gameReconnectionNotice.parentNode) {
                gameReconnectionNotice.style.transition = 'all 0.5s ease-out';
                gameReconnectionNotice.style.opacity = '0';
                gameReconnectionNotice.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => {
                    if (gameReconnectionNotice.parentNode) {
                        gameReconnectionNotice.remove();
                    }
                }, 500);
            }
        }, 2000);
        
    } else {
        // No active game or in Global - start in Global chat
        console.log('🌐 No active game or already in Global - starting in Global chat');
        currentRoom = 'Global';
        
        // Hide game interface for Global chat
        const gameDiv = document.getElementById('gameDiv');
        if (gameDiv) {
            gameDiv.style.display = 'none';
            console.log('🌐 Game UI hidden - starting in Global chat');
        }
        
        // Ensure we're not in game-active state for Global chat
        gameActive = false;
        document.body.classList.remove('game-active');
        console.log('🔧 Ensured cards are visible for Global chat');
        
        // Update card visibility for global context
        updateCardVisibility();
        
        // Join Global chat
        socket.emit('joinRoom', { room: 'Global' });
        
        // Handle room restoration for non-active games
        if (data.room && data.room !== 'Global') {
            if (data.roomRestored === false) {
                console.log('⚠️ Previous room no longer exists, staying in Global chat');
            } else {
                console.log('ℹ️ Previous room available but no active game, staying in Global chat');
            }
        } else {
            console.log('🌐 No previous room or already in Global, staying in Global chat');
        }
    }
    
    // Stop space animations if function exists
    if (typeof window.stopSpaceAnimationsOnLogin === 'function') {
        window.stopSpaceAnimationsOnLogin();
    }
}

// Handle logout response
socket.on('logoutResponse', function(data) {
    if (data.success) {
        console.log('🔓 Logged out successfully');
        
        // Reset client state
        currentUsername = null;
        
        // Show login elements
        const signDiv = document.getElementById('signDiv');
        const loginButton = document.getElementById('loginNav');
        const logoutButton = document.getElementById('logoutNav');
        
        if (signDiv) signDiv.style.display = 'block';
        switchToLoggedOutUI();
        
        // Hide game interface
        const gameDiv = document.getElementById('gameDiv');
        if (gameDiv) {
            gameDiv.style.display = 'none';
        }
        
        // Soft-reset client UI to logged-out state without full page reload
        console.log('🔄 Performing soft-reset to logged-out UI (no full reload)');
        // Ensure landing page / sign-in UI is visible and hide game UI
        const landing = document.getElementById('landingPage');
        const signDivLocal = document.getElementById('signDiv');
        const gameDivLocal = document.getElementById('gameDiv');

        if (landing) landing.style.display = 'block';
        if (signDivLocal) signDivLocal.style.display = 'block';
        if (gameDivLocal) gameDivLocal.style.display = 'none';
    }
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
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    
    if (!isModerator) return;
    
    document.querySelectorAll('.column-header').forEach((header, index) => {
        const column = header.getAttribute('data-column');
        
        header.addEventListener('mouseenter', function() {
            // Only show hover effect if in manual mode or if no column is selected
            const autoColumnToggle = document.getElementById('autoColumnToggleSwitch');
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

// Experiment UI cleanup function
function clearExperimentUI() {
    console.log('🧹 Clearing all experiment UI elements');
    
    // Hide all experiment phases
    const decisionPhase = document.getElementById('decisionPhase');
    const resultsPhase = document.getElementById('resultsPhase');
    const finalResults = document.getElementById('finalResults');
    
    if (decisionPhase) decisionPhase.style.display = 'none';
    if (resultsPhase) resultsPhase.style.display = 'none';
    if (finalResults) finalResults.style.display = 'none';
    
    // Hide moderator switchboard
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    if (moderatorSwitchboard) moderatorSwitchboard.style.display = 'none';
    
    // Reset grid display
    const gridContainer = document.getElementById('gridContainer');
    if (gridContainer) {
        gridContainer.innerHTML = '';
        gridContainer.style.display = 'none';
    }
    
    // Clear any round displays
    const roundDisplay = document.getElementById('roundNumber');
    const conditionDisplay = document.getElementById('currentCondition');
    const tokenDisplay = document.getElementById('tokenPool');
    
    if (roundDisplay) roundDisplay.textContent = '';
    if (conditionDisplay) conditionDisplay.textContent = '';
    if (tokenDisplay) tokenDisplay.textContent = '';
    
    // Reset button states
    const lightningBtn = document.getElementById('lightningBtn');
    if (lightningBtn) {
        lightningBtn.textContent = '⚡ Lightning Test';
        lightningBtn.disabled = false;
        lightningBtn.style.opacity = '1';
    }
    
    // Clear any experiment progress modals
    const existingModal = document.getElementById('lightningProgressModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Clear floating animations and locked-in player states
    if (typeof lockedInPlayers !== 'undefined' && lockedInPlayers instanceof Map) {
        console.log('🧹 Clearing locked-in player animations');
        lockedInPlayers.forEach((data, username) => {
            if (data.cleanupTimeout) {
                clearTimeout(data.cleanupTimeout);
            }
        });
        lockedInPlayers.clear();
    }
    
    // Force restore all player seats to original positions
    if (typeof restoreFloatingPlayers === 'function') {
        restoreFloatingPlayers();
    }
    
    // Targeted animation cleanup - no lag inducing DOM scanning
    console.log('🧹 Performing targeted animation cleanup...');
    
    // Specifically clear player seat states
    const playerSeats = document.querySelectorAll('[id$="Player"], .player-seat');
    playerSeats.forEach(seat => {
        seat.classList.remove('floating-player', 'floating-left', 'floating-right', 'floating-top', 'floating-back');
        // Reset any inline styles that might have been applied
        seat.style.transform = '';
        seat.style.zIndex = '';
        seat.style.left = '';
        seat.style.right = '';
        seat.style.top = '';
        seat.style.animation = '';
    });
    
    // Clear any player status indicators on seats
    const playerNames = document.querySelectorAll('.player-name');
    const playerStatuses = document.querySelectorAll('.player-status');
    playerNames.forEach(nameEl => {
        nameEl.textContent = '';
        nameEl.classList.remove('locked-in', 'decision-made', 'waiting');
        nameEl.style.animation = '';
    });
    playerStatuses.forEach(statusEl => {
        statusEl.textContent = 'Empty';
        statusEl.classList.remove('locked-in', 'decision-made', 'waiting');
        statusEl.style.animation = '';
    });
    
    // Force clear body classes that might affect UI state
    document.body.classList.remove('game-active', 'experiment-running', 'lightning-active');
    
    console.log('✅ Comprehensive experiment UI and animations cleared');
}

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
    // Hide the players in room display for cleaner UI
    /*
    const playerListDiv = document.getElementById('playerList');
    if (playerListDiv) playerListDiv.innerHTML = '<strong>Players in room:</strong><br>None';
    */
}

function updatePokerTable(gameSession, currentTurnPlayer = null) {
    // Use provided currentTurnPlayer or fall back to global currentActivePlayer
    const activePlayer = currentTurnPlayer || currentActivePlayer;
    console.log('🃏 Updating poker table - activePlayer:', activePlayer, 'currentTurnPlayer:', currentTurnPlayer, 'currentActivePlayer:', currentActivePlayer);
    
    // Clear all seats first but preserve lock indicators
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            const statusDiv = seat.querySelector('.player-status');
            const aiDiv = seat.querySelector('.ai-indicator');
            
            // Preserve existing lock indicators
            const existingLocks = seat.querySelectorAll('.player-lock-indicator');
            const lockIndicators = Array.from(existingLocks).map(lock => lock.cloneNode(true));
            
            if (nameDiv) nameDiv.textContent = '';
            if (statusDiv) statusDiv.textContent = 'Empty';
            if (aiDiv) aiDiv.style.display = 'none';
            seat.style.borderColor = '#72767d'; // Dim border for empty seats
            
            // Restore lock indicators after clearing
            lockIndicators.forEach(lockIndicator => {
                seat.appendChild(lockIndicator);
            });
            
            if (lockIndicators.length > 0) {
                console.log(`🔄 Preserved ${lockIndicators.length} lock indicators for seat ${seatId}`);
            }
        } else {
            console.warn('🃏 Poker seat element not found:', seatId);
        }
    });
    
    // Safety check for gameSession
    if (!gameSession) {
        console.log('⚠️ gameSession is undefined, skipping player placement');
        return;
    }
    
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
let modal, loginButton, createRoomButton, joinRoomButton, inviteButton;

// Store current user's username
let currentUsername = null;

// Event handlers will be initialized in DOMContentLoaded

// Join chatroom
socket.on('signInResponse', function (data) {
    console.log('🔑 Received signInResponse:', data);
    
    // Reset signin progress flag
    signinInProgress = false;
    
    if (data.success) {
        console.log('✅ Login successful!');
        
        // Store the current username globally and in localStorage
        currentUsername = signDivUsername ? signDivUsername.value : null;
        if (currentUsername) {
            localStorage.setItem('username', currentUsername);
        }
        console.log('Signed in as:', currentUsername);
        
        // Store admin status and update UI
        isGlobalAdmin = data.isAdmin || false;
        
        // Immediately set currentRoom to ensure context is correct
        currentRoom = 'Global';
        console.log('🌐 Set currentRoom to Global after login');
        
        // Show loading state for user count immediately using the global userCount variable
        if (userCount) {
            userCount.innerText = 'Loading...';
        } else {
            // Fallback to direct DOM access if userCount not initialized yet
            const userCountElement = document.getElementById('userCount');
            if (userCountElement) {
                userCountElement.innerText = 'Loading...';
            }
        }
        
        //signDiv.style.display = 'none';
        landingPage.style.display = "none";
        switchToLoggedInUI(data.username);
        chatDiv.style.display = '';
        
        // Hide room pill in global chat (inline implementation since updateHeaderPills is defined later)
        const roomPill = document.getElementById('room-pill');
        if (roomPill) {
            roomPill.style.display = 'none';
        }
        
        // Update card visibility AFTER UI elements are shown
        setTimeout(() => {
            updateCardVisibility();
            console.log('🃏 Called updateCardVisibility after login');
        }, 50);
        
        // Ensure invite card visibility is updated with additional retries
        setTimeout(() => {
            updateInviteVisibility();
        }, 100);
        
        // Additional retry with longer delay to ensure DOM is fully ready
        setTimeout(() => {
            const inviteCard = document.getElementById('invite-card');
            const actionCardsContainer = document.querySelector('.action-cards-container');
            
            if (inviteCard) {
                const inviteStyles = window.getComputedStyle(inviteCard);
                
                // Fix CSS override issues
                if (inviteStyles.visibility === 'hidden' || inviteStyles.opacity === '0') {
                    inviteCard.style.setProperty('visibility', 'visible', 'important');
                    inviteCard.style.setProperty('opacity', '1', 'important');
                    inviteCard.style.setProperty('display', 'block', 'important');
                }
            }
            
            if (inviteCard && isGlobalAdmin && currentRoom === 'Global') {
                inviteCard.style.display = 'block';
                inviteCard.style.visibility = 'visible';
                inviteCard.style.opacity = '1';
                inviteCard.classList.remove('invite-hidden');
                inviteCard.classList.add('invite-visible');
                
                // Also ensure container is visible
                if (actionCardsContainer) {
                    actionCardsContainer.style.display = '';
                    actionCardsContainer.style.visibility = '';
                    actionCardsContainer.style.opacity = '';
                }
            }
            updateInviteVisibility();
        }, 500);
        
        // Stop space animations when user successfully logs in
        if (typeof window.stopSpaceAnimationsOnLogin === 'function') {
            window.stopSpaceAnimationsOnLogin();
        }
        
        // Set a timeout to join Global chat if no session restoration occurs
        let sessionRestorationHandled = false;
        
        const originalSessionHandler = socket._callbacks && socket._callbacks['sessionRestored'] && socket._callbacks['sessionRestored'][0];
        if (originalSessionHandler) {
            // Wrap the original handler to track if session restoration occurred
            socket.off('sessionRestored');
            socket.on('sessionRestored', function(sessionData) {
                sessionRestorationHandled = true;
                originalSessionHandler(sessionData);
            });
        }
        
        // Shorter timeout for faster login experience
        setTimeout(() => {
            if (!sessionRestorationHandled && currentRoom === 'Global') {
                console.log('🌐 No session restoration - joining Global chat');
                
                // Update leave button visibility (hide for Global)
                updateLeaveButtonVisibility();
                
                // Hide game interface for Global chat
                const gameDiv = document.getElementById('gameDiv');
                if (gameDiv) {
                    gameDiv.style.display = 'none';
                    console.log('🌐 Game UI hidden - joining Global chat');
                }
                
                // Join Global chat immediately
                console.log('🔌 Emitting joinRoom for Global after login');
                socket.emit('joinRoom', { room: 'Global' });
            }
        }, 10); // Reduced from 100ms to 10ms for immediate user count update
    }

    else {
        console.error('❌ Login failed:', data);
        showGlassmorphismAlert('Login Failed', 'Sign in unsuccessful. Please check your credentials and try again.', 'error');
    }
});

// EARLY REGISTRATION: LED Condition Tracker Event Handler
console.log('🔵 EARLY: Registering conditionUpdate handler...');
socket.on('conditionUpdate', function(data) {
    console.log('🚨 🚨 🚨 EARLY conditionUpdate handler called! 🚨 🚨 🚨');
    console.log('🧪 EARLY conditionUpdate event received:', JSON.stringify(data, null, 2));
    
    // Call the LED tracker functionality
    if (typeof updateConditionLED === 'function') {
        try {
            console.log('🔍 EARLY: Processing conditionUpdate data');
            
            // Extract condition info for LED tracker
            const condition = data.condition || 0;
            const round = data.round || 0;
            const blockNumber = data.blockNumber || 0;
            // Filter out moderators from players array
            const allPlayers = data.players || [];
            console.log('🔍 EARLY: All players from server:', allPlayers);
            
            // Get moderator name from DOM
            const moderatorDiv = document.getElementById('moderatorPosition');
            const moderatorNameDiv = moderatorDiv?.querySelector('.moderator-name');
            const currentModerator = moderatorNameDiv?.textContent;
            
            // Filter out the moderator by name (since server doesn't send isModerator field)
            const players = allPlayers.filter(p => p.name !== currentModerator);
            console.log('🔍 EARLY: Filtered players (no moderators):', players);
            console.log('🔍 EARLY: Current moderator detected:', currentModerator);
            
            // Initialize player names if we have a players array and haven't done so yet
            if (players && players.length > 0 && playerNameMapping.size === 0) {
                console.log('🎯 EARLY: Moderator was filtered out:', currentModerator);
                initializePlayerNamesInTracker(players);
            }
            
            // Update LED matrix - use REAL player names (no A/B/C mapping)
            let playerName = data.player;
            
            // Skip moderator check for player assignment tracking
            if (playerName) {
                const moderatorDiv = document.getElementById('moderatorPosition');
                const moderatorNameDiv = moderatorDiv?.querySelector('.moderator-name');
                const currentModerator = moderatorNameDiv?.textContent;
                
                if (playerName === currentModerator) {
                    playerName = null; // Skip tracking for moderator
                }
            }
            
            console.log(`🔗 EARLY: Using real player name: ${playerName} (no A/B/C mapping)`);
            
            updateConditionLED(condition, round, blockNumber, playerName);
            console.log('✅ EARLY: Successfully processed conditionUpdate');
            
        } catch (error) {
            console.error('❌ EARLY: Error processing conditionUpdate:', error);
        }
    } else {
        console.warn('⚠️ EARLY: updateConditionLED function not yet available');
    }
});

socket.on('signUpResponse', function (data) {
    console.log('📝 Received signUpResponse:', data);
    console.log('📝 Data success value:', data.success, 'Type:', typeof data.success);
    console.log('📝 Data autoLogin value:', data.autoLogin, 'Type:', typeof data.autoLogin);
    
    if (data.success) {
        if (data.autoLogin) {
            // Handle auto-login after successful signup
            // Note: Welcome alert is shown later - either neon room join or neon welcome
            
            // Store the current username globally and in localStorage (like normal signin)
            currentUsername = data.username;
            if (currentUsername) {
                localStorage.setItem('username', currentUsername);
            }
            console.log('Signed up and logged in as:', currentUsername);
            
            // Store the admin status and update UI like a normal sign-in
            isGlobalAdmin = data.isAdmin || false;
            
            // Update card visibility based on context and admin status
            updateCardVisibility();
            
            // Hide landing page and show chat interface
            landingPage.style.display = "none";
            loginButton.style.display = "none";
            chatDiv.style.display = '';
            
            // Close any open modals/popups
            const loginModal = document.getElementById('id01');
            if (loginModal) {
                loginModal.style.display = 'none';
                console.log('🚪 Closed login modal on auto-login success');
            }
            
            const signupModal = document.getElementById('signupModal');
            if (signupModal) {
                signupModal.style.display = 'none';
                console.log('🚪 Closed signup modal on auto-login success');
            }
            
            // Close any other potential modal overlays
            if (modal && modal.style.display !== 'none') {
                modal.style.display = 'none';
                console.log('🚪 Closed generic modal on auto-login success');
            }
            
            // Switch to logged-in UI with profile menu
            switchToLoggedInUI(data.username);
            
            // Stop space animations when user successfully logs in
            if (typeof window.stopSpaceAnimationsOnLogin === 'function') {
                window.stopSpaceAnimationsOnLogin();
            }
            
            // Join Global chat automatically, or target room if invite specified one
            setTimeout(() => {
                // Check if there's a target room from invite link
                const targetRoom = window.inviteTargetRoom;
                
                if (targetRoom && targetRoom !== 'Global') {
                    console.log('🚪 Auto-joining target room from invite:', targetRoom);
                    currentRoom = targetRoom;
                    
                    // Update leave button visibility
                    updateLeaveButtonVisibility();
                    
                    // Join the target room
                    socket.emit('joinRoom', { room: targetRoom });
                    
                    // Clear the stored target room
                    window.inviteTargetRoom = null;
                    
                    showNeonRoomJoinAlert(targetRoom);
                } else {
                    // Normal signup without target room - show neon welcome
                    console.log('🌐 Auto-joining Global chat after signup');
                    currentRoom = 'Global';
                    
                    // Update leave button visibility (hide for Global)
                    updateLeaveButtonVisibility();
                    
                    // Hide game interface for Global chat
                    const gameDiv = document.getElementById('gameDiv');
                    if (gameDiv) {
                        gameDiv.style.display = 'none';
                        console.log('🌐 Game UI hidden - joining Global chat');
                    }
                    
                    // Join Global chat
                    console.log(`🔗 Session restore: Emitting joinRoom for Global chat`);
                    socket.emit('joinRoom', { room: 'Global' });
                    
                    // Show neon welcome alert for normal signups
                    showNeonWelcomeAlert();
                }
            }, 100);
        } else {
            showGlassmorphismAlert('Account Created!', data.message || 'Sign up successful. You can now log in with your new account.', 'success');
        }
    }
    else {
        showGlassmorphismAlert('Sign Up Failed', data.message || 'Sign up unsuccessful. Please check your information.', 'error');
    }
});

// Handle invite code generation response
socket.on('inviteCodeResponse', function (data) {
    // Reset button state
    if (inviteButton) {
        inviteButton.style.opacity = '1';
        inviteButton.style.pointerEvents = 'auto';
        inviteButton.innerHTML = `Generate Invite
            <div id="invite-submenu" class="invite-submenu" style="display:none;">
                <button id="random-invite-btn" class="submenu-btn">
                    <i class="fas fa-random"></i>
                    Random Code
                </button>
                <button id="permanent-invite-btn" class="submenu-btn">
                    <i class="fas fa-crown"></i>
                    Permanent Code
                </button>
            </div>`;
        
        // Re-setup submenu event handlers after button reset
        // setupInviteSubmenuHandlers(); // Removed - using emergency fix instead
    }
    
    // Reset permanent creation button if it exists
    const createPermanentBtn = document.getElementById('createPermanentBtn');
    if (createPermanentBtn) {
        createPermanentBtn.style.opacity = '1';
        createPermanentBtn.style.pointerEvents = 'auto';
        createPermanentBtn.innerHTML = '<i class="fas fa-crown" style="margin-right: 8px;"></i>Create Permanent Code';
    }
    
    if (data.success) {
        // Close permanent modal if open
        const permanentModal = document.getElementById('permanentInviteModal');
        if (permanentModal) {
            permanentModal.style.display = 'none';
            
            // Clear the input field
            const customCodeInput = document.getElementById('customCode');
            if (customCodeInput) {
                customCodeInput.value = '';
            }
        }
        
        // Show the invite code in a special alert with copy functionality
        const codeType = data.isPermanent ? 'Permanent' : 'Single-Use';
        showInviteCodeAlert(data.inviteCode, codeType, data.targetRoom);
    } else {
        showGlassmorphismAlert('Invite Generation Failed', data.message || 'Failed to generate invite code.', 'error');
    }
});

// Get room and users
socket.on('roomUsers', ({ room, users, usersCount }) => {
    console.log(`🏠 roomUsers event received for room: ${room}, users count: ${users ? users.length : 0}, currentRoom: ${currentRoom}`);
    
    // Use actual users array length instead of potentially incorrect usersCount from server
    const actualUserCount = users ? users.length : 0;
    
    // Only update the display if this roomUsers event is for the room the user is actually in
    if (room === currentRoom) {
        console.log(`✅ Room matches currentRoom, updating user count display`);
        if (room === "Global") {
            // Update global chat users
            outputUsers(users);
            console.log(`🔍 Looking for userCount element...`);
            if (userCount) {
                console.log(`✅ Found userCount element, updating to: ${actualUserCount} online`);
                userCount.innerText = `${actualUserCount} online`;
            } else {
                console.error('❌ userCount element not found for Global room');
                // Try direct DOM access as fallback
                const userCountElement = document.getElementById('userCount');
                if (userCountElement) {
                    console.log(`✅ Found userCount via getElementById, updating to: ${actualUserCount} online`);
                    userCountElement.innerText = `${actualUserCount} online`;
                } else {
                    console.error('❌ userCount element not found via getElementById either');
                }
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
    console.log('📥 Received playersInRoom event:', {
        room: data.room,
        playerCount: data.players.length,
        players: data.players.map(p => ({
            username: p.username,
            isModerator: p.isModerator,
            isAI: p.isAI,
            seatPosition: p.seatPosition,
            triadPosition: p.triadPosition
        }))
    });
    
    // Only update if this is for our current room
    if (data.room === currentRoom) {
        // Check if the player list has actually changed to avoid unnecessary UI rebuilds
        const currentPlayers = [];
        SEAT_IDS.forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const username = seat.getAttribute('data-player-username');
                if (username) {
                    currentPlayers.push(username);
                }
            }
        });
        
        // Also check moderator
        const moderatorDiv = document.getElementById('moderatorPosition');
        const moderatorNameDiv = moderatorDiv?.querySelector('.moderator-name');
        const currentModerator = moderatorNameDiv?.textContent;
        
        // Get new player list using isModerator flag
        const newModerator = data.players.find(p => p.isModerator);
        const newParticipants = data.players.filter(p => !p.isModerator).map(p => p.username);
        
        console.log('🔄 playersInRoom change detection:', {
            currentRoom: currentRoom,
            dataRoom: data.room,
            currentModerator: currentModerator,
            newModeratorName: newModerator?.username,
            currentParticipants: currentPlayers,
            newParticipants: newParticipants,
            allPlayersInData: data.players.map(p => ({username: p.username, isModerator: p.isModerator, isAI: p.isAI}))
        });
        
        // EARLY INITIALIZATION: Initialize player names in LED tracker as soon as we have players
        // Filter out moderators and only include actual participants
        const trackerPlayers = data.players.filter(p => !p.isModerator).map(p => ({ name: p.username, isAI: p.isAI }));
        if (trackerPlayers.length > 0 && (!playerNameMapping || playerNameMapping.size === 0)) {
            console.log('🎯 EARLY: Initializing player names from playersInRoom event');
            console.log('🎯 EARLY: Participant players:', trackerPlayers);
            initializePlayerNamesInTracker(trackerPlayers);
        }
        
        // Compare lists to see if there's an actual change
        const moderatorChanged = currentModerator !== newModerator?.username;
        const participantsChanged = JSON.stringify(currentPlayers.sort()) !== JSON.stringify(newParticipants.sort());
        
        console.log('🔄 Change detection results:', {
            moderatorChanged: moderatorChanged,
            participantsChanged: participantsChanged,
            shouldUpdate: moderatorChanged || participantsChanged
        });
        
        // ALWAYS check moderator buttons regardless of whether UI needs rebuilding
        // Check if current user is the moderator and show/hide buttons accordingly
        const currentUser = data.players.find(p => p.isModerator);
        const storedUsername = localStorage.getItem('username');
        const effectiveUsername = currentUsername || storedUsername;
        const isCurrentUserModerator = currentUser && currentUser.username === effectiveUsername;
        
        console.log('🔑 Moderator check:', {
            currentUser: currentUser,
            currentUsername: currentUsername,
            storedUsername: storedUsername,
            effectiveUsername: effectiveUsername,
            isCurrentUserModerator: isCurrentUserModerator,
            data: data
        });
        
        // Store moderator status globally and update card visibility
        window.currentUserIsModerator = isCurrentUserModerator;
        updateCardVisibility();
        
        // Show/hide "Start Experiment" button based on moderator status
        const startExperimentBtn = document.getElementById('startExperimentBtn');
        if (startExperimentBtn) {
            if (newModerator && isCurrentUserModerator) {
                startExperimentBtn.style.display = 'block';
                startExperimentBtn.style.visibility = 'visible';
                startExperimentBtn.style.opacity = '1';
                console.log('✅ Showing Start Experiment button for moderator via playersInRoom');
            } else {
                startExperimentBtn.style.display = 'none';
                console.log('❌ Hiding Start Experiment button - not moderator via playersInRoom');
                console.log('   Debug: newModerator =', newModerator, 'isCurrentUserModerator =', isCurrentUserModerator);
            }
        } else {
            console.error('❌ startExperimentBtn not found in playersInRoom handler');
        }
        
        // Show/hide "Add AI Players" button based on moderator status
        let addAIBtn = document.getElementById('addAIBtn');
        if (newModerator && isCurrentUserModerator) {
            // Create Add AI button if it doesn't exist and user is moderator
            if (!addAIBtn && startExperimentBtn) {
                addAIBtn = document.createElement('button');
                addAIBtn.id = 'addAIBtn';
                addAIBtn.textContent = '🤖 Fill Room with AI';
                addAIBtn.style.cssText = 'background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%); color: white; padding: 8px 16px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; margin-left: 8px; font-weight: 500; box-shadow: 0 2px 8px rgba(88, 101, 242, 0.3); transition: all 0.2s ease;';
                addAIBtn.addEventListener('mouseover', () => {
                    addAIBtn.style.transform = 'translateY(-1px)';
                    addAIBtn.style.boxShadow = '0 4px 12px rgba(88, 101, 242, 0.4)';
                });
                addAIBtn.addEventListener('mouseout', () => {
                    addAIBtn.style.transform = 'translateY(0)';
                    addAIBtn.style.boxShadow = '0 2px 8px rgba(88, 101, 242, 0.3)';
                });
                startExperimentBtn.parentNode.appendChild(addAIBtn);
                
                // Add event listener for Add AI button with toggle functionality
                addAIBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    // Check current button state to determine action (more reliable than checking stale data)
                    const isRemovalMode = addAIBtn.textContent.includes('Remove');
                    
                    if (isRemovalMode) {
                        // Remove all AI players
                        console.log(`🚫 Button in removal mode - removing all AI players from room`);
                        socket.emit('removeAIPlayers', { 
                            room: currentRoom || 'Global'
                        });
                        console.log('🚫 Requested removal of all AI players from room:', currentRoom || 'Global');
                    } else {
                        // Add AI players to fill room - get current player count dynamically
                        console.log('🤖 Button in add mode - requesting fresh room state for accurate count');
                        
                        // Request current room state and then add AI in the response
                        window.pendingAIAdd = true;
                        socket.emit('requestRoomState', { room: currentRoom });
                    }
                });
                console.log('✅ Created Add AI Players button for moderator');
            } else if (addAIBtn) {
                addAIBtn.style.display = 'block';
                console.log('✅ Showing Add AI Players button for moderator');
            }
            
            // Update button appearance based on whether AI players exist
            if (addAIBtn) {
                const aiPlayersInRoom = data.players.filter(p => p.isAI);
                if (aiPlayersInRoom.length > 0) {
                    // Change to removal mode - red glowing button
                    addAIBtn.textContent = '❌🤖 Democratically Remove AI';
                    addAIBtn.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                    addAIBtn.style.boxShadow = '0 0 20px rgba(220, 38, 38, 0.6), 0 2px 8px rgba(220, 38, 38, 0.4)';
                    addAIBtn.style.animation = 'subtlePulse 2s infinite';
                } else {
                    // Default add mode - blue button
                    addAIBtn.textContent = '🤖 Fill Room with AI';
                    addAIBtn.style.background = 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)';
                    addAIBtn.style.boxShadow = '0 2px 8px rgba(88, 101, 242, 0.3)';
                    addAIBtn.style.animation = '';
                }
            }
        } else if (addAIBtn) {
            addAIBtn.style.display = 'none';
            console.log('❌ Hiding Add AI Players button - not moderator');
        }
        
        // Show/hide "Lightning Experiment" button for moderators
        let lightningBtn = document.getElementById('lightningBtn');
        if (newModerator && isCurrentUserModerator) {
            // Create Lightning Experiment button if it doesn't exist and user is moderator
            if (!lightningBtn && startExperimentBtn) {
                lightningBtn = document.createElement('button');
                lightningBtn.id = 'lightningBtn';
                lightningBtn.textContent = '⚡ Lightning Test';
                lightningBtn.style.cssText = 'background: linear-gradient(135deg, #c026d3 0%, #7c3aed 100%); color: white; padding: 8px 16px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; margin-left: 8px; font-weight: 500; box-shadow: 0 2px 8px rgba(192, 38, 211, 0.3); transition: all 0.2s ease;';
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
                    showLightningExperimentConfirmation();
                });
                console.log('✅ Created Lightning Experiment button for moderator');
            } else if (lightningBtn) {
                lightningBtn.style.display = 'block';
                console.log('✅ Showing Lightning Experiment button for moderator');
            }
        } else if (lightningBtn) {
            lightningBtn.style.display = 'none';
            console.log('❌ Hiding Lightning Experiment button - not moderator');
        }
        
        // Show/hide "Run Speed Test" button for ADMINs in "room test" 
        let speedTestBtn = document.getElementById('speedTestBtn');
        const isRoomTest = currentRoom && currentRoom.toLowerCase().includes('test');
        if (isGlobalAdmin && isRoomTest && startExperimentBtn) {
            // Create Speed Test button if it doesn't exist and user is admin in test room
            if (!speedTestBtn) {
                speedTestBtn = document.createElement('button');
                speedTestBtn.id = 'speedTestBtn';
                speedTestBtn.textContent = '⚡ Admin Speed Test';
                speedTestBtn.style.cssText = 'background: linear-gradient(135deg, #ff6b35 0%, #e63946 100%); color: white; padding: 8px 16px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; margin-left: 8px; font-weight: 500; box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3); transition: all 0.2s ease;';
                speedTestBtn.addEventListener('mouseover', () => {
                    speedTestBtn.style.transform = 'translateY(-1px)';
                    speedTestBtn.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)';
                });
                speedTestBtn.addEventListener('mouseout', () => {
                    speedTestBtn.style.transform = 'translateY(0)';
                    speedTestBtn.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.3)';
                });
                startExperimentBtn.parentNode.appendChild(speedTestBtn);
                
                // Add event listener for Speed Test button
                speedTestBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    // Confirm the speed test
                    if (confirm('This will add 3 AI players and run a full 441-round experiment at high speed. Continue?')) {
                        // Emit request to server to run speed test
                        socket.emit('runSpeedTest', { 
                            room: currentRoom || 'Global'
                        });
                        console.log('⚡ Requested speed test for room:', currentRoom || 'Global');
                        
                        // Disable button to prevent multiple clicks
                        speedTestBtn.disabled = true;
                        speedTestBtn.textContent = '⚡ SPEED TEST RUNNING...';
                        speedTestBtn.style.opacity = '0.6';
                    }
                });
                console.log('✅ Created Speed Test button for admin in test room');
            } else {
                speedTestBtn.style.display = 'block';
                console.log('✅ Showing Speed Test button for admin in test room');
            }
        } else if (speedTestBtn) {
            speedTestBtn.style.display = 'none';
            console.log('❌ Hiding Speed Test button - not admin or not test room');
        }
        
        // Check if this is an AI removal scenario or forced update
        const previousAICount = currentPlayers.filter(name => {
            // Check if any previous player names suggest they were AI
            return name && (name.includes('AI Player') || name.includes('Bot'));
        }).length;
        const newAICount = data.players.filter(p => p.isAI).length;
        const aiPlayersRemoved = previousAICount > newAICount;
        const forceUpdate = window.forceNextPlayersUpdate === true;
        
        if (forceUpdate) {
            console.log('🔄 Forced playersInRoom update requested');
            window.forceNextPlayersUpdate = false; // Clear the flag
        }
        
        // Handle pending AI add request
        if (window.pendingAIAdd) {
            console.log('🤖 Processing pending AI add request...');
            window.pendingAIAdd = false;
            
            const currentPlayerCount = data.players.length;
            const maxPlayers = 4;
            const aiPlayersNeeded = maxPlayers - currentPlayerCount;
            
            if (aiPlayersNeeded > 0) {
                console.log(`🤖 Current players: ${currentPlayerCount}, Adding ${aiPlayersNeeded} AI players to fill room`);
                socket.emit('addAIPlayers', { 
                    room: currentRoom || 'Global',
                    count: aiPlayersNeeded
                });
            } else {
                console.log(`🤖 Room already at capacity (${currentPlayerCount} players)`);
            }
            
            // Don't process the rest of playersInRoom since we're about to get another update
            return;
        }
        
        if (!moderatorChanged && !participantsChanged && data.players.length <= 2 && !aiPlayersRemoved && !forceUpdate) {
            // Only skip updates if there are no significant changes AND we have minimal players AND no AI was removed AND not forced
            console.log('🔄 playersInRoom received but no changes detected - skipping UI rebuild to preserve game state');
            return;
        }
        
        if (aiPlayersRemoved) {
            console.log('🤖 AI players removed detected - forcing UI update');
        }
        if (forceUpdate) {
            console.log('🔄 Force flag detected - processing UI update');
        }
        
        console.log('🔄 Player list changed, updating UI:', {
            moderatorChanged,
            participantsChanged,
            oldParticipants: currentPlayers,
            newParticipants: newParticipants
        });
        
        // Find the moderator (room creator/first player)
        const moderator = data.players.find(p => p.isModerator) || data.players[0];
        
        console.log('👑 Moderator display update:', {
            moderator: moderator,
            moderatorDiv: !!moderatorDiv,
            moderatorDivDisplay: moderatorDiv?.style.display,
            allPlayers: data.players.map(p => ({username: p.username, isModerator: p.isModerator}))
        });
        
        // Update moderator position
        if (moderator) {
            // Ensure moderatorDiv exists (defensive programming)
            if (!moderatorDiv) {
                console.warn('👑 moderatorPosition element not found, searching again...');
                // Try to find it again
                const foundModeratorDiv = document.getElementById('moderatorPosition');
                if (foundModeratorDiv) {
                    console.log('👑 Found moderatorPosition on retry');
                    // Update the reference for the rest of this function
                    const moderatorNameDiv = foundModeratorDiv.querySelector('.moderator-name');
                    if (moderatorNameDiv) {
                        moderatorNameDiv.textContent = moderator.username;
                        console.log('👑 Updated moderator name via retry to:', moderator.username);
                    }
                } else {
                    console.error('👑 moderatorPosition element still not found after retry');
                }
            } else {
                const moderatorNameDiv = moderatorDiv.querySelector('.moderator-name');
                
                if (moderatorNameDiv) {
                    moderatorNameDiv.textContent = moderator.username;
                    console.log('👑 Updated existing moderator name to:', moderator.username);
                } else {
                    // Add moderator name if div doesn't exist (should not happen given the HTML)
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'moderator-name';
                    nameDiv.style.cssText = 'color: #9b59b6; font-size: 13px; font-weight: bold;';
                    nameDiv.textContent = moderator.username;
                    moderatorDiv.appendChild(nameDiv);
                    console.log('👑 Created new moderator name div for:', moderator.username);
                }
            }
        } else {
            console.warn('👑 No moderator found in player data:', data.players);
        }
        
        // Get non-moderator players (participants) - exclude moderator from seat placement
        const participantPlayers = data.players.filter(p => !p.isModerator);
        
        console.log('🎯 Participant placement:', {
            totalPlayers: data.players.length,
            moderator: moderator?.username,
            participants: participantPlayers.map(p => ({username: p.username, isAI: p.isAI})),
            seatIds: SEAT_IDS
        });
        
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
                
                console.log('🧹 Cleared seat:', seatId);
            } else {
                console.warn('🧹 Seat not found for clearing:', seatId);
            }
        });
        
        // Place participant players in seats
        const seatIds = SEAT_IDS;
        console.log('🎯 Available seat IDs:', seatIds);
        
        // Check if all required DOM elements exist before proceeding
        const availableSeats = [];
        seatIds.forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const nameDiv = seat.querySelector('.player-name');
                const statusDiv = seat.querySelector('.player-status');
                if (nameDiv && statusDiv) {
                    availableSeats.push(seatId);
                } else {
                    console.warn(`🎯 Seat ${seatId} is missing required child elements:`, {
                        nameDiv: !!nameDiv,
                        statusDiv: !!statusDiv
                    });
                }
            } else {
                console.warn(`🎯 Seat element ${seatId} not found in DOM`);
            }
        });
        
        console.log('🎯 Available seats for placement:', availableSeats);
        
        // Map server seat positions to client seat IDs
        const seatPositionMap = {
            'left': 'leftPlayer',
            'top': 'topPlayer',
            'right': 'rightPlayer'
        };
        
        participantPlayers.forEach((player, index) => {
            // Use server-assigned seatPosition if available, otherwise fallback to index
            let seatId;
            if (player.seatPosition && seatPositionMap[player.seatPosition]) {
                seatId = seatPositionMap[player.seatPosition];
                console.log(`🎯 Using server-assigned seat for ${player.username}: ${player.seatPosition} -> ${seatId}`);
            } else {
                // Fallback to index-based assignment
                seatId = availableSeats[index];
                console.log(`⚠️ No server seat position for ${player.username}, using index ${index} -> ${seatId}`);
            }
            
            const seat = document.getElementById(seatId);
            
            if (seat) {
                console.log(`🎯 Placing ${player.username} (${player.isAI ? 'AI' : 'Human'}) in seat ${seatId} (triadPosition: ${player.triadPosition})`);
                
                const nameDiv = seat.querySelector('.player-name');
                const statusDiv = seat.querySelector('.player-status');
                const aiDiv = seat.querySelector('.ai-indicator');
                const walletDiv = seat.querySelector('.player-wallet');
                
                if (nameDiv) nameDiv.textContent = player.username;
                // Use triadPosition for P1/P2/P3 label if available, otherwise use index
                if (statusDiv) statusDiv.textContent = player.triadPosition ? `P${player.triadPosition}` : `P${index + 1}`;
                
                // Show AI indicator if it's an AI player
                if (aiDiv) {
                    if (player.isAI) {
                        aiDiv.style.display = 'block';
                    } else {
                        aiDiv.style.display = 'none';
                    }
                }
                
                // Display wallet totals (only for non-moderators)
                if (walletDiv && !player.isModerator) {
                    const totalEarnings = player.totalEarnings || 0;
                    walletDiv.textContent = `$${totalEarnings.toFixed(2)}`;
                } else if (walletDiv && player.isModerator) {
                    walletDiv.textContent = ''; // Moderators don't have wallets
                }
                
                // Store player data for wallet updates
                seat.setAttribute('data-player-username', player.username);
                
                // Highlight active seat
                seat.style.borderColor = '#7289da';
                
                console.log(`✅ Successfully placed ${player.username} in ${seatId} as P${player.triadPosition || index + 1}`);
                
                // Process any pending lock indicators for this player
                if (pendingLockIndicators.has(player.username)) {
                    const lockData = pendingLockIndicators.get(player.username);
                    console.log(`🔄 Processing pending lock indicator for ${player.username}`);
                    
                    // Apply visual lock indicator
                    applyLockIndicator(lockData);
                    
                    // IMPORTANT: Also trigger the full floating animation that was missed during initial lock-in
                    console.log(`🎭 Triggering deferred floating animation for ${player.username}`);
                    console.log(`🎭 Function params: seat=${!!seat}, lockData=${!!lockData}, username=${player.username}`);
                    triggerPlayerSeatAnimation(seat, lockData, player.username);
                }
                
            } else {
                console.error(`❌ Seat element ${seatId} not found during placement`);
            }
        });
        
        // Also update the player list display - COMMENTED OUT FOR CLEANER UI
        /*
        const usernames = data.players.map(p => {
            let name = p.isAI ? `🤖 ${p.username}` : p.username;
            if (p === moderator) name += ' (Moderator)';
            return name;
        });
        const playerListDiv = document.getElementById('playerList');
        if (playerListDiv) {
            playerListDiv.innerHTML = `<strong>Players in room:</strong><br>${usernames.join('<br>')}`;
        }
        */
        
        // Show triad formation popup with current status
        const participantCount = participantPlayers.length;
        const totalCount = data.players.length;
        const playerCountText = participantCount >= 3 ? 
            `Triad Complete! (${totalCount} total: 1 moderator + ${participantCount} participants)` : 
            `Need ${3 - participantCount} more players... (${totalCount} total: 1 moderator + ${participantCount} participants)`;
        
        // Find moderator for position info
        const moderatorPlayer = data.players.find(p => p.isModerator);
        const userIsModerator = moderatorPlayer && moderatorPlayer.username === currentUsername;
        const moderatorText = userIsModerator ? `You are the moderator` : '';
        
        // Only show the triad formation popup in NEW rooms before the game has started (lobby phase)
        // Check multiple conditions to ensure we're truly in lobby state:
        // 1. No active game (gameActive = false)
        // 2. Current round is 0 (no rounds have started)
        // 3. User is on game screen (not chat screen)
        // 4. Lobby phase is visible (not decision/results phase)
        const gameDiv = document.getElementById('gameDiv');
        const lobbyPhase = document.getElementById('lobbyPhase');
        const decisionPhase = document.getElementById('decisionPhase');
        const isOnGameScreen = gameDiv && gameDiv.style.display !== 'none';
        const isInLobbyPhase = lobbyPhase && lobbyPhase.style.display !== 'none';
        const isNotInDecisionPhase = !decisionPhase || decisionPhase.style.display === 'none';
        
        // Only show popup if ALL conditions indicate we're in true lobby state
        if (!gameActive && currentRoundNumber === 0 && isOnGameScreen && isInLobbyPhase && isNotInDecisionPhase) {
            showTriadFormationPopup(playerCountText, moderatorText, data.players);
            console.log('🎯 Showing triad formation popup - in lobby phase');
        } else {
            // Log the reason for not showing the popup for debugging
            const reasons = [];
            if (gameActive) reasons.push('game is active');
            if (currentRoundNumber > 0) reasons.push(`round ${currentRoundNumber} in progress`);
            if (!isOnGameScreen) reasons.push('not on game screen');
            if (!isInLobbyPhase) reasons.push('not in lobby phase');
            if (!isNotInDecisionPhase) reasons.push('in decision phase');
            
            console.log('⚠️ Skipping triad formation popup:', reasons.join(', '));
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
    const dropdown = document.getElementById('incentivePlayerSwitch');
    if (!dropdown) return;
    
    // Store the current selection
    const currentSelection = dropdown.value;
    
    // Clear existing options
    dropdown.innerHTML = '<option value="">Select a player...</option>';
    
    // Add player options (exclude AI players and moderators for incentives)
    players.forEach(player => {
        if (!player.isAI && !player.isModerator) {
            const option = document.createElement('option');
            option.value = player.username;
            option.textContent = player.username;
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
    console.log("Room Created: "+roomName);
    
    // Force clear any experiment state that might interfere with UI
    gameActive = false;
    currentRoundNumber = 0;
    document.body.classList.remove('game-active', 'experiment-running', 'lightning-active');
    
    roomNameText.style.display ="";
    socket.emit('joinRoom', roomName );
    currentRoom = roomName; // Update current room tracking
    roomNameText.innerText = roomName;
    
    // Show game interface immediately when moderator creates room
    showGameInterface();
    
    // Initialize moderator status and buttons for room creator (with delay to ensure DOM ready)
    setTimeout(() => {
        initializeModeratorUI(roomName);
    }, 10);
    
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

// Function to initialize moderator UI when creating or joining a room as moderator
function initializeModeratorUI(roomName) {
    console.log('🎯 Initializing moderator UI for room:', roomName);
    
    // Force establish moderator status aggressively 
    window.currentUserIsModerator = true;
    currentUsername = localStorage.getItem('username');
    
    // Comprehensive button visibility setup with detailed debugging
    const setupButton = (attempt = 1) => {
        console.log(`🔧 Button setup attempt ${attempt}...`);
        const startExperimentBtn = document.getElementById('startExperimentBtn');
        
        if (startExperimentBtn) {
            // Log current state
            console.log('🔍 Button found - current state:', {
                display: startExperimentBtn.style.display,
                visibility: startExperimentBtn.style.visibility,
                opacity: startExperimentBtn.style.opacity,
                computedDisplay: window.getComputedStyle(startExperimentBtn).display,
                computedVisibility: window.getComputedStyle(startExperimentBtn).visibility
            });
            
            // Force show with multiple approaches
            startExperimentBtn.style.cssText = startExperimentBtn.style.cssText.replace(/display\s*:\s*none/gi, '');
            startExperimentBtn.style.display = 'block';
            startExperimentBtn.style.visibility = 'visible';
            startExperimentBtn.style.opacity = '1';
            startExperimentBtn.style.pointerEvents = 'auto';
            
            // Remove any classes that might hide it
            startExperimentBtn.classList.remove('hidden', 'invisible', 'd-none');
            
            // Verify it's actually visible
            const finalState = window.getComputedStyle(startExperimentBtn);
            console.log('✅ Button configured - final state:', {
                display: finalState.display,
                visibility: finalState.visibility,
                opacity: finalState.opacity
            });
            
            if (finalState.display === 'none') {
                console.warn('⚠️ Button still hidden after setup - CSS override detected');
                // Try using !important
                startExperimentBtn.setAttribute('style', 
                    startExperimentBtn.getAttribute('style') + '; display: block !important; visibility: visible !important;'
                );
            }
            
            return true;
        } else {
            console.warn(`⚠️ startExperimentBtn not found on attempt ${attempt}`);
            return false;
        }
    };
    
    // Immediate setup
    if (!setupButton(1)) {
        // Fallback attempts with increasing delays
        setTimeout(() => setupButton(2), 50);
        setTimeout(() => setupButton(3), 150);
        setTimeout(() => setupButton(4), 300);
    }
    
    // Update card visibility with new context
    updateCardVisibility();
    
    console.log('✅ Moderator UI initialization complete with comprehensive button setup');
}

// Function to show game interface inline
function showGameInterface() {
    console.log('🎮 showGameInterface() called for room:', currentRoom);
    
    // Only show game interface for non-Global rooms
    if (currentRoom === 'Global' || !currentRoom) {
        console.log('🚫 Not showing game interface - user is in Global chat or no room');
        return;
    }
    
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
                
                // Fallback: Check button visibility after room state request
                setTimeout(() => {
                    const startBtn = document.getElementById('startExperimentBtn');
                    if (startBtn && window.currentUserIsModerator && startBtn.style.display === 'none') {
                        console.log('🔧 FALLBACK: Force showing Start Experiment button for moderator');
                        startBtn.style.display = 'block';
                        startBtn.style.visibility = 'visible';
                        startBtn.style.opacity = '1';
                    }
                }, 200);
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
    
    // Don't automatically set gameActive = true here
    // This will be set when an experiment actually starts
    // For now, just show the room interface without game-active state
    
    // Update card visibility for room context (not game context yet)
    updateCardVisibility();
    
    // Clear inline styles to let CSS take over
    if (createRoomButton) {
        createRoomButton.style.display = '';
    }
    if (joinRoomButton) {
        joinRoomButton.style.display = '';
    }
    
    console.log('🎮 Game interface setup complete');
}

// Output message to DOM
function outputMessage(message) {

if(message.type == "broadcast"){
    console.log("📢 Processing broadcast message:", message);
    //If message is a broadcast, send to ALL rooms with special styling
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
    
    // Add broadcast icon/indicator
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
    
    // Add to both global and room chat with error checking
    try {
        if (globalChatMessages) {
            const globalDiv = div.cloneNode(true);
            globalChatMessages.appendChild(globalDiv);
            console.log("📢 Broadcast added to global chat");
        } else {
            console.error("❌ globalChatMessages element not found");
        }
        
        if (roomChatMessages) {
            const roomDiv = div.cloneNode(true);
            roomChatMessages.appendChild(roomDiv);
            console.log("📢 Broadcast added to room chat");
        } else {
            console.error("❌ roomChatMessages element not found");
        }
        
        // Auto-scroll both chat areas
        if (globalChatMessages) globalChatMessages.scrollTop = globalChatMessages.scrollHeight;
        if (roomChatMessages) roomChatMessages.scrollTop = roomChatMessages.scrollHeight;
        
    } catch (error) {
        console.error("❌ Error displaying broadcast message:", error);
    }
    
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
            p.innerHTML = `<span style="color: magenta; font-weight: bold;">${message.username}</span> <span style="color: #ff6b35; font-size: 14px;">🪪</span>`;
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
    // The server may send a string ("Global") or an object ({ room: 'Global' })
    const roomName = (typeof room === 'object' && room && room.room) ? room.room : room;
    currentRoom = roomName; // Ensure currentRoom is updated when server confirms room join

    // Update leave button visibility based on room
    updateLeaveButtonVisibility();

    // If joining Global, don't show the room-name pill (prevents duplicate "Global" tab)
    if (roomName === 'Global') {
        console.log('🌐 Joined Global - ensuring only the global tab is shown');

        // Hide room name pill if present
        if (roomNameText) {
            roomNameText.innerText = '';
            roomNameText.style.display = 'none';
            roomNameText.style.backgroundColor = '';
        }

        // Ensure global chat is visible and styled as active
        if (globalChatMessages) globalChatMessages.style.display = '';
        if (globalNameText) globalNameText.style.backgroundColor = 'green';

        // Ensure room chat is hidden
        if (roomChatMessages) roomChatMessages.style.display = 'none';

        // Reset any game visuals/state since we're in Global
        gameActive = false;
        document.body.classList.remove('game-active');
        resetGameVisuals();
        return;
    }

    // Joining a non-Global room 
    console.log('🔄 Joined room:', roomName);
    resetGameVisuals();

    // Update room name display if elements are available
    if (roomNameText) {
        roomNameText.innerText = roomName;
        roomNameText.style.display = "";
        roomNameText.style.backgroundColor = "green";
    } else {
        console.log(`❌ roomNameText element not found, cannot display room name`);
    }

    // Show game interface immediately when joining a room
    showGameInterface();
    console.log('🎮 Showing game board for player joining room');

    // Enable CSV download button since we're in an experiment room
    const csvDownloadBtn = document.getElementById('csvDownloadBtn');
    const csvStatus = document.getElementById('csvStatus');
    if (csvDownloadBtn) {
        csvDownloadBtn.disabled = false;
        csvDownloadBtn.title = 'Download experiment data as CSV';
    }
    if (csvStatus) {
        csvStatus.textContent = `Ready for ${roomName}`;
        csvStatus.style.color = '#43b581';
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
    const landingPage = document.getElementById('landingPage');
    
    if (gameDiv) {
        gameDiv.style.display = 'none';
        console.log('✅ Game interface hidden');
    }
    
    // Show landing page and chat container when returning to Global
    if (landingPage) {
        landingPage.style.display = 'block';
        console.log('✅ Landing page shown');
    }
    
    if (chatDiv) {
        chatDiv.style.display = '';  // Use empty string like the login handlers
        console.log('✅ Chat container shown');
    }
    
    // Clear the poker table and all experiment UI
    clearPokerTable();
    clearExperimentUI();
    
    // Hide control buttons
    const startBtn = document.getElementById('startExperimentBtn');
    const aiBtn = document.getElementById('addAIPlayersBtn');
    const addAIBtn = document.getElementById('addAIBtn');
    
    if (startBtn) startBtn.style.display = 'none';
    if (aiBtn) aiBtn.style.display = 'none';
    if (addAIBtn) addAIBtn.remove(); // Remove dynamically created button
    
    // Disable CSV download button since we're leaving the experiment room
    const csvDownloadBtn = document.getElementById('csvDownloadBtn');
    const csvStatus = document.getElementById('csvStatus');
    if (csvDownloadBtn) {
        csvDownloadBtn.disabled = true;
        csvDownloadBtn.title = 'Start an experiment to enable CSV download';
    }
    if (csvStatus) {
        csvStatus.textContent = 'No data available';
        csvStatus.style.color = '#b9bbbe';
    }
    
    // Reset game state FIRST (before showing cards)
    gameActive = false;
    document.body.classList.remove('game-active');
    currentRoom = 'Global';
    
    // Close triad formation popup when leaving room
    closeTriadFormationPopup();
    
    // Update card visibility for global context
    updateCardVisibility();
    
    // Ensure action cards container is visible after leaving room
    const actionCardsContainer = document.querySelector('.action-cards-container');
    if (actionCardsContainer) {
        actionCardsContainer.style.display = '';
        actionCardsContainer.style.visibility = '';
        actionCardsContainer.style.opacity = '';
    }
    
    // Update invite visibility for admins
    updateInviteVisibility();
    
    // Clear any inline styles to let CSS take over
    console.log('🔧 Attempting to show cards after leaving room');
    console.log('🔧 createRoomButton:', createRoomButton);
    console.log('🔧 joinRoomButton:', joinRoomButton);
    console.log('🔧 body classes after changes:', document.body.className);
    
    if (createRoomButton) {
        console.log('🔧 createRoomButton current display:', createRoomButton.style.display);
        console.log('🔧 createRoomButton computed style:', window.getComputedStyle(createRoomButton).display);
        createRoomButton.style.display = ''; // Clear inline styles to let CSS take over
        console.log('🔧 Cleared createRoomButton inline display');
    }
    if (joinRoomButton) {
        console.log('🔧 joinRoomButton current display:', joinRoomButton.style.display);
        console.log('🔧 joinRoomButton computed style:', window.getComputedStyle(joinRoomButton).display);
        joinRoomButton.style.display = ''; // Clear inline styles to let CSS take over
        console.log('🔧 Cleared joinRoomButton inline display');
    }
    
    // Force reflow and check computed styles after a brief delay
    setTimeout(() => {
        console.log('🔧 Post-delay computed styles:');
        if (createRoomButton) {
            console.log('🔧 createRoomButton final computed style:', window.getComputedStyle(createRoomButton).display);
            if (window.getComputedStyle(createRoomButton).display === 'none') {
                console.log('❌ createRoomButton still hidden - forcing display');
                createRoomButton.style.display = 'block';
                createRoomButton.style.visibility = 'visible';
                createRoomButton.style.opacity = '1';
            }
        }
        if (joinRoomButton) {
            console.log('🔧 joinRoomButton final computed style:', window.getComputedStyle(joinRoomButton).display);
            if (window.getComputedStyle(joinRoomButton).display === 'none') {
                console.log('❌ joinRoomButton still hidden - forcing display');
                joinRoomButton.style.display = 'block';
                joinRoomButton.style.visibility = 'visible';
                joinRoomButton.style.opacity = '1';
            }
        }
        
        // Force a DOM reflow to ensure styles are applied
        document.body.offsetHeight;
        console.log('🔧 Forced DOM reflow completed');
        
        // Nuclear option: call the force show function
        console.log('🚨 NUCLEAR OPTION: Calling forceShowCards()');
        if (window.forceShowCards) {
            window.forceShowCards();
        }
    }, 200);
    
    // Clear room moderator status and update card visibility
    window.currentUserIsModerator = false;
    updateCardVisibility();
    
    // Update leave button visibility (hide for Global)
    updateLeaveButtonVisibility();
    
    // Update header pills to hide room pill in global
    updateHeaderPills();
    
    // Switch back to global chat
    if (globalChatMessages) globalChatMessages.style.display = "";
    if (globalNameText) globalNameText.style.backgroundColor = "#667aff";
    if (roomChatMessages) roomChatMessages.style.display = "none";
    
    console.log('✅ Returned to Global chat and cleared all room data');
});

socket.on('experimentEnded', function(data) {
    console.log('🛑 Experiment ended:', data);
    
    // Show retro-future neon stat screen with full experiment data
    showExperimentEndedModal(data);
    
    // User will refresh by clicking "Return to Global Chat" button
    
    // Reset game state immediately and completely
    gameActive = false;
    document.body.classList.remove('game-active', 'experiment-running', 'lightning-active');
    currentRoom = 'Global';
    currentRoundNumber = 0;
    
    // Simple targeted cleanup
    console.log('🧹 Performing targeted experiment cleanup...');
    
    // Clear all experiment UI elements
    clearExperimentUI();
    
    // Clear the poker table completely
    clearPokerTable();
    
    // Reset Player.list to clear any lingering player data
    Player.list = {};
    
    // Clear locked-in players map
    if (typeof lockedInPlayers !== 'undefined' && lockedInPlayers instanceof Map) {
        lockedInPlayers.clear();
    }
    
    // Update card visibility for global context
    updateCardVisibility();
    
    // Hide any open modals or menus
    hideModeratorContextMenu();
    
    console.log('🛑 Experiment ended, waiting for leftRoom event to handle UI transition...');
    
    // Simple post-cleanup state verification
    setTimeout(() => {
        console.log('🔍 Post-cleanup: Ensuring Global state is properly established');
        currentRoom = 'Global';
        document.body.classList.remove('game-active', 'experiment-running', 'lightning-active');
    }, 100);
});

// Lightning Test Progress Handler
socket.on('lightningTestProgress', function(data) {
    console.log(`⚡ Lightning test progress: Round ${data.round}/${data.totalRounds}`);
    
    // Show or update progress modal
    if (data.round === 1) {
        showLightningTestProgressModal(data);
    } else {
        updateLightningTestProgress(data);
    }
    
    // Update lightning button text to show progress
    const lightningBtn = document.getElementById('lightningBtn');
    if (lightningBtn) {
        lightningBtn.textContent = `⚡ Round ${data.round}/${data.totalRounds}`;
        lightningBtn.disabled = true;
        lightningBtn.style.opacity = '0.8';
    }
});

// Lightning Test Complete Handler
socket.on('lightningTestComplete', function(data) {
    console.log('⚡ Lightning test completed:', data);
    
    // Close progress modal
    closeLightningTestProgressModal();
    
    // Re-enable lightning button
    const lightningBtn = document.getElementById('lightningBtn');
    if (lightningBtn) {
        lightningBtn.textContent = '⚡ Lightning Experiment';
        lightningBtn.disabled = false;
        lightningBtn.style.opacity = '1';
    }
    
    // Store CSV data globally for download
    window.lightningTestCsvData = data.csvData;
    window.lightningTestDataLog = data.dataLog;
    
    // Show completion modal with stats after a brief delay
    setTimeout(() => {
        showLightningTestResults(data.message, data.stats, data.duration, data.csvData);
    }, 500);
});

socket.on("gameStarted", function(){
    // Entity.js handles all game initialization after sending gameStarted
    // No need to send beginGame back to server
    console.log('🎮 Game started by moderator');
});




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
    console.log('📡 Full init data:', data);
    
    // Reset all game visuals for fresh experiment start
    if (currentRoom !== 'Global') {
        resetGameVisuals();
        console.log('🔄 Reset game visuals for experiment initialization');
    }
    
    if(data.selfId){
        selfId = data.selfId;
        console.log('🔑 SelfId set to:', selfId);
    }
    
    
    if(data.player && data.player.length > 0 && (currentRoom !== "Global" || data.selfId)) {
        gameDiv.style.display = 'inline-block';
        gameActive = true; // Mark game as active
        
        // Close triad formation popup when game initializes
        closeTriadFormationPopup();
        
        // Add game-active class to body for styling
        document.body.classList.add('game-active');
        
        // Update card visibility for game context
        updateCardVisibility();
        
        // Clear inline styles to let CSS take over (CSS will hide them with game-active class)
        if (createRoomButton) {
            createRoomButton.style.display = '';
        }
        if (joinRoomButton) {
            joinRoomButton.style.display = '';
        }
        
        // Clear existing players before adding new ones
        Player.list = {};
        
        // Initialize players
        for (var i = 0; i < data.player.length; i++) {
            new Player(data.player[i]);
        }
        
        // EARLY INITIALIZATION: Initialize LED tracker with real player names at game start
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
            
            if (players.length > 0) {
                initializePlayerNamesInTracker(players);
            } else {
                console.warn('⚠️ No non-moderator players found for LED tracker');
            }
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
        
        // Remove game-active class from body
        document.body.classList.remove('game-active');
        
        // Update card visibility for non-game context
        updateCardVisibility();
        document.body.classList.remove('game-active');
        
        // Show create room and join room buttons when game is not active (if in appropriate context)
        if (createRoomButton && currentRoom !== "Global") {
            createRoomButton.style.display = 'block';
        }
        if (joinRoomButton && currentRoom !== "Global") {
            joinRoomButton.style.display = 'block';
        }
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
    console.log('🎯 Full triadComplete data:', data);
    
    // Close the triad formation popup immediately when triad is complete
    closeTriadFormationPopup();
    
    // DEBUG: Check if poker table elements exist when triadComplete is received
    console.log('🔍 DOM Check at triadComplete:');
    console.log('  - leftPlayer exists:', !!document.getElementById('leftPlayer'));
    console.log('  - topPlayer exists:', !!document.getElementById('topPlayer'));
    console.log('  - rightPlayer exists:', !!document.getElementById('rightPlayer'));
    console.log('  - gameDiv display:', document.getElementById('gameDiv') ? document.getElementById('gameDiv').style.display : 'not found');
    
    // Update player position and status
    document.getElementById('playerPosition').textContent = `You are Player ${data.playerPosition}`;
    
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
            addAIBtn.textContent = 'Fill Room with AI Players (3-Player Triad)';
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
                    addAIBtn.textContent = 'Fill Room with AI Players (3-Player Triad)';
                    addAIBtn.disabled = false;
                }, 2000);
            });
        }
        addAIBtn.style.display = 'inline-block';
    }
    
    // Update condition info (only for moderators)
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    const conditionInfoElement = document.getElementById('conditionInfo');
    if (conditionInfoElement && isModerator) {
        conditionInfoElement.textContent = `Condition: ${data.gameSession.condition}`;
    }
    
    // Safe access to gameSession properties
    if (data.gameSession) {
        document.getElementById('maxRounds').textContent = data.gameSession.maxRounds;
        // Set up grid with random symbols
        updateDecisionGrid(data.gameSession.grid);
    } else {
        console.warn('⚠️ gameSession is undefined in yourTurn event, skipping maxRounds and grid setup');
    }
    
    gameActive = true;
    gameDiv.style.display = 'inline-block';
});

// AI players added
socket.on('aiPlayersAdded', function(data) {
    console.log('🤖 AI players added:', data);
    
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
    console.log('🎯 yourTurn event received:', data);
    console.log('🎯 isYourTurn:', data.isYourTurn, 'isModerator:', data.isModerator, 'activePlayer:', data.activePlayer);
    console.log('🎯 DOM state check - gameDiv exists:', !!document.getElementById('gameDiv'));
    console.log('🎯 DOM state check - decisionPhase exists:', !!document.getElementById('decisionPhase'));
    console.log('🎯 DOM state check - selectionSection exists:', !!document.getElementById('selectionSection'));
    
    // Close the triad formation popup when actual gameplay starts
    closeTriadFormationPopup();
    
    // Set game as active since we're now in active gameplay
    gameActive = true;
    
    // IMMEDIATE gameDiv protection at yourTurn start
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
            console.log('🎯 Made gameDiv visible');
        } else {
            console.log('🎯 gameDiv already visible:', gameDiv.style.display);
        }
    } else {
        console.log('❌ gameDiv not found');
        return; // Early return if critical element missing
    }
    
    // Restore any floating players from previous round
    restoreFloatingPlayers();
    
    // Restore or reset client-side lock-in state
    if (data.currentChoice !== undefined && data.isLockedIn !== undefined) {
        // Restore previous choice and locked-in status for reconnecting players
        // Restore previous choice if it exists
        selectedChoice = data.currentChoice;
        isLockedIn = data.isLockedIn;
    } else {
        // Reset for new round
        selectedChoice = null;
        isLockedIn = false;
    }
    
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
    
    // Show and update current token value display (below checkerboard)
    const currentTokenValueDisplay = document.getElementById('currentTokenValueDisplay');
    if (currentTokenValueDisplay) {
        currentTokenValueDisplay.style.display = 'block';
        // Update token values from server data if available
        if (data.condition && typeof data.condition === 'object' && 
            data.condition.whiteValue && data.condition.blackValue) {
            const whiteValueEl = document.getElementById('currentWhiteTokenValue');
            const blackValueEl = document.getElementById('currentBlackTokenValue');
            if (whiteValueEl) whiteValueEl.textContent = `$${data.condition.whiteValue.toFixed(2)}`;
            if (blackValueEl) blackValueEl.textContent = `$${data.condition.blackValue.toFixed(2)}`;
            
            // Color-code background based on condition
            const innerBox = currentTokenValueDisplay.querySelector('div');
            if (innerBox && data.condition.name) {
                let bgColor, borderColor;
                switch (data.condition.name) {
                    case 'High Operant':
                        // Blue for high-operant
                        bgColor = 'rgba(88, 101, 242, 0.3)';
                        borderColor = 'rgba(88, 101, 242, 0.5)';
                        break;
                    case 'Equal Culturant-Operant':
                        // Green for equal operant-culturant
                        bgColor = 'rgba(67, 181, 129, 0.3)';
                        borderColor = 'rgba(67, 181, 129, 0.5)';
                        break;
                    case 'High Culturant':
                        // Yellow for high culturant
                        bgColor = 'rgba(250, 166, 26, 0.3)';
                        borderColor = 'rgba(250, 166, 26, 0.5)';
                        break;
                    default:
                        // Default gray for baseline or unknown
                        bgColor = 'rgba(54, 57, 63, 0.8)';
                        borderColor = 'rgba(114, 118, 125, 0.2)';
                }
                innerBox.style.background = bgColor;
                innerBox.style.borderColor = borderColor;
                innerBox.style.transition = 'background 0.3s ease, border-color 0.3s ease';
            }
        }
    }
    
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
    
    // Update selection UI elements based on restored or reset state
    const selectedChoiceDiv = document.getElementById('selectedChoice');
    const lockInBtn = document.getElementById('lockInBtn');
    const lockInText = document.getElementById('lockInText');
    
    if (selectedChoiceDiv) {
        if (selectedChoice !== null) {
            selectedChoiceDiv.textContent = `Selected: Row ${selectedChoice}`;
            selectedChoiceDiv.style.color = '#faa61a';
            console.log(`🔄 Restored selected choice UI: Row ${selectedChoice}`);
        } else {
            selectedChoiceDiv.textContent = 'No selection made';
            selectedChoiceDiv.style.color = '#6c757d';
        }
    }
    
    if (lockInBtn && lockInText) {
        if (isLockedIn) {
            lockInBtn.disabled = true;
            lockInText.textContent = '✅ Choice Locked In';
            lockInBtn.style.background = 'linear-gradient(135deg, #28a745, #218838)';
            lockInBtn.style.cursor = 'not-allowed';
            console.log(`🔄 Restored locked-in UI state`);
        } else if (selectedChoice !== null) {
            lockInBtn.disabled = false;
            lockInText.textContent = 'Lock in';
            lockInBtn.style.background = 'linear-gradient(135deg, #faa61a, #e8941a)';
            lockInBtn.style.cursor = 'pointer';
            console.log(`🔄 Restored enabled lock-in button`);
        } else {
            lockInBtn.disabled = true;
            lockInText.textContent = 'Lock in';
            lockInBtn.style.background = 'linear-gradient(135deg, #5865f2, #4752c4)';
            lockInBtn.style.cursor = 'not-allowed';
        }
    }
    
    // Reset row styles and restore selected row if applicable
    document.querySelectorAll('.clickable-row').forEach(row => {
        row.style.opacity = '0.7';
        row.style.transform = 'scale(1)';
        row.style.boxShadow = 'none';
        row.style.backgroundColor = 'transparent';
    });
    
    // Restore selected row highlighting if choice was restored
    if (selectedChoice !== null) {
        const selectedRow = document.querySelector(`.clickable-row[data-row="${selectedChoice}"]`);
        if (selectedRow) {
            selectedRow.style.opacity = '1';
            selectedRow.style.transform = 'scale(1.02)';
            selectedRow.style.boxShadow = '0 4px 12px rgba(250, 166, 26, 0.3)';
            selectedRow.style.backgroundColor = 'rgba(250, 166, 26, 0.1)';
            console.log(`🔄 Restored row ${selectedChoice} highlighting`);
        }
    }
    
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
    
    // Show/hide moderator switchboard control
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    if (moderatorSwitchboard) {
        moderatorSwitchboard.style.display = data.isModerator ? 'block' : 'none';
        
        // Show/hide moderator cumulative earnings section
        const moderatorCumulativeEarnings = document.getElementById('moderatorCumulativeEarnings');
        if (moderatorCumulativeEarnings) {
            moderatorCumulativeEarnings.style.display = data.isModerator ? 'block' : 'none';
        }
        
        // Hide tokenUpdate div for moderators - update both left and right versions
        const tokenUpdateElements = document.querySelectorAll('.tokenUpdate');
        tokenUpdateElements.forEach(element => {
            element.style.display = data.isModerator ? 'none' : 'block';
        });
        
        // Initialize switchboard functionality for moderators
        if (data.isModerator) {
            // Add a small delay to ensure DOM is fully updated
            setTimeout(() => {
                addColumnHoverEffects();
                initializeSwitchboardFunctions();
            }, 100);
            
            // Update moderator status panel with current round info
            const conditionStatusDisplay = document.getElementById('currentConditionDisplay');
            if (conditionStatusDisplay && data.condition && data.condition.name) {
                conditionStatusDisplay.textContent = data.condition.name;
            }
            
            const roundDisplay = document.getElementById('currentRoundDisplay');
            if (roundDisplay && data.round) {
                // Calculate round within current block (1-63)
                const roundInBlock = ((data.round - 1) % 63) + 1;
                roundDisplay.textContent = `${roundInBlock}/63`;
            }
            
            // Update incentive player display
            const incentivePlayerDisplay = document.getElementById('currentIncentivePlayerDisplay');
            if (incentivePlayerDisplay) {
                if (data.player && data.incentive && data.incentive !== 'No Incentive') {
                    // Use incentiveDisplay for user-friendly text, fallback to raw incentive
                    incentivePlayerDisplay.textContent = `${data.player} (${data.incentiveDisplay || data.incentive})`;
                } else {
                    incentivePlayerDisplay.textContent = 'None';
                }
            }
            
            // Block display will be updated by roundResult, but initialize if we have data
            const blockStatusDisplay = document.getElementById('currentBlockDisplay');
            if (blockStatusDisplay && data.blockNumber) {
                blockStatusDisplay.textContent = `${data.blockNumber}/3`;
            } else if (blockStatusDisplay) {
                blockStatusDisplay.textContent = '1/3';
            }
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
    
    // Update token pool display if data is available
    if (data.whiteTokensRemaining !== undefined) {
        const totalTokens = data.initialWhiteTokens || TOKEN_CONFIG.CONDITIONS_TOKENS;
        updateTokenPoolDisplay(data.whiteTokensRemaining, totalTokens);
        console.log('🎯 yourTurn: Token pool updated:', data.whiteTokensRemaining, '/', totalTokens);
    }
    
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
    
    // Reset game visuals at the start of each new round (clears any stuck animations)
    resetGameVisuals();
    console.log('🔄 Reset game visuals for new round start');
    
    // Close the triad formation popup when game starts
    closeTriadFormationPopup();
    
    // Initialize round results panel on first round
    if (data.round === 1) {
        initializeRoundResultsPanel();
    }
    
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
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    const conditionInfoElement = document.getElementById('conditionInfo');
    if (conditionInfoElement && isModerator) {
        conditionInfoElement.textContent = `Condition: ${data.condition}`;
    }
    
    console.log('🔄 NEW ROUND - Token pool update data:', {
        whiteTokensRemaining: data.whiteTokensRemaining,
        initialWhiteTokens: data.initialWhiteTokens,
        dataKeys: Object.keys(data),
        elementExists: !!document.getElementById('globalTokenPool'),
        currentTextContent: document.getElementById('globalTokenPool') ? document.getElementById('globalTokenPool').textContent : 'N/A'
    });
    
    // Update token pool display with dynamic max value
    if (data.whiteTokensRemaining !== undefined) {
        const maxTokens = data.initialWhiteTokens || TOKEN_CONFIG.CONDITIONS_TOKENS; // fallback to CONDITIONS_TOKENS if not provided
        updateTokenPoolDisplay(data.whiteTokensRemaining, maxTokens);
        console.log('🔄 NewRound: Token pool updated:', data.whiteTokensRemaining, '/', maxTokens);
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

// Function to update token conversion display (handles both left and right versions for responsive layout)
function updateTokenConversionDisplay(whiteValue, blackValue) {
    const whiteTokenElements = document.querySelectorAll('.whiteTokenValue');
    const blackTokenElements = document.querySelectorAll('.blackTokenValue');
    const conversionDisplays = document.querySelectorAll('#tokenConversionDisplayLeft, #tokenConversionDisplayRight');
    
    // Update all white token value elements
    whiteTokenElements.forEach(element => {
        element.textContent = `$${whiteValue.toFixed(2)}`;
    });
    
    // Update all black token value elements
    blackTokenElements.forEach(element => {
        element.textContent = `$${blackValue.toFixed(2)}`;
    });
    
    // Show all conversion displays
    conversionDisplays.forEach(display => {
        display.style.display = 'block';
    });
    
    if (whiteTokenElements.length > 0 && blackTokenElements.length > 0) {
        console.log(`💰 Updated token conversion display: White=$${whiteValue.toFixed(2)}, Black=$${blackValue.toFixed(2)}`);
    }
}

// LED Condition Tracker Management
let conditionTracker = {
    // Track occurrences per block: condition -> round -> count
    currentBlock: 1,
    occurrences: {},
    // Track player assignments per condition: condition -> player -> count
    playerCounts: {}
};

function initializeConditionTracker() {
    // Reset tracker for new block
    conditionTracker.occurrences = {};
    conditionTracker.playerCounts = {};
    
    // Reset all LEDs to off state
    const allLEDs = document.querySelectorAll('.led-indicator');
    allLEDs.forEach(led => {
        led.className = 'led-indicator off';
    });
    
    // Reset all player counters
    const allCounters = document.querySelectorAll('.player-counter .count');
    allCounters.forEach(counter => {
        counter.textContent = '0';
    });
    
    // Remove active state from player counters
    const allPlayerCounters = document.querySelectorAll('.player-counter');
    allPlayerCounters.forEach(counter => {
        counter.classList.remove('active');
    });
    
    console.log('🔵 LED Condition Tracker initialized for new block');
}

// Test function for debugging player counter creation
function debugPlayerCounterState(playerName, conditionKey) {
    console.log(`🔍 DEBUGGING COUNTER STATE for ${playerName} in ${conditionKey}`);
    
    // Check if the player counter element exists
    const playerCounter = document.querySelector(`[data-player="${playerName}"][data-condition="${conditionKey}"]`);
    console.log(`🔍 Player counter element:`, playerCounter);
    if (playerCounter) {
        console.log(`🔍 Player counter details:`, {
            tagName: playerCounter.tagName,
            className: playerCounter.className,
            dataPlayer: playerCounter.getAttribute('data-player'),
            dataCondition: playerCounter.getAttribute('data-condition'),
            innerHTML: playerCounter.innerHTML,
            style: playerCounter.style.cssText
        });
        
        // Check for the count span inside
        const countSpan = playerCounter.querySelector('.count');
        console.log(`🔍 Count span element:`, countSpan);
        if (countSpan) {
            console.log(`🔍 Count span details:`, {
                tagName: countSpan.tagName,
                className: countSpan.className,
                textContent: countSpan.textContent,
                innerHTML: countSpan.innerHTML
            });
        } else {
            console.error(`❌ Count span not found inside player counter for ${playerName}`);
        }
    } else {
        console.error(`❌ Player counter element not found for ${playerName} in ${conditionKey}`);
        
        // Check what similar elements exist
        const allPlayerElements = document.querySelectorAll(`[data-player="${playerName}"]`);
        console.log(`🔍 All elements with data-player="${playerName}":`, allPlayerElements.length);
        allPlayerElements.forEach((el, i) => {
            console.log(`  ${i+1}:`, {
                tagName: el.tagName,
                dataCondition: el.getAttribute('data-condition'),
                innerHTML: el.innerHTML
            });
        });
        
        const allConditionElements = document.querySelectorAll(`[data-condition="${conditionKey}"]`);
        console.log(`🔍 All elements with data-condition="${conditionKey}":`, allConditionElements.length);
        allConditionElements.forEach((el, i) => {
            console.log(`  ${i+1}:`, {
                tagName: el.tagName,
                dataPlayer: el.getAttribute('data-player'),
                innerHTML: el.innerHTML
            });
        });
    }
}
window.testPlayerCounter = function(conditionKey, playerName) {
    console.log(`🧪 Testing player counter creation...`);
    console.log(`Condition: ${conditionKey}, Player: ${playerName}`);
    
    // Simulate the data that would come from conditionUpdate
    const testData = {
        condition: conditionKey === 'HIGH_CULTURANT' ? 'High Culturant' : 
                  conditionKey === 'HIGH_OPERANT' ? 'High Operant' : 'Equal Culturant–Operant',
        round: 1,
        blockNumber: 1,
        player: playerName,
        incentive: 'Self Control Incentive'
    };
    
    console.log(`🧪 Simulating conditionUpdate with:`, testData);
    updateExperimentalHUD(testData);
};

// Test function to manually trigger LED update
window.testLEDUpdate = function() {
    console.log(`🧪 Testing LED update with sample data...`);
    updateConditionLED('High Culturant', 1, 1, 'TestPlayer');
};

// Debug function to manually test tom counter
window.testTomCounter = function() {
    console.log(`🧪 Testing tom counter specifically...`);
    
    // First, create counter for tom
    const success = createDynamicPlayerCounter('HIGH_CULTURANT', 'tom');
    console.log(`🧪 Tom counter creation success: ${success}`);
    
    // Then test updating it
    setTimeout(() => {
        updateConditionLED('High Culturant', 1, 1, 'tom');
    }, 500);
};

// Debug function to show all current counters
window.showAllCounters = function() {
    console.log(`🔍 === COUNTER DEBUG REPORT ===`);
    
    const allCounters = document.querySelectorAll('[data-player]:not([data-player=""])');
    console.log(`📊 Found ${allCounters.length} total counters:`);
    
    allCounters.forEach((counter, index) => {
        console.log(`  ${index + 1}. Player: "${counter.getAttribute('data-player')}", Condition: "${counter.getAttribute('data-condition')}", Display: "${counter.style.display}", Content: "${counter.innerHTML}"`);
    });
    
    const placeholders = document.querySelectorAll('.dynamic-player');
    console.log(`📝 Found ${placeholders.length} remaining placeholders:`);
    
    placeholders.forEach((placeholder, index) => {
        console.log(`  ${index + 1}. Condition: "${placeholder.getAttribute('data-condition')}", Player: "${placeholder.getAttribute('data-player') || 'NONE'}", Display: "${placeholder.style.display}"`);
    });
};

function createDynamicPlayerCounter(conditionKey, playerName) {
    // CRITICAL: Final safeguard - never create counters for moderators
    // Check if player name matches current moderator
    const moderatorDiv = document.getElementById('moderatorPosition');
    const moderatorNameDiv = moderatorDiv?.querySelector('.moderator-name');
    const currentModerator = moderatorNameDiv?.textContent;
    
    if (playerName === currentModerator) {
        console.warn(`🚫 FINAL BLOCK: Refusing to create counter for moderator "${playerName}"`);
        return false;
    }
    
    console.log(`🎯 createDynamicPlayerCounter called:`, {
        conditionKey: conditionKey,
        playerName: playerName
    });
    
    // Find all placeholder elements for this condition
    const placeholderElements = document.querySelectorAll(`span.dynamic-player[data-condition="${conditionKey}"]`);
    
    if (placeholderElements.length === 0) {
        console.error(`❌ No placeholder elements found for condition: ${conditionKey}`);
        console.log(`🔍 Available placeholders:`, Array.from(document.querySelectorAll('.dynamic-player')).map(el => el.getAttribute('data-condition')));
        return false;
    }
    
    console.log(`✅ Found ${placeholderElements.length} placeholder elements for ${conditionKey}`);
    
    // Check if this player counter already exists for this condition
    const existingCounter = document.querySelector(`[data-player="${playerName}"][data-condition="${conditionKey}"]`);
    if (existingCounter) {
        console.log(`⚠️ Player counter already exists for ${playerName} in ${conditionKey}`);
        // Make sure it's visible
        existingCounter.style.display = 'inline-block';
        return true;
    }
    
    // Find the first available placeholder that hasn't been assigned yet
    let availablePlaceholder = null;
    for (let placeholder of placeholderElements) {
        if (!placeholder.hasAttribute('data-player') || placeholder.getAttribute('data-player') === '') {
            availablePlaceholder = placeholder;
            break;
        }
    }
    
    if (!availablePlaceholder) {
        console.warn(`⚠️ No available placeholders for ${playerName} in condition ${conditionKey}`);
        return false;
    }
    
    console.log(`🔧 Converting placeholder to player counter for ${playerName}`);
    
    // Convert the placeholder to a player counter
    availablePlaceholder.setAttribute('data-player', playerName);
    availablePlaceholder.setAttribute('title', `${playerName} assignments`);
    availablePlaceholder.innerHTML = `${playerName}:<span class="count">0</span>`;
    
    // CRITICAL: Make it visible and style it properly
    availablePlaceholder.style.display = 'inline-block';
    availablePlaceholder.style.visibility = 'visible';
    availablePlaceholder.style.opacity = '1';
    availablePlaceholder.style.marginLeft = '8px';
    availablePlaceholder.style.padding = '2px 6px';
    availablePlaceholder.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    availablePlaceholder.style.borderRadius = '3px';
    availablePlaceholder.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    
    // Keep both classes for styling and identification
    // availablePlaceholder.classList.remove('dynamic-player'); // Keep this for CSS styling
    
    console.log(`✅ Successfully created player counter for ${playerName} in ${conditionKey}`);
    console.log(`🔍 Element after creation:`, {
        dataPlayer: availablePlaceholder.getAttribute('data-player'),
        dataCondition: availablePlaceholder.getAttribute('data-condition'),
        innerHTML: availablePlaceholder.innerHTML,
        classes: availablePlaceholder.className,
        display: availablePlaceholder.style.display,
        visibility: availablePlaceholder.style.visibility
    });
    
    // Debug: Verify the counter can be found immediately after creation
    debugPlayerCounterState(playerName, conditionKey);
    
    return true;
}

function updateConditionLED(condition, round, blockNumber, player) {
    console.log(`🔍 updateConditionLED called with:`, {
        condition: condition,
        round: round,
        blockNumber: blockNumber,
        player: player,
        playerType: typeof player
    });
    
    // Only track conditions mode (not baseline)
    if (!condition || condition === 'Baseline') {
        console.log(`🔍 Skipping LED update - condition is baseline or empty`);
        return;
    }
    
    // Skip tracking for moderators - check if this player is the moderator
    const moderatorDiv = document.getElementById('moderatorPosition');
    const moderatorNameDiv = moderatorDiv?.querySelector('.moderator-name');
    const currentModerator = moderatorNameDiv?.textContent;
    
    // Also check if we have stored moderator information from playersInRoom
    const storedUsername = localStorage.getItem('username');
    const effectiveUsername = currentUsername || storedUsername;
    const isPlayerTheModerator = (player === effectiveUsername && window.currentUserIsModerator);
    
    console.log(`🔍 Moderator check debug:`, {
        player: player,
        moderatorDiv: !!moderatorDiv,
        moderatorNameDiv: !!moderatorNameDiv,
        currentModerator: currentModerator,
        storedUsername: storedUsername,
        effectiveUsername: effectiveUsername,
        isPlayerTheModerator: isPlayerTheModerator,
        currentUserIsModerator: window.currentUserIsModerator,
        isDOMMatch: player === currentModerator,
        shouldSkip: (player && currentModerator && player === currentModerator) || isPlayerTheModerator
    });
    
    if ((player && currentModerator && player === currentModerator) || isPlayerTheModerator) {
        console.log(`🚫 Skipping LED update - ${player} is the moderator, not a participant`);
        return;
    }
    
    // Convert display name to constant name for HTML data attributes
    let conditionKey;
    console.log(`🔍 Condition matching debug: received="${condition}" (length: ${condition ? condition.length : 0})`);
    switch(condition) {
        case 'High Culturant':
            conditionKey = 'HIGH_CULTURANT';
            console.log(`✅ Matched High Culturant → ${conditionKey}`);
            break;
        case 'High Operant':
            conditionKey = 'HIGH_OPERANT';
            console.log(`✅ Matched High Operant → ${conditionKey}`);
            break;
        case 'Equal Culturant–Operant':
            conditionKey = 'EQUAL_CULTURANT_OPERANT';
            console.log(`✅ Matched Equal Culturant–Operant → ${conditionKey}`);
            break;
        default:
            console.warn(`⚠️ Unknown condition: "${condition}" (chars: ${condition ? Array.from(condition).map(c => `${c}(${c.charCodeAt(0)})`).join(' ') : 'null'})`);
            return;
    }
    
    // Reset tracker if new block started
    if (blockNumber && blockNumber !== conditionTracker.currentBlock) {
        conditionTracker.currentBlock = blockNumber;
        initializeConditionTracker();
    }
    
    // Initialize condition tracking if not exists
    if (!conditionTracker.occurrences[conditionKey]) {
        conditionTracker.occurrences[conditionKey] = {};
    }
    if (!conditionTracker.playerCounts[conditionKey]) {
        conditionTracker.playerCounts[conditionKey] = {};
    }
    
    // For conditions mode, each condition gets exactly 21 rounds per block
    // The round number should be 1-21 within each condition, not global
    let conditionRound = round;
    
    // If this is a global round number > 21, we need to calculate which round within this condition
    if (typeof round === 'number') {
        // In a 63-round block: rounds 1-21 = condition 1, rounds 22-42 = condition 2, rounds 43-63 = condition 3
        // But we don't know which condition this is, so we'll use a different approach
        // We'll just track each unique round-condition pair once
        conditionRound = round;
    }
    
    // Create a unique key for this condition-round pair within the block
    const uniqueKey = `${conditionKey}-${conditionRound}`;
    
    // Check if we've already processed this exact condition-round combination
    if (conditionTracker.occurrences[conditionKey][uniqueKey]) {
        console.warn(`⚠️ Duplicate processing detected for ${condition} round ${conditionRound} - skipping to prevent false error`);
        return;
    }
    
    // Mark this condition-round as processed
    conditionTracker.occurrences[conditionKey][uniqueKey] = 1;
    
    // Calculate which LED position to light (1-7 for each condition)
    // We need to determine which of the 7 LEDs within this condition to light
    // For now, we'll use a simple counter approach
    const processedRounds = Object.keys(conditionTracker.occurrences[conditionKey]).length;
    const ledPosition = Math.min(processedRounds, 7); // Cap at 7 LEDs per condition
    
    // Update player count
    const playerKey = player || 'None';
    
    console.log(`🔍 LED Update Debug DETAILED:`);
    console.log(`   condition: "${condition}"`);
    console.log(`   player: "${player}" (type: ${typeof player})`);
    console.log(`   playerKey: "${playerKey}" (type: ${typeof playerKey})`);
    console.log(`   conditionKey: "${conditionKey}"`);
    console.log(`🔍 conditionTracker.playerCounts:`, conditionTracker.playerCounts);
    
    // Create dynamic player counter if it doesn't exist (including 'None')
    if (!conditionTracker.playerCounts[conditionKey][playerKey]) {
        conditionTracker.playerCounts[conditionKey][playerKey] = 0;
        console.log(`🆕 Initializing counter for ${playerKey} in ${conditionKey}`);
        
        // For 'None', check if static counter exists, otherwise create dynamic counter
        if (playerKey === 'None') {
            const existingNoneCounter = document.querySelector(`[data-player="None"][data-condition="${conditionKey}"]`);
            if (existingNoneCounter) {
                console.log(`✅ Found existing static None counter for ${conditionKey}`);
                // Make sure it's visible (it should be by default, but just in case)
                existingNoneCounter.style.display = 'inline-block';
            } else {
                console.log(`🆕 Creating dynamic None counter for ${conditionKey}`);
                const success = createDynamicPlayerCounter(conditionKey, playerKey);
                console.log(`🆕 Counter creation result for ${playerKey}: ${success}`);
            }
        } else {
            // For regular players, always try to create dynamic counter
            const success = createDynamicPlayerCounter(conditionKey, playerKey);
            console.log(`🆕 Counter creation result for ${playerKey}: ${success}`);
            if (!success) {
                console.warn(`⚠️ Failed to create counter for ${playerKey} in ${conditionKey} - no available placeholders`);
            }
        }
    }
    
    // Increment player count
    if (conditionTracker.playerCounts[conditionKey][playerKey] !== undefined) {
        const oldCount = conditionTracker.playerCounts[conditionKey][playerKey];
        conditionTracker.playerCounts[conditionKey][playerKey]++;
        const newCount = conditionTracker.playerCounts[conditionKey][playerKey];
        console.log(`📊 Updated counter: ${playerKey} in ${conditionKey}: ${oldCount} → ${newCount}`);
        
        // Update player counter display
        const playerCounterSelector = `[data-player="${playerKey}"][data-condition="${conditionKey}"] .count`;
        console.log(`🎯 Looking for counter element with selector: ${playerCounterSelector}`);
        
        const playerCounterElement = document.querySelector(playerCounterSelector);
        if (playerCounterElement) {
            const oldValue = playerCounterElement.textContent;
            playerCounterElement.textContent = newCount;
            console.log(`✅ Updated counter display for ${playerKey}: ${oldValue} → ${newCount}`);
            
            // Add visual feedback for the update
            playerCounterElement.style.fontWeight = 'bold';
            playerCounterElement.style.color = '#4CAF50';
            setTimeout(() => {
                playerCounterElement.style.fontWeight = '';
                playerCounterElement.style.color = '';
            }, 1000);
        } else {
            console.error(`❌ Counter element not found for ${playerKey} in ${conditionKey}`);
            
            // Call debug function to analyze the issue
            debugPlayerCounterState(playerKey, conditionKey);
            
            // Enhanced debugging: Check what elements exist
            console.log(`🔍 Debug: Looking for elements with data-player="${playerKey}"`);
            const playerElements = document.querySelectorAll(`[data-player="${playerKey}"]`);
            console.log(`🔍 Found ${playerElements.length} elements with data-player="${playerKey}":`, 
                Array.from(playerElements).map(el => ({
                    tagName: el.tagName,
                    dataCondition: el.getAttribute('data-condition'),
                    innerHTML: el.innerHTML,
                    classes: el.className
                }))
            );
            
            console.log(`🔍 Debug: Looking for elements with data-condition="${conditionKey}"`);
            const conditionElements = document.querySelectorAll(`[data-condition="${conditionKey}"]`);
            console.log(`🔍 Found ${conditionElements.length} elements with data-condition="${conditionKey}":`,
                Array.from(conditionElements).map(el => ({
                    tagName: el.tagName,
                    dataPlayer: el.getAttribute('data-player'),
                    innerHTML: el.innerHTML,
                    classes: el.className
                }))
            );
            
            // Try alternative selectors
            const altSelector1 = `[data-condition="${conditionKey}"][data-player="${playerKey}"] .count`;
            const altElement1 = document.querySelector(altSelector1);
            console.log(`🔍 Alternative selector "${altSelector1}" found:`, !!altElement1);
            
            if (altElement1) {
                altElement1.textContent = newCount;
                console.log(`✅ Updated counter using alternative selector!`);
            }
        }
        
        // Highlight current player
        const allPlayerCounters = document.querySelectorAll(`[data-condition="${conditionKey}"] .player-counter`);
        allPlayerCounters.forEach(counter => counter.classList.remove('active'));
        
        const currentPlayerCounter = document.querySelector(
            `[data-player="${playerKey}"][data-condition="${conditionKey}"]`
        );
        if (currentPlayerCounter) {
            currentPlayerCounter.classList.add('active');
        }
    }
    
    // Find the LED element for this condition and LED position
    const ledElement = document.querySelector(
        `[data-condition="${conditionKey}"][data-round="${ledPosition}"] .led-indicator`
    );
    
    if (ledElement) {
        // Always show green for normal processing (no duplicates since we prevent them above)
        ledElement.className = 'led-indicator green';
        console.log(`🟢 LED updated: ${condition} position ${ledPosition} - Normal occurrence (Player ${playerKey})`);
    } else {
        console.warn(`⚠️ LED not found for condition: ${conditionKey}, position: ${ledPosition}`);
    }
}

// Function to update experimental HUD with condition and incentive information
function updateExperimentalHUD(data) {
    // Note: LED tracker is updated separately in conditionUpdate handler to avoid conflicts
    
    // Update condition display
    const conditionDisplay = document.getElementById('currentCondition');
    if (conditionDisplay) {
        conditionDisplay.textContent = data.condition;
        conditionDisplay.className = 'condition-' + data.condition.toLowerCase().replace(/\s+/g, '-').replace(/–/g, '-');
    }
    
    // Update incentive display
    const incentiveDisplay = document.getElementById('currentIncentive');
    if (incentiveDisplay) {
        const displayText = data.incentiveDisplay || data.incentive;
        incentiveDisplay.textContent = displayText;
        incentiveDisplay.className = 'incentive-' + data.incentive.toLowerCase().replace(/\s+/g, '-');
    }
    
    // Update block progress if in conditions mode
    if (data.blockNumber) {
        const blockDisplay = document.getElementById('blockProgress');
        if (blockDisplay) {
            blockDisplay.textContent = `Block ${data.blockNumber}/7`;
        }
    }
    
    // Update assigned player if applicable
    if (data.player) {
        const playerDisplay = document.getElementById('assignedPlayer');
        if (playerDisplay) {
            playerDisplay.textContent = `Player: ${data.player}`;
        }
    }
    
    // Check if current user is moderator
    const isModerator = window.currentUserIsModerator || false;
    
    if (!isModerator) {
        // Non-moderators don't get the experimental info panel - only incentive notifications
        const hasIncentive = data.incentive && data.incentive !== 'No Incentive';
        
        // Remove any existing experimental panel for non-moderators
        const existingPanel = document.getElementById('experimentalInfo');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // Show prominent incentive notification ONLY to the target player
        if (hasIncentive && data.player) {
            const incentiveDisplay = data.incentiveDisplay || data.incentive;
            
            // Get current username from multiple sources
            const storedUsername = localStorage.getItem('username');
            const effectiveUsername = currentUsername || storedUsername;
            
            console.log(`🎁 Incentive check: player=${data.player}, currentUser=${effectiveUsername}, incentive=${incentiveDisplay}`);
            
            if (effectiveUsername === data.player) {
                console.log(`🎁 Active incentive for current player: ${incentiveDisplay}`);
                
                // Create or update prominent incentive banner
                showIncentiveBanner(incentiveDisplay);
            } else {
                console.log(`🎁 Incentive not for current player (${effectiveUsername}), hiding banner`);
                hideIncentiveBanner();
            }
        } else {
            // Remove incentive banner if no incentive or not the target player
            hideIncentiveBanner();
        }
        return; // Exit early for non-moderators
    }
    
    // MODERATOR STATUS UPDATES - Update fixed status panel in control board
    
    // Update current condition display
    const conditionStatusDisplay = document.getElementById('currentConditionDisplay');
    if (conditionStatusDisplay) {
        conditionStatusDisplay.textContent = data.condition;
    }
    
    // Update current round display with round count in block (x/63 format)
    const roundDisplay = document.getElementById('currentRoundDisplay');
    if (roundDisplay) {
        if (data.blockNumber) {
            // Calculate round within current block (1-63)
            const roundInBlock = ((data.round - 1) % 63) + 1;
            roundDisplay.textContent = `${roundInBlock}/63`;
        } else {
            roundDisplay.textContent = `Round ${data.round || 0}`;
        }
    }
    
    // Update incentive player display
    const incentivePlayerDisplay = document.getElementById('currentIncentivePlayerDisplay');
    if (incentivePlayerDisplay) {
        if (data.player && data.incentive !== 'No Incentive') {
            incentivePlayerDisplay.textContent = `${data.player} (${data.incentiveDisplay || data.incentive})`;
        } else {
            incentivePlayerDisplay.textContent = 'None';
        }
    }
    
    // Update block display
    const blockStatusDisplay = document.getElementById('currentBlockDisplay');
    if (blockStatusDisplay) {
        if (data.blockNumber) {
            blockStatusDisplay.textContent = `${data.blockNumber}/3`;
        } else {
            blockStatusDisplay.textContent = 'N/A';
        }
    }
    
    // Remove any existing floating experimental panel since we now have fixed display
    const existingPanel = document.getElementById('experimentalInfo');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    console.log('🧪 Updated experimental status display in moderator control panel');
}

// Function to update all player wallet displays
function updateAllWalletDisplays(playersData) {
    console.log('💰 Updating wallet displays for all players');
    console.log('💰 Players data received:', playersData);
    
    // Check moderator status
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
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
    
    // Skip pendingTokenUpdates and animations for historical restoration rounds
    if (data.showDetails === false) {
        console.log('📚 Historical round result - skipping animations and token updates');
        return;
    }
    
    // Detect if user is moderator (used throughout this handler)
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    
    // Ensure gameDiv is visible at start of round result processing
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
        }
    }
    
    // Show results phase immediately - keep both results and selection section visible
    document.getElementById('resultsPhase').style.display = 'block';
    
    // Store token update data to apply when the return animation triggers (only for current round results)
    if (data.totalTokens && data.totalEarnings !== undefined) {
        pendingTokenUpdates = {
            totalTokens: data.totalTokens,
            totalEarnings: data.totalEarnings,
            whiteTokensRemaining: data.whiteTokensRemaining,
            isModerator: isModerator
        };
        console.log('🎯 Stored pending token updates for later application:', pendingTokenUpdates);
    } else {
        console.log('❌ Invalid token data in roundResult, skipping pendingTokenUpdates');
    }

    // Trigger token updates when return animation starts (after a longer delay)
    setTimeout(() => {
        if (pendingTokenUpdates && pendingTokenUpdates.totalTokens) {
            console.log('🎯 Applying token updates as return animation begins');
            
            // Update personal token displays (don't update personal tokens for moderators)
            if (!pendingTokenUpdates.isModerator) {
                if (pendingTokenUpdates.totalTokens.white !== undefined && pendingTokenUpdates.totalTokens.black !== undefined) {
                    document.getElementById('whiteTokens').textContent = pendingTokenUpdates.totalTokens.white;
                    document.getElementById('blackTokens').textContent = pendingTokenUpdates.totalTokens.black;
                }
                if (pendingTokenUpdates.totalEarnings !== undefined) {
                    document.getElementById('totalEarnings').textContent = `$${pendingTokenUpdates.totalEarnings.toFixed(2)}`;
                }
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
        
        console.log('🎯 ROUND RESULT - Token pool update data:', {
            whiteTokensRemaining: data.whiteTokensRemaining,
            initialWhiteTokens: data.initialWhiteTokens,
            dataKeys: Object.keys(data),
            elementExists: !!document.getElementById('globalTokenPool'),
            currentTextContent: document.getElementById('globalTokenPool') ? document.getElementById('globalTokenPool').textContent : 'N/A'
        });
        
        // Update token pool display with dynamic max value
        if (data.whiteTokensRemaining !== undefined) {
            const totalTokens = data.initialWhiteTokens || TOKEN_CONFIG.CONDITIONS_TOKENS;
            updateTokenPoolDisplay(data.whiteTokensRemaining, totalTokens);
            console.log('🎯 Token pool updated:', data.whiteTokensRemaining, '/', totalTokens);
        }
        
        // Update token pool progress bar
        const tokenPoolBar = document.getElementById('tokenPoolBar');
        console.log('🎯 Token pool bar element found:', !!tokenPoolBar);
        
        if (tokenPoolBar) {
            // Use dynamic total based on experiment phase - default to CONDITIONS_TOKENS if not provided
            const totalTokens = data.initialWhiteTokens || TOKEN_CONFIG.CONDITIONS_TOKENS;
            const percentage = Math.max(0, (data.whiteTokensRemaining / totalTokens) * 100);
            const oldWidth = tokenPoolBar.style.width;
            tokenPoolBar.style.width = `${percentage}%`;
            console.log(`🎯 Token pool bar updated: ${oldWidth} → ${percentage}% (${data.whiteTokensRemaining}/${totalTokens})`);
            
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
    
    // Update round results title (both left and right versions for responsive layout)
    const roundResultsTitles = document.querySelectorAll('.roundResultsTitle');
    if (roundResultsTitles.length > 0 && data.round) {
        roundResultsTitles.forEach(title => {
            title.textContent = `Round ${data.round} Results`;
        });
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
    
    // Check if we have restored round history that we should preserve
    const roundResultsDivs = document.querySelectorAll('.roundResults');
    const hasRestoredHistory = roundResultsDivs.length > 0 && roundResultsDivs[0].querySelector('#persistentRoundHistory');
    
    if (hasRestoredHistory && data.showDetails === false) {
        // This is a historical round result sent during restoration - don't overwrite the history display
        console.log('📚 Preserving restored round history, skipping roundResults update');
    } else {
        // This is a current round result, safe to update both left and right versions
        roundResultsDivs.forEach(div => {
            div.innerHTML = resultsHTML;
        });
    }
    
    // Display token awards with earnings inline (hide for moderators) - update both left and right versions
    const tokenUpdateElements = document.querySelectorAll('.tokenUpdate');
    if (tokenUpdateElements.length > 0) {
        if (isModerator) {
            // Hide token update div for moderators and clear content
            tokenUpdateElements.forEach(element => {
                element.style.display = 'none';
                element.innerHTML = '';
            });
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
            
            tokenUpdateElements.forEach(element => {
                element.innerHTML = tokenHTML;
            });
        }
    }

    // Clear the separate round earnings element since we're now showing inline
    const roundEarningsElements = document.querySelectorAll('.roundEarnings');
    roundEarningsElements.forEach(element => {
        element.textContent = '';
    });
    
    // Display active incentive status (only for moderators) - update both left and right versions
    const incentiveElements = document.querySelectorAll('.activeIncentive');
    incentiveElements.forEach(element => {
        if (isModerator && data.activeIncentive) {
            element.textContent = `Active Incentive: ${data.activeIncentive.charAt(0).toUpperCase() + data.activeIncentive.slice(1)}`;
            element.style.color = '#faa61a';
        } else if (isModerator && !data.activeIncentive) {
            element.textContent = 'No Active Incentive';
            element.style.color = '#72767d';
        } else {
            // Hide incentive info for non-moderators
            element.textContent = '';
        }
    });
    
    // Update culturant count from server data
    if (data.culturantsProduced !== undefined) {
        const culturantCountElement = document.getElementById('culturantCount');
        if (culturantCountElement) {
            culturantCountElement.textContent = data.culturantsProduced;
            console.log('🎯 Updated culturant count to:', data.culturantsProduced);
        }
    }
    
    // Display culturant status - update both left and right versions
    const culturantStatusElements = document.querySelectorAll('.culturantStatus');
    if (data.culturantProduced) {
        // Only show cooperation event message to moderators
        culturantStatusElements.forEach(element => {
            if (isModerator) {
                element.textContent = '🎯 Cooperation Event! All players chose even rows.';
                element.style.color = '#43b581';
            } else {
                element.textContent = '';
            }
        });
    } else {
        culturantStatusElements.forEach(element => {
            element.textContent = '';
        });
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
    
    // Reset round number so triad popup can show again for next game
    currentRoundNumber = 0;
    
    // Reset game state to allow new game to start
    gameActive = false;
    
    // Store export data for later use
    window.experimentData = data.exportData;
});

// Room full error
socket.on('roomFull', function(data) {
    showGlassmorphismAlert('Room Full', data.message || 'This room has reached its maximum capacity.', 'warning');
    console.log('❌ Room full:', data.message);
});

// Generic error handler
socket.on('error', function(data) {
    showGlassmorphismAlert('Server Error', data.message || 'An unexpected error occurred.', 'error');
    console.log('❌ Server error:', data);
});

// Column mode changed
socket.on('columnModeChanged', function(data) {
    console.log(`🎛️ Column mode changed to: ${data.mode} by ${data.moderator}`);
    
    // Update UI based on mode change
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    if (moderatorSwitchboard && moderatorSwitchboard.style.display === 'block') {
        const autoColumnToggle = document.getElementById('autoColumnToggleSwitch');
        if (autoColumnToggle) {
            autoColumnToggle.checked = (data.mode === 'auto');
            // Don't trigger change event - this would cause infinite loop!
            // Instead, manually update UI elements
            const manualColumnGrid = document.getElementById('manualColumnGrid');
            const selectedColumnIndicator = document.getElementById('selectedColumnIndicator');
            
            if (autoColumnToggle.checked) {
                // Auto mode UI
                if (manualColumnGrid) manualColumnGrid.style.display = 'none';
                if (selectedColumnIndicator) selectedColumnIndicator.textContent = 'AUTO MODE';
            } else {
                // Manual mode UI
                if (manualColumnGrid) manualColumnGrid.style.display = 'block';
                if (selectedColumnIndicator) selectedColumnIndicator.textContent = 'MANUAL MODE';
            }
        }
    }
});

// Function to show baseline exit notification to moderators
// Experimental condition changed
socket.on('conditionChanged', function(data) {
    console.log('🔄 conditionChanged event received:', data);
    console.log(`💰 Experimental condition changed: ${data.condition.name}`);
    
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

// Handle automatic condition updates based on experimental schedule
// Test function for LED tracker (for debugging)
window.testLEDTrackerWithPlayers = function() {
    console.log('🧪 Testing LED tracker with players array...');
    const testData = {
        condition: 'High Culturant',
        round: 1,
        blockNumber: 1,
        player: 'tom',
        players: [
            { name: 'tom', id: 'test1', isAI: false },
            { name: 'AI Player 1', id: 'test2', isAI: true },
            { name: 'AI Player 2', id: 'test3', isAI: true }
        ],
        tokenValues: { white: 0.03, black: 0.01 },
        incentive: 'Self Control Incentive'
    };
    
    // Simulate the conditionUpdate event
    console.log('🔍 Triggering test conditionUpdate with:', testData);
    updateConditionLED(testData.condition, testData.round, testData.blockNumber, testData.player);
};

window.testLEDTrackerWithoutPlayers = function() {
    console.log('🧪 Testing LED tracker without players array...');
    const testData = {
        condition: 'High Operant',
        round: 2,
        blockNumber: 1,
        player: 'AI Player 1',
        tokenValues: { white: 0.03, black: 0.01 },
        incentive: 'Impulse Incentive'
    };
    
    // Simulate the conditionUpdate event
    console.log('🔍 Triggering test conditionUpdate without players array:', testData);
    updateConditionLED(testData.condition, testData.round, testData.blockNumber, testData.player);
};

// Initialize dynamic player mapping for when players array isn't available
let playerNameMapping = new Map();
let nextPlayerIndex = 0;

// Function to initialize all player names in the LED tracker
function initializePlayerNamesInTracker(players) {
    console.log(`🎯 Initializing player names in LED tracker with ${players.length} players`);
    
    // FIRST: Clear any existing player assignments from placeholders
    console.log('🧹 Clearing existing player assignments from placeholders...');
    const allPlaceholders = document.querySelectorAll('.dynamic-player');
    console.log(`🔍 Found ${allPlaceholders.length} total placeholder elements in DOM`);
    
    allPlaceholders.forEach(placeholder => {
        // Reset placeholder to its original state
        placeholder.removeAttribute('data-player');
        placeholder.innerHTML = '';
        placeholder.style.display = 'none';
        placeholder.style.visibility = 'hidden';
        placeholder.style.opacity = '0';
    });
    
    // Clear existing mapping
    playerNameMapping.clear();
    nextPlayerIndex = 0;
    
    // SMART PARTICIPANT SELECTION: Filter out moderators and get actual participants
    // Get current moderator name from DOM for additional safety
    const moderatorDiv = document.getElementById('moderatorPosition');
    const moderatorNameDiv = moderatorDiv?.querySelector('.moderator-name');
    const currentModerator = moderatorNameDiv?.textContent;
    
    // Filter to get only actual participants (not moderators)
    const actualParticipants = players.filter(player => {
        const isModerator = player.isModerator || player.name === currentModerator;
        if (isModerator) {
            console.warn(`🚫 FILTERED OUT: Moderator "${player.name}" excluded from LED tracker`);
            return false;
        }
        return true;
    });
    
    console.log(`✅ Found ${actualParticipants.length} actual participants:`, actualParticipants.map(p => p.name));
    
    // Map up to 3 actual participants (not just first 3 positions)
    actualParticipants.slice(0, 3).forEach((player, index) => {
        playerNameMapping.set(player.name, player.name);
        console.log(`🔗 Mapped participant ${index + 1}: ${player.name}`);
    });
    
    // Initialize all player counters for all conditions using REAL participant names
    const allConditions = ['HIGH_CULTURANT', 'HIGH_OPERANT', 'EQUAL_CULTURANT_OPERANT'];
    
    allConditions.forEach(conditionKey => {
        actualParticipants.slice(0, 3).forEach((player, index) => {
            const success = createDynamicPlayerCounter(conditionKey, player.name);
            if (!success) {
                console.error(`❌ Failed to create counter for ${player.name} in ${conditionKey}`);
            }
        });
    });
    
    console.log(`✅ Initialized LED tracker for ${actualParticipants.slice(0, 3).length} actual participants`);
    console.log(`🔍 Final player mapping:`, Array.from(playerNameMapping.entries()));
    
    // Debug: Check what counters were actually created
    setTimeout(() => {
        const createdCounters = document.querySelectorAll('[data-player]:not([data-player="None"]):not([data-player=""])');
        console.log(`🔍 POST-INIT: Found ${createdCounters.length} created player counters:`);
        createdCounters.forEach(counter => {
            console.log(`  - ${counter.getAttribute('data-player')} in ${counter.getAttribute('data-condition')}: "${counter.innerHTML}"`);
        });
    }, 100);
}

// Test socket connection and event handlers
console.log('🔵 Initializing socket event handlers...');
console.log('🔵 Socket object:', socket);
console.log('🔵 Socket connected:', socket.connected);

// Test handler to verify socket is working
socket.on('test-conditionUpdate-handler', function(data) {
    console.log('🧪 TEST: conditionUpdate test handler called!', data);
});

socket.on('conditionUpdate', function(data) {
    console.log('🚨 🚨 🚨 conditionUpdate handler called! 🚨 🚨 🚨');
    console.log('🧪 conditionUpdate event received:', JSON.stringify(data, null, 2));
    console.log(`🔄 Experimental condition updated for round ${data.round}: ${data.condition}`);
    console.log(`💰 Token values - White: $${data.tokenValues.white}, Black: $${data.tokenValues.black}`);
    console.log(`🎯 Incentive: ${data.incentive}`);
    if (data.player) {
        console.log(`👤 Assigned player: "${data.player}" (type: ${typeof data.player})`);
    } else {
        console.log(`👤 No player assigned (data.player = ${data.player})`);
    }
    if (data.blockNumber) {
        console.log(`📦 Block: ${data.blockNumber}/7`);
    }
    
    // Update token conversion display for all players
    updateTokenConversionDisplay(data.tokenValues.white, data.tokenValues.black);
    
    // Update current token value display (below checkerboard)
    const currentWhiteValueEl = document.getElementById('currentWhiteTokenValue');
    const currentBlackValueEl = document.getElementById('currentBlackTokenValue');
    if (currentWhiteValueEl) currentWhiteValueEl.textContent = `$${data.tokenValues.white.toFixed(2)}`;
    if (currentBlackValueEl) currentBlackValueEl.textContent = `$${data.tokenValues.black.toFixed(2)}`;
    
    // Color-code token value display based on condition
    const currentTokenValueDisplay = document.getElementById('currentTokenValueDisplay');
    if (currentTokenValueDisplay && data.condition) {
        const innerBox = currentTokenValueDisplay.querySelector('div');
        if (innerBox) {
            let bgColor, borderColor;
            switch (data.condition) {
                case 'High Operant':
                    // Blue for high-operant
                    bgColor = 'rgba(88, 101, 242, 0.3)';
                    borderColor = 'rgba(88, 101, 242, 0.5)';
                    break;
                case 'Equal Culturant-Operant':
                    // Green for equal operant-culturant
                    bgColor = 'rgba(67, 181, 129, 0.3)';
                    borderColor = 'rgba(67, 181, 129, 0.5)';
                    break;
                case 'High Culturant':
                    // Yellow for high culturant
                    bgColor = 'rgba(250, 166, 26, 0.3)';
                    borderColor = 'rgba(250, 166, 26, 0.5)';
                    break;
                default:
                    // Default gray for baseline or unknown
                    bgColor = 'rgba(54, 57, 63, 0.8)';
                    borderColor = 'rgba(114, 118, 125, 0.2)';
            }
            innerBox.style.background = bgColor;
            innerBox.style.borderColor = borderColor;
            innerBox.style.transition = 'background 0.3s ease, border-color 0.3s ease';
        }
    }
    
    // Update HUD with experimental information
    updateExperimentalHUD(data);
    
    // Update previous condition tracking
    previousCondition = data.condition;
    
    // *** LED TRACKER FUNCTIONALITY ***
    try {        
        // Extract condition info for LED tracker
        const condition = data.condition || '';
        const round = data.round || 0;
        const blockNumber = data.blockNumber || 0;
        const playerName = data.player || 'None';  // Simplified - use data.player directly
        
        console.log(`🔍 conditionUpdate LED processing DETAILED:`);
        console.log(`   data.player: "${data.player}" (type: ${typeof data.player})`);
        console.log(`   playerName: "${playerName}" (type: ${typeof playerName})`);
        console.log(`   condition: "${condition}"`);
        console.log(`   round: ${round}`);
        
        // Single call to updateConditionLED - no duplication
        updateConditionLED(condition, round, blockNumber, playerName);
        
        console.log(`✅ conditionUpdate processing complete for round ${round}`);
        
    } catch (error) {
        console.error('❌ LED TRACKER: Error processing conditionUpdate:', error);
    }
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
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    if (moderatorSwitchboard && moderatorSwitchboard.style.display === 'block') {
        // Clear previous selections
        document.querySelectorAll('.column-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Highlight selected button
        const correspondingBtn = document.querySelector(`.column-btn[data-column="${data.column}"]`);
        if (correspondingBtn) {
            correspondingBtn.classList.add('active');
        }
        
        // Update indicator
        const indicator = document.getElementById('selectedColumnIndicator');
        if (indicator) {
            indicator.textContent = `SELECTED: ${data.column}`;
        }
    }
});

// Auto column selected (for showing which column was randomly picked)
socket.on('autoColumnSelected', function(data) {
    console.log(`🎲 Auto-selected column: ${data.column} for round ${data.round}`);
    
    // Attempt highlighting with retry mechanism
    attemptColumnHighlight(data.column);
    
    // Show which column was automatically selected
    const selectedColumnIndicator = document.getElementById('selectedColumnIndicator');
    if (selectedColumnIndicator) {
        selectedColumnIndicator.textContent = `AUTO: COLUMN ${data.column}`;
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

// Function to control leave card visibility
function updateLeaveButtonVisibility() {
    const leaveCard = document.getElementById('leave-card');
    if (leaveCard) {
        // Clear any inline styles first
        leaveCard.style.display = '';
        
        if (currentRoom && currentRoom !== 'Global') {
            leaveCard.classList.remove('leave-hidden');
            leaveCard.classList.add('leave-visible');
            console.log(`👁️ Leave card shown for room: ${currentRoom}`);
        } else {
            leaveCard.classList.remove('leave-visible');
            leaveCard.classList.add('leave-hidden');
            console.log('👁️ Leave card hidden (in Global chat)');
        }
        console.log(`👁️ Leave card classes: ${leaveCard.className}`);
    }
}

// Set up event listeners for behavioral experiment
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOM loaded, initializing...');
    
    // Check userCount element availability immediately
    console.log(`🔍 DOMContentLoaded: Checking userCount element availability`);
    const userCountCheck = document.getElementById('userCount');
    console.log(`📊 userCount element found: ${userCountCheck ? 'YES' : 'NO'}`);
    if (userCountCheck) {
        console.log(`📊 Current userCount text: "${userCountCheck.textContent || userCountCheck.innerText}"`);
    }
    
    domLoaded = true;
    
    // Check if we have session data from server
    if (window.sessionData) {
        console.log('🔄 Session data available from server:', window.sessionData);
        
        if (window.sessionData.isLoggedIn && window.sessionData.username) {
            console.log('🔄 Valid session found, restoring session for:', window.sessionData.username);
            performSessionRestore({
                success: true,
                username: window.sessionData.username,
                room: window.sessionData.room,
                roomRestored: window.sessionData.roomRestored,
                isAdmin: window.sessionData.isAdmin
            });
        } else {
            console.log('🔄 No valid session data found');
            // Ensure login button is visible when no session is found
            console.log('🔄 Calling switchToLoggedOutUI from invalid session data');
            switchToLoggedOutUI();
        }
    } else {
        console.log('🔄 No session data found on page load');
        // Ensure login button is visible when no session data exists
        console.log('🔄 Calling switchToLoggedOutUI from no session data');
        switchToLoggedOutUI();
    }
    
    // If there's a pending session restore from socket, handle it now
    if (pendingSessionRestore) {
        // Process pending session restore from socket connect
        performSessionRestore(pendingSessionRestore);
        pendingSessionRestore = null;
    }
    
    // Double-check: If we have valid session data but login button is still visible, fix it
    setTimeout(() => {
        console.log('🔧 FAILSAFE 1: Checking login button visibility after DOM load');
        if (window.sessionData && window.sessionData.isLoggedIn && window.sessionData.username) {
            const loginButton = document.getElementById('loginNav');
            const profileMenuContainer = document.querySelector('.profile-menu-container');
            
            console.log('🔧 FAILSAFE 1: Session data indicates logged in user:', window.sessionData.username);
            console.log('🔧 FAILSAFE 1: Login button display:', loginButton ? loginButton.style.display : 'NOT_FOUND');
            console.log('🔧 FAILSAFE 1: Profile menu display:', profileMenuContainer ? profileMenuContainer.style.display : 'NOT_FOUND');
            
            if (loginButton && (loginButton.style.display === 'block' || loginButton.style.display === '')) {
                console.log('🔧 FIXING 1: Login button still visible despite valid session - hiding it');
                switchToLoggedInUI(window.sessionData.username);
                
                // Additional check after switchToLoggedInUI
                setTimeout(() => {
                    console.log('🔧 POST-FIX 1: Login button display after switchToLoggedInUI:', loginButton.style.display);
                    console.log('🔧 POST-FIX 1: Profile menu display after switchToLoggedInUI:', profileMenuContainer ? profileMenuContainer.style.display : 'NOT_FOUND');
                }, 50);
            } else {
                console.log('🔧 FAILSAFE 1: Login button already properly hidden');
            }
        } else {
            console.log('🔧 FAILSAFE 1: No valid session data found, login button should be visible');
        }
    }, 100);
    
    // Second failsafe check after a longer delay
    setTimeout(() => {
        console.log('🔧 FAILSAFE 2: Secondary check for login button persistence');
        if (window.sessionData && window.sessionData.isLoggedIn && window.sessionData.username) {
            const loginButton = document.getElementById('loginNav');
            const profileMenuContainer = document.querySelector('.profile-menu-container');
            
            if (loginButton && (loginButton.style.display === 'block' || loginButton.style.display === '')) {
                console.log('🔧 FIXING 2: Login button STILL visible after first failsafe - forcing hide');
                loginButton.style.setProperty('display', 'none', 'important');
                
                if (profileMenuContainer) {
                    profileMenuContainer.style.setProperty('display', 'block', 'important');
                }
                
                console.log('🔧 FORCED: Used !important to override any conflicting styles');
            } else {
                console.log('🔧 FAILSAFE 2: Login button properly hidden, no action needed');
            }
        }
    }, 500);
    
    // Third failsafe check after even longer delay
    setTimeout(() => {
        console.log('🔧 FAILSAFE 3: Final check for login button state');
        if (window.sessionData && window.sessionData.isLoggedIn && window.sessionData.username) {
            const loginButton = document.getElementById('loginNav');
            
            if (loginButton && (loginButton.style.display === 'block' || loginButton.style.display === '')) {
                console.log('🔧 CRITICAL: Login button STILL showing after all failsafes - investigating CSS conflicts');
                console.log('🔧 Login button computed style:', window.getComputedStyle(loginButton).display);
                console.log('🔧 Login button inline style:', loginButton.style.display);
                console.log('🔧 Login button class list:', loginButton.classList.toString());
                
                // Force hide with multiple approaches
                loginButton.style.setProperty('display', 'none', 'important');
                loginButton.hidden = true;
                loginButton.classList.add('force-hidden');
                
                console.log('🔧 NUCLEAR: Applied display:none !important, hidden attribute, and force-hidden class');
            } else {
                console.log('🔧 FAILSAFE 3: All good - login button properly hidden');
            }
        }
    }, 1000);
    
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
    console.log('🔍 Login button found during init:', !!loginButton);
    if (loginButton) {
        console.log('🔍 Login button initial display style:', loginButton.style.display);
        console.log('🔍 Login button computed display:', window.getComputedStyle(loginButton).display);
        
        // Add click event handler to open login modal
        loginButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔑 Login button clicked - opening modal');
            const modal = document.getElementById('id01');
            if (modal) {
                modal.style.display = 'block';
                
                // Reinitialize login elements after modal is shown
                setTimeout(() => {
                    console.log('🔑 Reinitializing login elements after modal open');
                    const signDivUsername = document.getElementById('username');
                    const signDivPassword = document.getElementById('password');
                    const signDivSignIn = document.getElementById('signIn');
                    
                    console.log('🔑 Elements found:');
                    console.log('  - username:', !!signDivUsername);
                    console.log('  - password:', !!signDivPassword);
                    console.log('  - signIn:', !!signDivSignIn);
                    
                    // Focus on username input
                    if (signDivUsername) {
                        signDivUsername.focus();
                    }
                    
                    // Setup event listeners for sign in button
                    if (signDivSignIn && !signDivSignIn.hasAttribute('data-handler-added')) {
                        signDivSignIn.addEventListener('click', handleSignIn);
                        signDivSignIn.addEventListener('touchend', handleSignIn, { passive: false });
                        signDivSignIn.setAttribute('data-handler-added', 'true');
                        console.log('🔑 Event handlers added to sign in button');
                    }
                }, 100);
            } else {
                console.error('❌ Login modal not found!');
            }
        });
        
        console.log('🔑 Login button event handler added');
    }
    
    // Clean initialization - header should work with normal CSS now
    console.log('🔧 Header initialized with normal CSS styling');
    
    // Hide emergency header since main header should be working
    const emergencyHeader = document.getElementById('emergencyHeader');
    if (emergencyHeader) {
        emergencyHeader.style.display = 'none';
        console.log('🔧 Emergency header hidden');
    }
    
    createRoomButton = document.getElementById('create-card');
    joinRoomButton = document.getElementById('join-card');
    inviteButton = document.getElementById('invite-card');
    
    // Clear any inline styles on ALL cards to let CSS take full control
    if (createRoomButton) createRoomButton.style.display = '';
    if (joinRoomButton) joinRoomButton.style.display = '';
    if (inviteButton) inviteButton.style.display = '';
    
    const leaveCardElement = document.getElementById('leave-card');
    if (leaveCardElement) leaveCardElement.style.display = '';

    // Initialize login elements
    signDiv = document.getElementById('signDiv');
    signDivUsername = document.getElementById('username');
    signDivPassword = document.getElementById('password');
    signDivSignIn = document.getElementById('signIn');
    signDivSignUp = document.getElementById('signUp');
    chatDiv = document.getElementById('chat-container');
    landingPage = document.getElementById('landingPage');
    backgroundIMG = document.getElementById('backgroundIMG');

    // Initialize leave button visibility (hidden by default for Global)
    updateLeaveButtonVisibility();
    
    // Initialize LED condition tracker
    initializeConditionTracker();
    
    console.log('🔵 Page loaded, LED tracker initialized');
    console.log('🔵 Testing if conditionUpdate handler will work...');
    
    // Test the createDynamicPlayerCounter function after page loads
    // DISABLED: This was consuming placeholders before real player names could be assigned
    /*
    setTimeout(() => {
        console.log('🧪 Running automatic test of createDynamicPlayerCounter...');
        // Test all players for all conditions
        const conditions = ['HIGH_CULTURANT', 'HIGH_OPERANT', 'EQUAL_CULTURANT_OPERANT'];
        const players = ['Player A', 'Player B', 'Player C'];
        
        conditions.forEach(condition => {
            players.forEach(player => {
                createDynamicPlayerCounter(condition, player);
            });
        });
        console.log('✅ Automatic test completed - all players added to all conditions');
    }, 2000);
    */
    
    // Ensure cards are visible by default (unless in active game)
    if (!gameActive && currentRoom === 'Global') {
        document.body.classList.remove('game-active');
        console.log('🔧 Initial setup: Cards set to visible for Global context');
    }
    
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
        console.log('🔑 Primary login button found - adding click and touch support');
        
        let touchStartedOnLogin = false;
        
        // Add touch event handlers for mobile
        loginButton.addEventListener('touchstart', function(e) {
            console.log('📱 Touch started on primary login button');
            touchStartedOnLogin = true;
            // Visual feedback
            this.style.transform = 'scale(0.95)';
        }, { passive: false });
        
        loginButton.addEventListener('touchend', function(e) {
            console.log('📱 Touch ended on primary login button');
            if (touchStartedOnLogin) {
                e.preventDefault();
                e.stopPropagation();
                
                // Reset visual feedback
                this.style.transform = 'scale(1)';
                
                // Open modal
                console.log('📱 Opening login modal from mobile touch');
                const loginModal = document.getElementById('id01');
                if (loginModal) {
                    loginModal.style.display = 'block';
                    const usernameInput = document.getElementById('username');
                    if (usernameInput) usernameInput.focus();
                }
                
                touchStartedOnLogin = false;
            }
        }, { passive: false });
        
        // Handle touch cancel
        loginButton.addEventListener('touchcancel', function(e) {
            console.log('📱 Touch cancelled on primary login button');
            if (touchStartedOnLogin) {
                this.style.transform = 'scale(1)';
                touchStartedOnLogin = false;
            }
        });
        
        // Click handler for desktop (works alongside touchend for mobile)
        loginButton.addEventListener('click', function(event) {
            console.log('🖱️ Click on primary login button');
            event.preventDefault();
            const loginModal = document.getElementById('id01');
            if (loginModal) {
                loginModal.style.display = 'block';
                const usernameInput = document.getElementById('username');
                if (usernameInput) usernameInput.focus();
            } else {
                console.error('❌ Login modal (id01) not found!');
            }
        });
    }

    // Set up logout button (legacy - now in profile menu)
    const logoutButton = document.getElementById('logoutNav');
    if (logoutButton) {
        logoutButton.onclick = function(event) {
            event.preventDefault();
            socket.emit('logout');
        }
    }

    // Set up profile menu functionality
    setupProfileMenu();

    // Note: signIn button event handlers are now setup when modal opens
    // since the button doesn't exist in DOM until modal is displayed

    // Old signup handler removed - now handled by modal system in login.ejs

    // Custom Join Room Modal Function
    function showJoinRoomModal() {
        // Create modal if it doesn't exist
        let joinModal = document.getElementById('joinRoomModal');
        if (!joinModal) {
            createJoinRoomModal();
            joinModal = document.getElementById('joinRoomModal');
        }
        
        // Clear any existing input value
        const roomInput = document.getElementById('joinRoomInput');
        if (roomInput) {
            roomInput.value = '';
            roomInput.focus();
        }
        
        // Show modal
        joinModal.style.display = 'block';
    }

    function createJoinRoomModal() {
        const modalHTML = `
            <div id="joinRoomModal" class="modal" style="
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            ">
                <div class="modal-content animate" style="
                    max-width: 400px;
                    background: linear-gradient(145deg, 
                        rgba(43, 45, 59, 0.98) 0%, 
                        rgba(54, 57, 63, 0.95) 100%);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    box-shadow: 
                        0 20px 60px rgba(0, 0, 0, 0.5),
                        0 8px 32px rgba(0, 0, 0, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
                ">
                    <div class="imgcontainer">
                        <span onclick="document.getElementById('joinRoomModal').style.display='none'" 
                              class="close" 
                              title="Close Modal"
                              style="
                                  color: #b9bbbe;
                                  font-size: 28px;
                                  transition: all 0.2s ease;
                              "
                              onmouseover="this.style.color='#ffffff'; this.style.transform='scale(1.1)'"
                              onmouseout="this.style.color='#b9bbbe'; this.style.transform='scale(1)'">&times;</span>
                    </div>

                    <div class="container" style="text-align: center; padding: 30px;">
                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                            margin-bottom: 8px;
                        ">
                            <div style="
                                width: 3px;
                                height: 3px;
                                background: linear-gradient(135deg, #667aff, #7386ff);
                                border-radius: 50%;
                                animation: subtlePulse 2s infinite;
                            "></div>
                            <h3 style="
                                color: #dcddde; 
                                font-weight: 600; 
                                font-size: 18px;
                                margin: 0;
                                background: linear-gradient(135deg, #dcddde, #ffffff);
                                -webkit-background-clip: text;
                                -webkit-text-fill-color: transparent;
                                background-clip: text;
                            ">Join Room</h3>
                            <div style="
                                width: 3px;
                                height: 3px;
                                background: linear-gradient(135deg, #667aff, #7386ff);
                                border-radius: 50%;
                                animation: subtlePulse 2s infinite;
                            "></div>
                        </div>
                        
                        <p style="
                            color: #b9bbbe; 
                            margin-bottom: 24px; 
                            font-size: 13px;
                            opacity: 0.8;
                            line-height: 1.4;
                        ">Enter the name of the room you'd like to join</p>
                        
                        <div style="position: relative; margin-bottom: 24px;">
                            <input type="text" 
                                   id="joinRoomInput" 
                                   placeholder="Room name..." 
                                   style="
                                       width: 100%;
                                       padding: 14px 16px;
                                       background: rgba(32, 34, 37, 0.8);
                                       border: 1px solid rgba(114, 118, 125, 0.4);
                                       border-radius: 8px;
                                       color: #dcddde;
                                       font-size: 14px;
                                       font-weight: 400;
                                       transition: all 0.3s ease;
                                       box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
                                       backdrop-filter: blur(10px);
                                   "
                                   onfocus="
                                       this.style.borderColor='rgba(102, 122, 255, 0.6)';
                                       this.style.boxShadow='inset 0 1px 3px rgba(0, 0, 0, 0.2), 0 0 0 3px rgba(102, 122, 255, 0.15)';
                                   "
                                   onblur="
                                       this.style.borderColor='rgba(114, 118, 125, 0.4)';
                                       this.style.boxShadow='inset 0 1px 3px rgba(0, 0, 0, 0.2)';
                                   "
                                   onkeypress="if(event.key === 'Enter') document.getElementById('joinRoomConfirm').click()"
                            >
                        </div>
                        
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button type="button" 
                                    id="joinRoomConfirm"
                                    style="
                                        background: linear-gradient(135deg, rgba(67, 181, 129, 0.9) 0%, rgba(52, 168, 107, 0.9) 100%);
                                        color: white;
                                        padding: 11px 18px;
                                        border: none;
                                        border-radius: 7px;
                                        cursor: pointer;
                                        font-weight: 500;
                                        font-size: 13px;
                                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                                        box-shadow: 0 3px 8px rgba(67, 181, 129, 0.3);
                                        display: flex;
                                        align-items: center;
                                        gap: 6px;
                                    "
                                    onmouseover="
                                        this.style.background='linear-gradient(135deg, rgba(52, 168, 107, 0.95) 0%, rgba(39, 174, 96, 0.95) 100%)';
                                        this.style.transform='translateY(-1px)';
                                        this.style.boxShadow='0 4px 12px rgba(67, 181, 129, 0.4)';
                                    "
                                    onmouseout="
                                        this.style.background='linear-gradient(135deg, rgba(67, 181, 129, 0.9) 0%, rgba(52, 168, 107, 0.9) 100%)';
                                        this.style.transform='translateY(0)';
                                        this.style.boxShadow='0 3px 8px rgba(67, 181, 129, 0.3)';
                                    ">
                                <span style="font-size: 12px;">🚪</span>
                                Join Room
                            </button>
                            <button type="button" 
                                    onclick="document.getElementById('joinRoomModal').style.display='none'"
                                    style="
                                        background: rgba(114, 118, 125, 0.15);
                                        color: #b9bbbe;
                                        padding: 11px 18px;
                                        border: 1px solid rgba(114, 118, 125, 0.4);
                                        border-radius: 7px;
                                        cursor: pointer;
                                        font-size: 13px;
                                        font-weight: 400;
                                        transition: all 0.2s ease;
                                        backdrop-filter: blur(10px);
                                    "
                                    onmouseover="
                                        this.style.background='rgba(114, 118, 125, 0.25)';
                                        this.style.color='#dcddde';
                                        this.style.borderColor='rgba(114, 118, 125, 0.6)';
                                    "
                                    onmouseout="
                                        this.style.background='rgba(114, 118, 125, 0.15)';
                                        this.style.color='#b9bbbe';
                                        this.style.borderColor='rgba(114, 118, 125, 0.4)';
                                    ">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up event handlers and focus on input
        const confirmBtn = document.getElementById('joinRoomConfirm');
        const roomInput = document.getElementById('joinRoomInput');
        const joinModal = document.getElementById('joinRoomModal');
        
        // Focus on the input field after modal is created
        if (roomInput) {
            setTimeout(() => {
                roomInput.focus();
            }, 100); // Small delay to ensure modal is fully rendered
        }
        
        if (confirmBtn && roomInput) {
            confirmBtn.onclick = function() {
                const roomName = roomInput.value.trim();
                if (roomName) {
                    socket.emit('joinRoom', roomName);
                    currentRoom = roomName;
                    joinModal.style.display = 'none';
                } else {
                    // Enhanced error feedback with better styling
                    roomInput.style.animation = 'shake 0.3s ease-in-out';
                    roomInput.style.borderColor = 'rgba(218, 86, 79, 0.8)';
                    roomInput.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.2), 0 0 0 3px rgba(218, 86, 79, 0.2)';
                    
                    // Add a subtle error message
                    let errorMsg = roomInput.nextElementSibling;
                    if (!errorMsg || !errorMsg.classList.contains('error-msg')) {
                        errorMsg = document.createElement('div');
                        errorMsg.classList.add('error-msg');
                        errorMsg.style.cssText = `
                            color: rgba(218, 86, 79, 0.9);
                            font-size: 12px;
                            margin-top: 6px;
                            opacity: 0;
                            transition: opacity 0.2s ease;
                        `;
                        errorMsg.textContent = 'Please enter a room name';
                        roomInput.parentNode.appendChild(errorMsg);
                    }
                    errorMsg.style.opacity = '1';
                    
                    setTimeout(() => {
                        roomInput.style.animation = '';
                        roomInput.style.borderColor = 'rgba(114, 118, 125, 0.4)';
                        roomInput.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.2)';
                        if (errorMsg) {
                            errorMsg.style.opacity = '0';
                            setTimeout(() => errorMsg.remove(), 200);
                        }
                    }, 2500);
                    roomInput.focus();
                }
            };
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === joinModal) {
                joinModal.style.display = 'none';
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
                
                // Reset game state and close triad popup when leaving room
                currentRoundNumber = 0;
                closeTriadFormationPopup();
                
                // Hide game interface and return to chat
                const gameDiv = document.getElementById('gameDiv');
                if (gameDiv) gameDiv.style.display = 'none';
                gameActive = false;
                document.body.classList.remove('game-active');
                currentRoom = "Global";
                
                // Update leave button visibility (hide for Global)
                updateLeaveButtonVisibility();
            }
            else {
                console.log("🌍 Leaving global chat");
                const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
                if (leaveRoom) {
                    socket.emit('leaveRoom', "Global");
                    console.log('🔄 Soft-returning to landing page (no full navigation)');
                    currentRoom = "Global";
                    const landing = document.getElementById('landingPage');
                    const gameDivLocal = document.getElementById('gameDiv');
                    if (landing) landing.style.display = 'block';
                    if (gameDivLocal) gameDivLocal.style.display = 'none';
                    switchToLoggedOutUI();
                    updateLeaveButtonVisibility();
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
            showJoinRoomModal();
        });
    }

    // Set up invite card handlers
    if (inviteButton) {
        console.log('🔍 Setting up invite card handlers');
        console.log('🔍 Invite button element:', inviteButton);
        console.log('🔍 Invite button HTML:', inviteButton.outerHTML);
        
        // Toggle invite options on main card click
        inviteButton.addEventListener('click', (e) => {
            console.log('🖱️ Invite card clicked - opening glassmorphism modal');
            e.preventDefault();
            e.stopPropagation();
            
            // Open the existing glassmorphism invite choice modal
            createInviteChoiceModal();
        });
        
        // Close invite options when clicking outside (not needed with modal, but keeping for safety)
        document.addEventListener('click', (e) => {
            // This is now handled by the modal system
        });
    } else {
        console.log('❌ Invite card not found during setup');
    }

    // Set up leave card handler
    const leaveCard = document.getElementById('leave-card');
    if (leaveCard) {
        leaveCard.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if user is moderator
            if (window.currentUserIsModerator) {
                // Show moderator context menu
                showModeratorContextMenu();
            } else {
                // Regular user - simple leave confirmation
                const leaveRoom = confirm("Are you sure you want to leave this room?");
                if (leaveRoom) {
                    socket.emit('leaveRoom', "Global");
                    console.log('🔄 Soft-returning to landing page (no full navigation)');
                    currentRoom = "Global";
                    const landing = document.getElementById('landingPage');
                    const gameDivLocal = document.getElementById('gameDiv');
                    if (landing) landing.style.display = 'block';
                    if (gameDivLocal) gameDivLocal.style.display = 'none';
                    switchToLoggedOutUI();
                    updateLeaveButtonVisibility();
                }
            }
        });
    }

    // Set up room pill dropdown menu
    const roomPill = document.getElementById('room-pill');
    const roomPillSubmenu = document.getElementById('room-pill-submenu');
    const leaveRoomOption = document.getElementById('leave-room-option');
    
    if (roomPill && roomPillSubmenu && leaveRoomOption) {
        let isSubmenuOpen = false;
        
        // Function to show room pill submenu
        function showRoomPillSubmenu() {
            if (!roomPill || !roomPillSubmenu) return;
            
            // Get room pill position
            const pillRect = roomPill.getBoundingClientRect();
            
            // Move submenu to body to escape stacking context
            if (roomPillSubmenu.parentNode !== document.body) {
                document.body.appendChild(roomPillSubmenu);
            }
            
            // Position submenu absolutely relative to viewport (left-aligned now)
            roomPillSubmenu.style.position = 'fixed';
            roomPillSubmenu.style.top = (pillRect.bottom + 8) + 'px';
            roomPillSubmenu.style.left = pillRect.left + 'px';
            roomPillSubmenu.style.right = 'auto';
            roomPillSubmenu.style.zIndex = '999999';
            
            roomPill.classList.add('expanded');
            roomPillSubmenu.classList.add('show');
            isSubmenuOpen = true;
        }
        
        // Function to hide room pill submenu
        function hideRoomPillSubmenu() {
            if (!roomPillSubmenu) return;
            
            roomPill.classList.remove('expanded');
            roomPillSubmenu.classList.remove('show');
            isSubmenuOpen = false;
        }
        
        // Toggle submenu on pill click
        roomPill.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Only show menu if we're in a room (not Global)
            if (currentRoom === 'Global') {
                return;
            }
            
            if (isSubmenuOpen) {
                hideRoomPillSubmenu();
            } else {
                showRoomPillSubmenu();
            }
        });
        
        // Close submenu when clicking outside
        document.addEventListener('click', (e) => {
            if (isSubmenuOpen && !roomPill.contains(e.target)) {
                isSubmenuOpen = false;
                roomPill.classList.remove('expanded');
                roomPillSubmenu.classList.remove('show');
                console.log('📋 Room pill menu closed (click outside)');
            }
        });
        
        // Handle leave room option click
        leaveRoomOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🚪 Leave room option clicked from pill menu');
            
            // Close the submenu first
            isSubmenuOpen = false;
            roomPill.classList.remove('expanded');
            roomPillSubmenu.classList.remove('show');
            
            // Same logic as other leave room handlers
            if (window.currentUserIsModerator) {
                // Show moderator context menu
                console.log('👑 Moderator leaving via pill menu - showing context menu');
                showModeratorContextMenu();
            } else {
                // Regular user - simple leave confirmation
                const leaveRoom = confirm("Are you sure you want to leave this room?");
                if (leaveRoom) {
                    socket.emit('leaveRoom', "Global");
                    window.location.href = '/';
                }
            }
        });
        
    } else {
    }

    // Final check: ensure logged-out state if no user (but only if no valid session data exists)
    if (!currentUsername && !(window.sessionData && window.sessionData.isLoggedIn)) {
        console.log('🔒 No current username AND no valid session data - switching to logged-out UI');
        switchToLoggedOutUI();
        console.log('🔒 Switched to logged-out UI for anonymous user');
    } else if (!currentUsername && window.sessionData && window.sessionData.isLoggedIn) {
        console.log('🔒 No current username but valid session data exists - skipping logged-out UI switch');
    } else if (currentUsername) {
        console.log('🔒 Current username exists:', currentUsername, '- staying in logged-in state');
    }
    // Set up Floating Action Button (FAB) for mobile
    const fabMain = document.getElementById('fab-main');
    const fabMenu = document.getElementById('fab-menu');
    const fabContainer = document.getElementById('floating-action-container');
    
    if (fabMain && fabMenu) {
        let fabOpen = false;
        
        fabMain.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            fabOpen = !fabOpen;
            
            if (fabOpen) {
                fabMenu.classList.add('active');
                fabMain.classList.add('active');
            } else {
                fabMenu.classList.remove('active');
                fabMain.classList.remove('active');
            }
        });
        
        // Close FAB menu when clicking outside
        document.addEventListener('click', (e) => {
            if (fabContainer && !fabContainer.contains(e.target) && fabOpen) {
                fabOpen = false;
                fabMenu.classList.remove('active');
                fabMain.classList.remove('active');
            }
        });
        
        // FAB item handlers
        const createFab = document.getElementById('create-fab');
        const joinFab = document.getElementById('join-fab');
        const inviteFab = document.getElementById('invite-fab');
        
        if (createFab) {
            createFab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                socket.emit("createRoom");
                if (roomNameText) roomNameText.click();
                // Close FAB menu
                fabOpen = false;
                fabMenu.classList.remove('active');
                fabMain.classList.remove('active');
            });
        }
        
        if (joinFab) {
            joinFab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showJoinRoomModal();
                // Close FAB menu
                fabOpen = false;
                fabMenu.classList.remove('active');
                fabMain.classList.remove('active');
            });
        }
        
        if (inviteFab) {
            inviteFab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // For now, just generate a random invite
                socket.emit('generateInviteCode', { isPermanent: false });
                // Close FAB menu
                fabOpen = false;
                fabMenu.classList.remove('active');
                fabMain.classList.remove('active');
            });
        }
    }

    // Function to show/hide FAB based on screen size
    function updateFabVisibility() {
        if (fabContainer) {
            if (window.innerWidth <= 768) {
                fabContainer.style.display = 'block';
            } else {
                fabContainer.style.display = 'none';
            }
        }
    }
    
    // Initial FAB visibility check
    updateFabVisibility();
    
    // Update FAB visibility on window resize
    window.addEventListener('resize', updateFabVisibility);

    // Update header pills with real-time info
    function updateHeaderPills() {
        const headerUserCount = document.getElementById('header-user-count-text');
        const roomPill = document.getElementById('room-pill');
        const roomPillText = document.getElementById('room-pill-text');
        
        // Update user count pill
        if (headerUserCount && userCount) {
            headerUserCount.textContent = userCount.textContent || '0 online';
        }
        
        // Update room pill visibility and content
        if (roomPill && roomPillText) {
            if (currentRoom && currentRoom !== 'Global') {
                roomPill.style.display = 'flex';
                roomPillText.textContent = currentRoom;
                roomPill.setAttribute('data-room', currentRoom);
            } else {
                roomPill.style.display = 'none';
                roomPill.removeAttribute('data-room');
            }
        }
    }
    
    // Initial pill update
    updateHeaderPills();
    
    // Update pills whenever user list or room changes
    const observer = new MutationObserver(() => {
        updateHeaderPills();
    });
    
    if (userCount) {
        observer.observe(userCount, { childList: true, subtree: true, characterData: true });
    }

    // Add smooth animations to cards
    function addCardAnimations() {
        const cards = document.querySelectorAll('.action-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('card-animate-in');
        });
    }
    
    // Trigger animations when chat becomes visible
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        const containerObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = chatContainer.style.display !== 'none';
                    if (isVisible) {
                        setTimeout(addCardAnimations, 100);
                    }
                }
            });
        });
        
        containerObserver.observe(chatContainer, { attributes: true });
    }

    // Navigation is now always visible - no hamburger menu needed

    // Start Experiment button (inside game interface)
    const startExperimentBtn = document.getElementById('startExperimentBtn');
    if (startExperimentBtn) {
        startExperimentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🚀 Start experiment button clicked - showing confirmation');
            
            // Show confirmation modal instead of starting immediately
            showStartExperimentConfirmation();
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
            
            console.log('🎯 Row clicked! Row number:', rowNumber, 'Previous selectedChoice:', selectedChoice);
            
            // Store selection but don't submit yet
            selectedChoice = rowNumber;
            console.log('🎯 selectedChoice updated to:', selectedChoice);
            
            // Clear previous selections and reset row headers
            document.querySelectorAll('.clickable-row').forEach(r => {
                r.style.opacity = '0.7';
                r.style.transform = 'scale(1)';
                r.style.boxShadow = 'none';
                r.style.backgroundColor = 'transparent';
            });
            
            // Reset all row headers to default
            document.querySelectorAll('.row-header').forEach(header => {
                const headerRow = parseInt(header.getAttribute('data-row'));
                const isOddRow = headerRow % 2 === 1;
                header.style.color = isOddRow ? '#ffffff' : '#000000';
                header.style.textShadow = 'none';
                header.style.transform = 'scale(1)';
                header.style.backgroundColor = 'transparent';
            });
            
            // Highlight selected row
            row.style.opacity = '1';
            row.style.transform = 'scale(1.02)';
            row.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
            row.style.backgroundColor = '#40444b';
            
            // Highlight the corresponding row header
            const rowHeader = document.querySelector(`.row-header[data-row="${rowNumber}"]`);
            if (rowHeader) {
                rowHeader.style.color = '#ffd700';
                rowHeader.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.8)';
                rowHeader.style.transform = 'scale(1.15)';
                rowHeader.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
            }
            
            // Show selection status and enable lock-in button
            const selectedChoiceDiv = document.getElementById('selectedChoice');
            const lockInBtn = document.getElementById('lockInBtn');
            console.log('🎯 UI elements found:', {selectedChoiceDiv: !!selectedChoiceDiv, lockInBtn: !!lockInBtn});
            
            if (selectedChoiceDiv) {
                selectedChoiceDiv.textContent = `Selected: Row ${rowNumber}`;
                selectedChoiceDiv.style.color = '#faa61a';
                console.log('🎯 Updated selectedChoiceDiv text to:', selectedChoiceDiv.textContent);
            }
            
            if (lockInBtn && !isLockedIn) {
                const lockInText = document.getElementById('lockInText');
                lockInBtn.disabled = false;
                if (lockInText) {
                    lockInText.textContent = 'Lock in';
                }
                lockInBtn.style.background = 'linear-gradient(135deg, #5865f2, #4752c4)';
                lockInBtn.style.cursor = 'pointer';
                console.log('🎯 Enabled lock-in button');
            }
        }
    });
    
    // Lock In button handler
    document.addEventListener('click', function(e) {
        if (e.target.id === 'lockInBtn' || e.target.closest('#lockInBtn')) {
            const lockInBtn = document.getElementById('lockInBtn');
            console.log('🔒 Lock-in button clicked!', {
                exists: !!lockInBtn, 
                disabled: lockInBtn?.disabled,
                selectedChoice: selectedChoice,
                isLockedIn: isLockedIn
            });
            
            if (lockInBtn && !lockInBtn.disabled && selectedChoice && !isLockedIn) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('🔒 Lock-in processing started - selectedChoice:', selectedChoice);
                
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
                console.log('🔒 Emitting makeChoice with:', {
                    choice: selectedChoice,
                    room: currentRoom,
                    lockedIn: true
                });
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
            const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
            const autoColumnToggle = document.getElementById('autoColumnToggleSwitch');
            
            if (moderatorSwitchboard && moderatorSwitchboard.style.display === 'block' && 
                autoColumnToggle && !autoColumnToggle.checked) {
                e.preventDefault();
                const column = e.target.getAttribute('data-column');
                
                // Clear manual column button selections
                document.querySelectorAll('.column-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Highlight the selected column button
                const correspondingBtn = document.querySelector(`.column-btn[data-column="${column}"]`);
                if (correspondingBtn) {
                    correspondingBtn.classList.add('active');
                }
                
                // Update indicator
                const indicator = document.getElementById('selectedColumnIndicator');
                if (indicator) {
                    indicator.textContent = `SELECTED: ${column}`;
                }
                
                // Notify server of column selection
                socket.emit('selectColumn', { column: column });
                
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
    const messageText = document.getElementById('systemMessageTextSwitch').value.trim();
    if (!messageText) {
        showGlassmorphismAlert('Missing Message', 'Please enter a message to send.', 'warning');
        return;
    }
    
    console.log(`📢 Sending system message: "${messageText}"`);
    socket.emit('systemMessage', {
        message: messageText,
        room: currentRoom
    });
    
    // Clear the input
    document.getElementById('systemMessageTextSwitch').value = '';
    
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
    const playerSelect = document.getElementById('incentivePlayerSwitch');
    const typeSelect = document.getElementById('incentiveTypeSwitch');
    const selectedPlayer = playerSelect.value;
    const selectedType = typeSelect.value;
    
    if (!selectedPlayer) {
        const statusDiv = document.getElementById('incentiveStatusSwitch');
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
    const statusDiv = document.getElementById('incentiveStatusSwitch');
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

// Show system message in poker table notification area
function showSystemNotification(title, message, type = 'info') {
    // Get or create notification area
    const notificationArea = getNotificationArea();
    if (!notificationArea) {
        console.error('📢 Cannot show system notification: poker table not found, falling back to modal');
        showGlassmorphismAlert(title, message, type);
        return;
    }
    
    // Set colors and icons based on type
    let gradient, icon, borderColor;
    switch(type) {
        case 'success':
            gradient = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            borderColor = '#27ae60';
            icon = '✅';
            break;
        case 'error':
            gradient = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            borderColor = '#e74c3c';
            icon = '❌';
            break;
        case 'warning':
            gradient = 'linear-gradient(135deg, #f39c12, #e67e22)';
            borderColor = '#f39c12';
            icon = '⚠️';
            break;
        default:
            gradient = 'linear-gradient(135deg, #667aff, #7386ff)';
            borderColor = '#667aff';
            icon = '📢';
            break;
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'system-notification';
    
    // Create content
    const content = document.createElement('div');
    content.className = 'notification-content';
    
    const titleElement = document.createElement('h4');
    titleElement.innerHTML = `${icon} ${title}`;
    titleElement.className = 'notification-title';
    
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.className = 'notification-message';
    
    content.appendChild(titleElement);
    content.appendChild(messageElement);
    notification.appendChild(content);
    
    // Style the notification
    notification.style.cssText = `
        position: relative;
        width: 100%;
        background: ${gradient};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        text-align: left;
        border: 2px solid ${borderColor};
        animation: slideInRight 0.5s ease-out;
        margin-bottom: 10px;
        pointer-events: auto;
        cursor: pointer;
    `;
    
    titleElement.style.cssText = `
        margin: 0 0 4px 0;
        font-size: 13px;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
    `;
    
    messageElement.style.cssText = `
        margin: 0;
        font-size: 12px;
        line-height: 1.3;
        font-weight: 400;
        opacity: 0.95;
    `;
    
    // Add click to close functionality
    notification.onclick = function() {
        notification.remove();
    };
    
    // Auto-remove after 8 seconds for info messages, longer for errors
    const autoRemoveTime = type === 'error' ? 12000 : (type === 'warning' ? 10000 : 8000);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, autoRemoveTime);
    
    notificationArea.appendChild(notification);
    
    console.log('📢 System notification displayed in poker table area:', title, message);
}

// Socket event handlers for testing features
socket.on('systemMessageSent', function(data) {
    console.log('📢 System message confirmed sent:', data.message);
    
    // Check if we're in game and should use notification area
    const pokerTable = document.getElementById('pokerTable');
    const isInGame = pokerTable && pokerTable.style.display !== 'none';
    
    if (isInGame) {
        showSystemNotification(data.title || '📢 System Announcement', data.message, data.type || 'info');
    } else {
        // Fall back to modal for non-game contexts
        showGlassmorphismAlert(data.title || '📢 System Announcement', data.message, data.type || 'info');
    }
});

// Handle AI players removal confirmation
socket.on('aiPlayersRemoved', function(data) {
    console.log('🤖 AI players removed confirmation received:', data);
    console.log('🤖 Current room:', currentRoom, 'Event room:', data.room);
    
    if (data.room === currentRoom) {
        console.log('🔄 Room match - executing lobby reset...');
        // Force complete lobby reset to pre-AI state
        resetLobbyToPreAIState();
        console.log('✅ Lobby reset to pre-AI state completed');
    } else {
        console.log('❌ Room mismatch - skipping reset');
    }
});

// Function to reset lobby to clean pre-AI state
function resetLobbyToPreAIState() {
    console.log('🔄 Resetting lobby to pre-AI state...');
    
    // 1. Reset AI button to add mode
    const addAIBtn = document.getElementById('addAIBtn');
    if (addAIBtn) {
        addAIBtn.textContent = '🤖 Fill Room with AI';
        addAIBtn.style.background = 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)';
        addAIBtn.style.boxShadow = '0 2px 8px rgba(88, 101, 242, 0.3)';
        addAIBtn.style.animation = '';
        console.log('✅ Reset AI button to add mode');
    }
    
    // 2. Clear ALL participant seats completely
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            const statusDiv = seat.querySelector('.player-status');
            const aiDiv = seat.querySelector('.ai-indicator');
            const walletDiv = seat.querySelector('.player-wallet');
            
            // Clear everything
            if (nameDiv) nameDiv.textContent = '';
            if (statusDiv) statusDiv.textContent = 'Empty';
            if (aiDiv) aiDiv.style.display = 'none';
            if (walletDiv) walletDiv.textContent = '';
            seat.style.borderColor = '#72767d';
            seat.removeAttribute('data-player-username');
            
            // Remove any special classes
            seat.classList.remove('floating-player', 'floating-left', 'floating-right', 'floating-top', 'floating-back');
            seat.classList.remove('locked-in', 'decision-made', 'waiting');
            
            console.log('🧹 Completely cleared seat:', seatId);
        }
    });
    
    // 3. Force request fresh room state to populate only human players
    setTimeout(() => {
        console.log('🔍 Requesting fresh room state after AI removal...');
        window.forceNextPlayersUpdate = true; // Flag to force next playersInRoom update
        socket.emit('requestRoomState', { room: currentRoom });
    }, 100);
}

// Handle system messages (including AI removal confirmations)
socket.on('systemMessage', function(data) {
    console.log('📢 System message received:', data);
    
    // Check if this is an AI removal confirmation message
    if (data.message && data.message.includes('Successfully removed') && data.message.includes('AI player')) {
        console.log('🤖 AI removal detected via system message - triggering reset...');
        resetLobbyToPreAIState();
    }
});

// Handle system notification popups
socket.on('systemNotification', function(data) {
    console.log('📢 System notification received:', data);
    
    // Check if we're in game and should use notification area
    const pokerTable = document.getElementById('pokerTable');
    const isInGame = pokerTable && pokerTable.style.display !== 'none';
    
    if (isInGame) {
        showSystemNotification(data.title || '📢 System Announcement', data.message, data.type || 'info');
    } else {
        // Fall back to modal for non-game contexts
        showGlassmorphismAlert(data.title || '📢 System Announcement', data.message, data.type || 'info');
    }
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
        const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
        const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
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
    
    // Only update wallet displays immediately for moderators, avoid delayed updates during gameplay
    // to prevent interference with animations
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    
    if (isModerator && data.players && data.players.length > 0) {
        // Update immediately for moderators, without delay to avoid animation conflicts
        console.log('💰 Immediate wallet update for moderator during status update');
        updateAllWalletDisplays(data.players);
    }
    // Note: Non-moderator wallet updates handled by specific game events (roundResult, etc.)
    // to avoid interfering with ongoing animations
});

// Handle incentive changes
socket.on('incentiveChanged', function(data) {
    console.log('🎁 Incentive changed:', data);
    
    // Show prominent incentive banner to the player who received the incentive
    if (data.incentiveType && data.incentiveDisplay) {
        showIncentiveBanner(data.incentiveDisplay);
        // Removed: showSystemNotification('Incentive Active', data.message, 'success');
    } else {
        hideIncentiveBanner();
        // Removed: showSystemNotification('Incentive Removed', data.message, 'warning');
    }
    
    // Update incentive element for moderators (legacy support)
    const incentiveElement = document.getElementById('activeIncentive');
    if (incentiveElement && window.currentUserIsModerator) {
        if (data.incentiveType) {
            incentiveElement.textContent = data.incentiveDisplay || data.incentiveType;
            incentiveElement.style.color = '#faa61a';
        } else {
            incentiveElement.textContent = 'No Active Incentive';
            incentiveElement.style.color = '#72767d';
        }
    }
});

// Handle incentive bonus notifications - turn banner to neon green success state and spawn token
socket.on('incentiveBonusNotification', function(data) {
    console.log('🎁 Incentive bonus earned:', data);
    
    // Turn the incentive banner to neon green success state
    const incentiveBanner = document.getElementById('incentiveBanner');
    if (incentiveBanner) {
        // Add success class for neon green styling
        incentiveBanner.classList.add('incentive-success');
        
        // Get the content container
        const content = incentiveBanner.querySelector('.incentive-content');
        if (content) {
            // Replace content with checkmark and success message in neon style
            content.innerHTML = `
                <h3 class="incentive-title" style="color: #00ff00 !important; text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00 !important;">
                    ✓ BONUS EARNED ✓
                </h3>
                <p class="incentive-description" style="color: #00ffff; font-size: 16px;">
                    +${data.bonusTokens} Black Token${data.bonusTokens > 1 ? 's' : ''}
                </p>
            `;
        }
    }
    
    // Trigger immediate incentive token animation
    if (data.bonusTokens && data.bonusTokens > 0) {
        // Small delay to let the color change register
        setTimeout(() => {
            showIncentiveTokenAnimation(data.bonusTokens);
        }, 200);
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

socket.on('roundResultsPanel', function(data) {
    console.log('📊 Round results panel data received:', data);
    
    // Show results for everyone, but different data based on role
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    console.log('📊 isModerator check:', isModerator);
    
    // Show token animation for non-moderators (players)
    // NOTE: Only animate white tokens and cooperative black tokens here
    // Incentive bonus tokens are animated IMMEDIATELY when earned (in incentiveBonusNotification handler)
    if (!isModerator && data.previousRoundPlayers) {
        const currentPlayerRound = data.previousRoundPlayers.find(p => p.username === currentUsername);
        if (currentPlayerRound) {
            const whiteEarned = currentPlayerRound.whiteTokens || 0;
            // Only include cooperative black tokens (when all chose even), NOT incentive bonuses
            const cooperativeBlackEarned = currentPlayerRound.blackTokens || 0;
            // Show animation with slight delay for dramatic effect
            setTimeout(() => {
                showTokenAnimation(whiteEarned, cooperativeBlackEarned);
            }, 500);
        }
    }
    
    // Delay showing results until return animation triggers (2 seconds)
    setTimeout(() => {
        console.log('📊 Displaying round results after return animation delay');
        updateRoundResultsPanel(data);
        
        // Update poker table wallet displays and personal wallet with current totals
        if (data.players && data.players.length > 0) {
            console.log('💰 Updating all wallet displays from roundResultsPanel');
            updateAllWalletDisplays(data.players);
            
            // Also update personal wallet if not moderator
            if (!isModerator) {
                const currentPlayer = data.players.find(p => p.username === currentUsername);
                if (currentPlayer) {
                    console.log(`💰 Found current player data:`, currentPlayer);
                    document.getElementById('whiteTokens').textContent = currentPlayer.whiteTokens || 0;
                    document.getElementById('blackTokens').textContent = currentPlayer.blackTokens || 0;
                    document.getElementById('totalEarnings').textContent = `$${(currentPlayer.totalEarnings || 0).toFixed(2)}`;
                    console.log(`💰 Updated personal wallet for ${currentUsername}: White=${currentPlayer.whiteTokens}, Black=${currentPlayer.blackTokens}, Total=$${currentPlayer.totalEarnings}`);
                } else {
                    console.log(`💰 Could not find player data for ${currentUsername} in:`, data.players.map(p => p.username));
                }
            }
        }
        
        // Show roundResultsPokerTable for all players (round results below poker table)
        const roundResultsPokerTable = document.getElementById('roundResultsPokerTable');
        if (roundResultsPokerTable && data.previousRoundPlayers) {
            roundResultsPokerTable.style.display = 'block';
            console.log('📊 Showing roundResultsPokerTable for all players');
        }
        
        // Show resultsPhaseBottom only for moderators (cumulative below checkerboard)
        if (isModerator) {
            const resultsPhaseBottom = document.getElementById('resultsPhaseBottom');
            if (resultsPhaseBottom && data.players) {
                resultsPhaseBottom.style.display = 'block';
                console.log('📊 Showing resultsPhaseBottom for moderator only');
            }
        } else {
            // Hide resultsPhaseBottom for non-moderators
            const resultsPhaseBottom = document.getElementById('resultsPhaseBottom');
            if (resultsPhaseBottom) {
                resultsPhaseBottom.style.display = 'none';
                console.log('📊 Hiding resultsPhaseBottom for non-moderator');
            }
        }
    }, 2500); // Delay to sync with return animation completion
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
    console.log(`🎯 DOM check - gameDiv exists:`, !!document.getElementById('gameDiv'));
    console.log(`🎯 DOM check - turnDisplay exists:`, !!document.getElementById('turnDisplay'));
    
    // CRITICAL: Check gameDiv BEFORE processing turn update
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
            console.log('🎯 turnUpdate: Made gameDiv visible');
        } else {
            console.log('🎯 turnUpdate: gameDiv already visible');
        }
    } else {
        console.log('❌ turnUpdate: gameDiv not found');
        return; // Early return if critical element missing
    }
    
    // Update global active player tracker
    currentActivePlayer = data.currentTurnPlayer;
    console.log(`🎯 Set currentActivePlayer to: ${currentActivePlayer}`);
    
    // Update turn display
    console.log('🎯 Calling updateTurnDisplay...');
    updateTurnDisplay(data);
    
    // Enable/disable row clicking based on whose turn it is
    console.log('🎯 Calling updateRowInteractivity...');
    updateRowInteractivity(data);
    
    // Check gameDiv AFTER processing turn update
    if (gameDiv) {
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
            console.log('🎯 turnUpdate: Re-made gameDiv visible after processing');
        }
    }
    
    console.log('🎯 turnUpdate processing complete');
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
            position: absolute;
            top: -60px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(72, 47, 247, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 2px solid rgba(92, 63, 255, 0.5);
            white-space: nowrap;
        `;
        
        // Anchor it to the decision grid container or create a container for it
        const decisionGridContainer = document.getElementById('decisionGridContainer');
        if (decisionGridContainer) {
            decisionGridContainer.style.position = 'relative';
            decisionGridContainer.appendChild(turnDisplay);
            console.log(`✅ turnDisplay anchored to decision grid container`);
        } else {
            document.body.appendChild(turnDisplay);
            console.log(`⚠️ decision grid container not found, appending to body`);
        }
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
                position: absolute;
                bottom: 30px;
                right: 70px;
                background: linear-gradient(145deg, rgba(67, 181, 129, 0.95), rgba(52, 144, 103, 0.95));
                color: white;
                padding: 8px 16px;
                border-radius: 8px;
                font-family: 'Inter', sans-serif;
                font-size: 13px;
                z-index: 1000;
                box-shadow: 
                    0 0 25px rgba(67, 181, 129, 0.8),
                    0 0 50px rgba(67, 181, 129, 0.4),
                    0 4px 12px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(67, 181, 129, 0.9);
                animation: pulseGlow 2s infinite alternate;
                white-space: nowrap;
            `;
        } else {
            turnDisplay.style.cssText = `
                position: absolute;
                bottom: 30px;
                right: 70px;
                background: rgba(72, 47, 247, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 8px;
                font-family: 'Inter', sans-serif;
                font-size: 13px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(92, 63, 255, 0.5);
                white-space: nowrap;
            `;
        }
        
        const displayHTML = `
            <div style="font-weight: 600; font-size: 12px;">${isMyTurn ? '🎯 YOUR TURN' : `🎯 ${turnData.currentTurnPlayer}'s Turn`}</div>
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
    console.log(`🟢 updateActivePlayerHighlight called for: ${activePlayerName}`);
    
    // Reset all player seat styles to default
    SEAT_IDS.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            // Only reset border if seat has a player (don't modify empty seats)
            if (nameDiv && nameDiv.textContent.trim() !== '' && nameDiv.textContent !== 'Empty') {
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
    console.log('🎯 updateRowInteractivity called with:', turnData);
    
    // Small delay to ensure this runs after any conflicting UI updates
    setTimeout(() => {
        const rows = document.querySelectorAll('.grid-row-8x8, .clickable-row');
        const currentUsername = localStorage.getItem('username');
        const isMyTurn = turnData.currentTurnPlayer === currentUsername;
        
        console.log(`🎯 UpdateRowInteractivity: Current user: ${currentUsername}, Current turn: ${turnData.currentTurnPlayer}, Is my turn: ${isMyTurn}, Found ${rows.length} rows, turnBased: ${turnData.turnBased}`);
        console.log(`🎯 Row selectors found: .grid-row-8x8 (${document.querySelectorAll('.grid-row-8x8').length}), .clickable-row (${document.querySelectorAll('.clickable-row').length})`);
        
        if (rows.length === 0) {
            console.log('❌ No rows found for interactivity update!');
            return;
        }
        
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
                if (index === 0) console.log('🔓 Non-turn-based: all rows enabled');
            }
        });
        
        // Ensure lock-in button remains accessible when player has made a selection
        const lockInBtn = document.getElementById('lockInBtn');
        console.log(`🎯 Lock-in button check: exists=${!!lockInBtn}, selectedChoice=${selectedChoice}, isLockedIn=${isLockedIn}, isMyTurn=${isMyTurn}`);
        if (lockInBtn && selectedChoice && !isLockedIn && isMyTurn) {
            lockInBtn.style.pointerEvents = 'auto';
            lockInBtn.disabled = false;
            console.log('🔒 Lock-in button ensured clickable');
        } else if (lockInBtn) {
            console.log(`🔒 Lock-in button NOT enabled - selectedChoice=${selectedChoice}, isLockedIn=${isLockedIn}, isMyTurn=${isMyTurn}`);
        }
        
        console.log('🎯 updateRowInteractivity complete');
    }, 100); // 100ms delay to ensure this runs after other UI updates
}

// Function to trigger the floating animation for a player seat (used for deferred animations during reconnection)
function triggerPlayerSeatAnimation(playerSeat, lockData, username) {
    console.log(`🎭 triggerPlayerSeatAnimation called: seat=${!!playerSeat}, lockData=${!!lockData}, username=${username}`);
    
    if (!playerSeat || !lockData) {
        console.log(`🎭 Early return: missing playerSeat (${!!playerSeat}) or lockData (${!!lockData})`);
        return;
    }
    
    console.log(`🎭 Starting deferred floating animation for ${username}`);
    
    // IMPORTANT: Use a delay to ensure this runs AFTER any restoreFloatingPlayers() calls
    setTimeout(() => {
        console.log(`🎭 Executing deferred animation for ${username} (after restore delay)`);
        
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
    
    // Store player info for round end restoration (if not already stored)
    if (!lockedInPlayers.has(username)) {
        lockedInPlayers.set(username, {
            seat: playerSeat,
            originalStyles: originalStyles,
            isFloating: false,
            cleanupTimeout: null
        });
    }
    
    // Add glow effect to the player seat (if not already applied)
    const glowColor = lockData.isAI ? '#faa61a' : '#5865f2';
    playerSeat.style.border = `3px solid ${glowColor}`;
    playerSeat.style.boxShadow = `
        0 0 25px ${lockData.isAI ? 'rgba(250, 166, 26, 0.6)' : 'rgba(88, 101, 242, 0.6)'},
        0 0 50px ${lockData.isAI ? 'rgba(250, 166, 26, 0.3)' : 'rgba(88, 101, 242, 0.3)'},
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `;
    playerSeat.style.background = `linear-gradient(145deg, rgba(${lockData.isAI ? '250, 166, 26' : '88, 101, 242'}, 0.05), rgba(${lockData.isAI ? '255, 140, 66' : '71, 82, 196'}, 0.1))`;
    
    // Phase 1: Brief initial scale effect (immediate for reconnection)
    playerSeat.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    playerSeat.style.transform = (originalStyles.transform || '') + ' scale(1.15)';
    
    // Phase 2: Move toward center (shorter delay for reconnection)
    setTimeout(() => {
        playerSeat.style.zIndex = '25'; // Float above other elements
        
        if (playerSeat.id === 'leftPlayer') {
            // Left player moves right to just outside counter boundary
            let moveDistance = 320;
            playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateX(${moveDistance}px)`;
        } else if (playerSeat.id === 'rightPlayer') {
            // Right player moves left to just outside counter boundary
            let moveDistance = 320;
            playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateX(-${moveDistance}px)`;
        } else if (playerSeat.id === 'topPlayer') {
            // Top player moves down to just outside counter boundary
            let moveDistance = 40;
            playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateY(${moveDistance}px)`;
        } else {
            // Fallback: just scale
            playerSeat.style.transform = (originalStyles.transform || '') + ' scale(1.1)';
        }
        
        // Set transition for smooth movement
        playerSeat.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        
        if (lockedInPlayers.has(username)) {
            lockedInPlayers.get(username).isFloating = true;
        }
        
        console.log(`✅ Applied floating animation to ${username}'s seat (${playerSeat.id})`);
        
    }, 1500); // Delay to ensure this runs after restoreFloatingPlayers() completes
    }); // Close the first setTimeout that starts on line 3698
}

// Visual feedback when players lock in their choices
// Store pending lock indicators for players whose seats aren't ready yet
let pendingLockIndicators = new Map();

// Function to apply lock indicator to a player's seat
function applyLockIndicator(data, retryCount = 0) {
    const maxRetries = 5; // Limit retries to prevent infinite loops
    const allSeats = SEAT_IDS;
    let playerSeat = null;
    
    console.log(`🔍 Looking for seat for ${data.username}, checking ${allSeats.length} seats (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    allSeats.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            if (nameDiv && nameDiv.textContent === data.username) {
                console.log(`✅ Found ${data.username} in seat ${seatId}`);
                playerSeat = seat;
            } else {
                console.log(`❌ Seat ${seatId} contains: ${nameDiv ? nameDiv.textContent : 'no name'}`);
            }
        } else {
            console.log(`❌ Seat element ${seatId} not found`);
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
        
        console.log(`✅ Added lock indicator to ${data.username}'s seat (${playerSeat.id})`);
        console.log(`🔍 Lock indicator element:`, lockIcon);
        
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
        
        console.log(`✅ Applied glow effects to ${data.username}'s seat`);
        
        // Phase 1: Brief initial scale effect (0.5s)
        setTimeout(() => {
            playerSeat.style.transform = (originalStyles.transform || '') + ' scale(1.15)';
        }, 200);
        
        // Phase 2: Simple gentle movement toward center (stops at boundary)
        setTimeout(() => {
            playerSeat.style.zIndex = '25'; // Float above other elements
            
            // Calculate movement distance toward center (reduced for balance)
            const rect = playerSeat.getBoundingClientRect();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const deltaX = (centerX - rect.left - rect.width / 2) * 0.1; // 10% toward center
            const deltaY = (centerY - rect.top - rect.height / 2) * 0.1;
            
            // Apply gentle movement with scale
            if (Math.abs(deltaY) > 5) { // Only apply if meaningful distance
                const moveDistance = Math.sign(deltaY) * Math.min(Math.abs(deltaY), 30); // Limit movement
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
        
        // Remove from pending list if successfully applied
        pendingLockIndicators.delete(data.username);
        console.log(`✅ Applied lock indicator for ${data.username}, remaining pending: ${pendingLockIndicators.size}`);
        return true;
    } else {
        console.log(`❌ No seat found for ${data.username}, retry ${retryCount + 1}/${maxRetries + 1}`);
        
        if (retryCount < maxRetries) {
            // Retry after a short delay to allow for DOM updates
            setTimeout(() => {
                console.log(`🔄 Retrying lock indicator for ${data.username} (attempt ${retryCount + 2})`);
                if (pendingLockIndicators.has(data.username)) {
                    applyLockIndicator(data, retryCount + 1);
                }
            }, 500);
        } else {
            console.log(`❌ Max retries reached for ${data.username}, removing from pending list`);
            pendingLockIndicators.delete(data.username);
        }
        return false;
    }
}

socket.on('playerLockedIn', function(data) {
    console.log(`🔒 Player locked in: ${data.username}, Row: ${data.row}, AI: ${data.isAI}, Column: ${data.column}`);
    
    // Store the lock-in data for processing
    pendingLockIndicators.set(data.username, data);
    console.log(`📦 Stored lock indicator for ${data.username}, pending indicators: ${pendingLockIndicators.size}`);
    
    // Try to apply lock indicator immediately
    applyLockIndicator(data);
    
    // 1. PLAYER SEAT VISUAL EFFECTS (seat animation and lock indicators)
    // This section handles the floating animation and visual effects on player seats
    const allSeats = SEAT_IDS;
    let playerSeat = null;
    
    console.log(`🔍 Looking for player seat for ${data.username}`);
    allSeats.forEach(seatId => {
        const seat = document.getElementById(seatId);
        if (seat) {
            const nameDiv = seat.querySelector('.player-name');
            if (nameDiv && nameDiv.textContent === data.username) {
                console.log(`✅ Found ${data.username} in seat ${seatId}`);
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
        
        console.log(`✅ Added lock indicator to ${data.username}'s seat (${playerSeat.id})`);
        
        // Add immediate glow effect to the player seat
        const glowColor = data.isAI ? '#faa61a' : '#5865f2';
        playerSeat.style.border = `3px solid ${glowColor}`;
        playerSeat.style.boxShadow = `
            0 0 25px ${data.isAI ? 'rgba(250, 166, 26, 0.6)' : 'rgba(88, 101, 242, 0.6)'},
            0 0 50px ${data.isAI ? 'rgba(250, 166, 26, 0.3)' : 'rgba(88, 101, 242, 0.3)'},
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `;
        playerSeat.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        playerSeat.style.background = `linear-gradient(145deg, rgba(${data.isAI ? '250, 166, 26' : '88, 101, 242'}, 0.05), rgba(${data.isAI ? '255, 140, 66' : '71, 82, 196'}, 0.1))`;
        
        console.log(`✅ Applied glow effects to ${data.username}'s seat`);
        
        // Phase 1: Brief initial scale effect (0.5s)
        setTimeout(() => {
            playerSeat.style.transform = (originalStyles.transform || '') + ' scale(1.15)';
        }, 200);
        
        // Phase 2: Move all players to just outside the counter boundary in the middle
        setTimeout(() => {
            playerSeat.style.zIndex = '25'; // Float above other elements
            
            if (playerSeat.id === 'leftPlayer') {
                // Left player moves right to just outside counter boundary
                let moveDistance = 80; // Reduced movement for new layout
                playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateX(${moveDistance}px)`;
            } else if (playerSeat.id === 'rightPlayer') {
                // Right player moves left to just outside counter boundary
                let moveDistance = 80; // Reduced movement for new layout
                playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateX(-${moveDistance}px)`;
            } else if (playerSeat.id === 'topPlayer') {
                // Top player moves down to just outside counter boundary
                let moveDistance = 60; // P2 moves less
                playerSeat.style.transform = (originalStyles.transform || '') + ` scale(1.1) translateY(${moveDistance}px)`;
            } else {
                // Fallback: just scale
                playerSeat.style.transform = (originalStyles.transform || '') + ' scale(1.1)';
            }
            
            // Set transition for smooth movement
            playerSeat.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            
            if (lockedInPlayers.has(data.username)) {
                lockedInPlayers.get(data.username).isFloating = true;
            }
            
        }, 1000);
        
        console.log(`🎭 Started floating animation for ${data.username}`);
    } else {
        console.log(`❌ No seat found for ${data.username}, cannot show player seat animation`);
    }
    
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
    
    // Process grid row details (visible to ALL players)
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
    
    // 3. COLUMN SELECTION DISPLAY (popup removed per user request)
    if (data.column) {
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

// Handle comprehensive game state restoration on reconnection
socket.on('gameStateRestore', function(data) {
    console.log(`🎮 Comprehensive game state restore received:`, data);
    
    // Update global token pool display
    if (data.globalTokenPool) {
        const tokenPoolBar = document.getElementById('tokenPoolBar');
        const totalTokens = data.globalTokenPool.initialWhiteTokens || TOKEN_CONFIG.CONDITIONS_TOKENS;
        
        // Update token pool display with dynamic max value
        updateTokenPoolDisplay(data.globalTokenPool.whiteTokens, totalTokens);
        console.log(`🎯 Token pool restored: ${data.globalTokenPool.whiteTokens}/${totalTokens}`);
        
        // Update token pool bar if it exists
        if (tokenPoolBar) {
            const percentage = (data.globalTokenPool.whiteTokens / totalTokens) * 100;
            tokenPoolBar.style.width = `${percentage}%`;
            tokenPoolBar.style.background = 'linear-gradient(90deg, #faa61a 0%, #ffcc4d 50%, #f1c40f 100%)';
            console.log(`🎯 Token pool bar restored: ${percentage}% (${data.globalTokenPool.whiteTokens}/${totalTokens})`);
        }
        
        // Add brief highlight effect to show restoration
        const globalTokenPoolElement = document.getElementById('globalTokenPool');
        if (globalTokenPoolElement) {
            globalTokenPoolElement.style.backgroundColor = 'rgba(250, 166, 26, 0.2)';
            globalTokenPoolElement.style.transition = 'background-color 0.5s ease';
            setTimeout(() => {
                globalTokenPoolElement.style.backgroundColor = '';
            }, 1000);
        }
    }
    
    // Update current round display if it exists
    if (data.gameSession && data.gameSession.currentRound) {
        const roundDisplays = document.querySelectorAll('.round-display, .current-round, [class*="round"]');
        roundDisplays.forEach(display => {
            if (display.textContent.includes('Round') || display.id.includes('round')) {
                console.log(`🔄 Updating round display: Round ${data.gameSession.currentRound}`);
                display.textContent = `Round ${data.gameSession.currentRound}`;
            }
        });
    }
    
    // Update condition display if it exists
    if (data.gameSession && data.gameSession.currentCondition) {
        const conditionDisplays = document.querySelectorAll('.condition-display, #conditionInfo');
        conditionDisplays.forEach(display => {
            console.log(`🔄 Updating condition display: ${data.gameSession.currentCondition.name}`);
            display.textContent = data.gameSession.currentCondition.name;
        });
    }
    
    // Update culturant count display
    if (data.gameSession && typeof data.gameSession.culturantsProduced !== 'undefined') {
        const culturantDisplays = document.querySelectorAll('.culturant-count, #culturantCount, [class*="culturant"]');
        culturantDisplays.forEach(display => {
            console.log(`🏆 Updating culturant count: ${data.gameSession.culturantsProduced}`);
            display.textContent = `Culturants: ${data.gameSession.culturantsProduced}`;
        });
    }
    
    console.log(`✅ Comprehensive game state restoration complete`);
});

// Track wallet restoration to prevent duplicates
let walletRestorationInProgress = false;

// Handle all players wallet restoration on reconnection  
socket.on('allPlayersWalletRestore', function(data) {
    console.log(`💰 All players wallet restore received:`, data);
    
    if (!data.players || data.players.length === 0) {
        console.log(`❌ No player wallet data to restore`);
        return;
    }

    if (walletRestorationInProgress) {
        console.log(`⏳ Wallet restoration already in progress, skipping duplicate`);
        return;
    }

    walletRestorationInProgress = true;
    
    // Add a delay to ensure DOM elements are ready
    setTimeout(() => {
        // Update wallet displays for all players
        console.log(`💰 Updating wallet displays for all players`);
        console.log(`💰 Players data received:`, data.players);
        
        // Determine if current user is moderator
        const currentUserData = data.players.find(p => p.username === currentUsername);
        const isCurrentUserModerator = currentUserData ? currentUserData.isModerator : false;
        console.log(`💰 Current user: ${currentUsername}, is moderator: ${isCurrentUserModerator}`);
        
        // Update personal wallet first if not moderator
        if (!isCurrentUserModerator && currentUserData) {
            const whiteTokensElement = document.getElementById('whiteTokens');
            const blackTokensElement = document.getElementById('blackTokens');
            const totalEarningsElement = document.getElementById('totalEarnings');
            
            if (whiteTokensElement) {
                whiteTokensElement.textContent = currentUserData.whiteTokens || 0;
                console.log(`💰 Updated personal white tokens: ${currentUserData.whiteTokens || 0}`);
            }
            if (blackTokensElement) {
                blackTokensElement.textContent = currentUserData.blackTokens || 0;
                console.log(`💰 Updated personal black tokens: ${currentUserData.blackTokens || 0}`);
            }
            if (totalEarningsElement) {
                totalEarningsElement.textContent = `$${(currentUserData.totalEarnings || 0).toFixed(2)}`;
                console.log(`💰 Updated personal earnings: $${(currentUserData.totalEarnings || 0).toFixed(2)}`);
            }
        }
        
        // Update each seat's wallet display
        const allSeats = SEAT_IDS;
        allSeats.forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const nameDiv = seat.querySelector('.player-name');
                const walletDiv = seat.querySelector('.player-wallet');
                
                if (nameDiv && walletDiv) {
                    const playerName = nameDiv.textContent;
                    const playerData = data.players.find(p => p.username === playerName);
                    
                    if (playerData) {
                        console.log(`💰 Processing seat ${seatId}: username=${playerName}, walletDiv=${!!walletDiv}`);
                        console.log(`💰 Player data for ${playerName}:`, playerData);
                        
                        walletDiv.textContent = `$${playerData.totalEarnings.toFixed(2)}`;
                        console.log(`💰 Updated wallet for ${playerName}: $${playerData.totalEarnings.toFixed(2)}`);
                        
                        // Add brief highlight effect to show restoration
                        walletDiv.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
                        walletDiv.style.transition = 'background-color 0.5s ease';
                        setTimeout(() => {
                            walletDiv.style.backgroundColor = '';
                        }, 1000);
                    }
                }
            }
        });
        
        console.log(`✅ All players wallet restoration complete`);
        walletRestorationInProgress = false; // Reset flag after completion
    }, 500); // 500ms delay to ensure DOM is ready
});

// UNIFIED COMPREHENSIVE GAME STATE RESTORATION
socket.on('unifiedGameStateRestore', function(data) {
    console.log(`🎮 UNIFIED: Comprehensive game state restoration received:`, data);
    
    // Ensure gameDiv is visible for token pool updates
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        console.log(`🎮 UNIFIED: gameDiv current display: ${gameDiv.style.display}`);
        if (gameDiv.style.display === 'none' || gameDiv.style.display === '') {
            gameDiv.style.display = 'inline-block';
            console.log(`🎮 UNIFIED: Made gameDiv visible for token pool access`);
        }
    }
    
    // 1. Game Session Restoration
    if (data.gameSession) {
        // Update token pool
        if (data.globalTokenPool) {
            const totalTokens = data.globalTokenPool.initialWhiteTokens || TOKEN_CONFIG.CONDITIONS_TOKENS;
            console.log(`🎯 UNIFIED: About to update token pool: ${data.globalTokenPool.whiteTokens}/${totalTokens}`);
            updateTokenPoolDisplay(data.globalTokenPool.whiteTokens, totalTokens);
            console.log(`🎯 UNIFIED: Token pool restored: ${data.globalTokenPool.whiteTokens}/${totalTokens}`);
        }
        
        // Update culturant count
        const culturantDisplays = document.querySelectorAll('.culturant-count, #culturantCount, [class*="culturant"]');
        culturantDisplays.forEach(display => {
            display.textContent = data.gameSession.culturantsProduced || 0;
        });
        console.log(`🏆 UNIFIED: Culturant count: ${data.gameSession.culturantsProduced || 0}`);
    }
    
    // 2. Wallet Restoration
    if (data.playersWalletData && data.playersWalletData.length > 0) {
        console.log(`💰 UNIFIED: Restoring wallet data for ${data.playersWalletData.length} players`);
        
        const currentUserData = data.playersWalletData.find(p => p.username === currentUsername);
        
        // Update personal wallet (if not moderator)
        if (currentUserData && !currentUserData.isModerator) {
            const whiteTokensElement = document.getElementById('whiteTokens');
            const blackTokensElement = document.getElementById('blackTokens');
            const totalEarningsElement = document.getElementById('totalEarnings');
            
            if (whiteTokensElement) whiteTokensElement.textContent = currentUserData.whiteTokens || 0;
            if (blackTokensElement) blackTokensElement.textContent = currentUserData.blackTokens || 0;
            if (totalEarningsElement) totalEarningsElement.textContent = `$${(currentUserData.totalEarnings || 0).toFixed(2)}`;
            
            console.log(`💰 UNIFIED: Personal wallet - White: ${currentUserData.whiteTokens}, Black: ${currentUserData.blackTokens}, Earnings: $${(currentUserData.totalEarnings || 0).toFixed(2)}`);
        }
        
        // Update seat wallets
        const seatIds = ['leftPlayer', 'topPlayer', 'rightPlayer'];
        seatIds.forEach(seatId => {
            const seat = document.getElementById(seatId);
            if (seat) {
                const nameDiv = seat.querySelector('.player-name');
                const walletDiv = seat.querySelector('.player-wallet');
                
                if (nameDiv && walletDiv) {
                    const playerName = nameDiv.textContent;
                    const playerData = data.playersWalletData.find(p => p.username === playerName);
                    
                    if (playerData) {
                        walletDiv.textContent = `$${(playerData.totalEarnings || 0).toFixed(2)}`;
                        console.log(`💰 UNIFIED: Seat ${seatId} wallet updated: ${playerData.username} = $${(playerData.totalEarnings || 0).toFixed(2)}`);
                    }
                }
            }
        });
    }
    
    // 3. Last Round Result Restoration
    if (data.lastRoundResult) {
        console.log(`📚 UNIFIED: Restoring last round result:`, data.lastRoundResult);
        
        // Simulate the normal round result display that Tom would have seen
        const roundResultsDiv = document.getElementById('roundResults');
        if (roundResultsDiv) {
            // Create the same HTML structure as a normal round result
            let resultsHTML = `<h4>Round ${data.lastRoundResult.round} Results</h4>`;
            resultsHTML += '<h4>Choices Made:</h4>';
            
            // Show player choices (same format as normal round results)
            data.lastRoundResult.choices.forEach(choice => {
                if (!choice.isAI && !choice.isModerator) {
                    resultsHTML += `<div>${choice.username}: Row ${choice.choice} (${choice.rowType})</div>`;
                }
            });
            
            
            // Show column selection
            resultsHTML += `<div style="margin-top: 8px;"><strong>Selected Column:</strong> ${data.lastRoundResult.selectedColumn}</div>`;
            
            roundResultsDiv.innerHTML = resultsHTML;
            
            // Show results phase
            const resultsPhase = document.getElementById('resultsPhase');
            if (resultsPhase) {
                resultsPhase.style.display = 'block';
                console.log(`📚 UNIFIED: Last round result displayed`);
            }
        }
    } else {
        console.log(`📚 UNIFIED: No previous round to restore`);
    }
    
    // 4. Turn System Restoration
    if (data.turnData) {
        console.log(`🔄 UNIFIED: Restoring turn system`);
        
        if (data.turnData.currentTurnPlayer) {
            // Update turn display
            const turnDisplayElement = document.querySelector('.turn-display, #turnDisplay');
            if (turnDisplayElement) {
                turnDisplayElement.textContent = `Current Turn: ${data.turnData.currentTurnPlayer}`;
            }
            
            // Update row interactivity
            if (data.turnData.isYourTurn) {
                console.log(`🎯 UNIFIED: It's ${currentUsername}'s turn, enabling interactions`);
                // Enable row interactions will be handled by existing yourTurn handler
            }
        }
    }
    
    console.log(`✅ UNIFIED: Comprehensive restoration complete`);
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

function setupProfileMenu() {
    console.log('👤 Setting up profile menu');
    
    const profileMenuBtn = document.getElementById('profileMenuBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileChevron = document.getElementById('profileChevron');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileUsername = document.getElementById('profileUsername');
    
    if (profileMenuBtn && profileDropdown) {
        // Toggle dropdown on profile button click
        profileMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isVisible = profileDropdown.style.display === 'block';
            
            if (isVisible) {
                profileDropdown.style.display = 'none';
                if (profileChevron) {
                    profileChevron.style.transform = 'rotate(0deg)';
                }
            } else {
                profileDropdown.style.display = 'block';
                if (profileChevron) {
                    profileChevron.style.transform = 'rotate(180deg)';
                }
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!profileMenuBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.style.display = 'none';
                if (profileChevron) {
                    profileChevron.style.transform = 'rotate(0deg)';
                }
            }
        });
    }
    
    // Set up logout functionality in profile menu
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('👤 Logout clicked from profile menu');
            
            // Close the dropdown
            if (profileDropdown) profileDropdown.style.display = 'none';
            if (profileChevron) profileChevron.style.transform = 'rotate(0deg)';
            
            // Emit logout
            socket.emit('logout');
        });
    }
    
    // Set up other profile menu items (placeholder for future functionality)
    const profileMenuItems = document.querySelectorAll('.profile-menu-item');
    profileMenuItems.forEach(item => {
        if (item.id !== 'logoutBtn') { // Skip logout button as it's handled above
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const itemText = item.querySelector('span').textContent;
                console.log(`👤 Profile menu item clicked: ${itemText}`);
                
                // Close dropdown
                if (profileDropdown) profileDropdown.style.display = 'none';
                if (profileChevron) profileChevron.style.transform = 'rotate(0deg)';
                
                // Placeholder for future functionality
                switch(itemText) {
                    case 'Settings':
                        alert('Settings functionality coming soon!');
                        break;
                    case 'Statistics':
                        alert('Statistics functionality coming soon!');
                        break;
                    case 'Achievements':
                        alert('Achievements functionality coming soon!');
                        break;
                }
            });
        }
    });
    
    // Update username in profile menu when available
    if (profileUsername && currentUsername) {
        profileUsername.textContent = currentUsername;
    }
}

// Helper function to switch between login and profile menu
function switchToLoggedInUI(username) {
    console.log(`👤 switchToLoggedInUI called with username: ${username}. Call stack:`, new Error().stack.split('\n').slice(1, 4).join(' | '));
    
    const loginButton = document.getElementById('loginNav');
    const profileMenuContainer = document.querySelector('.profile-menu-container');
    const profileUsername = document.getElementById('profileUsername');
    const emergencyLoginButton = document.getElementById('emergencyLoginButton');
    
    console.log(`👤 Before state change: login button display = ${loginButton ? loginButton.style.display : 'NOT_FOUND'}, profile menu display = ${profileMenuContainer ? profileMenuContainer.style.display : 'NOT_FOUND'}`);
    
    // Ensure main header is visible when logging in
    const header = document.querySelector('.header');
    if (header) {
        header.style.setProperty('display', 'block', 'important');
        header.style.setProperty('visibility', 'visible', 'important');
        header.style.setProperty('opacity', '1', 'important');
        console.log('🔍 Main header ensured visible during login');
    }
    
    // Hide login button with !important to override any CSS
    if (loginButton) {
        loginButton.style.setProperty('display', 'none', 'important');
        loginButton.style.setProperty('visibility', 'hidden', 'important');
        console.log('👤 ✅ Login button hidden with !important');
    } else {
        console.log('👤 ❌ Login button not found');
    }
    
    // Show profile menu container with !important
    if (profileMenuContainer) {
        profileMenuContainer.style.setProperty('display', 'flex', 'important');
        profileMenuContainer.style.setProperty('visibility', 'visible', 'important');
        profileMenuContainer.style.setProperty('opacity', '1', 'important');
        console.log('👤 ✅ Profile menu shown with !important');
    } else {
        console.log('👤 ❌ Profile menu container not found');
    }
    
    if (profileUsername && username) {
        profileUsername.textContent = username;
        console.log(`👤 ✅ Username set to: ${username}`);
    }
    
    if (emergencyLoginButton) emergencyLoginButton.style.display = 'none';
    
    // Hide emergency header when logged in since main header should be visible
    const emergencyHeader = document.getElementById('emergencyHeader');
    if (emergencyHeader) emergencyHeader.style.display = 'none';
    
    console.log(`👤 After state change: login button display = ${loginButton ? loginButton.style.display : 'NOT_FOUND'}, profile menu display = ${profileMenuContainer ? profileMenuContainer.style.display : 'NOT_FOUND'}`);
    console.log('👤 UI switched to logged-in state with profile menu and main header visible');
}

function switchToLoggedOutUI() {
    console.log('👤 switchToLoggedOutUI called. Call stack:', new Error().stack.split('\n').slice(1, 4).join(' | '));
    
    const loginButton = document.getElementById('loginNav');
    const profileMenuContainer = document.querySelector('.profile-menu-container');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileChevron = document.getElementById('profileChevron');
    
    console.log(`👤 Before logout state: login button display = ${loginButton ? loginButton.style.display : 'NOT_FOUND'}, profile menu display = ${profileMenuContainer ? profileMenuContainer.style.display : 'NOT_FOUND'}`);
    
    // Show login button, hide profile menu
    if (loginButton) {
        loginButton.style.display = 'block';
        console.log('👤 ✅ Login button shown');
    } else {
        console.log('👤 ❌ Login button not found');
    }
    
    // Hide profile menu elements
    if (profileMenuContainer) {
        profileMenuContainer.style.display = 'none';
        console.log('👤 ✅ Profile menu hidden');
    } else {
        console.log('👤 ❌ Profile menu container not found');
    }
    
    if (profileDropdown) profileDropdown.style.display = 'none';
    if (profileChevron) profileChevron.style.transform = 'rotate(0deg)';
    
    console.log(`👤 After logout state: login button display = ${loginButton ? loginButton.style.display : 'NOT_FOUND'}, profile menu display = ${profileMenuContainer ? profileMenuContainer.style.display : 'NOT_FOUND'}`);
    console.log('👤 UI switched to logged-out state');
}

console.log('🧠 Client.js loaded - Canvas rendering and keyboard controls disabled for behavioral experiment mode');

// Debug function to check DOM state
function debugDOMState() {
    console.log('🔍 DOM DEBUG REPORT:');
    console.log('- Body class list:', document.body.classList.toString());
    console.log('- Document ready state:', document.readyState);
    
    // Check all header-related elements
    const elements = {
        'header (.header)': document.querySelector('.header'),
        'navbar (.navbar)': document.querySelector('.navbar'),
        'nav-logo (.nav-logo)': document.querySelector('.nav-logo'),
        'loginNav (#loginNav)': document.getElementById('loginNav'),
        'emergencyHeader (#emergencyHeader)': document.getElementById('emergencyHeader'),
        'emergencyLoginButton (#emergencyLoginButton)': document.getElementById('emergencyLoginButton')
    };
    
    Object.entries(elements).forEach(([name, element]) => {
        if (element) {
            const computed = window.getComputedStyle(element);
            console.log(`- ${name}:`, {
                exists: true,
                display: element.style.display || 'not set',
                computedDisplay: computed.display,
                visibility: computed.visibility,
                opacity: computed.opacity,
                position: computed.position,
                zIndex: computed.zIndex
            });
        } else {
            console.log(`- ${name}: NOT FOUND IN DOM`);
        }
    });
    
    // Check if elements are actually visible
    const header = document.querySelector('.header');
    if (header) {
        const rect = header.getBoundingClientRect();
        console.log('- Header position:', {
            top: rect.top,
            left: rect.left, 
            width: rect.width,
            height: rect.height,
            inViewport: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
        });
    }
}

// Simple header visibility function
function forceHeaderVisibility() {
    console.log('🔧 forceHeaderVisibility called');
    
    // First, debug current state
    debugDOMState();
    
    const header = document.querySelector('.header');
    const navbar = document.querySelector('.navbar');
    const loginButton = document.getElementById('loginNav');
    
    if (!header) {
        console.error('❌ CRITICAL: .header element not found in DOM!');
        return false;
    }
    
    if (!navbar) {
        console.error('❌ CRITICAL: .navbar element not found in DOM!');
        return false;
    }
    
    if (!loginButton) {
        console.error('❌ CRITICAL: #loginNav element not found in DOM!');
        return false;
    }
    
    // Force elements to be visible
    header.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 80px !important;
        background: rgba(25, 10, 45, 0.95) !important;
        border-bottom: 2px solid #E619B3 !important;
        z-index: 9999 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    `;
    
    navbar.style.cssText = `
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 1rem 1.5rem !important;
        height: 100% !important;
        width: 100% !important;
        visibility: visible !important;
        opacity: 1 !important;
    `;
    
    loginButton.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: #E619B3 !important;
        color: white !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
    `;
    
    console.log('🔧 All header elements forced visible');
    return true;
}

// Multiple attempts to force header visibility for better browser compatibility
function ensureHeaderVisibility() {
    console.log('🔧 Ensuring header visibility...');
    
    // Immediate attempt
    const success1 = forceHeaderVisibility();
    
    // After a short delay (for slow rendering)
    setTimeout(() => {
        const success2 = forceHeaderVisibility();
        console.log('🔧 Second attempt:', success2);
    }, 100);
    
    // After page load events settle
    setTimeout(() => {
        const success3 = forceHeaderVisibility();
        console.log('🔧 Third attempt:', success3);
    }, 500);
    
    // Final attempt after everything should be loaded
    setTimeout(() => {
        const success4 = forceHeaderVisibility();
        console.log('🔧 Final attempt:', success4);
        
        // If still no header, create an alert for debugging
        const header = document.querySelector('.header');
        if (!header) {
            console.error('❌ CRITICAL: Header element not found even after multiple attempts!');
            // Add a visible error message to the page
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed;top:10px;left:10px;background:red;color:white;padding:10px;z-index:9999;';
            errorDiv.textContent = 'ERROR: Header not found in DOM!';
            document.body.appendChild(errorDiv);
        }
    }, 1000);
}

// Force header visibility when DOM is ready - multiple timing approaches
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureHeaderVisibility);
    window.addEventListener('load', ensureHeaderVisibility);
} else {
    ensureHeaderVisibility();
}

// Also ensure it runs after socket connection
window.addEventListener('load', ensureHeaderVisibility);

// Global debug functions for browser console
window.debugHeader = debugDOMState;
window.forceHeader = forceHeaderVisibility;
window.fixHeader = function() {
    console.log('🔧 Manual header fix initiated from console');
    forceHeaderVisibility();
    
    // Also create a visible test element
    const testDiv = document.createElement('div');
    testDiv.id = 'headerTestDiv';
    testDiv.style.cssText = `
        position: fixed !important;
        top: 90px !important;
        left: 20px !important;
        background: red !important;
        color: white !important;
        padding: 10px !important;
        z-index: 99999 !important;
        border: 2px solid yellow !important;
        font-weight: bold !important;
    `;
    testDiv.textContent = 'HEADER FIX TEST - If you see this, JavaScript is working';
    
    // Remove existing test div
    const existing = document.getElementById('headerTestDiv');
    if (existing) existing.remove();
    
    document.body.appendChild(testDiv);
    console.log('🔧 Added red test div to verify DOM manipulation');
};

// Enhanced debug function for checking all card visibility states
window.debugCardVisibility = function() {
    console.log('🔥 CARD VISIBILITY DEBUG REPORT 🔥');
    const menuContext = getMenuContext();
    console.log('🎯 Menu Context:', menuContext);
    console.log('🔍 Current username:', currentUsername);
    console.log('🔍 Current room:', currentRoom);
    console.log('🔍 Game active:', gameActive);
    console.log('🔍 Body classes:', document.body.className);
    console.log('🔍 Body has game-active:', document.body.classList.contains('game-active'));
    
    const createCard = document.getElementById('create-card');
    const joinCard = document.getElementById('join-card');
    const inviteCard = document.getElementById('invite-card');
    const roomPill = document.getElementById('room-pill');
    const actionCardsContainer = document.querySelector('.action-cards-container');
    
    if (createCard) {
        console.log('📊 Create Card:');
        console.log('  - Classes:', createCard.className);
        console.log('  - Display:', window.getComputedStyle(createCard).display);
        console.log('  - Visibility:', window.getComputedStyle(createCard).visibility);
        console.log('  - Opacity:', window.getComputedStyle(createCard).opacity);
    }
    
    if (joinCard) {
        console.log('📊 Join Card:');
        console.log('  - Classes:', joinCard.className);
        console.log('  - Display:', window.getComputedStyle(joinCard).display);
        console.log('  - Visibility:', window.getComputedStyle(joinCard).visibility);
        console.log('  - Opacity:', window.getComputedStyle(joinCard).opacity);
    }
    
    if (inviteCard) {
        console.log('📊 Invite Card:');
        console.log('  - Classes:', inviteCard.className);
        console.log('  - Display:', window.getComputedStyle(inviteCard).display);
        console.log('  - Visibility:', window.getComputedStyle(inviteCard).visibility);
        console.log('  - Opacity:', window.getComputedStyle(inviteCard).opacity);
    }
    
    if (actionCardsContainer) {
        console.log('📊 Action Cards Container:');
        console.log('  - Classes:', actionCardsContainer.className);
        console.log('  - Display:', window.getComputedStyle(actionCardsContainer).display);
        console.log('  - Visibility:', window.getComputedStyle(actionCardsContainer).visibility);
        console.log('  - Opacity:', window.getComputedStyle(actionCardsContainer).opacity);
    }
    
    if (roomPill) {
        console.log('📊 Room Pill:');
        console.log('  - Classes:', roomPill.className);
        console.log('  - Display:', window.getComputedStyle(roomPill).display);
        console.log('  - Visibility:', window.getComputedStyle(roomPill).visibility);
        console.log('  - Opacity:', window.getComputedStyle(roomPill).opacity);
        console.log('  - Data-room attribute:', roomPill.getAttribute('data-room'));
        
        const submenu = document.getElementById('room-pill-submenu');
        const leaveOption = document.getElementById('leave-room-option');
        console.log('  - Submenu found:', !!submenu);
        console.log('  - Leave option found:', !!leaveOption);
        if (submenu) {
            console.log('  - Submenu display:', window.getComputedStyle(submenu).display);
            console.log('  - Submenu classes:', submenu.className);
        }
    }
};

// Global debug function to force show cards (fallback)
window.forceShowCards = function() {
    console.log('🔧 FORCE SHOW CARDS - Debug function called');
    const createCard = document.getElementById('create-card');
    const joinCard = document.getElementById('join-card');
    
    if (createCard) {
        createCard.style.display = 'block';
        createCard.style.visibility = 'visible';
        createCard.style.opacity = '1';
        createCard.classList.remove('card-hidden');
        createCard.classList.add('card-visible');
        console.log('✅ Forced create card visible');
        console.log('🔧 Create card computed style:', window.getComputedStyle(createCard).display);
    }
    if (joinCard) {
        joinCard.style.display = 'block';
        joinCard.style.visibility = 'visible';
        joinCard.style.opacity = '1';
        joinCard.classList.remove('card-hidden');
        joinCard.classList.add('card-visible');
        console.log('✅ Forced join card visible');
        console.log('🔧 Join card computed style:', window.getComputedStyle(joinCard).display);
    }
    
    document.body.classList.remove('game-active');
    console.log('✅ Removed game-active class');
    console.log('🔧 Current body classes:', document.body.className);
    
    // Force DOM reflow
    document.body.offsetHeight;
    console.log('🔧 Forced DOM reflow');
};

// Emergency fix for invite button submenu - Multiple approaches
console.log('🔧 Setting up multiple emergency fixes');

// Set up permanent invite button handler immediately
setupPermanentInviteHandler();

// Approach 1: DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 DOMContentLoaded fired - attempting emergency fix');
    setupInviteButtonFix('DOMContentLoaded');
    setupPermanentInviteHandler(); // Ensure handler is set up
});

// Approach 2: Window load
window.addEventListener('load', function() {
    console.log('🔧 Window load fired - attempting emergency fix');
    setupInviteButtonFix('window.load');
    setupPermanentInviteHandler(); // Ensure handler is set up
});

// Approach 3: Immediate with retries (reduced from 5 to 2)
for (let i = 0; i < 2; i++) {
    setTimeout(() => {
        console.log(`🔧 Retry attempt ${i + 1}`);
        setupInviteButtonFix(`retry-${i + 1}`);
        setupPermanentInviteHandler(); // Ensure handler is set up
    }, 1000 * (i + 1));
}

function setupPermanentInviteHandler() {
    console.log('🔧 Setting up permanent invite button handler');
    const createBtn = document.getElementById('createPermanentBtn');
    if (createBtn) {
        console.log('✅ Found createPermanentBtn, setting up handler');
        // Remove existing listeners by cloning
        const newBtn = createBtn.cloneNode(true);
        createBtn.parentNode.replaceChild(newBtn, createBtn);
        
        newBtn.addEventListener('click', function(e) {
            console.log('🔨 Create permanent clicked');
            e.preventDefault();
            
            const customCode = document.getElementById('customCode').value.trim();
            if (!customCode) {
                alert('Please enter a custom invite code.');
                return;
            }
            
            if (customCode.length < 3) {
                alert('Custom invite code must be at least 3 characters long.');
                return;
            }
            
            newBtn.style.opacity = '0.6';
            newBtn.style.pointerEvents = 'none';
            newBtn.innerHTML = 'Creating...';
            
            socket.emit('generateInviteCode', { 
                isPermanent: true, 
                customCode: customCode 
            });
        });
        return true;
    } else {
        console.log('❌ createPermanentBtn not found yet');
        return false;
    }
}

function setupInviteButtonFix(source) {
    console.log(`🔧 setupInviteButtonFix called from: ${source}`);
    const inviteBtn = document.getElementById('invite-card'); // Changed from 'invite-btn' to 'invite-card'
    console.log(`🔧 Found invite button (${source}):`, !!inviteBtn, inviteBtn?.style?.display);
    
    if (inviteBtn && !inviteBtn.classList.contains('invite-hidden')) {
        console.log(`🔧 Setting up invite button click handler (${source})`);
        
        // Remove existing listeners by cloning
        const newBtn = inviteBtn.cloneNode(true);
        inviteBtn.parentNode.replaceChild(newBtn, inviteBtn);
        
        newBtn.addEventListener('click', function(e) {
            console.log(`🖱️ Invite button clicked! (${source}) - Creating MODAL instead of submenu`);
            e.preventDefault();
            e.stopPropagation();
            
            // Create a modal like the login/signup modals
            createInviteChoiceModal();
        });
        
        // Add visual indicator that fix is active
        newBtn.style.boxShadow = '0 0 5px #00ff00';
        newBtn.title = `Modal-based fix active (${source}) - Click for modal menu`;
        
        return true; // Success
    }
    return false; // Failed
}

function createInviteChoiceModal() {
    console.log('🎯 Creating invite choice modal');
    
    // Remove existing modal if it exists
    const existingModal = document.getElementById('inviteChoiceModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal HTML using the same structure as login modals
    const modalHTML = `
        <div id="inviteChoiceModal" class="modal" style="
            display: block;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        ">
            <div class="modal-content animate" style="
                max-width: 420px;
                background: linear-gradient(145deg, 
                    rgba(43, 45, 59, 0.98) 0%, 
                    rgba(54, 57, 63, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 8px 32px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                margin: 10% auto;
            ">
                <div class="imgcontainer" style="text-align: center; padding: 20px 20px 0 20px;">
                    <span onclick="closeInviteChoiceModal()" 
                          class="close"
                          title="Close Modal"
                          style="
                              position: absolute;
                              top: 15px;
                              right: 20px;
                              color: #b9bbbe;
                              font-size: 28px;
                              cursor: pointer;
                              transition: all 0.2s ease;
                          "
                          onmouseover="this.style.color='#ffffff'; this.style.transform='scale(1.1)'"
                          onmouseout="this.style.color='#b9bbbe'; this.style.transform='scale(1)'">&times;</span>
                </div>

                <div class="container" style="text-align: center; padding: 30px;">
                    <h3 style="color: #dcddde; font-weight: 600; margin-bottom: 25px;">
                        <i class="fas fa-user-plus" style="margin-right: 10px;"></i>
                        Generate Invite Code
                    </h3>
                    
                    <button onclick="generateRandomInvite()" style="
                        width: 100%;
                        padding: 15px;
                        margin: 10px 0;
                        background: linear-gradient(135deg, #667aff, #7386ff);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(102, 122, 255, 0.4)'"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        <i class="fas fa-random"></i>
                        Generate Random Code
                    </button>
                    
                    <button onclick="generateInviteLink()" style="
                        width: 100%;
                        padding: 15px;
                        margin: 10px 0;
                        background: linear-gradient(135deg, #2ecc71, #27ae60);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(46, 204, 113, 0.4)'"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        <i class="fas fa-link"></i>
                        Generate Invite Link
                    </button>
                    
                    <button onclick="openPermanentInviteModal()" style="
                        width: 100%;
                        padding: 15px;
                        margin: 10px 0;
                        background: linear-gradient(135deg, #ff7647, #ff8c67);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(255, 118, 71, 0.4)'"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        <i class="fas fa-crown"></i>
                        Create Permanent Code
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to the page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('✅ Invite choice modal created and displayed');
}

// Global functions for the modal
window.closeInviteChoiceModal = function() {
    const modal = document.getElementById('inviteChoiceModal');
    if (modal) {
        modal.remove();
        console.log('❌ Invite choice modal closed');
    }
};

window.generateRandomInvite = function() {
    console.log('🎲 Random invite requested from modal');
    closeInviteChoiceModal();
    
    const inviteBtn = document.getElementById('invite-btn');
    if (inviteBtn) {
        inviteBtn.style.opacity = '0.6';
        inviteBtn.style.pointerEvents = 'none';
        inviteBtn.innerHTML = 'Generating...';
    }
    
    socket.emit('generateInviteCode', { isPermanent: false });
};

window.generateInviteLink = function() {
    console.log('🔗 Invite link requested from modal');
    closeInviteChoiceModal();
    
    // Same as random invite - the response handler will show the link
    socket.emit('generateInviteCode', { isPermanent: false });
};

window.openPermanentInviteModal = function() {
    console.log('👑 Permanent invite requested from modal');
    closeInviteChoiceModal();
    
    const permanentModal = document.getElementById('permanentInviteModal');
    if (permanentModal) {
        permanentModal.style.display = 'block';
        setTimeout(() => {
            const input = document.getElementById('customCode');
            if (input) input.focus();
        }, 100);
    }
};

function setupSubmenuButtons(source) {
    console.log(`🔧 Setting up submenu buttons (${source})`);
    
    const randomBtn = document.getElementById('random-invite-btn');
    const permanentBtn = document.getElementById('permanent-invite-btn');
    const createBtn = document.getElementById('createPermanentBtn');
    
    if (randomBtn) {
        randomBtn.addEventListener('click', function(e) {
            console.log(`🎲 Random invite clicked (${source})`);
            e.preventDefault();
            e.stopPropagation();
            
            const submenu = document.getElementById('invite-submenu');
            if (submenu) submenu.style.display = 'none';
            
            const inviteBtn = document.getElementById('invite-btn');
            if (inviteBtn) {
                inviteBtn.style.opacity = '0.6';
                inviteBtn.style.pointerEvents = 'none';
                inviteBtn.innerHTML = 'Generating...';
            }
            
            socket.emit('generateInviteCode', { isPermanent: false });
        });
    }
    
    if (permanentBtn) {
        permanentBtn.addEventListener('click', function(e) {
            console.log(`👑 Permanent invite clicked (${source})`);
            e.preventDefault();
            e.stopPropagation();
            
            const submenu = document.getElementById('invite-submenu');
            if (submenu) submenu.style.display = 'none';
            
            const modal = document.getElementById('permanentInviteModal');
            if (modal) {
                modal.style.display = 'block';
                setTimeout(() => {
                    const input = document.getElementById('customCode');
                    if (input) input.focus();
                }, 100);
            }
        });
    }
    
    if (createBtn) {
        createBtn.addEventListener('click', function(e) {
            console.log(`🔨 Create permanent clicked (${source})`);
            e.preventDefault();
            
            const customCode = document.getElementById('customCode').value.trim();
            if (!customCode) {
                alert('Please enter a custom invite code.');
                return;
            }
            
            if (customCode.length < 3) {
                alert('Custom invite code must be at least 3 characters long.');
                return;
            }
            
            createBtn.style.opacity = '0.6';
            createBtn.innerHTML = 'Creating...';
            
            socket.emit('generateInviteCode', { 
                isPermanent: true, 
                customCode: customCode 
            });
        });
    }
}

// Moderator Context Menu Functions
function showModeratorContextMenu() {
    const overlay = document.getElementById('moderatorContextOverlay');
    const menu = document.getElementById('moderatorContextMenu');
    
    if (overlay && menu) {
        overlay.style.display = 'block';
        menu.style.display = 'block';
        
        // Add click handlers for the buttons
        setupModeratorMenuHandlers();
        
        // Close menu when clicking overlay
        overlay.addEventListener('click', hideModeratorContextMenu);
    }
}

function hideModeratorContextMenu() {
    const overlay = document.getElementById('moderatorContextOverlay');
    const menu = document.getElementById('moderatorContextMenu');
    
    if (overlay && menu) {
        overlay.style.display = 'none';
        menu.style.display = 'none';
    }
}

function setupModeratorMenuHandlers() {
    const endBtn = document.getElementById('endExperimentBtn');
    const pauseBtn = document.getElementById('pauseExperimentBtn');
    
    // Remove any existing listeners to prevent duplicates
    endBtn?.removeEventListener('click', handleEndExperiment);
    pauseBtn?.removeEventListener('click', handlePauseExperiment);
    
    // Add new listeners
    endBtn?.addEventListener('click', handleEndExperiment);
    pauseBtn?.addEventListener('click', handlePauseExperiment);
}

function handleEndExperiment() {
    hideModeratorContextMenu();
    
    // Show glassmorphic confirmation as part of the button press
    showEndExperimentConfirmation();
}

// Function to show glassmorphic end experiment confirmation
function showEndExperimentConfirmation() {
    // Remove any existing modal
    const existingModal = document.getElementById('endExperimentConfirmModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="endExperimentConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 520px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(220, 38, 127, 0.98) 0%, 
                    rgba(185, 28, 28, 0.95) 100%);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 2px solid rgba(239, 68, 68, 0.4);
                border-radius: 24px;
                box-shadow: 
                    0 30px 100px rgba(185, 28, 28, 0.8),
                    0 15px 50px rgba(0, 0, 0, 0.6),
                    inset 0 2px 0 rgba(255, 255, 255, 0.15);
                padding: 48px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                <!-- Danger gradient bar -->
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-bottom: 30px;
                ">
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: warningBlink 1.5s infinite;
                    "></div>
                    <h2 style="
                        color: #fef2f2; 
                        font-weight: 700; 
                        margin: 0;
                        font-size: 32px;
                        letter-spacing: -0.5px;
                        text-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    ">⚠️ End Experiment</h2>
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: warningBlink 1.5s infinite 0.75s;
                    "></div>
                </div>
                
                <div style="
                    font-size: 64px;
                    margin-bottom: 25px;
                    opacity: 0.95;
                    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
                    animation: iconBounce 3s infinite;
                ">🛑</div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 2px solid rgba(239, 68, 68, 0.4);
                    border-radius: 16px;
                    padding: 24px;
                    margin: 25px 0;
                    backdrop-filter: blur(12px);
                ">
                    <p style="
                        color: #fef2f2; 
                        font-size: 18px; 
                        margin: 0 0 15px 0; 
                        line-height: 1.6;
                        font-weight: 600;
                    ">Are you sure you want to END the experiment?</p>
                    
                    <p style="
                        color: #fca5a5; 
                        font-size: 15px; 
                        margin: 0;
                        line-height: 1.5;
                        font-style: italic;
                    ">This will return all players to global chat and permanently end the room.</p>
                </div>
                
                <div style="
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    margin-top: 35px;
                ">
                    <button onclick="cancelEndExperiment()" style="
                        background: linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%);
                        color: #e5e7eb;
                        padding: 16px 28px;
                        border: 2px solid rgba(156, 163, 175, 0.3);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(55, 65, 81, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 4px 15px rgba(0, 0, 0, 0.3)';
                    ">
                        <span style="font-size: 14px;">❌</span>
                        Cancel
                    </button>
                    
                    <button onclick="confirmEndExperiment()" style="
                        background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%);
                        color: white;
                        padding: 16px 28px;
                        border: 2px solid rgba(239, 68, 68, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 700;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(239, 68, 68, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        animation: dangerButtonPulse 2s infinite;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(185, 28, 28, 1) 0%, rgba(153, 27, 27, 1) 100%)';
                        this.style.transform='translateY(-3px)';
                        this.style.boxShadow='0 8px 25px rgba(239, 68, 68, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.97)'"
                    onmouseup="this.style.transform='translateY(-3px) scale(1)'">
                        <span style="font-size: 14px;">🛑</span>
                        End Experiment
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes dangerPulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            
            @keyframes warningBlink {
                0%, 100% { opacity: 0.5; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.3); }
            }
            
            @keyframes iconBounce {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-8px) scale(1.05); }
            }
            
            @keyframes dangerButtonPulse {
                0%, 100% { box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3); }
                50% { box-shadow: 0 8px 30px rgba(239, 68, 68, 0.8), 0 4px 15px rgba(0, 0, 0, 0.4); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to cancel end experiment
function cancelEndExperiment() {
    const modal = document.getElementById('endExperimentConfirmModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to confirm end experiment
function confirmEndExperiment() {
    console.log('🛑 Moderator ending experiment');
    
    // Close the confirmation modal
    cancelEndExperiment();
    
    // Emit end experiment event to server
    socket.emit('endExperiment', {
        room: currentRoom,
        moderatorAction: true
    });
    
    // Don't redirect immediately - let the server's response events handle the transition
    // The server will send 'experimentEnded' and 'leftRoom' events which will handle the cleanup
    console.log('🛑 End experiment request sent, waiting for server response...');
}

// Function to show Lightning Experiment confirmation modal with magenta theme
function showLightningExperimentConfirmation() {
    // Remove any existing modal
    const existingModal = document.getElementById('lightningExperimentConfirmModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="lightningExperimentConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 520px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(192, 38, 211, 0.98) 0%, 
                    rgba(124, 58, 237, 0.95) 100%);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 2px solid rgba(192, 38, 211, 0.4);
                border-radius: 24px;
                box-shadow: 
                    0 30px 100px rgba(192, 38, 211, 0.8),
                    0 15px 50px rgba(0, 0, 0, 0.6),
                    inset 0 2px 0 rgba(255, 255, 255, 0.15);
                padding: 48px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-bottom: 30px;
                ">
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: lightningBlink 1.5s infinite;
                    "></div>
                    <h2 style="
                        color: #fef2f2; 
                        font-weight: 700; 
                        margin: 0;
                        font-size: 32px;
                        letter-spacing: -0.5px;
                        text-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    ">⚡ Lightning Experiment</h2>
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: lightningBlink 1.5s infinite 0.75s;
                    "></div>
                </div>
                
                <div style="
                    font-size: 64px;
                    margin-bottom: 25px;
                    opacity: 0.95;
                    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
                    animation: lightningBounce 3s infinite;
                ">⚡</div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 2px solid rgba(192, 38, 211, 0.4);
                    border-radius: 16px;
                    padding: 24px;
                    margin: 25px 0;
                    backdrop-filter: blur(12px);
                ">
                    <p style="
                        color: #fef2f2; 
                        font-size: 18px; 
                        margin: 0 0 15px 0; 
                        line-height: 1.6;
                        font-weight: 600;
                    ">Start a high-speed behavioral experiment?</p>
                    
                    <p style="
                        color: #ddd6fe; 
                        font-size: 15px; 
                        margin: 0;
                        line-height: 1.5;
                        font-style: italic;
                    ">This will add 3 AI players and run a rapid 441-round experiment with accelerated timing and minimal UI for system testing.</p>
                </div>
                
                <div style="
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    margin-top: 35px;
                ">
                    <button onclick="cancelLightningExperiment()" style="
                        background: linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%);
                        color: #e5e7eb;
                        padding: 16px 28px;
                        border: 2px solid rgba(156, 163, 175, 0.3);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(55, 65, 81, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 4px 15px rgba(0, 0, 0, 0.3)';
                    ">
                        <span style="font-size: 14px;">❌</span>
                        Cancel
                    </button>
                    
                    <button onclick="confirmLightningExperiment()" style="
                        background: linear-gradient(135deg, rgba(192, 38, 211, 0.95) 0%, rgba(124, 58, 237, 0.95) 100%);
                        color: white;
                        padding: 16px 28px;
                        border: 2px solid rgba(192, 38, 211, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 700;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(192, 38, 211, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        animation: lightningButtonPulse 2s infinite;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(124, 58, 237, 1) 0%, rgba(147, 51, 234, 1) 100%)';
                        this.style.transform='translateY(-3px)';
                        this.style.boxShadow='0 8px 25px rgba(192, 38, 211, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(192, 38, 211, 0.95) 0%, rgba(124, 58, 237, 0.95) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(192, 38, 211, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.97)'"
                    onmouseup="this.style.transform='translateY(-3px) scale(1)'">
                        <span style="font-size: 14px;">⚡</span>
                        Start Lightning Test
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes lightningPulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            
            @keyframes lightningBlink {
                0%, 100% { opacity: 0.5; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.3); }
            }
            
            @keyframes lightningBounce {
                0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                50% { transform: translateY(-8px) scale(1.05) rotate(5deg); }
            }
            
            @keyframes lightningButtonPulse {
                0%, 100% { box-shadow: 0 6px 20px rgba(192, 38, 211, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3); }
                50% { box-shadow: 0 8px 30px rgba(192, 38, 211, 0.8), 0 4px 15px rgba(0, 0, 0, 0.4); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to cancel Lightning Experiment
function cancelLightningExperiment() {
    const modal = document.getElementById('lightningExperimentConfirmModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to confirm Lightning Experiment
function confirmLightningExperiment() {
    console.log('⚡ Starting Lightning Experiment');
    
    // Close the confirmation modal
    cancelLightningExperiment();
    
    // Emit Lightning Experiment event to server
    socket.emit('runSpeedTest', {
        room: currentRoom,
        lightningMode: true
    });
    
    // Disable the lightning button to prevent multiple clicks
    const lightningBtn = document.getElementById('lightningBtn');
    if (lightningBtn) {
        lightningBtn.disabled = true;
        lightningBtn.textContent = '⚡ Lightning Test Running...';
        lightningBtn.style.opacity = '0.6';
    }
}

// Function to show Start Experiment confirmation modal
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
                        animation: startBounce 3s infinite;
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
                    "
                    onmouseover="
                        this.style.background='rgba(50, 50, 50, 0.9)';
                        this.style.borderColor='rgba(150, 150, 150, 0.6)';
                        this.style.color='white';
                    "
                    onmouseout="
                        this.style.background='rgba(30, 30, 30, 0.8)';
                        this.style.borderColor='rgba(100, 100, 100, 0.4)';
                        this.style.color='rgba(255, 255, 255, 0.8)';
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
                        animation: startButtonPulse 2s infinite;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(22, 163, 74, 1) 0%, rgba(21, 128, 61, 1) 100%)';
                        this.style.transform='translateY(-3px)';
                        this.style.boxShadow='0 8px 25px rgba(34, 197, 94, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(22, 163, 74, 0.95) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(34, 197, 94, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.97)'"
                    onmouseup="this.style.transform='translateY(-3px) scale(1)'">
                        <span style="font-size: 14px;">🚀</span>
                        Start Experiment
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes startBounce {
                0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                50% { transform: translateY(-8px) scale(1.05) rotate(-3deg); }
            }
            
            @keyframes startButtonPulse {
                0%, 100% { box-shadow: 0 6px 20px rgba(34, 197, 94, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3); }
                50% { box-shadow: 0 8px 30px rgba(34, 197, 94, 0.8), 0 4px 15px rgba(0, 0, 0, 0.4); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to cancel Start Experiment
function cancelStartExperiment() {
    const modal = document.getElementById('startExperimentConfirmModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to confirm Start Experiment
function confirmStartExperiment() {
    console.log('🚀 Starting experiment with confirmation');
    
    // Close the confirmation modal
    cancelStartExperiment();
    
    // Emit start game event to server (matches Entity.js startGame handler)
    socket.emit('startGame', { 
        room: currentRoom,
        experimentMode: 'conditions'  // Entity.js expects 'experimentMode', not 'mode'
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
}

function handlePauseExperiment() {
    hideModeratorContextMenu();
    
    const confirmPause = confirm("Are you sure you want to PAUSE the experiment? This will allow you to leave while keeping the room active for other players.");
    
    if (confirmPause) {
        console.log('⏸️ Moderator pausing experiment (leaving room)');
        
        // Regular leave room behavior for moderator (soft-return)
        socket.emit('leaveRoom', "Global");
        console.log('🔄 Moderator soft-returning to landing page (no full navigation)');
        currentRoom = "Global";
        const landingModerator = document.getElementById('landingPage');
        const gameDivModerator = document.getElementById('gameDiv');
        if (landingModerator) landingModerator.style.display = 'block';
        if (gameDivModerator) gameDivModerator.style.display = 'none';
        switchToLoggedOutUI();
        updateLeaveButtonVisibility();
    }
}

// Experiment Fast-Forward Controls (Moderator Only)
document.addEventListener('DOMContentLoaded', function() {
    // Apply Fast-Forward Token Setting
    const applyFastForwardBtn = document.getElementById('applyFastForward');
    if (applyFastForwardBtn) {
        applyFastForwardBtn.addEventListener('click', function() {
            const tokenInput = document.getElementById('fastForwardTokens');
            const tokenValue = parseInt(tokenInput.value);
            
            if (isNaN(tokenValue) || tokenValue < 0 || tokenValue > TOKEN_CONFIG.MAX_TOKENS) {
                alert(`Please enter a valid token amount between 0 and ${TOKEN_CONFIG.MAX_TOKENS}`);
                return;
            }
            
            if (confirm(`Set token pool to ${tokenValue} tokens? This will affect experiment pacing.`)) {
                socket.emit('setTokenPool', { tokens: tokenValue });
                console.log(`⚡ Fast-forward: Setting token pool to ${tokenValue}`);
                tokenInput.value = '';
            }
        });
    }
    
    // Force Baseline to Conditions Transition
    const forceTransitionBtn = document.getElementById('forceBaselineTransition');
    if (forceTransitionBtn) {
        forceTransitionBtn.addEventListener('click', function() {
            if (confirm('Force transition from baseline to conditions phase?')) {
                socket.emit('forcePhaseTransition');
                console.log('⚡ Forcing baseline to conditions transition');
            }
        });
    }
    
    // Set Low Tokens (50)
    const setLowTokensBtn = document.getElementById('setLowTokens');
    if (setLowTokensBtn) {
        setLowTokensBtn.addEventListener('click', function() {
            if (confirm('Set token pool to 50 tokens? This will likely trigger experiment end conditions soon.')) {
                socket.emit('setTokenPool', { tokens: 50 });
                console.log('⚡ Fast-forward: Setting token pool to 50 (low tokens)');
            }
        });
    }
    
    // End Experiment
    const endExperimentBtn = document.getElementById('endExperiment');
    if (endExperimentBtn) {
        endExperimentBtn.addEventListener('click', function() {
            if (confirm('End the experiment immediately? This will stop the current session.')) {
                socket.emit('forceEndExperiment');
                console.log('⚡ Forcing experiment end');
            }
        });
    }
});

// Update experiment status display
socket.on('experimentStatusUpdate', function(data) {
    const statusDisplay = document.getElementById('experimentStatus');
    if (statusDisplay) {
        statusDisplay.textContent = `Phase: ${data.phase || 'Unknown'} | Tokens: ${data.tokens || 'Unknown'} | Round: ${data.round || 'Unknown'}`;
    }
});

// Initialize switchboard functionality
function initializeSwitchboardFunctions() {
    // Update switchboard clock
    updateSwitchboardClock();
    setInterval(updateSwitchboardClock, 1000);
    
    // Collapsible header functionality
    const switchboardHeader = document.getElementById('switchboardHeader');
    const switchboardGrid = document.getElementById('switchboardGrid');
    const collapseIndicator = document.getElementById('collapseIndicator');
    
    if (switchboardHeader && switchboardGrid && collapseIndicator) {
        // Check if already initialized to prevent re-initialization
        if (switchboardHeader.dataset.initialized === 'true') {
            return; // Already initialized, skip
        }
        switchboardHeader.dataset.initialized = 'true';
        
        let isCollapsed = true; // Start collapsed on first load
        
        // Set initial collapsed state only on first initialization
        switchboardGrid.classList.add('collapsed');
        collapseIndicator.style.transform = 'translateY(-50%) rotate(180deg)';
        
        switchboardHeader.addEventListener('click', function() {
            isCollapsed = !isCollapsed;
            
            if (isCollapsed) {
                // Collapsing
                switchboardGrid.classList.remove('expanding');
                switchboardGrid.classList.add('collapsing');
                collapseIndicator.style.transform = 'translateY(-50%) rotate(180deg)';
                
                setTimeout(() => {
                    switchboardGrid.classList.add('collapsed');
                    switchboardGrid.classList.remove('collapsing');
                }, 400);
            } else {
                // Expanding
                switchboardGrid.classList.remove('collapsed', 'collapsing');
                switchboardGrid.classList.add('expanding');
                collapseIndicator.style.transform = 'translateY(-50%) rotate(0deg)';
                
                setTimeout(() => {
                    switchboardGrid.classList.remove('expanding');
                }, 500);
            }
        });
    }
    
    // Auto column toggle functionality
    const autoToggle = document.getElementById('autoColumnToggleSwitch');
    const manualGrid = document.getElementById('manualColumnGrid');
    const indicator = document.getElementById('selectedColumnIndicator');
    
    if (autoToggle && manualGrid && indicator) {
        autoToggle.addEventListener('change', function() {
            if (this.checked) {
                manualGrid.style.display = 'none';
                indicator.textContent = 'AUTO MODE';
                socket.emit('setColumnMode', { mode: 'auto' });
            } else {
                manualGrid.style.display = 'block';
                indicator.textContent = 'MANUAL MODE';
                socket.emit('setColumnMode', { mode: 'manual' });
            }
        });
    }
    
    // Column button functionality
    document.querySelectorAll('.column-btn').forEach(button => {
        button.addEventListener('click', function() {
            const column = this.getAttribute('data-column');
            // Remove active class from all buttons
            document.querySelectorAll('.column-btn').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Update indicator
            if (indicator) indicator.textContent = `SELECTED: ${column}`;
            // Notify server
            socket.emit('selectColumn', { column: column });
        });
    });
    
    // Experiment control buttons
    const applyButton = document.getElementById('applyFastForwardSwitch');
    const statusDisplay = document.getElementById('experimentStatusSwitch');
    const phaseStatus = document.getElementById('phaseStatusSwitch');
    
    if (applyButton) {
        applyButton.addEventListener('click', function() {
            const tokensInput = document.getElementById('fastForwardTokensSwitch');
            const tokens = parseInt(tokensInput.value);
            if (tokens >= 0 && tokens <= TOKEN_CONFIG.MAX_TOKENS) {
                socket.emit('setTokenPool', { tokens: tokens });
                if (statusDisplay) statusDisplay.textContent = `Token pool set to ${tokens}`;
            }
        });
    }
    
    // Quick token buttons
    const setLowTokensBtn = document.getElementById('setLowTokensSwitch');
    const setMidTokensBtn = document.getElementById('setMidTokensSwitch');
    const setHighTokensBtn = document.getElementById('setHighTokensSwitch');
    
    if (setLowTokensBtn) {
        setLowTokensBtn.addEventListener('click', function() {
            socket.emit('setTokenPool', { tokens: 50 });
            if (statusDisplay) statusDisplay.textContent = 'Token pool set to 50 (low)';
        });
    }
    
    if (setMidTokensBtn) {
        setMidTokensBtn.addEventListener('click', function() {
            socket.emit('setTokenPool', { tokens: 500 });
            if (statusDisplay) statusDisplay.textContent = 'Token pool set to 500 (medium)';
        });
    }
    
    if (setHighTokensBtn) {
        setHighTokensBtn.addEventListener('click', function() {
            socket.emit('setTokenPool', { tokens: 1500 });
            if (statusDisplay) statusDisplay.textContent = 'Token pool set to 1500 (high)';
        });
    }
    
    const forceTransitionBtn = document.getElementById('forceBaselineTransitionSwitch');
    if (forceTransitionBtn) {
        forceTransitionBtn.addEventListener('click', function() {
            socket.emit('forcePhaseTransition');
            if (phaseStatus) phaseStatus.textContent = 'Forcing baseline → conditions transition...';
        });
    }
    
    const endExperimentBtn = document.getElementById('endExperimentSwitch');
    if (endExperimentBtn) {
        endExperimentBtn.addEventListener('click', function() {
            handleEndExperiment(); // Use the same function as the leave room menu
        });
    }
    
    // AI behavior control
    const aiBehaviorSelect = document.getElementById('aiBehaviorModeSwitch');
    const specificRowInput = document.getElementById('specificRowNumberSwitch');
    
    if (aiBehaviorSelect && specificRowInput) {
        aiBehaviorSelect.addEventListener('change', function() {
            const mode = this.value;
            console.log(`🤖 AI behavior mode changed to: ${mode}`);
            
            if (this.value === 'specific_row') {
                specificRowInput.style.display = 'block';
            } else {
                specificRowInput.style.display = 'none';
            }
            
            // Send behavior change to server
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
                console.log(`🤖 AI specific row changed to: ${rowNumber}`);
                socket.emit('setAIBehavior', {
                    room: currentRoom,
                    mode: 'specific_row',
                    specificRow: rowNumber
                });
            }
        });
    }
    
    // Preset message buttons
    document.querySelectorAll('.preset-msg-btn').forEach(button => {
        button.addEventListener('click', function() {
            const message = this.getAttribute('data-msg');
            const messageInput = document.getElementById('systemMessageTextSwitch');
            if (messageInput) {
                messageInput.value = message;
            }
        });
    });
    
    // Info button functionality
    initializeInfoTooltips();
}

// Initialize info tooltip system
function initializeInfoTooltips() {
    const tooltip = document.getElementById('infoTooltip');
    const tooltipText = document.getElementById('tooltipText');
    const closeBtn = document.querySelector('.tooltip-close');
    
    const infoContent = {
        'game-controls': 'Control core game mechanics including column selection mode (auto/manual) and experiment phase transitions. Use these controls to manage the flow of the experiment.',
        'column-selection': 'AUTO MODE: System randomly selects columns each round. MANUAL MODE: You choose which column is active for each round using the buttons below.',
        'phase-control': 'Manage experiment phases. BASELINE→CONDITIONS forces transition from baseline phase to conditions phase. END EXPERIMENT terminates the current session.',
        'experiment-controls': 'Manage token pools and experimental conditions. Lower token counts advance phases faster. Different conditions have different payment structures.',
        'token-pool': 'Adjust the global token pool to control experiment pacing. Lower values (50-500) speed up transitions between phases. Higher values (1000+) slow down progression.',
        'conditions': 'Payment structures: Baseline (standard), High Culturant (higher group bonus), High Operant (higher individual bonus), Equal C-O (balanced bonuses).',
        'system-debug': 'Advanced system controls for testing and debugging. Use preset messages for common announcements.',
        'ai-behavior': 'Control how AI players make decisions. Use for testing specific scenarios or forcing particular behavioral patterns.',
        'system-messages': 'Send messages to all players. Use preset buttons for common messages or type custom announcements.',
        'system-controls': 'PAUSE: Stops AI decision-making. RESUME: Restarts AI. RESET: Restarts the current round.',
        'incentives': 'Set special bonus conditions for players. Performance, collaboration, consistency, and leadership bonuses available.',
        'csv-export': 'Download comprehensive experiment data including player choices, payoffs, timestamps, and behavioral metrics. Available during active experiments or after completion. Data includes ODD/EVEN choices, individual/group rewards, AI decisions, and round-by-round progression.'
    };
    
    document.querySelectorAll('.info-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const infoKey = this.getAttribute('data-info');
            const content = infoContent[infoKey] || 'Information not available.';
            
            if (tooltipText) tooltipText.textContent = content;
            if (tooltip) {
                // Position tooltip near the clicked button
                const rect = this.getBoundingClientRect();
                tooltip.style.position = 'fixed';
                tooltip.style.left = (rect.left + rect.width + 10) + 'px';
                tooltip.style.top = rect.top + 'px';
                tooltip.style.transform = 'none';
                tooltip.style.display = 'block';
            }
        });
    });
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            if (tooltip) tooltip.style.display = 'none';
        });
    }
    
    // Close tooltip when clicking anywhere outside of it
    document.addEventListener('click', function(e) {
        if (tooltip && tooltip.style.display === 'block') {
            if (!tooltip.contains(e.target) && !e.target.classList.contains('info-btn')) {
                tooltip.style.display = 'none';
            }
        }
    });
}

// Update switchboard clock
function updateSwitchboardClock() {
    const clock = document.getElementById('switchboardClock');
    if (clock) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        clock.textContent = timeString;
    }
}

// Create or get notification area anchored to poker table
function getNotificationArea() {
    let notificationArea = document.getElementById('pokerTableNotifications');
    if (!notificationArea) {
        const pokerTable = document.getElementById('pokerTable');
        if (pokerTable) {
            notificationArea = document.createElement('div');
            notificationArea.id = 'pokerTableNotifications';
            notificationArea.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                width: 280px;
                z-index: 1000;
                pointer-events: none;
            `;
            pokerTable.appendChild(notificationArea);
        }
    }
    return notificationArea;
}

// Show prominent incentive banner for players - anchored to poker table with CRT flourish
function showIncentiveBanner(incentiveText) {
    // Remove existing banner
    hideIncentiveBanner();
    
    // Get poker table for positioning
    const pokerTable = document.getElementById('pokerTable');
    if (!pokerTable) {
        console.error('🎁 Cannot show incentive banner: poker table not found');
        return;
    }
    
    // Create incentive banner
    const banner = document.createElement('div');
    banner.id = 'incentiveBanner';
    banner.className = 'incentive-banner incentive-flourish';
    
    // Create scanline overlay for CRT effect
    const scanlines = document.createElement('div');
    scanlines.className = 'incentive-scanlines';
    
    // Create content
    const content = document.createElement('div');
    content.className = 'incentive-content';
    
    const title = document.createElement('h3');
    title.textContent = '⚡ BONUS OPPORTUNITY';
    title.className = 'incentive-title';
    
    const description = document.createElement('p');
    description.textContent = incentiveText;
    description.className = 'incentive-description';
    
    content.appendChild(title);
    content.appendChild(description);
    banner.appendChild(scanlines);
    banner.appendChild(content);
    
    // Add CRT neon styles
    const styleId = 'incentiveBannerCRTStyles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #incentiveBanner {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 1000;
                min-width: 280px;
                max-width: 320px;
                background: linear-gradient(180deg, 
                    rgba(10, 10, 20, 0.92) 0%, 
                    rgba(15, 12, 25, 0.95) 100%);
                border: 2px solid #ff00ff;
                border-radius: 4px;
                padding: 0;
                font-family: 'Courier New', monospace;
                text-align: left;
                box-shadow: 
                    0 0 15px rgba(255, 0, 255, 0.4),
                    0 0 30px rgba(255, 0, 255, 0.2),
                    inset 0 0 20px rgba(255, 0, 255, 0.05);
                cursor: pointer;
                overflow: hidden;
                transform: translateX(100%);
                opacity: 0;
            }
            
            /* Initial flourish state - intense CRT effect */
            #incentiveBanner.incentive-flourish {
                animation: incentiveSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                           incentiveCRTFlourish 0.8s ease-out forwards;
            }
            
            /* Settled state - reduced effects, more legible */
            #incentiveBanner.incentive-settled {
                animation: none;
                transform: translateX(0);
                opacity: 1;
                border-color: #cc00cc;
                box-shadow: 
                    0 0 10px rgba(255, 0, 255, 0.3),
                    0 0 20px rgba(255, 0, 255, 0.15),
                    inset 0 0 15px rgba(255, 0, 255, 0.03);
            }
            
            #incentiveBanner.incentive-settled .incentive-scanlines {
                opacity: 0.3;
                animation: none;
            }
            
            #incentiveBanner.incentive-settled .incentive-title {
                animation: none;
                text-shadow: 
                    0 0 8px rgba(255, 0, 255, 0.6),
                    0 0 15px rgba(255, 0, 255, 0.3);
            }
            
            #incentiveBanner.incentive-settled .incentive-description {
                text-shadow: 
                    0 0 5px rgba(0, 255, 255, 0.4);
            }
            
            .incentive-scanlines {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: repeating-linear-gradient(
                    0deg,
                    rgba(0, 0, 0, 0.1) 0px,
                    rgba(0, 0, 0, 0.1) 1px,
                    transparent 1px,
                    transparent 3px
                );
                pointer-events: none;
                z-index: 10;
                opacity: 0.6;
            }
            
            .incentive-content {
                position: relative;
                z-index: 5;
                padding: 12px 16px;
            }
            
            #incentiveBanner .incentive-title {
                margin: 0 0 6px 0;
                font-size: 15px;
                font-weight: bold;
                color: #ff00ff;
                letter-spacing: 2px;
                text-transform: uppercase;
                text-shadow: 
                    0 0 10px #ff00ff,
                    0 0 20px #ff00ff,
                    0 0 30px #ff00ff;
            }
            
            #incentiveBanner .incentive-description {
                margin: 0;
                font-size: 13px;
                line-height: 1.4;
                font-weight: 500;
                color: #00ffff;
                text-shadow: 
                    0 0 5px #00ffff,
                    0 0 10px rgba(0, 255, 255, 0.5);
                letter-spacing: 0.5px;
            }
            
            @keyframes incentiveSlideIn {
                0% { 
                    transform: translateX(120%); 
                    opacity: 0; 
                }
                100% { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
            }
            
            @keyframes incentiveCRTFlourish {
                0% {
                    filter: brightness(2) saturate(1.5);
                    box-shadow: 
                        0 0 30px rgba(255, 0, 255, 0.8),
                        0 0 60px rgba(255, 0, 255, 0.5),
                        0 0 90px rgba(0, 255, 255, 0.3),
                        inset 0 0 40px rgba(255, 0, 255, 0.2);
                }
                30% {
                    filter: brightness(1.8) saturate(1.3);
                }
                60% {
                    filter: brightness(1.3) saturate(1.1);
                }
                100% {
                    filter: brightness(1) saturate(1);
                    box-shadow: 
                        0 0 15px rgba(255, 0, 255, 0.4),
                        0 0 30px rgba(255, 0, 255, 0.2),
                        inset 0 0 20px rgba(255, 0, 255, 0.05);
                }
            }
            
            @keyframes incentiveSlideOut {
                0% { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
                100% { 
                    transform: translateX(120%); 
                    opacity: 0; 
                }
            }
            
            /* Success state - when bonus is earned */
            #incentiveBanner.incentive-success {
                border-color: #00ff00;
                box-shadow: 
                    0 0 15px rgba(0, 255, 0, 0.5),
                    0 0 30px rgba(0, 255, 0, 0.3),
                    inset 0 0 20px rgba(0, 255, 0, 0.05);
                animation: incentiveSuccessFlash 0.5s ease-out forwards;
            }
            
            #incentiveBanner.incentive-success .incentive-title {
                color: #00ff00;
                text-shadow: 
                    0 0 10px #00ff00,
                    0 0 20px rgba(0, 255, 0, 0.5);
            }
            
            #incentiveBanner.incentive-success .incentive-scanlines {
                opacity: 0.2;
            }
            
            @keyframes incentiveSuccessFlash {
                0% {
                    filter: brightness(2) saturate(1.5);
                    box-shadow: 
                        0 0 40px rgba(0, 255, 0, 0.8),
                        0 0 80px rgba(0, 255, 0, 0.5),
                        inset 0 0 40px rgba(0, 255, 0, 0.2);
                }
                100% {
                    filter: brightness(1) saturate(1);
                    box-shadow: 
                        0 0 15px rgba(0, 255, 0, 0.5),
                        0 0 30px rgba(0, 255, 0, 0.3),
                        inset 0 0 20px rgba(0, 255, 0, 0.05);
                }
            }
            
            /* Dimmed state - when user clicks to temporarily hide */
            #incentiveBanner.incentive-dimmed {
                opacity: 0.15;
                transform: scale(0.95);
                filter: brightness(0.5) saturate(0.5);
                transition: all 0.3s ease-out;
                pointer-events: none;
            }
            
            #incentiveBanner.incentive-returning {
                opacity: 1;
                transform: scale(1);
                filter: brightness(1) saturate(1);
                transition: all 0.5s ease-out;
                pointer-events: auto;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Click to temporarily dim (NOT close) - returns after a few seconds
    banner.onclick = function() {
        if (banner.classList.contains('incentive-dimmed')) return; // Already dimmed
        
        banner.classList.add('incentive-dimmed');
        banner.classList.remove('incentive-settled');
        
        // Return after 4 seconds
        setTimeout(() => {
            if (banner && banner.parentNode && !banner.classList.contains('incentive-success')) {
                banner.classList.remove('incentive-dimmed');
                banner.classList.add('incentive-returning');
                
                // Remove returning class after transition
                setTimeout(() => {
                    if (banner && banner.parentNode) {
                        banner.classList.remove('incentive-returning');
                        banner.classList.add('incentive-settled');
                    }
                }, 500);
            }
        }, 4000);
    };
    
    // Append to poker table
    pokerTable.style.position = 'relative';
    pokerTable.appendChild(banner);
    
    // After flourish animation, settle into legible state
    setTimeout(() => {
        if (banner && banner.parentNode) {
            banner.classList.remove('incentive-flourish');
            banner.classList.add('incentive-settled');
        }
    }, 800);
    
    console.log('🎁 CRT incentive banner displayed on poker table:', incentiveText);
}

// Hide incentive banner
function hideIncentiveBanner() {
    const existingBanner = document.getElementById('incentiveBanner');
    if (existingBanner) {
        existingBanner.remove();
    }
}

// Immediate Incentive Token Animation - spawns from incentive banner and flies to wallet
function showIncentiveTokenAnimation(blackTokens) {
    if (blackTokens <= 0) return;
    
    // Get source position (incentive banner or notification area)
    const incentiveBanner = document.getElementById('incentiveBanner');
    const notificationArea = document.getElementById('pokerTableNotificationArea');
    const sourceEl = incentiveBanner || notificationArea;
    
    // Get destination (black token wallet)
    const blackWalletEl = document.getElementById('blackTokens');
    
    if (!sourceEl || !blackWalletEl) {
        console.log('🎁 Incentive animation: Could not find source/destination elements');
        return;
    }
    
    const sourceRect = sourceEl.getBoundingClientRect();
    const destRect = blackWalletEl.getBoundingClientRect();
    
    // Source: center of incentive banner
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    
    // Add animation styles if not present
    let style = document.getElementById('incentiveTokenAnimStyle');
    if (!style) {
        style = document.createElement('style');
        style.id = 'incentiveTokenAnimStyle';
        style.textContent = `
            .incentive-flying-token {
                position: fixed;
                font-size: 32px;
                pointer-events: none;
                z-index: 100000;
                opacity: 0;
                filter: drop-shadow(0 0 10px rgba(0, 255, 0, 0.8)) drop-shadow(0 0 20px rgba(0, 255, 0, 0.5));
            }
            
            @keyframes incentiveTokenSpawn {
                0% { opacity: 0; transform: scale(0); }
                60% { opacity: 1; transform: scale(1.3); }
                100% { opacity: 1; transform: scale(1); }
            }
            
            @keyframes incentiveTokenFly {
                0% { 
                    opacity: 1; 
                    transform: scale(1); 
                }
                50% { 
                    opacity: 1; 
                    transform: scale(1.1) translateY(-15px); 
                }
                100% { 
                    opacity: 0; 
                    transform: scale(0.6); 
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Create and animate tokens
    for (let i = 0; i < blackTokens; i++) {
        const token = document.createElement('div');
        token.className = 'incentive-flying-token';
        token.textContent = '⚫';
        token.style.left = `${sourceX}px`;
        token.style.top = `${sourceY}px`;
        document.body.appendChild(token);
        
        const staggerDelay = i * 150;
        
        // Phase 1: Spawn with golden glow effect
        setTimeout(() => {
            token.style.animation = 'incentiveTokenSpawn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }, staggerDelay);
        
        // Phase 2: Fly to wallet
        setTimeout(() => {
            token.style.animation = 'incentiveTokenFly 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
            token.style.transition = 'left 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            token.style.left = `${destRect.left + destRect.width / 2}px`;
            token.style.top = `${destRect.top + destRect.height / 2}px`;
        }, staggerDelay + 500);
        
        // Cleanup
        setTimeout(() => {
            token.remove();
            
            // On last token, increment the black token count in the wallet
            if (i === blackTokens - 1) {
                const blackWalletDisplay = document.getElementById('blackTokens');
                if (blackWalletDisplay) {
                    const currentCount = parseInt(blackWalletDisplay.textContent) || 0;
                    blackWalletDisplay.textContent = currentCount + blackTokens;
                    
                    // Add a brief pulse effect to the wallet
                    blackWalletDisplay.style.transition = 'transform 0.2s ease, color 0.2s ease';
                    blackWalletDisplay.style.transform = 'scale(1.3)';
                    blackWalletDisplay.style.color = '#22c55e';
                    
                    setTimeout(() => {
                        blackWalletDisplay.style.transform = 'scale(1)';
                        blackWalletDisplay.style.color = '';
                    }, 300);
                    
                    console.log(`🎁 Black token count updated: ${currentCount} → ${currentCount + blackTokens}`);
                }
            }
        }, staggerDelay + 1300);
    }
    
    // Cleanup style after all animations
    setTimeout(() => {
        if (style && style.parentNode) {
            style.remove();
        }
    }, (blackTokens * 150) + 1500);
    
    console.log(`🎁 Incentive token animation: ${blackTokens} black tokens flying to wallet`);
}

// Token Animation - Shows tokens earned at end of round
// Tokens float from moderator square → line up below poker table → fly to player's wallet
function showTokenAnimation(whiteTokens, blackTokens) {
    // Don't animate if no tokens
    if (whiteTokens === 0 && blackTokens === 0) return;
    
    // Remove any existing animation
    const existingTokens = document.querySelectorAll('.flying-token');
    existingTokens.forEach(t => t.remove());
    
    const existingStyle = document.getElementById('tokenAnimStyle');
    if (existingStyle) existingStyle.remove();
    
    // Get source position (moderator square / table center)
    const moderatorEl = document.getElementById('moderatorPosition') || document.getElementById('tableCenter');
    const pokerTable = document.getElementById('pokerTable');
    
    // Get destination positions (wallet tokens in status panel)
    const whiteWalletEl = document.getElementById('whiteTokens');
    const blackWalletEl = document.getElementById('blackTokens');
    
    if (!moderatorEl || !pokerTable) {
        console.log('🎯 Token animation: Could not find poker table elements');
        return;
    }
    
    // Calculate positions
    const sourceRect = moderatorEl.getBoundingClientRect();
    const tableRect = pokerTable.getBoundingClientRect();
    const whiteDestRect = whiteWalletEl?.getBoundingClientRect();
    const blackDestRect = blackWalletEl?.getBoundingClientRect();
    
    // Source: center of moderator square
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    
    // Staging area: below the poker table, centered
    const stagingY = tableRect.bottom + 20;
    const stagingBaseX = tableRect.left + tableRect.width / 2;
    
    // Add animation styles
    const style = document.createElement('style');
    style.id = 'tokenAnimStyle';
    style.textContent = `
        .flying-token {
            position: fixed;
            font-size: 28px;
            pointer-events: none;
            z-index: 99999;
            opacity: 0;
            transition: none;
        }
        
        .flying-token.white-token {
            filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 12px rgba(200, 200, 200, 0.3));
        }
        
        .flying-token.black-token {
            filter: drop-shadow(0 0 6px rgba(80, 80, 80, 0.6)) drop-shadow(0 0 12px rgba(60, 60, 60, 0.4));
        }
        
        @keyframes tokenSpawn {
            0% { opacity: 0; transform: scale(0) rotate(0deg); }
            60% { opacity: 0.9; transform: scale(1.1) rotate(180deg); }
            100% { opacity: 0.9; transform: scale(1) rotate(360deg); }
        }
        
        @keyframes tokenIdle {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(5deg); }
        }
        
        @keyframes tokenFlyToWallet {
            0% { 
                opacity: 0.9; 
                transform: scale(1) rotate(0deg); 
            }
            20% { 
                opacity: 1; 
                transform: scale(1.15) rotate(30deg) translateY(-10px); 
            }
            50% { 
                opacity: 0.95; 
                transform: scale(1.05) rotate(180deg); 
            }
            80% { 
                opacity: 0.8; 
                transform: scale(0.8) rotate(300deg); 
            }
            100% { 
                opacity: 0; 
                transform: scale(0.4) rotate(360deg); 
            }
        }
    `;
    document.head.appendChild(style);
    
    // Create and animate tokens
    const totalTokens = whiteTokens + blackTokens;
    const tokens = [];
    
    // Create white tokens first, then black tokens
    for (let i = 0; i < whiteTokens; i++) {
        tokens.push({ type: 'white', emoji: '⚪', destRect: whiteDestRect });
    }
    for (let i = 0; i < blackTokens; i++) {
        tokens.push({ type: 'black', emoji: '⚫', destRect: blackDestRect });
    }
    
    // Calculate side-by-side positions below table
    const tokenSpacing = 36; // pixels between token centers
    const totalWidth = (totalTokens - 1) * tokenSpacing;
    const startX = stagingBaseX - totalWidth / 2;
    
    // Animate each token with staggered timing
    tokens.forEach((tokenData, index) => {
        const token = document.createElement('div');
        token.className = `flying-token ${tokenData.type}-token`;
        token.textContent = tokenData.emoji;
        token.style.left = `${sourceX}px`;
        token.style.top = `${sourceY}px`;
        document.body.appendChild(token);
        
        const staggerDelay = index * 120; // 120ms between each token
        
        // Calculate this token's final position in the lineup
        const lineupX = startX + (index * tokenSpacing);
        
        // Phase 1: Spawn at moderator square with pop animation
        setTimeout(() => {
            token.style.animation = 'tokenSpawn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }, staggerDelay);
        
        // Phase 2: Float to lineup position below poker table
        setTimeout(() => {
            token.style.animation = 'none';
            token.style.opacity = '0.9';
            token.style.transition = 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            token.style.left = `${lineupX}px`;
            token.style.top = `${stagingY}px`;
        }, staggerDelay + 350);
        
        // Phase 3: Gentle idle animation while waiting (longer pause)
        setTimeout(() => {
            token.style.transition = 'none';
            token.style.animation = 'tokenIdle 1.5s ease-in-out infinite';
        }, staggerDelay + 850);
        
        // Phase 4: Fly to wallet destination with smooth arc
        const flyDelay = (totalTokens * 120) + 1800; // Wait for all tokens + 1.8s pause
        setTimeout(() => {
            const destRect = tokenData.destRect;
            if (destRect) {
                // Use smoother easing and longer duration for flight
                token.style.animation = 'tokenFlyToWallet 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
                token.style.transition = 'left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                token.style.left = `${destRect.left + destRect.width / 2}px`;
                token.style.top = `${destRect.top + destRect.height / 2}px`;
            } else {
                // Fallback: fade out in place
                token.style.animation = 'tokenFlyToWallet 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
            }
        }, flyDelay + (index * 100)); // Slightly more stagger for smoother cascade
        
        // Cleanup token
        setTimeout(() => {
            token.remove();
        }, flyDelay + (index * 100) + 900);
    });
    
    // Cleanup styles after all animations complete
    const totalDuration = (totalTokens * 120) + 1800 + (totalTokens * 100) + 1000;
    setTimeout(() => {
        style.remove();
    }, totalDuration);
    
    console.log(`🎯 Token animation: ${whiteTokens} white, ${blackTokens} black flying from moderator to wallet`);
}

// Initialize round results panel with waiting state (called when game starts)
function initializeRoundResultsPanel() {
    const roundResultsPanels = document.querySelectorAll('.roundResultsPanel');
    const conversionRateInfos = document.querySelectorAll('.conversionRateInfo');
    
    // Show the panels with initial waiting state
    roundResultsPanels.forEach(element => {
        if (element.querySelector('.conversionRateInfo')) {
            element.style.display = 'block';
        }
    });
    
    // Set initial content
    const initialHTML = `
        <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-width: 400px;">
            <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 16px; text-align: center;">
                <div style="color: #b9bbbe; font-size: 14px; margin-bottom: 10px;">
                    <i class="fas fa-hourglass-half" style="margin-right: 8px; animation: pulse 1.5s ease infinite;"></i>
                    Waiting for first round...
                </div>
                <div style="display: flex; justify-content: center; gap: 30px; opacity: 0.5;">
                    <div style="text-align: center;">
                        <div style="font-size: 24px;">⚪</div>
                        <div style="color: #43b581; font-size: 16px; font-weight: 600;">--</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 24px;">⚫</div>
                        <div style="color: #e74c3c; font-size: 16px; font-weight: 600;">--</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    conversionRateInfos.forEach(element => {
        element.innerHTML = initialHTML;
    });
    
    // Hide the title/message since we're showing the panel
    document.querySelectorAll('.roundResultsTitle').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.roundResults').forEach(el => el.style.display = 'none');
    
    console.log('📊 Initialized round results panel with waiting state');
}

// Update Round Results Panel for Moderators
function updateRoundResultsPanel(roundData) {
    console.log('🔍 Updating round results panel:', roundData);
    
    const roundResultsTitles = document.querySelectorAll('.roundResultsTitle');
    const roundResults = document.querySelectorAll('.roundResults');
    const roundResultsPanels = document.querySelectorAll('.roundResultsPanel');
    const roundSummaries = document.querySelectorAll('.roundSummary');
    const playerResultsTables = document.querySelectorAll('.playerResultsTable');
    const conversionRateInfos = document.querySelectorAll('.conversionRateInfo');
    const roundTotals = document.querySelectorAll('.roundTotals');
    
    // Check if current user is moderator
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    
    if (roundResultsTitles.length === 0 || roundResultsPanels.length === 0) {
        console.warn('⚠️ Round results panel elements not found');
        return;
    }
    
    // Hide waiting message and show panel for all versions
    roundResults.forEach(element => element.style.display = 'none');
    roundResultsTitles.forEach(element => element.style.display = 'none');
    
    // Only show panel if there's actual data to display
    const hasData = (conversionRateInfos.length > 0 && roundData.previousRoundPlayers) || 
                    (playerResultsTables.length > 0 && roundData.players && isModerator);
    
    if (hasData) {
        // Only show roundResultsPanels that contain data for this user's role
        if (isModerator && playerResultsTables.length > 0 && roundData.players) {
            // Show panel containing cumulative data for moderators
            roundResultsPanels.forEach(element => {
                if (element.querySelector('.playerResultsTable')) {
                    element.style.display = 'block';
                }
            });
        }
        if (conversionRateInfos.length > 0 && roundData.previousRoundPlayers) {
            // Show panel containing round results for everyone
            roundResultsPanels.forEach(element => {
                if (element.querySelector('.conversionRateInfo')) {
                    element.style.display = 'block';
                }
            });
        }
    }
    
    // 1. Show Cumulative Totals first - MODERATOR ONLY
    if (playerResultsTables.length > 0 && roundData.players && isModerator) {
        const totalWhite = roundData.players.reduce((sum, p) => sum + (p.whiteTokens || 0), 0);
        const totalBlack = roundData.players.reduce((sum, p) => sum + (p.blackTokens || 0), 0);
        const totalEarnings = roundData.players.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);
        
        // Sort players by their seat position (left-to-right: left, top, right)
        const seatOrder = { 'left': 1, 'top': 2, 'right': 3 };
        const sortedPlayers = [...roundData.players].sort((a, b) => {
            const seatA = seatOrder[a.seatPosition] || 999;
            const seatB = seatOrder[b.seatPosition] || 999;
            return seatA - seatB;
        });
        
        let tableHTML = `
            <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-height: 280px; overflow-y: auto;">
                <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                    <div style="color: #ffffff; font-weight: 600; font-size: 13px; margin-bottom: 8px;">Cumulative Player Earnings</div>
                    <div style="display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; font-size: 12px;">
                        <div style="color: #b9bbbe; font-weight: 500;">Player</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚪</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚫</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">Total $</div>
        `;
        
        // Add individual player rows in correct order
        sortedPlayers.forEach(player => {
            const whiteTokens = player.whiteTokens || 0;
            const blackTokens = player.blackTokens || 0;
            const totalEarnings = player.totalEarnings || 0;
            const isAI = player.isAI ? ' (AI)' : '';
            
            tableHTML += `
                <div style="color: #ffffff;">${player.username}${isAI}</div>
                <div style="color: #43b581; text-align: right;">${whiteTokens}</div>
                <div style="color: #e74c3c; text-align: right;">${blackTokens}</div>
                <div style="color: #faa61a; text-align: right; font-weight: 500;">$${totalEarnings.toFixed(2)}</div>
            `;
        });
        
        // Add separator line and totals row
        tableHTML += `
                    <div style="grid-column: 1 / -1; height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
                    <div style="color: #ffffff; font-weight: 600;">EXPERIMENT TOTALS</div>
                    <div style="color: #43b581; text-align: right; font-weight: 600;">${totalWhite}</div>
                    <div style="color: #e74c3c; text-align: right; font-weight: 600;">${totalBlack}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 600;">$${totalEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
        `;
        
        console.log('📊 Populating cumulative earnings table for moderator');
        playerResultsTables.forEach(element => {
            element.innerHTML = tableHTML;
        });
    } else {
        console.log('📊 Skipping cumulative earnings table - not moderator or no data');
    }
    
    // 2. Show Previous Round second - update all versions
    // For non-moderators, only show their own results
    if (conversionRateInfos.length > 0 && roundData.previousRoundPlayers) {
        const previousRoundNumber = roundData.round;
        
        // Find current player's data
        const currentPlayerData = roundData.previousRoundPlayers.find(p => p.username === currentUsername);
        
        let previousDistributionHTML = `
            <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-height: 280px; overflow-y: auto; max-width: 400px;">
                <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                    <div style="color: #ffffff; font-weight: 600; font-size: 13px; margin-bottom: 8px;">Round <span style="color: #43b581;">${previousRoundNumber}</span> Results</div>`;
        
        // Add token values subheader if available
        if (roundData.tokenValues) {
            previousDistributionHTML += `
                <div style="color: #dcddde; font-size: 11px; margin-bottom: 8px; padding: 6px 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-around; gap: 12px;">
                        <span style="display: flex; align-items: center; gap: 4px;">⚪ $${roundData.tokenValues.white?.toFixed(2) || '0.00'}</span>
                        <span style="display: flex; align-items: center; gap: 4px;">⚫ $${roundData.tokenValues.black?.toFixed(2) || '0.00'}</span>
                    </div>
                </div>`;
        }
        
        // Check if moderator - moderators see all players, non-moderators only see themselves
        if (isModerator) {
            // Moderator view - show all players
            previousDistributionHTML += `
                <div style="display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; font-size: 12px;">
                    <div style="color: #b9bbbe; font-weight: 500;">Player</div>
                    <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚪</div>
                    <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚫</div>
                    <div style="color: #b9bbbe; font-weight: 500; text-align: right;">Round $</div>
            `;
            
            // Sort players by their seat position (left-to-right: left, top, right)
            const seatOrder = { 'left': 1, 'top': 2, 'right': 3 };
            const sortedPreviousPlayers = [...roundData.previousRoundPlayers].sort((a, b) => {
                const seatA = seatOrder[a.seatPosition] || 999;
                const seatB = seatOrder[b.seatPosition] || 999;
                return seatA - seatB;
            });
            
            // Calculate totals for previous round
            let prevTotalWhite = 0;
            let prevTotalBlack = 0;
            let prevTotalRoundEarnings = 0;
            
            sortedPreviousPlayers.forEach(player => {
                const whiteTokens = player.whiteTokens || 0;
                const blackTokens = player.blackTokens || 0;
                const incentiveBonus = player.incentiveBonus || 0;
                const totalBlackTokens = blackTokens + incentiveBonus;
                const roundEarnings = player.roundEarnings || 0;
                const isAI = player.isAI ? ' (AI)' : '';
                
                prevTotalWhite += whiteTokens;
                prevTotalBlack += totalBlackTokens;
                prevTotalRoundEarnings += roundEarnings;
                
                previousDistributionHTML += `
                    <div style="color: #ffffff;">${player.username}${isAI}</div>
                    <div style="color: #43b581; text-align: right;">${whiteTokens}</div>
                    <div style="color: #e74c3c; text-align: right;">${totalBlackTokens}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 500;">$${roundEarnings.toFixed(2)}</div>
                `;
            });
            
            // Add totals row for previous round
            previousDistributionHTML += `
                    <div style="grid-column: 1 / -1; height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
                    <div style="color: #ffffff; font-weight: 600;">ROUND TOTALS</div>
                    <div style="color: #43b581; text-align: right; font-weight: 600;">${prevTotalWhite}</div>
                    <div style="color: #e74c3c; text-align: right; font-weight: 600;">${prevTotalBlack}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 600;">$${prevTotalRoundEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
            `;
        } else if (currentPlayerData) {
            // Non-moderator view - only show their own results
            const whiteTokens = currentPlayerData.whiteTokens || 0;
            const blackTokens = currentPlayerData.blackTokens || 0;
            const incentiveBonus = currentPlayerData.incentiveBonus || 0;
            const totalBlackTokens = blackTokens + incentiveBonus;
            const roundEarnings = currentPlayerData.roundEarnings || 0;
            
            previousDistributionHTML += `
                <div style="text-align: center; padding: 10px 0;">
                    <div style="color: #b9bbbe; font-size: 11px; margin-bottom: 8px;">Your Earnings last Round</div>
                    <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 10px;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px;">⚪</div>
                            <div style="color: #43b581; font-size: 18px; font-weight: 600;">${whiteTokens}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px;">⚫</div>
                            <div style="color: #e74c3c; font-size: 18px; font-weight: 600;">${totalBlackTokens}</div>
                        </div>
                    </div>
                    <div style="color: #faa61a; font-size: 20px; font-weight: 600;">+$${roundEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
            `;
        } else {
            // Fallback if player data not found
            previousDistributionHTML += `
                <div style="text-align: center; padding: 10px 0; color: #b9bbbe;">
                    Waiting for results...
                </div>
            </div>
            </div>
            `;
        }
        
        conversionRateInfos.forEach(element => {
            element.innerHTML = previousDistributionHTML;
        });
    }
    
    // 2. SWAPPED: Show Cumulative Totals - MODERATOR ONLY (non-moderators see their own data in the round results above)
    if (playerResultsTables.length > 0 && roundData.players && isModerator) {
        const totalWhite = roundData.players.reduce((sum, p) => sum + (p.whiteTokens || 0), 0);
        const totalBlack = roundData.players.reduce((sum, p) => sum + (p.blackTokens || 0), 0);
        const totalEarnings = roundData.players.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);
        
        // Sort players by their seat position (left-to-right: left, top, right)
        const seatOrder = { 'left': 1, 'top': 2, 'right': 3 };
        const sortedPlayers = [...roundData.players].sort((a, b) => {
            const seatA = seatOrder[a.seatPosition] || 999;
            const seatB = seatOrder[b.seatPosition] || 999;
            return seatA - seatB;
        });
        
        let tableHTML = `
            <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-height: 280px; overflow-y: auto;">
                <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                    <div style="color: #ffffff; font-weight: 600; font-size: 13px; margin-bottom: 8px;">Cumulative Player Earnings</div>
                    <div style="display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; font-size: 12px;">
                        <div style="color: #b9bbbe; font-weight: 500;">Player</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚪</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚫</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">Total $</div>
        `;
        
        // Add individual player rows in correct order
        sortedPlayers.forEach(player => {
            const whiteTokens = player.whiteTokens || 0;
            const blackTokens = player.blackTokens || 0;
            const totalEarnings = player.totalEarnings || 0;
            const isAI = player.isAI ? ' (AI)' : '';
            
            tableHTML += `
                <div style="color: #ffffff;">${player.username}${isAI}</div>
                <div style="color: #43b581; text-align: right;">${whiteTokens}</div>
                <div style="color: #e74c3c; text-align: right;">${blackTokens}</div>
                <div style="color: #faa61a; text-align: right; font-weight: 500;">$${totalEarnings.toFixed(2)}</div>
            `;
        });
        
        // Add separator line and totals row
        tableHTML += `
                    <div style="grid-column: 1 / -1; height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
                    <div style="color: #ffffff; font-weight: 600;">EXPERIMENT TOTALS</div>
                    <div style="color: #43b581; text-align: right; font-weight: 600;">${totalWhite}</div>
                    <div style="color: #e74c3c; text-align: right; font-weight: 600;">${totalBlack}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 600;">$${totalEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
        `;
        
        playerResultsTables.forEach(element => {
            element.innerHTML = tableHTML;
        });
    }
    
    // Hide the separate round totals section since it's now integrated - update all versions
    roundTotals.forEach(element => {
        element.style.display = 'none';
    });
}