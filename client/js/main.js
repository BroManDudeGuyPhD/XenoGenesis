/**
 * XenoGenesis Client - Main Application
 * Coordinates all modules and initializes the application
 */

import { setState, getMenuContext } from './utils.js';
import { socket } from './socketManager.js';
import initializeSocketHandlers from './socketHandlers.js';
import { initializeTokenSystem } from './tokenSystem.js';
import gameUI from './gameUI.js';
import modals from './modals.js';

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
    const createRoomButton = document.getElementById('createRoomButton');
    if (createRoomButton) {
        createRoomButton.addEventListener('click', handleCreateRoom);
    }
    
    const joinRoomButton = document.getElementById('joinRoomButton');
    if (joinRoomButton) {
        joinRoomButton.addEventListener('click', handleJoinRoom);
    }
    
    // Game controls
    const leaveRoomButton = document.getElementById('leaveRoomButton');
    if (leaveRoomButton) {
        leaveRoomButton.addEventListener('click', handleLeaveRoom);
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
    const roomName = prompt('Enter room name:');
    if (roomName && roomName.trim()) {
        socket.emit('createRoom', { roomName: roomName.trim() });
    }
}

/**
 * Handle join room
 */
function handleJoinRoom() {
    const roomName = prompt('Enter room name to join:');
    if (roomName && roomName.trim()) {
        socket.emit('joinRoom', { roomName: roomName.trim() });
    }
}

/**
 * Handle leave room
 */
function handleLeaveRoom() {
    socket.emit('leaveRoom');
}

/**
 * Handle before unload
 * @param {Event} e - Before unload event
 */
function handleBeforeUnload(e) {
    // Clean up resources
    socket.disconnect();
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

// Export main functions
export default {
    initializeApp,
    handleSignIn,
    handleSignUp,
    handleCreateRoom,
    handleJoinRoom,
    handleLeaveRoom
};