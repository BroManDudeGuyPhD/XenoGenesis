/**
 * XenoGenesis Client - Socket Event Handlers
 * Centralized socket event handling organized by functionality
 */

import { socket } from './socketManager.js';
import { showSessionExpiredModal, showGlassmorphismAlert, showInviteCodeAlert, showExperimentEndedModal } from './modals.js';
import { updateTokenPoolDisplay, updateAllWalletDisplays, updateTokenConversionDisplay } from './tokenSystem.js';
import { setState, currentUsername, currentRoom } from './utils.js';

/**
 * Initialize all socket event handlers
 */
export function initializeSocketHandlers() {
    console.log('🔌 Initializing socket event handlers');
    
    // Authentication handlers
    setupAuthenticationHandlers();
    
    // Game handlers
    setupGameHandlers();
    
    // Admin/Moderator handlers
    setupAdminHandlers();
    
    // Chat handlers
    setupChatHandlers();
    
    // System handlers
    setupSystemHandlers();
    
    // Experiment handlers
    setupExperimentHandlers();
}

/**
 * Setup authentication-related socket handlers
 */
function setupAuthenticationHandlers() {
    // Sign in response
    socket.on('signInResponse', function(data) {
        console.log('📝 Sign in response:', data);
        setState.setSigninInProgress(false);
        
        if (data.success) {
            setState.setCurrentUsername(data.username);
            setState.setGlobalAdmin(data.isGlobalAdmin || false);
            
            // Hide sign in interface
            const signDiv = document.getElementById('signDiv');
            const chatDiv = document.getElementById('chatDiv');
            
            if (signDiv) signDiv.style.display = 'none';
            if (chatDiv) chatDiv.style.display = 'block';
            
            console.log('✅ Successfully signed in as:', data.username);
        } else {
            showGlassmorphismAlert('Sign In Failed', data.message || 'Unknown error occurred', 'error');
        }
    });

    // Sign up response
    socket.on('signUpResponse', function(data) {
        console.log('📝 Sign up response:', data);
        setState.setSigninInProgress(false);
        
        if (data.success) {
            showGlassmorphismAlert('Account Created', 'Your account has been created successfully! You can now sign in.', 'success');
        } else {
            showGlassmorphismAlert('Sign Up Failed', data.message || 'Unknown error occurred', 'error');
        }
    });

    // Session restoration
    socket.on('sessionRestored', function(data) {
        console.log('🔄 Session restored:', data);
        if (data.username) {
            setState.setCurrentUsername(data.username);
            setState.setGlobalAdmin(data.isGlobalAdmin || false);
        }
    });

    // Session invalid - handled in authentication.js with proper context checking
    // Removing duplicate handler that was causing popup on every page load

    // Logout response
    socket.on('logoutResponse', function(data) {
        console.log('👋 Logout response:', data);
        
        // Reset state
        setState.setCurrentUsername(null);
        setState.setGlobalAdmin(false);
        setState.setCurrentRoom('Global');
        
        // Show sign in interface
        const signDiv = document.getElementById('signDiv');
        const chatDiv = document.getElementById('chatDiv');
        const gameDiv = document.getElementById('gameDiv');
        
        if (signDiv) signDiv.style.display = 'block';
        if (chatDiv) chatDiv.style.display = 'none';
        if (gameDiv) gameDiv.style.display = 'none';
    });
}

/**
 * Setup game-related socket handlers
 */
