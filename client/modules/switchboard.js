// ================================================
// SWITCHBOARD MODULE
// Moderator control panel setup, info tooltips, clock
// ================================================

// Initialize switchboard functionality
function initializeSwitchboardFunctions() {
    // Update switchboard clock
    updateSwitchboardClock();
    setInterval(updateSwitchboardClock, 1000);
    
    // Collapsible header functionality
    const switchboardHeader = document.getElementById('switchboardHeader');
    const switchboardGrid = document.getElementById('switchboardGrid');
    const collapseIndicator = document.getElementById('collapseIndicator');
    
    if (switchboardHeader && switchboardGrid && collapseIndicator) {
        // Check if already initialized to prevent re-initialization
        if (switchboardHeader.dataset.initialized === 'true') {
            return; // Already initialized, skip
        }
        switchboardHeader.dataset.initialized = 'true';
        
        let isCollapsed = true; // Start collapsed on first load
        
        // Set initial collapsed state only on first initialization
        switchboardGrid.classList.add('collapsed');
        collapseIndicator.style.transform = 'translateY(-50%) rotate(180deg)';
        
        switchboardHeader.addEventListener('click', function() {
            isCollapsed = !isCollapsed;
            
            if (isCollapsed) {
                // Collapsing
                switchboardGrid.classList.remove('expanding');
                switchboardGrid.classList.add('collapsing');
                collapseIndicator.style.transform = 'translateY(-50%) rotate(180deg)';
                
                setTimeout(() => {
                    switchboardGrid.classList.add('collapsed');
                    switchboardGrid.classList.remove('collapsing');
                }, 400);
            } else {
                // Expanding
                switchboardGrid.classList.remove('collapsed', 'collapsing');
                switchboardGrid.classList.add('expanding');
                collapseIndicator.style.transform = 'translateY(-50%) rotate(0deg)';
                
                setTimeout(() => {
                    switchboardGrid.classList.remove('expanding');
                }, 500);
            }
        });
    }
    
    // Auto column toggle functionality
    const autoToggle = document.getElementById('autoColumnToggleSwitch');
    const manualGrid = document.getElementById('manualColumnGrid');
    const indicator = document.getElementById('selectedColumnIndicator');
    
    if (autoToggle && manualGrid && indicator) {
        autoToggle.addEventListener('change', function() {
            if (this.checked) {
                manualGrid.style.display = 'none';
                indicator.textContent = 'AUTO MODE';
                socket.emit('setColumnMode', { mode: 'auto' });
            } else {
                manualGrid.style.display = 'block';
                indicator.textContent = 'MANUAL MODE';
                socket.emit('setColumnMode', { mode: 'manual' });
            }
        });
    }
    
    // Column button functionality
    document.querySelectorAll('.column-btn').forEach(button => {
        button.addEventListener('click', function() {
            const column = this.getAttribute('data-column');
            // Remove active class from all buttons
            document.querySelectorAll('.column-btn').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Update indicator
            if (indicator) indicator.textContent = `SELECTED: ${column}`;
            // Notify server
            socket.emit('selectColumn', { column: column });
        });
    });
    
    // Experiment control buttons
    const applyButton = document.getElementById('applyFastForwardSwitch');
    const statusDisplay = document.getElementById('experimentStatusSwitch');
    const phaseStatus = document.getElementById('phaseStatusSwitch');
    
    if (applyButton) {
        applyButton.addEventListener('click', function() {
            const tokensInput = document.getElementById('fastForwardTokensSwitch');
            const tokens = parseInt(tokensInput.value);
            if (tokens >= 0 && tokens <= TOKEN_CONFIG.MAX_TOKENS) {
                socket.emit('setTokenPool', { tokens: tokens });
                if (statusDisplay) statusDisplay.textContent = `Token pool set to ${tokens}`;
            }
        });
    }
    
    // Quick token buttons
    const setLowTokensBtn = document.getElementById('setLowTokensSwitch');
    const setMidTokensBtn = document.getElementById('setMidTokensSwitch');
    const setHighTokensBtn = document.getElementById('setHighTokensSwitch');
    
    if (setLowTokensBtn) {
        setLowTokensBtn.addEventListener('click', function() {
            socket.emit('setTokenPool', { tokens: 50 });
            if (statusDisplay) statusDisplay.textContent = 'Token pool set to 50 (low)';
        });
    }
    
    if (setMidTokensBtn) {
        setMidTokensBtn.addEventListener('click', function() {
            socket.emit('setTokenPool', { tokens: 500 });
            if (statusDisplay) statusDisplay.textContent = 'Token pool set to 500 (medium)';
        });
    }
    
    if (setHighTokensBtn) {
        setHighTokensBtn.addEventListener('click', function() {
            socket.emit('setTokenPool', { tokens: 1500 });
            if (statusDisplay) statusDisplay.textContent = 'Token pool set to 1500 (high)';
        });
    }
    
    const forceTransitionBtn = document.getElementById('forceBaselineTransitionSwitch');
    if (forceTransitionBtn) {
        forceTransitionBtn.addEventListener('click', function() {
            socket.emit('forcePhaseTransition');
            if (phaseStatus) phaseStatus.textContent = 'Forcing baseline → conditions transition...';
        });
    }
    
    const endExperimentBtn = document.getElementById('endExperimentSwitch');
    if (endExperimentBtn) {
        endExperimentBtn.addEventListener('click', function() {
            handleEndExperiment(); // Use the same function as the leave room menu
        });
    }
    
    // AI behavior control
    const aiBehaviorSelect = document.getElementById('aiBehaviorModeSwitch');
    const specificRowInput = document.getElementById('specificRowNumberSwitch');
    
    if (aiBehaviorSelect && specificRowInput) {
        aiBehaviorSelect.addEventListener('change', function() {
            const mode = this.value;
            console.log(`🤖 AI behavior mode changed to: ${mode}`);
            
            if (this.value === 'specific_row') {
                specificRowInput.style.display = 'block';
            } else {
                specificRowInput.style.display = 'none';
            }
            
            // Send behavior change to server
            const rowNumber = mode === 'specific_row' ? parseInt(specificRowInput.value) || 1 : null;
            socket.emit('setAIBehavior', {
                room: currentRoom,
                mode: mode,
                specificRow: rowNumber
            });
        });
        
        // Handle specific row input changes
        specificRowInput.addEventListener('input', function() {
            if (aiBehaviorSelect.value === 'specific_row') {
                const rowNumber = parseInt(this.value) || 1;
                console.log(`🤖 AI specific row changed to: ${rowNumber}`);
                socket.emit('setAIBehavior', {
                    room: currentRoom,
                    mode: 'specific_row',
                    specificRow: rowNumber
                });
            }
        });
    }
    
    // Preset message buttons
    document.querySelectorAll('.preset-msg-btn').forEach(button => {
        button.addEventListener('click', function() {
            const message = this.getAttribute('data-msg');
            const messageInput = document.getElementById('systemMessageTextSwitch');
            if (messageInput) {
                messageInput.value = message;
            }
        });
    });
    
    // Info button functionality
    initializeInfoTooltips();
}

