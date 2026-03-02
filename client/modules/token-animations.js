// ================================================
// TOKEN ANIMATIONS MODULE
// Token flying animations for round results
// and incentive bonus tokens
// ================================================

// Immediate Incentive Token Animation - spawns from incentive banner and flies to wallet
function showIncentiveTokenAnimation(blackTokens) {
    if (blackTokens <= 0) return;
    
    // Get source position (incentive banner or notification area)
    const incentiveBanner = document.getElementById('incentiveBanner');
    const notificationArea = document.getElementById('pokerTableNotificationArea');
    const sourceEl = incentiveBanner || notificationArea;
    
    // Get destination (black token wallet)
    const blackWalletEl = document.getElementById('blackTokens');
    
    if (!sourceEl || !blackWalletEl) {
        console.log('🎁 Incentive animation: Could not find source/destination elements');
        return;
    }
    
    const sourceRect = sourceEl.getBoundingClientRect();
    const destRect = blackWalletEl.getBoundingClientRect();
    
    // Source: center of incentive banner
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    
    // Add animation styles if not present
    let style = document.getElementById('incentiveTokenAnimStyle');
    if (!style) {
        style = document.createElement('style');
        style.id = 'incentiveTokenAnimStyle';
        style.textContent = `
            .incentive-flying-token {
                position: fixed;
                font-size: 32px;
                pointer-events: none;
                z-index: 100000;
                opacity: 0;
                filter: drop-shadow(0 0 10px rgba(0, 255, 0, 0.8)) drop-shadow(0 0 20px rgba(0, 255, 0, 0.5));
            }
            
            @keyframes incentiveTokenSpawn {
                0% { opacity: 0; transform: scale(0); }
                60% { opacity: 1; transform: scale(1.3); }
                100% { opacity: 1; transform: scale(1); }
            }
            
            @keyframes incentiveTokenFly {
                0% { 
                    opacity: 1; 
                    transform: scale(1); 
                }
                50% { 
                    opacity: 1; 
                    transform: scale(1.1) translateY(-15px); 
                }
                100% { 
                    opacity: 0; 
                    transform: scale(0.6); 
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Create and animate tokens
    for (let i = 0; i < blackTokens; i++) {
        const token = document.createElement('div');
        token.className = 'incentive-flying-token';
        token.textContent = '⚫';
        token.style.left = `${sourceX}px`;
        token.style.top = `${sourceY}px`;
        document.body.appendChild(token);
        
        const staggerDelay = i * 150;
        
        // Phase 1: Spawn with golden glow effect
        setTimeout(() => {
            token.style.animation = 'incentiveTokenSpawn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }, staggerDelay);
        
        // Phase 2: Fly to wallet
        setTimeout(() => {
            token.style.animation = 'incentiveTokenFly 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
            token.style.transition = 'left 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            token.style.left = `${destRect.left + destRect.width / 2}px`;
            token.style.top = `${destRect.top + destRect.height / 2}px`;
        }, staggerDelay + 500);
        
        // Cleanup
        setTimeout(() => {
            token.remove();
            
            // On last token, increment the black token count in the wallet
            if (i === blackTokens - 1) {
                const blackWalletDisplay = document.getElementById('blackTokens');
                if (blackWalletDisplay) {
                    const currentCount = parseInt(blackWalletDisplay.textContent) || 0;
                    blackWalletDisplay.textContent = currentCount + blackTokens;
                    
                    // Add a brief pulse effect to the wallet
                    blackWalletDisplay.style.transition = 'transform 0.2s ease, color 0.2s ease';
                    blackWalletDisplay.style.transform = 'scale(1.3)';
                    blackWalletDisplay.style.color = '#22c55e';
                    
                    setTimeout(() => {
                        blackWalletDisplay.style.transform = 'scale(1)';
                        blackWalletDisplay.style.color = '';
                    }, 300);
                    
                    console.log(`🎁 Black token count updated: ${currentCount} → ${currentCount + blackTokens}`);
                }
            }
        }, staggerDelay + 1300);
    }
    
    // Cleanup style after all animations
    setTimeout(() => {
        if (style && style.parentNode) {
            style.remove();
        }
    }, (blackTokens * 150) + 1500);
    
    console.log(`🎁 Incentive token animation: ${blackTokens} black tokens flying to wallet`);
}

// Token Animation - Shows tokens earned at end of round
// Tokens float from moderator square → line up below poker table → fly to player's wallet
function showTokenAnimation(whiteTokens, blackTokens) {
    // Don't animate if no tokens
    if (whiteTokens === 0 && blackTokens === 0) return;
    
    // Remove any existing animation
    const existingTokens = document.querySelectorAll('.flying-token');
    existingTokens.forEach(t => t.remove());
    
    const existingStyle = document.getElementById('tokenAnimStyle');
    if (existingStyle) existingStyle.remove();
    
    // Get source position (moderator square / table center)
    const moderatorEl = document.getElementById('moderatorPosition') || document.getElementById('tableCenter');
    const pokerTable = document.getElementById('pokerTable');
    
    // Get destination positions (wallet tokens in status panel)
    const whiteWalletEl = document.getElementById('whiteTokens');
    const blackWalletEl = document.getElementById('blackTokens');
    
    if (!moderatorEl || !pokerTable) {
        console.log('🎯 Token animation: Could not find poker table elements');
        return;
    }
    
    // Calculate positions
    const sourceRect = moderatorEl.getBoundingClientRect();
    const tableRect = pokerTable.getBoundingClientRect();
    const whiteDestRect = whiteWalletEl?.getBoundingClientRect();
    const blackDestRect = blackWalletEl?.getBoundingClientRect();
    
    // Source: center of moderator square
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    
    // Staging area: below the poker table, centered
    const stagingY = tableRect.bottom + 20;
    const stagingBaseX = tableRect.left + tableRect.width / 2;
    
    // Add animation styles
    const style = document.createElement('style');
    style.id = 'tokenAnimStyle';
    style.textContent = `
        .flying-token {
            position: fixed;
            font-size: 28px;
            pointer-events: none;
            z-index: 99999;
            opacity: 0;
            transition: none;
        }
        
        .flying-token.white-token {
            filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 12px rgba(200, 200, 200, 0.3));
        }
        
        .flying-token.black-token {
            filter: drop-shadow(0 0 6px rgba(80, 80, 80, 0.6)) drop-shadow(0 0 12px rgba(60, 60, 60, 0.4));
        }
        
        @keyframes tokenSpawn {
            0% { opacity: 0; transform: scale(0) rotate(0deg); }
            60% { opacity: 0.9; transform: scale(1.1) rotate(180deg); }
            100% { opacity: 0.9; transform: scale(1) rotate(360deg); }
        }
        
        @keyframes tokenIdle {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(5deg); }
        }
        
        @keyframes tokenFlyToWallet {
            0% { 
                opacity: 0.9; 
                transform: scale(1) rotate(0deg); 
            }
            20% { 
                opacity: 1; 
                transform: scale(1.15) rotate(30deg) translateY(-10px); 
            }
            50% { 
                opacity: 0.95; 
                transform: scale(1.05) rotate(180deg); 
            }
            80% { 
                opacity: 0.8; 
                transform: scale(0.8) rotate(300deg); 
            }
            100% { 
                opacity: 0; 
                transform: scale(0.4) rotate(360deg); 
            }
        }
    `;
    document.head.appendChild(style);
    
    // Create and animate tokens
    const totalTokens = whiteTokens + blackTokens;
    const tokens = [];
    
    // Create white tokens first, then black tokens
    for (let i = 0; i < whiteTokens; i++) {
        tokens.push({ type: 'white', emoji: '⚪', destRect: whiteDestRect });
    }
    for (let i = 0; i < blackTokens; i++) {
        tokens.push({ type: 'black', emoji: '⚫', destRect: blackDestRect });
    }
    
    // Calculate side-by-side positions below table
    const tokenSpacing = 36; // pixels between token centers
    const totalWidth = (totalTokens - 1) * tokenSpacing;
    const startX = stagingBaseX - totalWidth / 2;
    
    // Animate each token with staggered timing
    tokens.forEach((tokenData, index) => {
        const token = document.createElement('div');
        token.className = `flying-token ${tokenData.type}-token`;
        token.textContent = tokenData.emoji;
        token.style.left = `${sourceX}px`;
        token.style.top = `${sourceY}px`;
        document.body.appendChild(token);
        
        const staggerDelay = index * 120; // 120ms between each token
        
        // Calculate this token's final position in the lineup
        const lineupX = startX + (index * tokenSpacing);
        
        // Phase 1: Spawn at moderator square with pop animation
        setTimeout(() => {
            token.style.animation = 'tokenSpawn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        }, staggerDelay);
        
        // Phase 2: Float to lineup position below poker table
        setTimeout(() => {
            token.style.animation = 'none';
            token.style.opacity = '0.9';
            token.style.transition = 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            token.style.left = `${lineupX}px`;
            token.style.top = `${stagingY}px`;
        }, staggerDelay + 350);
        
        // Phase 3: Gentle idle animation while waiting (longer pause)
        setTimeout(() => {
            token.style.transition = 'none';
            token.style.animation = 'tokenIdle 1.5s ease-in-out infinite';
        }, staggerDelay + 850);
        
        // Phase 4: Fly to wallet destination with smooth arc
        const flyDelay = (totalTokens * 120) + 1800; // Wait for all tokens + 1.8s pause
        setTimeout(() => {
            const destRect = tokenData.destRect;
            if (destRect) {
                // Use smoother easing and longer duration for flight
                token.style.animation = 'tokenFlyToWallet 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
                token.style.transition = 'left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                token.style.left = `${destRect.left + destRect.width / 2}px`;
                token.style.top = `${destRect.top + destRect.height / 2}px`;
            } else {
                // Fallback: fade out in place
                token.style.animation = 'tokenFlyToWallet 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
            }
        }, flyDelay + (index * 100)); // Slightly more stagger for smoother cascade
        
        // Cleanup token
        setTimeout(() => {
            token.remove();
        }, flyDelay + (index * 100) + 900);
    });
    
    // Cleanup styles after all animations complete
    const totalDuration = (totalTokens * 120) + 1800 + (totalTokens * 100) + 1000;
    setTimeout(() => {
        style.remove();
    }, totalDuration);
    
    console.log(`🎯 Token animation: ${whiteTokens} white, ${blackTokens} black flying from moderator to wallet`);
}