function setupGameHandlers() {
    // New round started
    socket.on('newRound', function(data) {
        console.log('🎮 New round started:', data);
        // Game UI module will handle this
        if (window.gameUI) {
            window.gameUI.handleNewRound(data);
        }
    });

    // Player turn update
    socket.on('yourTurn', function(data) {
        console.log('🎯 Your turn:', data);
        if (window.gameUI) {
            window.gameUI.handleYourTurn(data);
        }
    });

    // Turn update for all players
    socket.on('turnUpdate', function(data) {
        console.log('🔄 Turn update:', data);
        if (window.gameUI) {
            window.gameUI.handleTurnUpdate(data);
        }
    });

    // Player locked in choice
    socket.on('playerLockedIn', function(data) {
        console.log('🔒 Player locked in:', data);
        if (window.gameUI) {
            window.gameUI.handlePlayerLockedIn(data);
        }
    });

    // Round result
    socket.on('roundResult', function(data) {
        console.log('📊 Round result:', data);
        if (window.gameUI) {
            window.gameUI.handleRoundResult(data);
        }
        
        // Update token displays
        if (data.tokenPool !== undefined) {
            updateTokenPoolDisplay(data.tokenPool, data.maxTokens || 2500);
        }
        
        if (data.players) {
            updateAllWalletDisplays(data.players);
        }
    });

    // Column selected
    socket.on('columnSelected', function(data) {
        console.log('📍 Column selected:', data);
        if (window.gameUI) {
            window.gameUI.handleColumnSelected(data);
        }
    });

    // Auto column selected
    socket.on('autoColumnSelected', function(data) {
        console.log('🎲 Auto column selected:', data);
        if (window.gameUI) {
            window.gameUI.handleAutoColumnSelected(data);
        }
    });

    // Game state restore
    socket.on('gameStateRestore', function(data) {
        console.log('💾 Game state restore:', data);
        if (window.gameUI) {
            window.gameUI.handleGameStateRestore(data);
        }
    });

    // Unified game state restore
    socket.on('unifiedGameStateRestore', function(data) {
        console.log('🔄 Unified game state restore:', data);
        if (window.gameUI) {
            window.gameUI.handleUnifiedGameStateRestore(data);
        }
    });
}

/**
 * Setup admin/moderator socket handlers
 */
function setupAdminHandlers() {
    // Round results panel (for moderators)
    socket.on('roundResultsPanel', function(data) {
        console.log('📊 Round results panel data:', data);
        if (window.adminUI) {
            window.adminUI.updateRoundResultsPanel(data);
        }
    });

    // Condition update
    socket.on('conditionUpdate', function(data) {
        console.log('🧪 Condition update:', data);
        if (window.adminUI) {
            window.adminUI.handleConditionUpdate(data);
        }
    });

    // Player status update
    socket.on('playerStatusUpdate', function(data) {
        console.log('👥 Player status update:', data);
        
        // Route to both gameUI and adminUI for comprehensive updates
        if (window.gameUI && typeof window.gameUI.handlePlayerStatusUpdate === 'function') {
            window.gameUI.handlePlayerStatusUpdate(data);
        }
        if (window.adminUI && typeof window.adminUI.handlePlayerStatusUpdate === 'function') {
            window.adminUI.handlePlayerStatusUpdate(data);
        }
    });

    // Experiment status update
    socket.on('experimentStatusUpdate', function(data) {
        console.log('⚗️ Experiment status update:', data);
        if (window.adminUI) {
            window.adminUI.handleExperimentStatusUpdate(data);
        }
    });

    // AI behavior set
    socket.on('aiBehaviorSet', function(data) {
        console.log('🤖 AI behavior set:', data);
        if (window.adminUI) {
            window.adminUI.handleAiBehaviorSet(data);
        }
    });

    // Incentive set result
    socket.on('incentiveSetResult', function(data) {
        console.log('🎯 Incentive set result:', data);
        if (data.success) {
            showGlassmorphismAlert('Incentive Set', data.message, 'success');
        } else {
            showGlassmorphismAlert('Incentive Error', data.message, 'error');
        }
    });

    // Column mode changed
    socket.on('columnModeChanged', function(data) {
        console.log('📍 Column mode changed:', data);
        if (window.adminUI) {
            window.adminUI.handleColumnModeChanged(data);
        }
    });
}

/**
 * Setup chat-related socket handlers
 */
