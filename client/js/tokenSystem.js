/**
 * XenoGenesis Client - Token System
 * Manages token pools, wallet displays, and conversion rates
 */

import { TOKEN_CONFIG, formatCurrency, getElement } from './utils.js';
import { socket } from './socketManager.js';

// Token system state
let currentTokenPool = TOKEN_CONFIG.STARTING_TOKENS;
let maxTokenPool = TOKEN_CONFIG.MAX_TOKENS;
let pendingTokenUpdates = null;

/**
 * Update token pool display with comprehensive debugging
 * @param {number} currentTokens - Current token count
 * @param {number} maxTokens - Maximum token count
 */
export function updateTokenPoolDisplay(currentTokens, maxTokens) {
    console.log(`🎯 Updating token pool display: ${currentTokens}/${maxTokens}`);
    
    currentTokenPool = currentTokens;
    maxTokenPool = maxTokens;
    
    const tokenPoolElement = getElement('tokenPool');
    const tokenPoolProgressElement = getElement('tokenPoolProgress');
    const tokenPoolPercentageElement = getElement('tokenPoolPercentage');
    
    if (tokenPoolElement) {
        tokenPoolElement.textContent = `${currentTokens.toLocaleString()} / ${maxTokens.toLocaleString()}`;
    }
    
    if (tokenPoolProgressElement && tokenPoolPercentageElement) {
        const percentage = Math.max(0, Math.min(100, (currentTokens / maxTokens) * 100));
        
        tokenPoolProgressElement.style.width = `${percentage}%`;
        tokenPoolPercentageElement.textContent = `${percentage.toFixed(1)}%`;
        
        // Update color based on token level
        if (percentage > 75) {
            tokenPoolProgressElement.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
        } else if (percentage > 50) {
            tokenPoolProgressElement.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
        } else if (percentage > 25) {
            tokenPoolProgressElement.style.background = 'linear-gradient(90deg, #FF5722, #FF9800)';
        } else {
            tokenPoolProgressElement.style.background = 'linear-gradient(90deg, #F44336, #FF5722)';
        }
    }
    
    // Update any other token displays
    updateTokenStatusIndicators(currentTokens, maxTokens);
}

/**
 * Update token conversion display
 * @param {number} whiteValue - White token value
 * @param {number} blackValue - Black token value
 */
export function updateTokenConversionDisplay(whiteValue, blackValue) {
    console.log(`💰 Updating token conversion: White=${formatCurrency(whiteValue)}, Black=${formatCurrency(blackValue)}`);
    
    const whiteValueElement = getElement('whiteTokenValue');
    const blackValueElement = getElement('blackTokenValue');
    
    if (whiteValueElement) {
        whiteValueElement.textContent = formatCurrency(whiteValue);
    }
    
    if (blackValueElement) {
        blackValueElement.textContent = formatCurrency(blackValue);
    }
    
    // Update any conversion rate displays
    updateConversionRateDisplay(whiteValue, blackValue);
}

/**
 * Update all wallet displays for players
 * @param {Array} playersData - Array of player data with wallet info
 */
export function updateAllWalletDisplays(playersData) {
    console.log(`💼 Updating wallet displays for ${playersData.length} players`);
    
    playersData.forEach(player => {
        updatePlayerWalletDisplay(player);
    });
}

/**
 * Update individual player wallet display
 * @param {Object} player - Player data object
 */
export function updatePlayerWalletDisplay(player) {
    if (!player || !player.username) return;
    
    const walletElement = getElement(`wallet-${player.username}`);
    if (!walletElement) return;
    
    const whiteTokens = player.whiteTokens || 0;
    const blackTokens = player.blackTokens || 0;
    const totalEarnings = player.totalEarnings || 0;
    
    walletElement.innerHTML = `
        <div class="wallet-display">
            <div class="wallet-header">${player.username}</div>
            <div class="token-counts">
                <div class="white-tokens">⚪ ${whiteTokens}</div>
                <div class="black-tokens">⚫ ${blackTokens}</div>
            </div>
            <div class="total-earnings">${formatCurrency(totalEarnings)}</div>
        </div>
    `;
}

/**
 * Update token status indicators throughout the UI
 * @param {number} currentTokens - Current token count
 * @param {number} maxTokens - Maximum token count
 */
