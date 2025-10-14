// Authentication Module - Handle user authentication, session management, and admin status
// Part of XenoGenesis Modular Architecture

import { socketManager } from './socketManager.js';
import { showSessionExpiredModal, showGlassmorphismAlert } from './modals.js';
import { updateInviteVisibility, updateCardVisibility } from './uiManager.js';

// Authentication state
let isGlobalAdmin = false;
let currentUsername = null;
let currentRoom = 'Global';
let signinInProgress = false;

// Getter functions for state
function getIsGlobalAdmin() {
    return isGlobalAdmin;
}

function getCurrentUsername() {
    return currentUsername;
}

function getCurrentRoom() {
    return currentRoom;
}

// Initialize authentication module
export function initializeAuthentication() {
    console.log('🔐 Initializing authentication module...');
    
    // Check for existing session data immediately to prevent flash of login screen
    if (window.sessionData && window.sessionData.isLoggedIn && window.sessionData.username) {
        console.log('🔄 Early session restore from window.sessionData');
        // Immediately hide login screen and show main interface
        const landingPage = document.getElementById('landingPage');
        const chatContainer = document.getElementById('chat-container');
        
        if (landingPage && chatContainer) {
            landingPage.style.display = 'none';
            chatContainer.style.display = '';
            
            // Set auth state
            currentUsername = window.sessionData.username;
            isGlobalAdmin = window.sessionData.isAdmin || false;
            currentRoom = window.sessionData.room || 'Global';
            
            // Update UI elements - delayed to ensure DOM is ready
            setTimeout(() => {
                switchToLoggedInUI(currentUsername);
                updateCardVisibility();
                updateInviteVisibility();
                
                // Ensure all modules are properly exposed globally
                if (window.exposeModulesGlobally) {
                    window.exposeModulesGlobally();
                }
                
                // Ensure admin functions are available globally if user is admin
                if (isGlobalAdmin && window.initializeAdminFunctions) {
                    window.initializeAdminFunctions();
                }
                
                // Auto-join room to get current state and user count updates
                const roomToJoin = currentRoom || 'Global';
                socketManager.emit('joinRoom', { room: roomToJoin });
            }, 100);
            
            console.log('✅ Early session restored successfully');
        }
    }
    
    setupAuthenticationHandlers();
    setupLoginForm();
    setupProfileMenu();
}

// Set up authentication event handlers
function setupAuthenticationHandlers() {
    // Session restoration handler
    socketManager.on('sessionRestored', handleSessionRestored);
    
    // Session invalid handler
    socketManager.on('sessionInvalid', handleSessionInvalid);
    
    // Sign-in response handler
    socketManager.on('signInResponse', handleSignInResponse);
    
    // Disconnect/reconnect handlers
    socketManager.on('disconnect', handleDisconnect);
    socketManager.on('reconnect', handleReconnect);
}

// Handle session restored event
function handleSessionRestored(data) {
    console.log('🔄 Session restoration received:', data);
    
    // Check if DOM is ready
    if (!document.getElementById('landingPage')) {
        console.log('🔄 DOM not ready, storing session data for later');
        pendingSessionRestore = data;
        return;
    }
    
    performSessionRestore(data);
}

