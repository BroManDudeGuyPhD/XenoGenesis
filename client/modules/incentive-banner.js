// ================================================
// INCENTIVE BANNER MODULE
// CRT-styled neon incentive banner for poker table
// ================================================

// Show prominent incentive banner for players - anchored to poker table with CRT flourish
function showIncentiveBanner(incentiveText) {
    // Remove existing banner
    hideIncentiveBanner();
    
    // Get poker table for positioning
    const pokerTable = document.getElementById('pokerTable');
    if (!pokerTable) {
        console.error('🎁 Cannot show incentive banner: poker table not found');
        return;
    }
    
    // Create incentive banner
    const banner = document.createElement('div');
    banner.id = 'incentiveBanner';
    banner.className = 'incentive-banner incentive-flourish';
    
    // Create scanline overlay for CRT effect
    const scanlines = document.createElement('div');
    scanlines.className = 'incentive-scanlines';
    
    // Create content
    const content = document.createElement('div');
    content.className = 'incentive-content';
    
    const title = document.createElement('h3');
    title.textContent = '⚡ BONUS OPPORTUNITY';
    title.className = 'incentive-title';
    
    const description = document.createElement('p');
    description.textContent = incentiveText;
    description.className = 'incentive-description';
    
    content.appendChild(title);
    content.appendChild(description);
    banner.appendChild(scanlines);
    banner.appendChild(content);
    
    // Add CRT neon styles
    const styleId = 'incentiveBannerCRTStyles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #incentiveBanner {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 1000;
                min-width: 280px;
                max-width: 320px;
                background: linear-gradient(180deg, 
                    rgba(10, 10, 20, 0.92) 0%, 
                    rgba(15, 12, 25, 0.95) 100%);
                border: 2px solid #ff00ff;
                border-radius: 4px;
                padding: 0;
                font-family: 'Courier New', monospace;
                text-align: left;
                box-shadow: 
                    0 0 15px rgba(255, 0, 255, 0.4),
                    0 0 30px rgba(255, 0, 255, 0.2),
                    inset 0 0 20px rgba(255, 0, 255, 0.05);
                cursor: pointer;
                overflow: hidden;
                transform: translateX(100%);
                opacity: 0;
            }
            
            /* Initial flourish state - intense CRT effect */
            #incentiveBanner.incentive-flourish {
                animation: incentiveSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                           incentiveCRTFlourish 0.8s ease-out forwards;
            }
            
            /* Settled state - reduced effects, more legible */
            #incentiveBanner.incentive-settled {
                animation: none;
                transform: translateX(0);
                opacity: 1;
                border-color: #cc00cc;
                box-shadow: 
                    0 0 10px rgba(255, 0, 255, 0.3),
                    0 0 20px rgba(255, 0, 255, 0.15),
                    inset 0 0 15px rgba(255, 0, 255, 0.03);
            }
            
            #incentiveBanner.incentive-settled .incentive-scanlines {
                opacity: 0.3;
                animation: none;
            }
            
            #incentiveBanner.incentive-settled .incentive-title {
                animation: none;
                text-shadow: 
                    0 0 8px rgba(255, 0, 255, 0.6),
                    0 0 15px rgba(255, 0, 255, 0.3);
            }
            
            #incentiveBanner.incentive-settled .incentive-description {
                text-shadow: 
                    0 0 5px rgba(0, 255, 255, 0.4);
            }
            
            .incentive-scanlines {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: repeating-linear-gradient(
                    0deg,
                    rgba(0, 0, 0, 0.1) 0px,
                    rgba(0, 0, 0, 0.1) 1px,
                    transparent 1px,
                    transparent 3px
                );
                pointer-events: none;
                z-index: 10;
                opacity: 0.6;
            }
            
            .incentive-content {
                position: relative;
                z-index: 5;
                padding: 12px 16px;
            }
            
            #incentiveBanner .incentive-title {
                margin: 0 0 6px 0;
                font-size: 15px;
                font-weight: bold;
                color: #ff00ff;
                letter-spacing: 2px;
                text-transform: uppercase;
                text-shadow: 
                    0 0 10px #ff00ff,
                    0 0 20px #ff00ff,
                    0 0 30px #ff00ff;
            }
            
            #incentiveBanner .incentive-description {
                margin: 0;
                font-size: 13px;
                line-height: 1.4;
                font-weight: 500;
                color: #00ffff;
                text-shadow: 
                    0 0 5px #00ffff,
                    0 0 10px rgba(0, 255, 255, 0.5);
                letter-spacing: 0.5px;
            }
            
            @keyframes incentiveSlideIn {
                0% { 
                    transform: translateX(120%); 
                    opacity: 0; 
                }
                100% { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
            }
            
            @keyframes incentiveCRTFlourish {
                0% {
                    filter: brightness(2) saturate(1.5);
                    box-shadow: 
                        0 0 30px rgba(255, 0, 255, 0.8),
                        0 0 60px rgba(255, 0, 255, 0.5),
                        0 0 90px rgba(0, 255, 255, 0.3),
                        inset 0 0 40px rgba(255, 0, 255, 0.2);
                }
                30% {
                    filter: brightness(1.8) saturate(1.3);
                }
                60% {
                    filter: brightness(1.3) saturate(1.1);
                }
                100% {
                    filter: brightness(1) saturate(1);
                    box-shadow: 
                        0 0 15px rgba(255, 0, 255, 0.4),
                        0 0 30px rgba(255, 0, 255, 0.2),
                        inset 0 0 20px rgba(255, 0, 255, 0.05);
                }
            }
            
            @keyframes incentiveSlideOut {
                0% { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
                100% { 
                    transform: translateX(120%); 
                    opacity: 0; 
                }
            }
            
            /* Success state - when bonus is earned */
            #incentiveBanner.incentive-success {
                border-color: #00ff00;
                box-shadow: 
                    0 0 15px rgba(0, 255, 0, 0.5),
                    0 0 30px rgba(0, 255, 0, 0.3),
                    inset 0 0 20px rgba(0, 255, 0, 0.05);
                animation: incentiveSuccessFlash 0.5s ease-out forwards;
            }
            
            #incentiveBanner.incentive-success .incentive-title {
                color: #00ff00;
                text-shadow: 
                    0 0 10px #00ff00,
                    0 0 20px rgba(0, 255, 0, 0.5);
            }
            
            #incentiveBanner.incentive-success .incentive-scanlines {
                opacity: 0.2;
            }
            
            @keyframes incentiveSuccessFlash {
                0% {
                    filter: brightness(2) saturate(1.5);
                    box-shadow: 
                        0 0 40px rgba(0, 255, 0, 0.8),
                        0 0 80px rgba(0, 255, 0, 0.5),
                        inset 0 0 40px rgba(0, 255, 0, 0.2);
                }
                100% {
                    filter: brightness(1) saturate(1);
                    box-shadow: 
                        0 0 15px rgba(0, 255, 0, 0.5),
                        0 0 30px rgba(0, 255, 0, 0.3),
                        inset 0 0 20px rgba(0, 255, 0, 0.05);
                }
            }
            
            /* Dimmed state - when user clicks to temporarily hide */
            #incentiveBanner.incentive-dimmed {
                opacity: 0.15;
                transform: scale(0.95);
                filter: brightness(0.5) saturate(0.5);
                transition: all 0.3s ease-out;
                pointer-events: none;
            }
            
            #incentiveBanner.incentive-returning {
                opacity: 1;
                transform: scale(1);
                filter: brightness(1) saturate(1);
                transition: all 0.5s ease-out;
                pointer-events: auto;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Click to temporarily dim (NOT close) - returns after a few seconds
    banner.onclick = function() {
        if (banner.classList.contains('incentive-dimmed')) return; // Already dimmed
        
        banner.classList.add('incentive-dimmed');
        banner.classList.remove('incentive-settled');
        
        // Return after 4 seconds
        setTimeout(() => {
            if (banner && banner.parentNode && !banner.classList.contains('incentive-success')) {
                banner.classList.remove('incentive-dimmed');
                banner.classList.add('incentive-returning');
                
                // Remove returning class after transition
                setTimeout(() => {
                    if (banner && banner.parentNode) {
                        banner.classList.remove('incentive-returning');
                        banner.classList.add('incentive-settled');
                    }
                }, 500);
            }
        }, 4000);
    };
    
    // Append to poker table
    pokerTable.style.position = 'relative';
    pokerTable.appendChild(banner);
    
    // After flourish animation, settle into legible state
    setTimeout(() => {
        if (banner && banner.parentNode) {
            banner.classList.remove('incentive-flourish');
            banner.classList.add('incentive-settled');
        }
    }, 800);
    
    console.log('🎁 CRT incentive banner displayed on poker table:', incentiveText);
}

// Hide incentive banner
function hideIncentiveBanner() {
    const existingBanner = document.getElementById('incentiveBanner');
    if (existingBanner) {
        existingBanner.remove();
    }
}