function setupChatHandlers() {
    // Room users update
    socket.on('roomUsers', function({ room, users, usersCount }) {
        console.log(`👥 Room users update for ${room}:`, users);
        if (window.chatUI) {
            window.chatUI.updateRoomUsers(room, users, usersCount);
        }
    });

    // Players in room
    socket.on('playersInRoom', function(data) {
        console.log('🎮 Players in room:', data);
        console.log('🎮 Players array detailed:', JSON.stringify(data.players, null, 2));
        if (window.chatUI) {
            window.chatUI.updatePlayersInRoom(data);
        }
    });

    // Chat message
    socket.on('message', function(message) {
        console.log('💬 Message received:', message);
        if (window.chatUI) {
            window.chatUI.displayMessage(message);
        }
    });

    // Room created
    socket.on('roomCreated', function(roomName) {
        console.log('🏠 Room created:', roomName);
        setState.setCurrentRoom(roomName);
        if (window.chatUI) {
            window.chatUI.handleRoomCreated(roomName);
        }
    });

    // Join room (from server confirmation)
    socket.on('joinRoom', function(room) {
        console.log('🚪 Join room event received:', room);
        if (window.chatUI) {
            window.chatUI.handleJoinRoom(room);
        }
    });

    // Left room
    socket.on('leftRoom', function(data) {
        console.log('🚪 Left room:', data);
        setState.setCurrentRoom('Global');
        if (window.chatUI) {
            window.chatUI.handleLeftRoom(data);
        }
    });

    // Copy to clipboard
    socket.on('copyToClipboard', function(data) {
        console.log('📋 Copy to clipboard:', data);
        navigator.clipboard.writeText(data.text).then(() => {
            console.log('✅ Copied to clipboard:', data.text);
        }).catch(err => {
            console.error('❌ Failed to copy to clipboard:', err);
        });
    });
}

/**
 * Setup system-related socket handlers
 */
function setupSystemHandlers() {
    // Handle server disconnections - redirect to login
    socket.on('disconnect', function(reason) {
        console.log('🔌 Disconnected from server:', reason);
        
        // Check if this is a server restart/shutdown (not a normal client disconnect)
        if (reason === 'io server disconnect' || reason === 'transport close') {
            console.log('🔄 Server disconnected - redirecting to login');
            
            // Reset all client state
            setState.setCurrentUsername(null);
            setState.setGlobalAdmin(false);
            setState.setCurrentRoom('Global');
            
            // Show login interface and hide everything else
            const signDiv = document.getElementById('signDiv');
            const chatDiv = document.getElementById('chatDiv');
            const gameDiv = document.getElementById('gameDiv');
            const landingPage = document.getElementById('landingPage');
            
            if (signDiv) signDiv.style.display = 'block';
            if (chatDiv) chatDiv.style.display = 'none';
            if (gameDiv) gameDiv.style.display = 'none';
            if (landingPage) landingPage.style.display = 'none';
            
            console.log('✅ Redirected to login screen due to server disconnect');
        }
    });
    
    // System notification
    socket.on('systemNotification', function(data) {
        console.log('🔔 System notification:', data);
        
        // Only show if there's actual content
        if (data && (data.title || data.message)) {
            if (window.showSystemNotification) {
                window.showSystemNotification(data.title, data.message, data.type);
            } else {
                showGlassmorphismAlert(data.title || 'Notification', data.message || '', data.type || 'info');
            }
        } else {
            console.log('⚠️ Skipping empty system notification');
        }
    });

    // System message sent
    socket.on('systemMessageSent', function(data) {
        console.log('📢 System message sent:', data);
        if (data.success) {
            showGlassmorphismAlert('Message Sent', 'System message sent successfully', 'success');
        } else {
            showGlassmorphismAlert('Message Failed', data.message || 'Failed to send message', 'error');
        }
    });

    // Room full
    socket.on('roomFull', function(data) {
        console.log('🚫 Room full:', data);
        showGlassmorphismAlert('Room Full', 'This room is full. Please try another room.', 'warning');
    });

    // Error
    socket.on('error', function(data) {
        console.error('❌ Socket error:', data);
        showGlassmorphismAlert('Error', data.message || 'An error occurred', 'error');
    });

    // Invite code response
    socket.on('inviteCodeResponse', function(data) {
        console.log('🎫 Invite code response:', data);
        if (data.success) {
            const codeType = data.isPermanent ? 'Permanent' : 'Single-Use';
            showInviteCodeAlert(data.inviteCode, codeType);
        } else {
            showGlassmorphismAlert('Invite Code Error', data.message || 'Failed to generate invite code', 'error');
        }
    });
}