// Handle session invalid event
function handleSessionInvalid(data) {
    console.log('❌ Session invalid received:', data);
    
    // Clear session data
    currentUsername = null;
    currentRoom = 'Global'; // Reset to Global instead of null
    isGlobalAdmin = false;
    
    // Only show alert and reset UI if we're not already on the login screen
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chatContainer');
    const gameDiv = document.getElementById('gameDiv');
    
    // Better check for login screen - if landing page is visible or chat/game are hidden
    const isOnLoginScreen = (landingPage && (landingPage.style.display === 'block' || landingPage.style.display === '')) &&
                           (chatContainer && chatContainer.style.display === 'none') &&
                           (gameDiv && gameDiv.style.display === 'none');
    
    console.log('🔍 Login screen check:', {
        landingPageDisplay: landingPage?.style.display,
        chatContainerDisplay: chatContainer?.style.display,
        gameDivDisplay: gameDiv?.style.display,
        isOnLoginScreen
    });
    
    // Check if this is initial page load by checking if we have any stored session
    const hasStoredSession = localStorage.getItem('username') || sessionStorage.getItem('username');
    
    // Don't show session expired modal on initial page load or if already on login screen
    if (!isOnLoginScreen && currentUsername && hasStoredSession) {
        console.log('⚠️ Showing session expired modal for existing session');
        // User was trying to access game content, show alert and reset UI
        if (landingPage) landingPage.style.display = 'block';
        if (chatContainer) chatContainer.style.display = 'none';
        if (gameDiv) gameDiv.style.display = 'none';
        
        // Show custom session expired modal
        showSessionExpiredModal();
    } else {
        console.log('🔍 Skipping session expired modal:', {
            isOnLoginScreen,
            currentUsername: !!currentUsername,
            hasStoredSession: !!hasStoredSession,
            reason: !isOnLoginScreen ? 'not on login screen' : !currentUsername ? 'no current session' : !hasStoredSession ? 'no stored session' : 'on login screen'
        });
    }
}

// Handle sign-in response
function handleSignInResponse(data) {
    console.log('🔐 Sign-in response received:', data);
    signinInProgress = false;
    
    if (data.success) {
        // Successful login
        currentUsername = data.username;
        isGlobalAdmin = data.isAdmin || false;
        
        // Update UI for logged-in state
        switchToLoggedInUI(data.username);
        
        // Show main interface - hide landing page and show chat
        const landingPage = document.getElementById('landingPage');
        const chatContainer = document.getElementById('chat-container');
        
        if (landingPage) landingPage.style.display = 'none';
        if (chatContainer) chatContainer.style.display = '';
        
        // Update card visibility based on new auth state
        updateCardVisibility();
        updateInviteVisibility();
        
        // Hide login modal
        const modal = document.querySelector('.modal');
        if (modal) modal.style.display = 'none';
        
        // Auto-redirect to main interface - no popup needed
        console.log('✅ Login successful, redirecting to main interface...');
        
        // Request updated room information and user counts
        setTimeout(() => {
            // Stop space animations since we're entering the main app
            if (window.stopSpaceAnimationsOnLogin) {
                window.stopSpaceAnimationsOnLogin();
            }
            
            // Automatically join Global room to get user count updates
            const roomToJoin = currentRoom || 'Global';
            socketManager.emit('joinRoom', { room: roomToJoin });
            console.log('🔄 Auto-joining room after login:', roomToJoin);
        }, 100);
    } else {
        // Failed login
        showGlassmorphismAlert(
            'Login Failed', 
            data.message || 'Invalid username or password', 
            'error'
        );
        
        // Reset login button
        const signInButton = document.getElementById('signIn');
        if (signInButton) {
            signInButton.style.background = '#22c55e';
            signInButton.innerHTML = '<span style="font-size: 12px;">🔐</span> Login';
        }
    }
}

// Handle disconnect
function handleDisconnect() {
    console.log('🔌 Disconnected from server');
    // Show reconnection indicator
    updateConnectionStatus(false);
}

// Handle reconnect
function handleReconnect() {
    console.log('🔌 Reconnected to server');
    updateConnectionStatus(true);
}

// Perform session restoration
function performSessionRestore(data) {
    console.log('🔄 Performing session restore with data:', data);
    
    // Update authentication state
    currentUsername = data.username;
    
    // Set admin status if provided
    if (data.isAdmin !== undefined) {
        isGlobalAdmin = data.isAdmin;
        updateInviteVisibility();
    }
    
    // Update UI for logged-in state
    switchToLoggedInUI(data.username);
    
    // Hide login modal and show appropriate interface
    const modal = document.querySelector('.modal');
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chat-container');
    
    if (modal) modal.style.display = 'none';
    if (landingPage) landingPage.style.display = 'none';
    if (chatContainer) chatContainer.style.display = '';
    
    // Handle active game sessions
    if (data.room && data.room !== 'Global' && data.hasActiveGame) {
        handleActiveGameReconnection(data.room);
    } else if (data.room && data.room !== 'Global') {
        // Regular room restoration
        currentRoom = data.room;
        socketManager.emit('joinRoom', { room: data.room });
    }
}

