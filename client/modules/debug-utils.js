// ================================================
// DEBUG UTILITIES MODULE
// DOM state debugging, header visibility fixes,
// and card visibility debug functions
// ================================================

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
