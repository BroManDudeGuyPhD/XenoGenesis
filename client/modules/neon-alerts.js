// ================================================
// NEON ALERTS MODULE
// Neon-styled room join and welcome animations
// ================================================

function showNeonRoomJoinAlert(roomName) {
    // Remove any existing neon alert
    const existingAlert = document.getElementById('neonRoomJoinAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const existingStyle = document.getElementById('neonRoomJoinStyle');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const alertHTML = `
        <div id="neonRoomJoinAlert">
            <div class="neon-alert-scanlines"></div>
            <div class="neon-alert-content">
                <div class="neon-alert-border-top"></div>
                <div class="neon-alert-icon">
                    <i class="fas fa-door-open"></i>
                </div>
                <div class="neon-alert-title">CONNECTING</div>
                <div class="neon-alert-room">
                    <span class="neon-alert-bracket">[</span>
                    <span class="neon-alert-room-name">${roomName}</span>
                    <span class="neon-alert-bracket">]</span>
                </div>
                <div class="neon-alert-status">
                    <span class="neon-alert-dot"></span>
                    <span class="neon-alert-status-text">ESTABLISHING LINK</span>
                </div>
                <div class="neon-alert-border-bottom"></div>
            </div>
        </div>
    `;
    
    const style = document.createElement('style');
    style.id = 'neonRoomJoinStyle';
    style.textContent = `
        #neonRoomJoinAlert {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 5, 15, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100000;
            opacity: 0;
            animation: neonAlertFadeIn 0.4s ease forwards;
            cursor: pointer;
        }
        
        @keyframes neonAlertFadeIn {
            to { opacity: 1; }
        }
        
        @keyframes neonAlertFadeOut {
            to { opacity: 0; transform: scale(0.95); }
        }
        
        .neon-alert-scanlines {
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
        }
        
        .neon-alert-content {
            text-align: center;
            padding: 40px 50px;
            position: relative;
            animation: neonAlertSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }
        
        @keyframes neonAlertSlideUp {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .neon-alert-border-top, .neon-alert-border-bottom {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 300px;
            height: 2px;
            background: linear-gradient(90deg, 
                transparent, 
                #00ffff, 
                #ff00ff, 
                #00ffff, 
                transparent);
            box-shadow: 
                0 0 10px #00ffff,
                0 0 20px #ff00ff;
            animation: neonBorderPulse 1.5s ease infinite;
        }
        
        .neon-alert-border-top { top: 0; }
        .neon-alert-border-bottom { bottom: 0; }
        
        @keyframes neonBorderPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        .neon-alert-icon {
            font-size: 48px;
            color: #00ffff;
            margin-bottom: 15px;
            text-shadow: 
                0 0 10px #00ffff,
                0 0 20px #00ffff,
                0 0 40px #00ffff;
            animation: neonIconFloat 2s ease-in-out infinite;
        }
        
        @keyframes neonIconFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        
        .neon-alert-title {
            font-size: 28px;
            font-weight: 900;
            font-family: 'Arial Black', Arial, sans-serif;
            color: #fff;
            letter-spacing: 8px;
            margin-bottom: 20px;
            text-shadow: 
                0 0 10px #fff,
                0 0 20px #ff00ff,
                0 0 40px #ff00ff;
            animation: neonTitlePulse 2s ease infinite;
        }
        
        @keyframes neonTitlePulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
        }
        
        .neon-alert-room {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .neon-alert-bracket {
            font-size: 40px;
            font-family: 'Courier New', monospace;
            color: #ff00ff;
            text-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff;
            animation: neonBracketPulse 1s ease infinite;
        }
        
        .neon-alert-bracket:last-child {
            animation-delay: 0.5s;
        }
        
        @keyframes neonBracketPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
        
        .neon-alert-room-name {
            font-family: 'Courier New', monospace;
            font-size: 24px;
            font-weight: bold;
            color: #00ffff;
            letter-spacing: 3px;
            padding: 10px 20px;
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            text-shadow: 
                0 0 10px #00ffff,
                0 0 20px #00ffff;
        }
        
        .neon-alert-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .neon-alert-dot {
            width: 8px;
            height: 8px;
            background: #00ff00;
            border-radius: 50%;
            box-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00;
            animation: neonDotBlink 0.8s ease infinite;
        }
        
        @keyframes neonDotBlink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.3; }
        }
        
        .neon-alert-status-text {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #00ff00;
            letter-spacing: 2px;
            text-shadow: 0 0 5px #00ff00;
        }
    `;
    
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    const alertElement = document.getElementById('neonRoomJoinAlert');
    
    // Function to dismiss the alert
    function dismissAlert() {
        if (alertElement) {
            alertElement.style.animation = 'neonAlertFadeOut 0.3s ease forwards';
            setTimeout(() => {
                alertElement.remove();
                style.remove();
            }, 300);
        }
    }
    
    // Dismiss on click anywhere
    alertElement.addEventListener('click', dismissAlert);
    
    // After 2 seconds, change to "CONNECTED" state
    setTimeout(() => {
        if (!alertElement || !document.contains(alertElement)) return;
        
        const titleEl = alertElement.querySelector('.neon-alert-title');
        const iconEl = alertElement.querySelector('.neon-alert-icon');
        const statusDot = alertElement.querySelector('.neon-alert-dot');
        const statusText = alertElement.querySelector('.neon-alert-status-text');
        
        if (titleEl) {
            titleEl.textContent = 'CONNECTED';
            titleEl.style.color = '#00ff00';
            titleEl.style.textShadow = '0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 40px #00ff00';
        }
        if (iconEl) {
            iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
            iconEl.style.color = '#00ff00';
            iconEl.style.textShadow = '0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 40px #00ff00';
        }
        if (statusText) {
            statusText.textContent = 'LINK ESTABLISHED';
        }
        
        // Dismiss after showing "CONNECTED" for 1.5 seconds
        setTimeout(dismissAlert, 1500);
    }, 2000);
}

// Neon-styled welcome alert for new account creation (matches room join styling)
function showNeonWelcomeAlert() {
    // Remove any existing neon alert
    const existingAlert = document.getElementById('neonWelcomeAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const existingStyle = document.getElementById('neonWelcomeStyle');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const alertHTML = `
        <div id="neonWelcomeAlert">
            <div class="neon-welcome-scanlines"></div>
            <div class="neon-welcome-content">
                <div class="neon-welcome-border-top"></div>
                <div class="neon-welcome-icon">
                    <i class="fas fa-user-check"></i>
                </div>
                <div class="neon-welcome-title">WELCOME</div>
                <div class="neon-welcome-subtitle">
                    <span class="neon-welcome-text">ACCOUNT CREATED</span>
                </div>
                <div class="neon-welcome-status">
                    <span class="neon-welcome-dot"></span>
                    <span class="neon-welcome-status-text">SYSTEM ONLINE</span>
                </div>
                <div class="neon-welcome-border-bottom"></div>
            </div>
        </div>
    `;
    
    const style = document.createElement('style');
    style.id = 'neonWelcomeStyle';
    style.textContent = `
        #neonWelcomeAlert {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 5, 15, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100000;
            opacity: 0;
            animation: neonWelcomeFadeIn 0.4s ease forwards;
            cursor: pointer;
        }
        
        @keyframes neonWelcomeFadeIn {
            to { opacity: 1; }
        }
        
        @keyframes neonWelcomeFadeOut {
            to { opacity: 0; transform: scale(0.95); }
        }
        
        .neon-welcome-scanlines {
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
        }
        
        .neon-welcome-content {
            text-align: center;
            padding: 40px 50px;
            position: relative;
            animation: neonWelcomeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }
        
        @keyframes neonWelcomeSlideUp {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .neon-welcome-border-top, .neon-welcome-border-bottom {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 300px;
            height: 2px;
            background: linear-gradient(90deg, 
                transparent, 
                #00ffff, 
                #ff00ff, 
                #00ffff, 
                transparent);
            box-shadow: 
                0 0 10px #00ffff,
                0 0 20px #ff00ff;
            animation: neonWelcomeBorderPulse 1.5s ease infinite;
        }
        
        .neon-welcome-border-top { top: 0; }
        .neon-welcome-border-bottom { bottom: 0; }
        
        @keyframes neonWelcomeBorderPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        .neon-welcome-icon {
            font-size: 48px;
            color: #00ff00;
            margin-bottom: 15px;
            text-shadow: 
                0 0 10px #00ff00,
                0 0 20px #00ff00,
                0 0 40px #00ff00;
            animation: neonWelcomeIconFloat 2s ease-in-out infinite;
        }
        
        @keyframes neonWelcomeIconFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        
        .neon-welcome-title {
            font-size: 32px;
            font-weight: 900;
            font-family: 'Arial Black', Arial, sans-serif;
            color: #fff;
            letter-spacing: 10px;
            margin-bottom: 15px;
            text-shadow: 
                0 0 10px #fff,
                0 0 20px #ff00ff,
                0 0 40px #ff00ff;
            animation: neonWelcomeTitlePulse 2s ease infinite;
        }
        
        @keyframes neonWelcomeTitlePulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
        }
        
        .neon-welcome-subtitle {
            margin-bottom: 20px;
        }
        
        .neon-welcome-text {
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            color: #00ffff;
            letter-spacing: 4px;
            padding: 10px 25px;
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            text-shadow: 
                0 0 10px #00ffff,
                0 0 20px #00ffff;
        }
        
        .neon-welcome-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .neon-welcome-dot {
            width: 8px;
            height: 8px;
            background: #00ff00;
            border-radius: 50%;
            box-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00;
            animation: neonWelcomeDotBlink 0.8s ease infinite;
        }
        
        @keyframes neonWelcomeDotBlink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.3; }
        }
        
        .neon-welcome-status-text {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #00ff00;
            letter-spacing: 2px;
            text-shadow: 0 0 5px #00ff00;
        }
    `;
    
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    const alertElement = document.getElementById('neonWelcomeAlert');
    
    // Function to dismiss the alert
    function dismissAlert() {
        if (alertElement) {
            alertElement.style.animation = 'neonWelcomeFadeOut 0.3s ease forwards';
            setTimeout(() => {
                alertElement.remove();
                style.remove();
            }, 300);
        }
    }
    
    // Dismiss on click anywhere
    alertElement.addEventListener('click', dismissAlert);
    
    // Auto-dismiss after 5 seconds
    setTimeout(dismissAlert, 5000);
}