// Handle active game reconnection
function handleActiveGameReconnection(room) {
    console.log('🎮 Reconnecting to active game in room:', room);
    
    currentRoom = room;
    
    // Show game interface
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
        gameDiv.style.display = 'block';
    }
    
    // Join the game room
    socketManager.emit('joinRoom', { room });
    
    // Show reconnection notification
    showGameReconnectionNotice(room);
}

// Show game reconnection notice
function showGameReconnectionNotice(room) {
    const notice = document.createElement('div');
    notice.innerHTML = `
        <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                    background: linear-gradient(135deg, #43b581, #5bc0de); color: white; 
                    padding: 12px 20px; border-radius: 8px; font-weight: bold; z-index: 9999;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);
                    font-size: 14px; text-align: center;">
            🎮 Reconnected to active game in ${room}
        </div>
    `;
    document.body.appendChild(notice);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        if (notice && notice.parentNode) {
            notice.style.transition = 'all 0.5s ease-out';
            notice.style.opacity = '0';
            notice.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => notice.remove(), 500);
        }
    }, 3000);
}

// Switch UI to logged-in state
function switchToLoggedInUI(username) {
    console.log('🔄 Switching to logged-in UI for:', username);
    
    // Update navigation elements
    const loginButton = document.getElementById('loginNav');
    const profileContainer = document.querySelector('.profile-menu-container');
    const profileUsername = document.getElementById('profileUsername');
    
    // Hide login button and show profile menu
    if (loginButton) {
        loginButton.style.display = 'none';
        // Hide the parent li element too
        loginButton.parentElement.style.display = 'none';
    }
    
    if (profileContainer) {
        profileContainer.style.display = 'block';
    }
    
    if (profileUsername) {
        profileUsername.textContent = username;
    }
    
    console.log('✅ UI switched to logged-in state');
    
    // Update UI visibility
    updateCardVisibility();
    updateInviteVisibility();
}

// Set up login form handlers
function setupLoginForm() {
    console.log('🔐 Setting up login form...');
    
    const signInButton = document.getElementById('signIn');
    const loginNavButton = document.getElementById('loginNav');
    const usernameInput = document.getElementById('username'); // Changed from 'uname'
    const passwordInput = document.getElementById('password'); // Changed from 'psw'
    const loginModal = document.getElementById('id01');
    
    console.log('🔍 Element check:');
    console.log('  - signInButton:', !!signInButton);
    console.log('  - loginNavButton:', !!loginNavButton);
    console.log('  - usernameInput:', !!usernameInput);
    console.log('  - passwordInput:', !!passwordInput);
    console.log('  - loginModal:', !!loginModal);
    
    if (!signInButton) {
        console.warn('🔐 Login button not found');
        return;
    }
    
    // Handle login nav button click (opens modal)
    if (loginNavButton && loginModal) {
        loginNavButton.addEventListener('click', (e) => {
            console.log('🔐 Login nav button clicked - opening modal');
            e.preventDefault();
            loginModal.style.display = 'block';
        });
    }
    
    // Handle sign-in button click
    function handleSignIn(e) {
        console.log('🔐 Login button clicked');
        e.preventDefault();
        e.stopPropagation();
        
        // Prevent multiple signin attempts
        if (signinInProgress) {
            console.log('⚠️ Sign-in already in progress');
            return;
        }
        
        const username = usernameInput?.value;
        const password = passwordInput?.value;
        
        if (!username || !password) {
            showGlassmorphismAlert(
                'Missing Information', 
                'Please enter both username and password', 
                'warning'
            );
            return;
        }
        
        // Set loading state
        signinInProgress = true;
        signInButton.style.background = '#16a34a';
        signInButton.textContent = 'Logging in...';
        
        // Send login request
        socketManager.emit('signIn', { username, password });
        
        // Reset button after timeout
        setTimeout(() => {
            if (signinInProgress) {
                signinInProgress = false;
                signInButton.style.background = '#22c55e';
                signInButton.innerHTML = '<span style="font-size: 12px;">🔐</span> Login';
            }
        }, 5000);
    }
    
    // Add event listeners
    if (signInButton) {
        console.log('🔐 Found sign-in button, attaching event listeners...');
        signInButton.addEventListener('click', handleSignIn);
        signInButton.addEventListener('touchend', handleSignIn, { passive: false });
        console.log('✅ Sign-in button event listeners attached');
    } else {
        console.error('❌ Sign-in button not found during setup');
    }
    
    // Handle enter key in password field
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSignIn(e);
            }
        });
    }
}

