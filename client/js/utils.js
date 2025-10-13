/**
 * XenoGenesis Client - Utility Functions and Constants
 * Common utilities, constants, and helper functions used across the application
 */

// Token Pool Configuration Constants (must match server-side)
export const TOKEN_CONFIG = {
    MAX_TOKENS: 2500,
    STARTING_TOKENS: 2500
};

// Global state variables
export let isGlobalAdmin = false;
export let currentUsername = null;
export let currentRoom = "Global";
export let gameActive = false;
export let selectedChoice = null;
export let isLockedIn = false;
export let domLoaded = false;
export let signinInProgress = false;

// State setters
export const setState = {
    setGlobalAdmin: (value) => { isGlobalAdmin = value; },
    setCurrentUsername: (value) => { currentUsername = value; },
    setCurrentRoom: (value) => { currentRoom = value; },
    setGameActive: (value) => { gameActive = value; },
    setSelectedChoice: (value) => { selectedChoice = value; },
    setLockedIn: (value) => { isLockedIn = value; },
    setDomLoaded: (value) => { domLoaded = value; },
    setSigninInProgress: (value) => { signinInProgress = value; }
};

/**
 * Utility function to get current menu context
 * @returns {string} Current menu context
 */
export function getMenuContext() {
    const signDiv = document.getElementById('signDiv');
    const chatDiv = document.getElementById('chatDiv');
    const gameDiv = document.getElementById('gameDiv');
    
    if (signDiv && signDiv.style.display !== 'none') {
        return 'login';
    } else if (chatDiv && chatDiv.style.display !== 'none') {
        return 'chat';
    } else if (gameDiv && gameDiv.style.display !== 'none') {
        return 'game';
    }
    return 'unknown';
}

/**
 * Check if current user is moderator of current room
 * @returns {boolean} True if user is moderator
 */
export function isCurrentRoomModerator() {
    // Implementation would depend on room data structure
    return false; // Placeholder
}

/**
 * Utility function to safely get DOM element
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} DOM element or null
 */
export function getElement(id) {
    return document.getElementById(id);
}

/**
 * Utility function to create DOM element with attributes
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Attributes to set
 * @param {string} textContent - Text content
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'innerHTML') {
            element.innerHTML = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
}

/**
 * Utility function to format currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
    return `$${amount.toFixed(2)}`;
}

/**
 * Utility function to debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Utility function to generate random ID
 * @returns {string} Random ID
 */
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

/**
 * Utility function to validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
export function isValidUsername(username) {
    return username && username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
}

/**
 * Utility function to validate password format
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid
 */
export function isValidPassword(password) {
    return password && password.length >= 6;
}

/**
 * Utility function to safely parse JSON
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed JSON or default value
 */
export function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn('Failed to parse JSON:', error);
        return defaultValue;
    }
}

/**
 * Utility function to copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        // Fallback method
        try {
            const textArea = createElement('textarea', { value: text });
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const result = document.execCommand('copy');
            document.body.removeChild(textArea);
            return result;
        } catch (fallbackError) {
            console.error('Fallback copy method also failed:', fallbackError);
            return false;
        }
    }
}