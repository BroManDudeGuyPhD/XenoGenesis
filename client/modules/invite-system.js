// ================================================
// INVITE SYSTEM MODULE
// Invite code generation, permanent invite setup,
// and moderator context menu
// ================================================

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