// Set up profile menu
function setupProfileMenu() {
    const profileMenuBtn = document.getElementById('profileMenuBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Toggle dropdown on profile button click
    if (profileMenuBtn && profileDropdown) {
        profileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = profileDropdown.style.display === 'block';
            profileDropdown.style.display = isVisible ? 'none' : 'block';
            
            // Rotate chevron
            const chevron = document.getElementById('profileChevron');
            if (chevron) {
                chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        });
    }
    
    // Handle logout button in dropdown
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (profileDropdown && !profileMenuBtn?.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.style.display = 'none';
            const chevron = document.getElementById('profileChevron');
            if (chevron) {
                chevron.style.transform = 'rotate(0deg)';
            }
        }
    });
}

// Handle logout
function handleLogout() {
    console.log('🔓 Logging out...');
    
    // Clear authentication state
    currentUsername = null;
    currentRoom = 'Global';
    isGlobalAdmin = false;
    
    // Reset UI to logged-out state
    const loginButton = document.getElementById('loginNav');
    const logoutButton = document.getElementById('logoutNav');
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chatContainer');
    const gameDiv = document.getElementById('gameDiv');
    
    if (loginButton) loginButton.style.display = 'inline-block';
    if (logoutButton) logoutButton.style.display = 'none';
    if (landingPage) landingPage.style.display = 'block';
    if (chatContainer) chatContainer.style.display = 'none';
    if (gameDiv) gameDiv.style.display = 'none';
    
    // Clear inputs
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    
    // Update card visibility
    updateCardVisibility();
    updateInviteVisibility();
    
    // Notify server
    socketManager.emit('logout');
    
    // Redirect to home screen/login page
    if (window.location.pathname !== '/') {
        window.location.href = '/';
    } else {
        // Show logout confirmation if already on home page
        showGlassmorphismAlert('Logged Out', 'You have been successfully logged out', 'info');
    }
}

// Helper function to open login modal
function openLoginModal() {
    const loginModal = document.getElementById('id01');
    if (loginModal) {
        loginModal.style.display = 'block';
    }
}

// Update profile menu
function updateProfileMenu(username) {
    const profileMenu = document.getElementById('profileMenu');
    if (profileMenu) {
        const usernameElement = profileMenu.querySelector('.username');
        if (usernameElement) {
            usernameElement.textContent = username;
        }
    }
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connectionStatus');
    if (statusIndicator) {
        if (connected) {
            statusIndicator.className = 'status-connected';
            statusIndicator.title = 'Connected';
        } else {
            statusIndicator.className = 'status-disconnected';
            statusIndicator.title = 'Disconnected - Attempting to reconnect...';
        }
    }
}

// Public API exports
export {
    // State getters
    getIsGlobalAdmin,
    getCurrentUsername,
    getCurrentRoom,
    
    // Authentication functions
    performSessionRestore,
    switchToLoggedInUI,
    handleLogout,
    openLoginModal,
    
    // Session management
    handleSessionRestored,
    handleSessionInvalid,
    
    // Status management
    updateConnectionStatus
};

// Global exports for backwards compatibility
if (typeof window !== 'undefined') {
    window.authModule = {
        isGlobalAdmin: () => isGlobalAdmin,
        getCurrentUsername: () => currentUsername,
        getCurrentRoom: () => currentRoom,
        performSessionRestore,
        switchToLoggedInUI,
        handleLogout,
        openLoginModal
    };
}