// Initialize info tooltip system
function initializeInfoTooltips() {
    const tooltip = document.getElementById('infoTooltip');
    const tooltipText = document.getElementById('tooltipText');
    const closeBtn = document.querySelector('.tooltip-close');
    
    const infoContent = {
        'game-controls': 'Control core game mechanics including column selection mode (auto/manual) and experiment phase transitions. Use these controls to manage the flow of the experiment.',
        'column-selection': 'AUTO MODE: System randomly selects columns each round. MANUAL MODE: You choose which column is active for each round using the buttons below.',
        'phase-control': 'Manage experiment phases. BASELINE→CONDITIONS forces transition from baseline phase to conditions phase. END EXPERIMENT terminates the current session.',
        'experiment-controls': 'Manage token pools and experimental conditions. Lower token counts advance phases faster. Different conditions have different payment structures.',
        'token-pool': 'Adjust the global token pool to control experiment pacing. Lower values (50-500) speed up transitions between phases. Higher values (1000+) slow down progression.',
        'conditions': 'Payment structures: Baseline (standard), High Culturant (higher group bonus), High Operant (higher individual bonus), Equal C-O (balanced bonuses).',
        'system-debug': 'Advanced system controls for testing and debugging. Use preset messages for common announcements.',
        'ai-behavior': 'Control how AI players make decisions. Use for testing specific scenarios or forcing particular behavioral patterns.',
        'system-messages': 'Send messages to all players. Use preset buttons for common messages or type custom announcements.',
        'system-controls': 'PAUSE: Stops AI decision-making. RESUME: Restarts AI. RESET: Restarts the current round.',
        'incentives': 'Set special bonus conditions for players. Performance, collaboration, consistency, and leadership bonuses available.',
        'csv-export': 'Download comprehensive experiment data including player choices, payoffs, timestamps, and behavioral metrics. Available during active experiments or after completion. Data includes ODD/EVEN choices, individual/group rewards, AI decisions, and round-by-round progression.'
    };
    
    document.querySelectorAll('.info-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const infoKey = this.getAttribute('data-info');
            const content = infoContent[infoKey] || 'Information not available.';
            
            if (tooltipText) tooltipText.textContent = content;
            if (tooltip) {
                // Position tooltip near the clicked button
                const rect = this.getBoundingClientRect();
                tooltip.style.position = 'fixed';
                tooltip.style.left = (rect.left + rect.width + 10) + 'px';
                tooltip.style.top = rect.top + 'px';
                tooltip.style.transform = 'none';
                tooltip.style.display = 'block';
            }
        });
    });
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            if (tooltip) tooltip.style.display = 'none';
        });
    }
    
    // Close tooltip when clicking anywhere outside of it
    document.addEventListener('click', function(e) {
        if (tooltip && tooltip.style.display === 'block') {
            if (!tooltip.contains(e.target) && !e.target.classList.contains('info-btn')) {
                tooltip.style.display = 'none';
            }
        }
    });
}

// Update switchboard clock
function updateSwitchboardClock() {
    const clock = document.getElementById('switchboardClock');
    if (clock) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        clock.textContent = timeString;
    }
}
