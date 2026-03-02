// ================================================
// RESULTS PANEL MODULE
// Round results display panel for moderators and players
// ================================================

// Initialize round results panel with waiting state (called when game starts)
function initializeRoundResultsPanel() {
    const roundResultsPanels = document.querySelectorAll('.roundResultsPanel');
    const conversionRateInfos = document.querySelectorAll('.conversionRateInfo');
    
    // Show the panels with initial waiting state
    roundResultsPanels.forEach(element => {
        if (element.querySelector('.conversionRateInfo')) {
            element.style.display = 'block';
        }
    });
    
    // Set initial content
    const initialHTML = `
        <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-width: 400px;">
            <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 16px; text-align: center;">
                <div style="color: #b9bbbe; font-size: 14px; margin-bottom: 10px;">
                    <i class="fas fa-hourglass-half" style="margin-right: 8px; animation: pulse 1.5s ease infinite;"></i>
                    Waiting for first round...
                </div>
                <div style="display: flex; justify-content: center; gap: 30px; opacity: 0.5;">
                    <div style="text-align: center;">
                        <div style="font-size: 24px;">⚪</div>
                        <div style="color: #43b581; font-size: 16px; font-weight: 600;">--</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 24px;">⚫</div>
                        <div style="color: #e74c3c; font-size: 16px; font-weight: 600;">--</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    conversionRateInfos.forEach(element => {
        element.innerHTML = initialHTML;
    });
    
    // Hide the title/message since we're showing the panel
    document.querySelectorAll('.roundResultsTitle').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.roundResults').forEach(el => el.style.display = 'none');
    
    console.log('📊 Initialized round results panel with waiting state');
}

// Update Round Results Panel for Moderators
function updateRoundResultsPanel(roundData) {
    console.log('🔍 Updating round results panel:', roundData);
    
    const roundResultsTitles = document.querySelectorAll('.roundResultsTitle');
    const roundResults = document.querySelectorAll('.roundResults');
    const roundResultsPanels = document.querySelectorAll('.roundResultsPanel');
    const roundSummaries = document.querySelectorAll('.roundSummary');
    const playerResultsTables = document.querySelectorAll('.playerResultsTable');
    const conversionRateInfos = document.querySelectorAll('.conversionRateInfo');
    const roundTotals = document.querySelectorAll('.roundTotals');
    
    // Check if current user is moderator
    const moderatorSwitchboard = document.getElementById('moderatorSwitchboard');
    const isModerator = moderatorSwitchboard && moderatorSwitchboard.style.display === 'block';
    
    if (roundResultsTitles.length === 0 || roundResultsPanels.length === 0) {
        console.warn('⚠️ Round results panel elements not found');
        return;
    }
    
    // Hide waiting message and show panel for all versions
    roundResults.forEach(element => element.style.display = 'none');
    roundResultsTitles.forEach(element => element.style.display = 'none');
    
    // Only show panel if there's actual data to display
    const hasData = (conversionRateInfos.length > 0 && roundData.previousRoundPlayers) || 
                    (playerResultsTables.length > 0 && roundData.players && isModerator);
    
    if (hasData) {
        // Only show roundResultsPanels that contain data for this user's role
        if (isModerator && playerResultsTables.length > 0 && roundData.players) {
            // Show panel containing cumulative data for moderators
            roundResultsPanels.forEach(element => {
                if (element.querySelector('.playerResultsTable')) {
                    element.style.display = 'block';
                }
            });
        }
        if (conversionRateInfos.length > 0 && roundData.previousRoundPlayers) {
            // Show panel containing round results for everyone
            roundResultsPanels.forEach(element => {
                if (element.querySelector('.conversionRateInfo')) {
                    element.style.display = 'block';
                }
            });
        }
    }
    
    // 1. Show Cumulative Totals first - MODERATOR ONLY
    if (playerResultsTables.length > 0 && roundData.players && isModerator) {
        const totalWhite = roundData.players.reduce((sum, p) => sum + (p.whiteTokens || 0), 0);
        const totalBlack = roundData.players.reduce((sum, p) => sum + (p.blackTokens || 0), 0);
        const totalEarnings = roundData.players.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);
        
        // Sort players by their seat position (left-to-right: left, top, right)
        const seatOrder = { 'left': 1, 'top': 2, 'right': 3 };
        const sortedPlayers = [...roundData.players].sort((a, b) => {
            const seatA = seatOrder[a.seatPosition] || 999;
            const seatB = seatOrder[b.seatPosition] || 999;
            return seatA - seatB;
        });
        
        let tableHTML = `
            <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-height: 280px; overflow-y: auto;">
                <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                    <div style="color: #ffffff; font-weight: 600; font-size: 13px; margin-bottom: 8px;">Cumulative Player Earnings</div>
                    <div style="display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; font-size: 12px;">
                        <div style="color: #b9bbbe; font-weight: 500;">Player</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚪</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚫</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">Total $</div>
        `;
        
        // Add individual player rows in correct order
        sortedPlayers.forEach(player => {
            const whiteTokens = player.whiteTokens || 0;
            const blackTokens = player.blackTokens || 0;
            const totalEarnings = player.totalEarnings || 0;
            const isAI = player.isAI ? ' (AI)' : '';
            
            tableHTML += `
                <div style="color: #ffffff;">${player.username}${isAI}</div>
                <div style="color: #43b581; text-align: right;">${whiteTokens}</div>
                <div style="color: #e74c3c; text-align: right;">${blackTokens}</div>
                <div style="color: #faa61a; text-align: right; font-weight: 500;">$${totalEarnings.toFixed(2)}</div>
            `;
        });
        
        // Add separator line and totals row
        tableHTML += `
                    <div style="grid-column: 1 / -1; height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
                    <div style="color: #ffffff; font-weight: 600;">EXPERIMENT TOTALS</div>
                    <div style="color: #43b581; text-align: right; font-weight: 600;">${totalWhite}</div>
                    <div style="color: #e74c3c; text-align: right; font-weight: 600;">${totalBlack}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 600;">$${totalEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
        `;
        
        console.log('📊 Populating cumulative earnings table for moderator');
        playerResultsTables.forEach(element => {
            element.innerHTML = tableHTML;
        });
    } else {
        console.log('📊 Skipping cumulative earnings table - not moderator or no data');
    }
    
    // 2. Show Previous Round second - update all versions
    // For non-moderators, only show their own results
    if (conversionRateInfos.length > 0 && roundData.previousRoundPlayers) {
        const previousRoundNumber = roundData.round;
        
        // Find current player's data
        const currentPlayerData = roundData.previousRoundPlayers.find(p => p.username === currentUsername);
        
        let previousDistributionHTML = `
            <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-height: 280px; overflow-y: auto; max-width: 400px;">
                <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                    <div style="color: #ffffff; font-weight: 600; font-size: 13px; margin-bottom: 8px;">Round <span style="color: #43b581;">${previousRoundNumber}</span> Results</div>`;
        
        // Add token values subheader if available
        if (roundData.tokenValues) {
            previousDistributionHTML += `
                <div style="color: #dcddde; font-size: 11px; margin-bottom: 8px; padding: 6px 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-around; gap: 12px;">
                        <span style="display: flex; align-items: center; gap: 4px;">⚪ $${roundData.tokenValues.white?.toFixed(2) || '0.00'}</span>
                        <span style="display: flex; align-items: center; gap: 4px;">⚫ $${roundData.tokenValues.black?.toFixed(2) || '0.00'}</span>
                    </div>
                </div>`;
        }
        
        // Check if moderator - moderators see all players, non-moderators only see themselves
        if (isModerator) {
            // Moderator view - show all players
            previousDistributionHTML += `
                <div style="display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; font-size: 12px;">
                    <div style="color: #b9bbbe; font-weight: 500;">Player</div>
                    <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚪</div>
                    <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚫</div>
                    <div style="color: #b9bbbe; font-weight: 500; text-align: right;">Round $</div>
            `;
            
            // Sort players by their seat position (left-to-right: left, top, right)
            const seatOrder = { 'left': 1, 'top': 2, 'right': 3 };
            const sortedPreviousPlayers = [...roundData.previousRoundPlayers].sort((a, b) => {
                const seatA = seatOrder[a.seatPosition] || 999;
                const seatB = seatOrder[b.seatPosition] || 999;
                return seatA - seatB;
            });
            
            // Calculate totals for previous round
            let prevTotalWhite = 0;
            let prevTotalBlack = 0;
            let prevTotalRoundEarnings = 0;
            
            sortedPreviousPlayers.forEach(player => {
                const whiteTokens = player.whiteTokens || 0;
                const blackTokens = player.blackTokens || 0;
                const incentiveBonus = player.incentiveBonus || 0;
                const totalBlackTokens = blackTokens + incentiveBonus;
                const roundEarnings = player.roundEarnings || 0;
                const isAI = player.isAI ? ' (AI)' : '';
                
                prevTotalWhite += whiteTokens;
                prevTotalBlack += totalBlackTokens;
                prevTotalRoundEarnings += roundEarnings;
                
                previousDistributionHTML += `
                    <div style="color: #ffffff;">${player.username}${isAI}</div>
                    <div style="color: #43b581; text-align: right;">${whiteTokens}</div>
                    <div style="color: #e74c3c; text-align: right;">${totalBlackTokens}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 500;">$${roundEarnings.toFixed(2)}</div>
                `;
            });
            
            // Add totals row for previous round
            previousDistributionHTML += `
                    <div style="grid-column: 1 / -1; height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
                    <div style="color: #ffffff; font-weight: 600;">ROUND TOTALS</div>
                    <div style="color: #43b581; text-align: right; font-weight: 600;">${prevTotalWhite}</div>
                    <div style="color: #e74c3c; text-align: right; font-weight: 600;">${prevTotalBlack}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 600;">$${prevTotalRoundEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
            `;
        } else if (currentPlayerData) {
            // Non-moderator view - only show their own results
            const whiteTokens = currentPlayerData.whiteTokens || 0;
            const blackTokens = currentPlayerData.blackTokens || 0;
            const incentiveBonus = currentPlayerData.incentiveBonus || 0;
            const totalBlackTokens = blackTokens + incentiveBonus;
            const roundEarnings = currentPlayerData.roundEarnings || 0;
            
            previousDistributionHTML += `
                <div style="text-align: center; padding: 10px 0;">
                    <div style="color: #b9bbbe; font-size: 11px; margin-bottom: 8px;">Your Earnings last Round</div>
                    <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 10px;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px;">⚪</div>
                            <div style="color: #43b581; font-size: 18px; font-weight: 600;">${whiteTokens}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px;">⚫</div>
                            <div style="color: #e74c3c; font-size: 18px; font-weight: 600;">${totalBlackTokens}</div>
                        </div>
                    </div>
                    <div style="color: #faa61a; font-size: 20px; font-weight: 600;">+$${roundEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
            `;
        } else {
            // Fallback if player data not found
            previousDistributionHTML += `
                <div style="text-align: center; padding: 10px 0; color: #b9bbbe;">
                    Waiting for results...
                </div>
            </div>
            </div>
            `;
        }
        
        conversionRateInfos.forEach(element => {
            element.innerHTML = previousDistributionHTML;
        });
    }
    
    // 2. SWAPPED: Show Cumulative Totals - MODERATOR ONLY (non-moderators see their own data in the round results above)
    if (playerResultsTables.length > 0 && roundData.players && isModerator) {
        const totalWhite = roundData.players.reduce((sum, p) => sum + (p.whiteTokens || 0), 0);
        const totalBlack = roundData.players.reduce((sum, p) => sum + (p.blackTokens || 0), 0);
        const totalEarnings = roundData.players.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);
        
        // Sort players by their seat position (left-to-right: left, top, right)
        const seatOrder = { 'left': 1, 'top': 2, 'right': 3 };
        const sortedPlayers = [...roundData.players].sort((a, b) => {
            const seatA = seatOrder[a.seatPosition] || 999;
            const seatB = seatOrder[b.seatPosition] || 999;
            return seatA - seatB;
        });
        
        let tableHTML = `
            <div style="background: rgba(64, 68, 75, 0.8); backdrop-filter: blur(12px); border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); border: 1px solid rgba(114, 118, 125, 0.2); max-height: 280px; overflow-y: auto;">
                <div style="background: rgba(40, 43, 48, 0.6); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                    <div style="color: #ffffff; font-weight: 600; font-size: 13px; margin-bottom: 8px;">Cumulative Player Earnings</div>
                    <div style="display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; font-size: 12px;">
                        <div style="color: #b9bbbe; font-weight: 500;">Player</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚪</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">⚫</div>
                        <div style="color: #b9bbbe; font-weight: 500; text-align: right;">Total $</div>
        `;
        
        // Add individual player rows in correct order
        sortedPlayers.forEach(player => {
            const whiteTokens = player.whiteTokens || 0;
            const blackTokens = player.blackTokens || 0;
            const totalEarnings = player.totalEarnings || 0;
            const isAI = player.isAI ? ' (AI)' : '';
            
            tableHTML += `
                <div style="color: #ffffff;">${player.username}${isAI}</div>
                <div style="color: #43b581; text-align: right;">${whiteTokens}</div>
                <div style="color: #e74c3c; text-align: right;">${blackTokens}</div>
                <div style="color: #faa61a; text-align: right; font-weight: 500;">$${totalEarnings.toFixed(2)}</div>
            `;
        });
        
        // Add separator line and totals row
        tableHTML += `
                    <div style="grid-column: 1 / -1; height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
                    <div style="color: #ffffff; font-weight: 600;">EXPERIMENT TOTALS</div>
                    <div style="color: #43b581; text-align: right; font-weight: 600;">${totalWhite}</div>
                    <div style="color: #e74c3c; text-align: right; font-weight: 600;">${totalBlack}</div>
                    <div style="color: #faa61a; text-align: right; font-weight: 600;">$${totalEarnings.toFixed(2)}</div>
                </div>
            </div>
            </div>
        `;
        
        playerResultsTables.forEach(element => {
            element.innerHTML = tableHTML;
        });
    }
    
    // Hide the separate round totals section since it's now integrated - update all versions
    roundTotals.forEach(element => {
        element.style.display = 'none';
    });
}
