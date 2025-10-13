/**
 * XenoGenesis Client - Socket Manager
 * Manages the socket.io connection and provides a centralized socket instance
 */

// Initialize socket connection
export const socket = io();

// Connection state
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Event emitters for connection state changes
const connectionListeners = new Set();

/**
 * Add a listener for connection state changes
 * @param {Function} listener - Callback function
 */
export function addConnectionListener(listener) {
    connectionListeners.add(listener);
}

/**
 * Remove a connection state listener
 * @param {Function} listener - Callback function to remove
 */
export function removeConnectionListener(listener) {
    connectionListeners.delete(listener);
}

/**
 * Notify all connection listeners of state change
 * @param {boolean} connected - Connection state
 */
function notifyConnectionListeners(connected) {
    connectionListeners.forEach(listener => {
        try {
            listener(connected);
        } catch (error) {
            console.error('Error in connection listener:', error);
        }
    });
}

/**
 * Get current connection status
 * @returns {boolean} True if connected
 */
export function isSocketConnected() {
    return isConnected && socket.connected;
}

/**
 * Emit an event with automatic retry on disconnect
 * @param {string} event - Event name
 * @param {*} data - Data to send
 * @param {Function} callback - Optional callback
 * @returns {Promise} Promise that resolves when event is sent
 */
export function emitWithRetry(event, data, callback) {
    return new Promise((resolve, reject) => {
        if (!isSocketConnected()) {
            reject(new Error('Socket not connected'));
            return;
        }

        if (callback) {
            socket.emit(event, data, callback);
        } else {
            socket.emit(event, data);
        }
        resolve();
    });
}

/**
 * Safely emit an event (won't throw if disconnected)
 * @param {string} event - Event name
 * @param {*} data - Data to send
 * @returns {boolean} True if event was sent
 */
export function safeEmit(event, data) {
    try {
        if (isSocketConnected()) {
            socket.emit(event, data);
            return true;
        }
    } catch (error) {
        console.error('Error emitting event:', error);
    }
    return false;
}

// Core connection event handlers
socket.on('connect', function() {
    console.log('🔗 Connected to server');
    isConnected = true;
    reconnectAttempts = 0;
    notifyConnectionListeners(true);
    
    // Update UI to show connected state
    updateConnectionStatus(true);
});

socket.on('disconnect', function(reason) {
    console.log('🔌 Disconnected from server:', reason);
    isConnected = false;
    notifyConnectionListeners(false);
    
    // Update UI to show disconnected state
    updateConnectionStatus(false);
    
    // Show user-friendly message
    if (reason === 'io server disconnect') {
        console.log('Server disconnected the client');
    } else {
        console.log('Client disconnected, attempting to reconnect...');
    }
});

socket.on('reconnect', function(attemptNumber) {
    console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
    isConnected = true;
    reconnectAttempts = 0;
    notifyConnectionListeners(true);
    updateConnectionStatus(true);
});

socket.on('reconnect_attempt', function(attemptNumber) {
    console.log('🔄 Reconnection attempt', attemptNumber);
    reconnectAttempts = attemptNumber;
    
    if (attemptNumber > maxReconnectAttempts) {
        console.log('❌ Max reconnection attempts reached');
        updateConnectionStatus(false, 'Connection failed. Please refresh the page.');
    }
});

socket.on('reconnect_error', function(error) {
    console.error('❌ Reconnection error:', error);
});

socket.on('reconnect_failed', function() {
    console.error('❌ Failed to reconnect to server');
    updateConnectionStatus(false, 'Unable to reconnect. Please refresh the page.');
});

/**
 * Update connection status in the UI
 * @param {boolean} connected - Connection state
 * @param {string} message - Optional status message
 */
function updateConnectionStatus(connected, message = '') {
    // Create or update connection status indicator
    let statusIndicator = document.getElementById('connectionStatus');
    
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'connectionStatus';
        statusIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 9999;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        document.body.appendChild(statusIndicator);
    }
    
    if (connected) {
        statusIndicator.style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(56, 142, 60, 0.9))';
        statusIndicator.style.color = 'white';
        statusIndicator.textContent = '🟢 Connected';
        
        // Hide after 3 seconds
        setTimeout(() => {
            if (statusIndicator && connected) {
                statusIndicator.style.opacity = '0';
                setTimeout(() => {
                    if (statusIndicator && statusIndicator.style.opacity === '0') {
                        statusIndicator.remove();
                    }
                }, 300);
            }
        }, 3000);
    } else {
        statusIndicator.style.background = 'linear-gradient(135deg, rgba(244, 67, 54, 0.9), rgba(183, 28, 28, 0.9))';
        statusIndicator.style.color = 'white';
        statusIndicator.style.opacity = '1';
        statusIndicator.textContent = message || '🔴 Disconnected';
    }
}

/**
 * Manually trigger a reconnection
 */
export function reconnect() {
    if (!isSocketConnected()) {
        console.log('🔄 Manual reconnection triggered');
        socket.disconnect();
        socket.connect();
    }
}

/**
 * Get socket instance (for backwards compatibility)
 * @returns {Socket} Socket.io instance
 */
export function getSocket() {
    return socket;
}

// Export socket as default for easy importing
export default socket;