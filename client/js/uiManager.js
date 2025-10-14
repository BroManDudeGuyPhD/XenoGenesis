// UI Manager Module - Handle card visibility, menu context, and UI state management
// Part of XenoGenesis Modular Architecture

import { getIsGlobalAdmin } from './authentication.js';

// UI state variables
let gameActive = false;
let currentRoom = 'Global';

// Initialize UI manager
export function initializeUIManager() {
    console.log('🎨 Initializing UI manager module...');
    setupInitialCardVisibility();
}

// Determine current menu context
export function getMenuContext() {
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

// Update card visibility based on menu context
export function updateCardVisibility() {
    const menuContext = getMenuContext();
    const createCard = document.getElementById('create-card');
    const joinCard = document.getElementById('join-card');
    const inviteCard = document.getElementById('invite-card');
    
    // Check if admin status was set early from session data
    const isAdmin = getIsGlobalAdmin();
    
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
    
    console.log('🎨 Card visibility updated:', {
        context: menuContext.context,
        createVisible: createCard ? !createCard.classList.contains('card-hidden') : false,
        joinVisible: joinCard ? !joinCard.classList.contains('card-hidden') : false,
        inviteVisible: inviteCard ? !inviteCard.classList.contains('card-hidden') : false,
        isAdmin
    });
    
    // Update invite visibility
    updateInviteVisibility();
    
    // Update admin status badge
    updateAdminStatusBadge();
}

// Update invite card visibility based on admin/moderator status  
export function updateInviteVisibility() {
    const inviteCard = document.getElementById('invite-card');
    const inviteFab = document.getElementById('invite-fab');
    const menuContext = getMenuContext();
    const isAdmin = getIsGlobalAdmin();
    
    // Determine if invite should be shown
    let shouldShowInvite = false;
    
    // 1. Global admin in global chat or room lobby (not during active games)
    if (menuContext.isInGlobalChat && isAdmin) {
        shouldShowInvite = true; // Global admin in global chat
    } else if (menuContext.isInRoomLobby && isAdmin) {
        shouldShowInvite = true; // Global admin in room lobby
    } else if (menuContext.isInRoomLobby && isCurrentRoomModerator()) {
        shouldShowInvite = true; // Room moderator in room lobby  
    }
    
    // Apply visibility
    if (inviteCard) {
        if (shouldShowInvite) {
            inviteCard.classList.remove('card-hidden');
            inviteCard.classList.add('card-visible');
        } else {
            inviteCard.classList.remove('card-visible');
            inviteCard.classList.add('card-hidden');
        }
    }
    
    if (inviteFab) {
        inviteFab.style.display = shouldShowInvite ? 'flex' : 'none';
    }
    
    console.log('🎟️ Invite visibility updated:', {
        shouldShow: shouldShowInvite,
        isAdmin,
        context: menuContext.context,
        isModerator: isCurrentRoomModerator()
    });
    
    // Also update admin build status badge visibility
    updateAdminStatusBadge();
}

// Update admin build status badge
export function updateAdminStatusBadge() {
    const adminBuildPill = document.getElementById('admin-build-pill');
    const isAdmin = getIsGlobalAdmin();
    
    if (adminBuildPill) {
        if (isAdmin) {
            adminBuildPill.style.display = 'inline-block';
            adminBuildPill.textContent = 'ADMIN BUILD';
        } else {
            adminBuildPill.style.display = 'none';
        }
    }
}

// Check if current user is moderator of current room
export function isCurrentRoomModerator() {
    // This would need to be implemented based on your room moderator system
    // For now, returning false as placeholder
    return false;
}

// Set up initial card visibility
function setupInitialCardVisibility() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateCardVisibility);
    } else {
        updateCardVisibility();
    }
}

// Update game active state
export function setGameActive(active) {
    gameActive = active;
    updateCardVisibility();
}

// Update current room
export function setCurrentRoom(room) {
    currentRoom = room;
    updateCardVisibility();
}

