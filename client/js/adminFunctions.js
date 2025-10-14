// Admin Functions Module - Handle moderator-specific functionality
// Part of XenoGenesis Modular Architecture

import { socketManager } from './socketManager.js';

// Get socket instance
const socket = socketManager.getSocket();

// Helper function to get current room
function getCurrentRoom() {
    return window.authModule?.getCurrentRoom() || 'Global';
}

// ===========================================
// LIGHTNING TEST FUNCTIONS
// ===========================================

// Function to show Lightning Test results modal
export function showLightningTestResults(message, stats, duration) {
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
                    gap: 12px;
                    margin-top: 30px;
                    justify-content: center;
                ">
                    <button onclick="window.adminFunctions.closeLightningTestResults()" style="
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
export function closeLightningTestResults() {
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

// Function to show Lightning Test progress modal
export function showLightningTestProgressModal(data) {
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
                        ">💰 TOTAL EARNINGS</div>
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
export function updateLightningTestProgress(data) {
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
export function closeLightningTestProgressModal() {
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

// Function to show Lightning Experiment confirmation modal with magenta theme
export function showLightningExperimentConfirmation() {
    const modalHTML = `
        <div id="lightningConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
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
                    ">Lightning Experiment</h2>
                </div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 1px solid rgba(192, 38, 211, 0.3);
                    border-radius: 16px;
                    padding: 20px;
                    margin: 20px 0;
                    backdrop-filter: blur(10px);
                ">
                    <p style="
                        color: #dcddde; 
                        font-size: 16px; 
                        margin: 0 0 15px 0; 
                        line-height: 1.5;
                        font-weight: 500;
                    ">This will run a rapid 441-round experiment (7 blocks × 63 rounds) with automated decision making.</p>
                    
                    <div style="
                        background: rgba(192, 38, 211, 0.1);
                        border: 1px solid rgba(192, 38, 211, 0.3);
                        border-radius: 8px;
                        padding: 12px;
                        margin: 15px 0;
                    ">
                        <p style="
                            color: #e879f9; 
                            font-size: 14px; 
                            margin: 0;
                            font-weight: 500;
                        ">⚠️ This test is designed for performance testing and will complete very quickly.</p>
                    </div>
                    
                    <p style="
                        color: #b9bbbe; 
                        font-size: 14px; 
                        margin: 0;
                        opacity: 0.8;
                        line-height: 1.4;
                    ">All decisions will be automated and results will be displayed at the end.</p>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                    <button onclick="window.adminFunctions.confirmLightningExperiment()" style="
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
                        <span style="font-size: 14px;">⚡</span>
                        Start Lightning Test
                    </button>
                    <button onclick="window.adminFunctions.cancelLightningExperiment()" style="
                        background: rgba(114, 118, 125, 0.2);
                        color: #b9bbbe;
                        padding: 15px 28px;
                        border: 1px solid rgba(114, 118, 125, 0.4);
                        border-radius: 12px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        backdrop-filter: blur(10px);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    "
                    onmouseover="
                        this.style.background='rgba(114, 118, 125, 0.3)';
                        this.style.borderColor='rgba(114, 118, 125, 0.6)';
                        this.style.color='#dcddde';
                        this.style.transform='translateY(-1px)';
                    "
                    onmouseout="
                        this.style.background='rgba(114, 118, 125, 0.2)';
                        this.style.borderColor='rgba(114, 118, 125, 0.4)';
                        this.style.color='#b9bbbe';
                        this.style.transform='translateY(0)';
                    ">
                        <span style="font-size: 14px;">❌</span>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to cancel Lightning Experiment
export function cancelLightningExperiment() {
    const modal = document.getElementById('lightningConfirmModal');
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
export function confirmLightningExperiment() {
    // Close the confirmation modal
    cancelLightningExperiment();
    
    // Emit the lightning experiment request to the server
    const room = getCurrentRoom();
    socket.emit('runSpeedTest', {
        room: room,
        lightningMode: true
    });
    
    console.log('⚡ Lightning experiment requested for room:', room);
}

// ===========================================
// MODERATOR CONTEXT MENU FUNCTIONS
// ===========================================

// Moderator Context Menu Functions
export function showModeratorContextMenu() {
    const menu = document.getElementById('moderatorContextMenu');
    if (menu) {
        menu.style.display = 'block';
        menu.style.opacity = '0';
        menu.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            menu.style.transition = 'all 0.2s ease-out';
            menu.style.opacity = '1';
            menu.style.transform = 'scale(1)';
        }, 10);
    }
}

export function hideModeratorContextMenu() {
    const menu = document.getElementById('moderatorContextMenu');
    if (menu) {
        menu.style.opacity = '0';
        menu.style.transform = 'scale(0.95)';
        setTimeout(() => {
            menu.style.display = 'none';
        }, 200);
    }
}

export function setupModeratorMenuHandlers() {
    // Set up event handlers for moderator context menu
    const contextMenuButton = document.getElementById('moderatorContextButton');
    const contextMenu = document.getElementById('moderatorContextMenu');
    
    if (contextMenuButton && contextMenu) {
        contextMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = contextMenu.style.display === 'block';
            if (isVisible) {
                hideModeratorContextMenu();
            } else {
                showModeratorContextMenu();
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target) && !contextMenuButton.contains(e.target)) {
                hideModeratorContextMenu();
            }
        });
    }
}

// ===========================================
// SWITCHBOARD FUNCTIONS
// ===========================================

export function initializeSwitchboardFunctions() {
    console.log('🎛️ Initializing moderator switchboard functions...');
    
    // Initialize column mode toggle
    const autoColumnToggle = document.getElementById('autoColumnToggleSwitch');
    if (autoColumnToggle) {
        autoColumnToggle.addEventListener('change', function() {
            const mode = this.checked ? 'auto' : 'manual';
            console.log(`🎛️ Column mode changed to: ${mode}`);
            
            // Emit to server
            socket.emit('setColumnMode', { mode: mode });
            
            // Update UI
            const manualColumnGrid = document.getElementById('manualColumnGrid');
            const selectedColumnIndicator = document.getElementById('selectedColumnIndicator');
            
            if (this.checked) {
                // Auto mode
                if (manualColumnGrid) manualColumnGrid.style.display = 'none';
                if (selectedColumnIndicator) selectedColumnIndicator.textContent = 'AUTO MODE';
            } else {
                // Manual mode
                if (manualColumnGrid) manualColumnGrid.style.display = 'block';
                if (selectedColumnIndicator) selectedColumnIndicator.textContent = 'MANUAL MODE';
            }
        });
    }
    
    // Initialize column selection buttons
    const columnButtons = document.querySelectorAll('.column-button');
    columnButtons.forEach(button => {
        button.addEventListener('click', function() {
            const column = this.getAttribute('data-column');
            console.log(`🎛️ Manual column selected: ${column}`);
            
            // Emit to server
            socket.emit('selectColumn', { column: column });
            
            // Update UI
            const selectedColumnIndicator = document.getElementById('selectedColumnIndicator');
            if (selectedColumnIndicator) {
                selectedColumnIndicator.textContent = `COLUMN ${column}`;
            }
            
            // Visual feedback
            columnButtons.forEach(btn => btn.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    
    // Initialize condition dropdown
    const conditionSelect = document.getElementById('experimentalCondition');
    if (conditionSelect) {
        conditionSelect.addEventListener('change', function() {
            const condition = this.value;
            if (condition) {
                console.log(`🧪 Manual condition set: ${condition}`);
                socket.emit('setCondition', { condition: condition });
            }
        });
    }
    
    // Initialize incentive switches
    const incentivePlayerSwitch = document.getElementById('incentivePlayerSwitch');
    const incentiveTypeSwitch = document.getElementById('incentiveTypeSwitch');
    
    if (incentivePlayerSwitch) {
        incentivePlayerSwitch.addEventListener('change', function() {
            updateIncentiveStatus();
        });
    }
    
    if (incentiveTypeSwitch) {
        incentiveTypeSwitch.addEventListener('change', function() {
            updateIncentiveStatus();
        });
    }
    
    // Initialize clock update
    updateSwitchboardClock();
    setInterval(updateSwitchboardClock, 1000);
    
    console.log('✅ Switchboard functions initialized');
}

function updateIncentiveStatus() {
    const playerSwitch = document.getElementById('incentivePlayerSwitch');
    const typeSwitch = document.getElementById('incentiveTypeSwitch');
    
    if (playerSwitch && typeSwitch) {
        const player = playerSwitch.value;
        const type = typeSwitch.value;
        
        if (player && type) {
            console.log(`🎁 Setting incentive: ${player} - ${type}`);
            socket.emit('setIncentive', { 
                player: player, 
                type: type 
            });
        } else {
            console.log('🎁 Clearing incentive');
            socket.emit('clearIncentive');
        }
    }
}

export function updateSwitchboardClock() {
    const clockElement = document.getElementById('switchboardClock');
    if (clockElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        clockElement.textContent = timeString;
    }
}

// ===========================================
// BASELINE EXIT NOTIFICATION
// ===========================================

// Function to show baseline exit notification to moderators
export function showBaselineExitNotification(turnNumber) {
    // Check if user is moderator
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    
    if (!isModerator) return;
    
    const notification = document.getElementById('baselineExitNotification');
    const notificationText = document.getElementById('baselineExitText');
    
    if (notification && notificationText) {
        // Use current round if turnNumber is 0 or invalid
        const displayTurn = turnNumber > 0 ? turnNumber : window.currentRoundNumber || 0;
        notificationText.textContent = `Baseline condition exited on turn ${displayTurn}`;
        notification.style.display = 'block';
        console.log('🎯 Baseline exit notification displayed for turn:', displayTurn);
        
        // Add a subtle animation to draw attention
        notification.style.transform = 'scale(0.95)';
        setTimeout(() => {
            notification.style.transform = 'scale(1)';
        }, 100);
    }
}

// ===========================================
// COLUMN HOVER EFFECTS
// ===========================================

// Function to add column hover effects for moderators
export function addColumnHoverEffects() {
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

// ===========================================
// GLOBAL EXPORTS FOR WINDOW ACCESS
// ===========================================

// Export functions to global scope for compatibility
if (typeof window !== 'undefined') {
    window.adminFunctions = {
        showLightningTestResults,
        closeLightningTestResults,
        showLightningTestProgressModal,
        updateLightningTestProgress,
        closeLightningTestProgressModal,
        showLightningExperimentConfirmation,
        cancelLightningExperiment,
        confirmLightningExperiment,
        showModeratorContextMenu,
        hideModeratorContextMenu,
        setupModeratorMenuHandlers,
        initializeSwitchboardFunctions,
        updateSwitchboardClock,
        showBaselineExitNotification,
        addColumnHoverEffects
    };
}

// Initialize admin functions when module loads
export function initializeAdminFunctions() {
    console.log('👑 Initializing admin functions module...');
    setupModeratorMenuHandlers();
}

console.log('👑 Admin functions module loaded');