/**
 * Setup experiment-related socket handlers
 */
function setupExperimentHandlers() {
    // Experiment ended
    socket.on('experimentEnded', function(data) {
        console.log('🏁 Experiment ended:', data);
        showExperimentEndedModal(data.message, data.moderator);
    });

    // Experiment end
    socket.on('experimentEnd', function(data) {
        console.log('🏁 Experiment end:', data);
        if (window.gameUI) {
            window.gameUI.handleExperimentEnd(data);
        }
    });

    // Phase transition
    socket.on('phaseTransition', function(data) {
        console.log('🔄 Phase transition:', data);
        if (window.gameUI) {
            window.gameUI.handlePhaseTransition(data);
        }
    });

    // Lightning test progress
    socket.on('lightningTestProgress', function(data) {
        console.log('⚡ Lightning test progress:', data);
        if (window.updateLightningTestProgress) {
            window.updateLightningTestProgress(data);
        }
    });

    // Lightning test complete
    socket.on('lightningTestComplete', function(data) {
        console.log('⚡ Lightning test complete:', data);
        if (window.showLightningTestResults) {
            window.showLightningTestResults(data.message, data.stats, data.duration);
        }
    });

    // Triad complete
    socket.on('triadComplete', function(data) {
        console.log('🔺 Triad complete:', data);
        if (window.gameUI) {
            window.gameUI.handleTriadComplete(data);
        }
    });

    // AI players added
    socket.on('aiPlayersAdded', function(data) {
        console.log('🤖 AI players added:', data);
        if (window.gameUI) {
            window.gameUI.handleAiPlayersAdded(data);
        }
    });

    // Incentive changed
    socket.on('incentiveChanged', function(data) {
        console.log('🎯 Incentive changed:', data);
        if (window.showIncentiveBanner) {
            window.showIncentiveBanner(data.incentiveDisplay);
        }
    });

    // Incentive bonus notification
    socket.on('incentiveBonusNotification', function(data) {
        console.log('💰 Incentive bonus notification:', data);
        if (window.showSystemNotification) {
            window.showSystemNotification('Bonus Earned!', data.message, 'success');
        }
    });

    // Experiment paused
    socket.on('experimentPaused', function(data) {
        console.log('⏸️ Experiment paused:', data);
        if (window.adminUI) {
            window.adminUI.handleExperimentPaused(data);
        }
    });

    // Experiment resumed
    socket.on('experimentResumed', function(data) {
        console.log('▶️ Experiment resumed:', data);
        if (window.adminUI) {
            window.adminUI.handleExperimentResumed(data);
        }
    });

    // Round reset
    socket.on('roundReset', function(data) {
        console.log('🔄 Round reset:', data);
        if (window.gameUI) {
            window.gameUI.handleRoundReset(data);
        }
    });
}

/**
 * Setup game initialization handlers
 */
socket.on('init', function(data) {
    console.log('🎮 Game initialization:', data);
    if (window.gameUI) {
        window.gameUI.handleGameInit(data);
    }
});

socket.on('update', function(data) {
    // Logging disabled to prevent console spam
    // console.log('🔄 Game update:', data);
    if (window.gameUI && typeof window.gameUI.handleGameUpdate === 'function') {
        window.gameUI.handleGameUpdate(data);
    }
});

socket.on('remove', function(data) {
    // Only log if there's meaningful data to prevent spam
    if (data && data.player && data.player.length > 0) {
        console.log('🗑️ Player removed:', data);
    }
    if (window.gameUI && typeof window.gameUI.handlePlayerRemoved === 'function') {
        window.gameUI.handlePlayerRemoved(data);
    }
});

// Export the initialization function
export default initializeSocketHandlers;