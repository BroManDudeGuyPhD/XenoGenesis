// ================================================
// CONFIRMATION MODALS MODULE
// End experiment, lightning test, start experiment,
// and pause experiment confirmation dialogs
// ================================================

// Function to show glassmorphic end experiment confirmation
function showEndExperimentConfirmation() {
    // Remove any existing modal
    const existingModal = document.getElementById('endExperimentConfirmModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="endExperimentConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 520px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(220, 38, 127, 0.98) 0%, 
                    rgba(185, 28, 28, 0.95) 100%);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 2px solid rgba(239, 68, 68, 0.4);
                border-radius: 24px;
                box-shadow: 
                    0 30px 100px rgba(185, 28, 28, 0.8),
                    0 15px 50px rgba(0, 0, 0, 0.6),
                    inset 0 2px 0 rgba(255, 255, 255, 0.15);
                padding: 48px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                <!-- Danger gradient bar -->
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-bottom: 30px;
                ">
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: warningBlink 1.5s infinite;
                    "></div>
                    <h2 style="
                        color: #fef2f2; 
                        font-weight: 700; 
                        margin: 0;
                        font-size: 32px;
                        letter-spacing: -0.5px;
                        text-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    ">⚠️ End Experiment</h2>
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: warningBlink 1.5s infinite 0.75s;
                    "></div>
                </div>
                
                <div style="
                    font-size: 64px;
                    margin-bottom: 25px;
                    opacity: 0.95;
                    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
                    animation: iconBounce 3s infinite;
                ">🛑</div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 2px solid rgba(239, 68, 68, 0.4);
                    border-radius: 16px;
                    padding: 24px;
                    margin: 25px 0;
                    backdrop-filter: blur(12px);
                ">
                    <p style="
                        color: #fef2f2; 
                        font-size: 18px; 
                        margin: 0 0 15px 0; 
                        line-height: 1.6;
                        font-weight: 600;
                    ">Are you sure you want to END the experiment?</p>
                    
                    <p style="
                        color: #fca5a5; 
                        font-size: 15px; 
                        margin: 0;
                        line-height: 1.5;
                        font-style: italic;
                    ">This will return all players to global chat and permanently end the room.</p>
                </div>
                
                <div style="
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    margin-top: 35px;
                ">
                    <button onclick="cancelEndExperiment()" style="
                        background: linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%);
                        color: #e5e7eb;
                        padding: 16px 28px;
                        border: 2px solid rgba(156, 163, 175, 0.3);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(55, 65, 81, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 4px 15px rgba(0, 0, 0, 0.3)';
                    ">
                        <span style="font-size: 14px;">❌</span>
                        Cancel
                    </button>
                    
                    <button onclick="confirmEndExperiment()" style="
                        background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%);
                        color: white;
                        padding: 16px 28px;
                        border: 2px solid rgba(239, 68, 68, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 700;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(239, 68, 68, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        animation: dangerButtonPulse 2s infinite;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(185, 28, 28, 1) 0%, rgba(153, 27, 27, 1) 100%)';
                        this.style.transform='translateY(-3px)';
                        this.style.boxShadow='0 8px 25px rgba(239, 68, 68, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.97)'"
                    onmouseup="this.style.transform='translateY(-3px) scale(1)'">
                        <span style="font-size: 14px;">🛑</span>
                        End Experiment
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes dangerPulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            
            @keyframes warningBlink {
                0%, 100% { opacity: 0.5; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.3); }
            }
            
            @keyframes iconBounce {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-8px) scale(1.05); }
            }
            
            @keyframes dangerButtonPulse {
                0%, 100% { box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3); }
                50% { box-shadow: 0 8px 30px rgba(239, 68, 68, 0.8), 0 4px 15px rgba(0, 0, 0, 0.4); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to cancel end experiment
function cancelEndExperiment() {
    const modal = document.getElementById('endExperimentConfirmModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to confirm end experiment
function confirmEndExperiment() {
    console.log('🛑 Moderator ending experiment');
    
    // Close the confirmation modal
    cancelEndExperiment();
    
    // Emit end experiment event to server
    socket.emit('endExperiment', {
        room: currentRoom,
        moderatorAction: true
    });
    
    // Don't redirect immediately - let the server's response events handle the transition
    // The server will send 'experimentEnded' and 'leftRoom' events which will handle the cleanup
    console.log('🛑 End experiment request sent, waiting for server response...');
}

// Function to show Lightning Experiment confirmation modal with magenta theme
function showLightningExperimentConfirmation() {
    // Remove any existing modal
    const existingModal = document.getElementById('lightningExperimentConfirmModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="lightningExperimentConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 520px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(192, 38, 211, 0.98) 0%, 
                    rgba(124, 58, 237, 0.95) 100%);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 2px solid rgba(192, 38, 211, 0.4);
                border-radius: 24px;
                box-shadow: 
                    0 30px 100px rgba(192, 38, 211, 0.8),
                    0 15px 50px rgba(0, 0, 0, 0.6),
                    inset 0 2px 0 rgba(255, 255, 255, 0.15);
                padding: 48px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-bottom: 30px;
                ">
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: lightningBlink 1.5s infinite;
                    "></div>
                    <h2 style="
                        color: #fef2f2; 
                        font-weight: 700; 
                        margin: 0;
                        font-size: 32px;
                        letter-spacing: -0.5px;
                        text-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    ">⚡ Lightning Experiment</h2>
                    <div style="
                        width: 6px;
                        height: 6px;
                        background: linear-gradient(135deg, #fbbf24, #f59e0b);
                        border-radius: 50%;
                        animation: lightningBlink 1.5s infinite 0.75s;
                    "></div>
                </div>
                
                <div style="
                    font-size: 64px;
                    margin-bottom: 25px;
                    opacity: 0.95;
                    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
                    animation: lightningBounce 3s infinite;
                ">⚡</div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 2px solid rgba(192, 38, 211, 0.4);
                    border-radius: 16px;
                    padding: 24px;
                    margin: 25px 0;
                    backdrop-filter: blur(12px);
                ">
                    <p style="
                        color: #fef2f2; 
                        font-size: 18px; 
                        margin: 0 0 15px 0; 
                        line-height: 1.6;
                        font-weight: 600;
                    ">Start a high-speed behavioral experiment?</p>
                    
                    <p style="
                        color: #ddd6fe; 
                        font-size: 15px; 
                        margin: 0;
                        line-height: 1.5;
                        font-style: italic;
                    ">This will add 3 AI players and run a rapid 441-round experiment with accelerated timing and minimal UI for system testing.</p>
                </div>
                
                <div style="
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    margin-top: 35px;
                ">
                    <button onclick="cancelLightningExperiment()" style="
                        background: linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%);
                        color: #e5e7eb;
                        padding: 16px 28px;
                        border: 2px solid rgba(156, 163, 175, 0.3);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(55, 65, 81, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 4px 15px rgba(0, 0, 0, 0.3)';
                    ">
                        <span style="font-size: 14px;">❌</span>
                        Cancel
                    </button>
                    
                    <button onclick="confirmLightningExperiment()" style="
                        background: linear-gradient(135deg, rgba(192, 38, 211, 0.95) 0%, rgba(124, 58, 237, 0.95) 100%);
                        color: white;
                        padding: 16px 28px;
                        border: 2px solid rgba(192, 38, 211, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 700;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(192, 38, 211, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        animation: lightningButtonPulse 2s infinite;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(124, 58, 237, 1) 0%, rgba(147, 51, 234, 1) 100%)';
                        this.style.transform='translateY(-3px)';
                        this.style.boxShadow='0 8px 25px rgba(192, 38, 211, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(192, 38, 211, 0.95) 0%, rgba(124, 58, 237, 0.95) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(192, 38, 211, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.97)'"
                    onmouseup="this.style.transform='translateY(-3px) scale(1)'">
                        <span style="font-size: 14px;">⚡</span>
                        Start Lightning Test
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes lightningPulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            
            @keyframes lightningBlink {
                0%, 100% { opacity: 0.5; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.3); }
            }
            
            @keyframes lightningBounce {
                0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                50% { transform: translateY(-8px) scale(1.05) rotate(5deg); }
            }
            
            @keyframes lightningButtonPulse {
                0%, 100% { box-shadow: 0 6px 20px rgba(192, 38, 211, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3); }
                50% { box-shadow: 0 8px 30px rgba(192, 38, 211, 0.8), 0 4px 15px rgba(0, 0, 0, 0.4); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to cancel Lightning Experiment
function cancelLightningExperiment() {
    const modal = document.getElementById('lightningExperimentConfirmModal');
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
function confirmLightningExperiment() {
    console.log('⚡ Starting Lightning Experiment');
    
    // Close the confirmation modal
    cancelLightningExperiment();
    
    // Emit Lightning Experiment event to server
    socket.emit('runSpeedTest', {
        room: currentRoom,
        lightningMode: true
    });
    
    // Disable the lightning button to prevent multiple clicks
    const lightningBtn = document.getElementById('lightningBtn');
    if (lightningBtn) {
        lightningBtn.disabled = true;
        lightningBtn.textContent = '⚡ Lightning Test Running...';
        lightningBtn.style.opacity = '0.6';
    }
}

// Function to show Start Experiment confirmation modal
function showStartExperimentConfirmation() {
    // Prevent multiple modals
    if (document.getElementById('startExperimentConfirmModal')) {
        return;
    }
    
    const modalHTML = `
        <div id="startExperimentConfirmModal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
            backdrop-filter: blur(8px);
        ">
            <div style="
                background: linear-gradient(135deg, rgba(20, 25, 35, 0.95) 0%, rgba(30, 40, 55, 0.95) 100%);
                border: 2px solid rgba(34, 197, 94, 0.4);
                border-radius: 20px;
                padding: 30px;
                max-width: 450px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 
                    0 25px 50px rgba(0, 0, 0, 0.7),
                    0 12px 25px rgba(34, 197, 94, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                transform-origin: center bottom;
            ">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="
                        font-size: 48px;
                        margin-bottom: 16px;
                        color: #22c55e;
                        text-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
                        filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
                        animation: startBounce 3s infinite;
                    ">🚀</div>
                    
                    <h2 style="
                        color: #22c55e;
                        margin: 0 0 8px 0;
                        font-size: 24px;
                        font-weight: 700;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">Start Experiment</h2>
                    
                    <p style="
                        color: rgba(255, 255, 255, 0.8);
                        margin: 0;
                        font-size: 16px;
                        line-height: 1.4;
                    ">Ready to begin the behavioral experiment?</p>
                </div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 2px solid rgba(34, 197, 94, 0.4);
                    border-radius: 16px;
                    padding: 24px;
                    margin: 25px 0;
                    backdrop-filter: blur(12px);
                ">
                    <div style="
                        color: rgba(255, 255, 255, 0.9);
                        font-size: 15px;
                        line-height: 1.6;
                        margin-bottom: 16px;
                    ">
                        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <span style="color: #22c55e; font-size: 16px;">✅</span>
                            <span>All players will enter the experiment phase</span>
                        </div>
                        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <span style="color: #22c55e; font-size: 16px;">⏱️</span>
                            <span>Timer and rounds will begin automatically</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #22c55e; font-size: 16px;">🎯</span>
                            <span>Experiment settings will be locked in</span>
                        </div>
                    </div>
                    
                    <div style="
                        background: rgba(34, 197, 94, 0.1);
                        border: 1px solid rgba(34, 197, 94, 0.3);
                        border-radius: 12px;
                        padding: 16px;
                        color: rgba(255, 255, 255, 0.85);
                        font-size: 14px;
                        line-height: 1.5;
                    ">
                        <strong style="color: #22c55e;">Note:</strong> Once started, the experiment cannot be paused or modified. Make sure all settings are configured correctly.
                    </div>
                </div>
                
                <div style="
                    display: flex;
                    gap: 16px;
                    margin-top: 30px;
                ">
                    <button onclick="cancelStartExperiment()" style="
                        background: rgba(30, 30, 30, 0.8);
                        color: rgba(255, 255, 255, 0.8);
                        padding: 16px 28px;
                        border: 2px solid rgba(100, 100, 100, 0.4);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s ease;
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    "
                    onmouseover="
                        this.style.background='rgba(50, 50, 50, 0.9)';
                        this.style.borderColor='rgba(150, 150, 150, 0.6)';
                        this.style.color='white';
                    "
                    onmouseout="
                        this.style.background='rgba(30, 30, 30, 0.8)';
                        this.style.borderColor='rgba(100, 100, 100, 0.4)';
                        this.style.color='rgba(255, 255, 255, 0.8)';
                    ">
                        <span style="font-size: 14px;">❌</span>
                        Cancel
                    </button>
                    
                    <button onclick="confirmStartExperiment()" style="
                        background: linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(22, 163, 74, 0.95) 100%);
                        color: white;
                        padding: 16px 28px;
                        border: 2px solid rgba(34, 197, 94, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 700;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(34, 197, 94, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        animation: startButtonPulse 2s infinite;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(22, 163, 74, 1) 0%, rgba(21, 128, 61, 1) 100%)';
                        this.style.transform='translateY(-3px)';
                        this.style.boxShadow='0 8px 25px rgba(34, 197, 94, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(22, 163, 74, 0.95) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(34, 197, 94, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.97)'"
                    onmouseup="this.style.transform='translateY(-3px) scale(1)'">
                        <span style="font-size: 14px;">🚀</span>
                        Start Experiment
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes startBounce {
                0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                50% { transform: translateY(-8px) scale(1.05) rotate(-3deg); }
            }
            
            @keyframes startButtonPulse {
                0%, 100% { box-shadow: 0 6px 20px rgba(34, 197, 94, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3); }
                50% { box-shadow: 0 8px 30px rgba(34, 197, 94, 0.8), 0 4px 15px rgba(0, 0, 0, 0.4); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to cancel Start Experiment
function cancelStartExperiment() {
    const modal = document.getElementById('startExperimentConfirmModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to confirm Start Experiment
function confirmStartExperiment() {
    console.log('🚀 Starting experiment with confirmation');
    
    // Close the confirmation modal
    cancelStartExperiment();
    
    // Emit start game event to server (matches Entity.js startGame handler)
    socket.emit('startGame', { 
        room: currentRoom,
        experimentMode: 'conditions'  // Entity.js expects 'experimentMode', not 'mode'
    });
    
    // Hide UI elements after starting
    const startBtn = document.getElementById('startExperimentBtn');
    if (startBtn) {
        startBtn.style.display = 'none';
    }
    
    // Hide Add AI button if it exists
    const addAIBtn = document.getElementById('addAIBtn');
    if (addAIBtn) {
        addAIBtn.style.display = 'none';
    }
}

function handlePauseExperiment() {
    hideModeratorContextMenu();
    
    const confirmPause = confirm("Are you sure you want to PAUSE the experiment? This will allow you to leave while keeping the room active for other players.");
    
    if (confirmPause) {
        console.log('⏸️ Moderator pausing experiment (leaving room)');
        
        // Regular leave room behavior for moderator (soft-return)
        socket.emit('leaveRoom', "Global");
        console.log('🔄 Moderator soft-returning to landing page (no full navigation)');
        currentRoom = "Global";
        const landingModerator = document.getElementById('landingPage');
        const gameDivModerator = document.getElementById('gameDiv');
        if (landingModerator) landingModerator.style.display = 'block';
        if (gameDivModerator) gameDivModerator.style.display = 'none';
        switchToLoggedOutUI();
        updateLeaveButtonVisibility();
    }
}