function updateTokenStatusIndicators(currentTokens, maxTokens) {
    const percentage = (currentTokens / maxTokens) * 100;
    
    // Update header indicators
    const headerTokens = document.querySelectorAll('.header-token-indicator');
    headerTokens.forEach(indicator => {
        indicator.textContent = currentTokens.toLocaleString();
        indicator.className = `header-token-indicator ${getTokenLevelClass(percentage)}`;
    });
    
    // Update any warning indicators
    if (percentage < 10) {
        showTokenWarning('Critical token shortage! Pool below 10%');
    } else if (percentage < 25) {
        showTokenWarning('Token levels running low');
    } else {
        hideTokenWarning();
    }
}

/**
 * Update conversion rate display
 * @param {number} whiteValue - White token value
 * @param {number} blackValue - Black token value
 */
function updateConversionRateDisplay(whiteValue, blackValue) {
    const conversionElements = document.querySelectorAll('.conversion-rate');
    
    conversionElements.forEach(element => {
        element.innerHTML = `
            <div class="conversion-item">
                <span class="token-symbol">⚪</span>
                <span class="token-value">${formatCurrency(whiteValue)}</span>
            </div>
            <div class="conversion-item">
                <span class="token-symbol">⚫</span>
                <span class="token-value">${formatCurrency(blackValue)}</span>
            </div>
        `;
    });
}

/**
 * Get CSS class for token level
 * @param {number} percentage - Token percentage
 * @returns {string} CSS class name
 */
function getTokenLevelClass(percentage) {
    if (percentage > 75) return 'token-level-high';
    if (percentage > 50) return 'token-level-medium';
    if (percentage > 25) return 'token-level-low';
    return 'token-level-critical';
}

/**
 * Show token warning
 * @param {string} message - Warning message
 */
function showTokenWarning(message) {
    let warning = getElement('tokenWarning');
    
    if (!warning) {
        warning = document.createElement('div');
        warning.id = 'tokenWarning';
        warning.className = 'token-warning';
        warning.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(255, 107, 107, 0.3);
            z-index: 9998;
            animation: slideInRight 0.3s ease-out;
        `;
        document.body.appendChild(warning);
    }
    
    warning.textContent = `⚠️ ${message}`;
}

/**
 * Hide token warning
 */
function hideTokenWarning() {
    const warning = getElement('tokenWarning');
    if (warning) {
        warning.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => warning.remove(), 300);
    }
}

/**
 * Store pending token updates for later application
 * @param {Object} updates - Token update data
 */
export function setPendingTokenUpdates(updates) {
    pendingTokenUpdates = updates;
    console.log('📝 Stored pending token updates:', updates);
}

/**
 * Apply pending token updates
 */
export function applyPendingTokenUpdates() {
    if (pendingTokenUpdates) {
        console.log('✅ Applying pending token updates:', pendingTokenUpdates);
        
        if (pendingTokenUpdates.players) {
            updateAllWalletDisplays(pendingTokenUpdates.players);
        }
        
        if (pendingTokenUpdates.tokenPool !== undefined) {
            updateTokenPoolDisplay(pendingTokenUpdates.tokenPool, maxTokenPool);
        }
        
        if (pendingTokenUpdates.conversionRates) {
            updateTokenConversionDisplay(
                pendingTokenUpdates.conversionRates.white,
                pendingTokenUpdates.conversionRates.black
            );
        }
        
        pendingTokenUpdates = null;
    }
}

/**
 * Get current token pool status
 * @returns {Object} Token pool information
 */
export function getTokenPoolStatus() {
    return {
        current: currentTokenPool,
        max: maxTokenPool,
        percentage: (currentTokenPool / maxTokenPool) * 100
    };
}

/**
 * Initialize token system
 */
export function initializeTokenSystem() {
    console.log('🎯 Initializing token system');
    
    // Set up initial displays
    updateTokenPoolDisplay(TOKEN_CONFIG.STARTING_TOKENS, TOKEN_CONFIG.MAX_TOKENS);
    
    // Set up socket listeners for token updates
    socket.on('tokenPoolUpdate', (data) => {
        updateTokenPoolDisplay(data.current, data.max);
    });
    
    socket.on('walletUpdate', (data) => {
        if (data.players) {
            updateAllWalletDisplays(data.players);
        }
    });
    
    socket.on('conversionRateUpdate', (data) => {
        updateTokenConversionDisplay(data.whiteValue, data.blackValue);
    });
}

// Export all token system functions
export default {
    updateTokenPoolDisplay,
    updateTokenConversionDisplay,
    updateAllWalletDisplays,
    updatePlayerWalletDisplay,
    setPendingTokenUpdates,
    applyPendingTokenUpdates,
    getTokenPoolStatus,
    initializeTokenSystem
};