// Show/hide loading spinner
export function showLoadingSpinner(show = true, message = 'Loading...') {
    let spinner = document.getElementById('globalLoadingSpinner');
    
    if (show) {
        if (!spinner) {
            // Create spinner if it doesn't exist
            spinner = document.createElement('div');
            spinner.id = 'globalLoadingSpinner';
            spinner.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                ">
                    <div style="
                        background: linear-gradient(145deg, rgba(43, 45, 59, 0.95), rgba(54, 57, 63, 0.9));
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        padding: 30px;
                        text-align: center;
                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                        backdrop-filter: blur(20px);
                    ">
                        <div style="
                            width: 40px;
                            height: 40px;
                            border: 3px solid rgba(255, 255, 255, 0.1);
                            border-top: 3px solid #7289da;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 15px;
                        "></div>
                        <div style="color: #dcddde; font-size: 14px; font-weight: 500;">
                            ${message}
                        </div>
                    </div>
                </div>
            `;
            
            // Add CSS animation
            if (!document.getElementById('spinnerStyles')) {
                const style = document.createElement('style');
                style.id = 'spinnerStyles';
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(spinner);
        } else {
            spinner.style.display = 'flex';
            const messageEl = spinner.querySelector('[style*="color: #dcddde"]');
            if (messageEl) messageEl.textContent = message;
        }
    } else {
        if (spinner) {
            spinner.style.display = 'none';
        }
    }
}

// Show/hide toast notification
export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    
    // Set colors based on type
    let bgColor, textColor, icon;
    switch(type) {
        case 'success':
            bgColor = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            textColor = '#ffffff';
            icon = '✅';
            break;
        case 'error':
            bgColor = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            textColor = '#ffffff';
            icon = '❌';
            break;
        case 'warning':
            bgColor = 'linear-gradient(135deg, #f39c12, #e67e22)';
            textColor = '#ffffff';
            icon = '⚠️';
            break;
        default:
            bgColor = 'linear-gradient(135deg, #667aff, #7386ff)';
            textColor = '#ffffff';
            icon = 'ℹ️';
            break;
    }
    
    toast.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: ${textColor};
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 500;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        ">
            <span>${icon}</span>
            <span>${message}</span>
        </div>
    `;
    
    // Add CSS animation if not exists
    if (!document.getElementById('toastStyles')) {
        const style = document.createElement('style');
        style.id = 'toastStyles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        const toastEl = toast.firstElementChild;
        if (toastEl) {
            toastEl.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// Toggle element visibility with animation
export function toggleElementVisibility(elementId, visible, animationType = 'fade') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (animationType === 'fade') {
        if (visible) {
            element.style.display = 'block';
            element.style.opacity = '0';
            element.style.transition = 'opacity 0.3s ease';
            setTimeout(() => element.style.opacity = '1', 10);
        } else {
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = '0';
            setTimeout(() => element.style.display = 'none', 300);
        }
    } else if (animationType === 'slide') {
        if (visible) {
            element.style.display = 'block';
            element.style.transform = 'translateY(-20px)';
            element.style.opacity = '0';
            element.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                element.style.transform = 'translateY(0)';
                element.style.opacity = '1';
            }, 10);
        } else {
            element.style.transition = 'all 0.3s ease';
            element.style.transform = 'translateY(-20px)';
            element.style.opacity = '0';
            setTimeout(() => element.style.display = 'none', 300);
        }
    }
}

// Public API exports
export {
    // All functions are already exported inline above
    // Keeping this for any future non-inline exports
};

// Global exports for backwards compatibility
if (typeof window !== 'undefined') {
    window.uiManager = {
        getMenuContext,
        updateCardVisibility,
        updateInviteVisibility,
        updateAdminStatusBadge,
        isCurrentRoomModerator,
        setGameActive,
        setCurrentRoom,
        showLoadingSpinner,
        showToast,
        toggleElementVisibility
    };
}