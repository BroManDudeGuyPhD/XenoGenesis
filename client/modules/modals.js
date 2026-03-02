// ================================================
// MODALS & ALERTS MODULE
// Glassmorphism alerts, neon animations, invite code
// modals, experiment end modal, lightning test modals,
// and confirmation dialogs.
// ================================================

// Function to create and show a glassmorphism session expired modal
function showSessionExpiredModal() {
    const modalHTML = `
        <div id="sessionExpiredModal" class="modal" style="
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: block;
            z-index: 10000;
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
                position: relative;
            ">
                <div class="imgcontainer" style="text-align: center; padding: 20px 20px 0 20px;">
                    <span onclick="closeSessionExpiredModal()" 
                          class="close"
                          title="Close Modal"
                          style="
                              position: absolute;
                              top: 15px;
                              right: 20px;
                              color: #b9bbbe;
                              font-size: 28px;
                              font-weight: bold;
                              cursor: pointer;
                              transition: all 0.2s ease;
                          "
                          onmouseover="this.style.color='#ffffff'; this.style.transform='scale(1.1)'"
                          onmouseout="this.style.color='#b9bbbe'; this.style.transform='scale(1)'">&times;</span>
                </div>

                <div class="container" style="text-align: center; padding: 30px;">
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        margin-bottom: 8px;
                    ">
                        <div style="
                            width: 3px;
                            height: 3px;
                            background: linear-gradient(135deg, #f39c12, #e67e22);
                            border-radius: 50%;
                            animation: subtlePulse 2s infinite;
                        "></div>
                        <h3 style="
                            color: #dcddde; 
                            font-weight: 600; 
                            font-size: 20px;
                            margin: 0;
                            background: linear-gradient(135deg, #e74c3c, #f39c12);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                        ">Session Expired</h3>
                        <div style="
                            width: 3px;
                            height: 3px;
                            background: linear-gradient(135deg, #f39c12, #e67e22);
                            border-radius: 50%;
                            animation: subtlePulse 2s infinite;
                        "></div>
                    </div>
                    
                    <div style="
                        font-size: 48px;
                        margin-bottom: 16px;
                        opacity: 0.8;
                    ">🔒</div>
                    
                    <p style="
                        color: #b9bbbe; 
                        margin-bottom: 24px; 
                        font-size: 14px;
                        opacity: 0.9;
                        line-height: 1.5;
                    ">Your session has expired for security purposes.<br>Please log in again to continue.</p>
                    
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button type="button" 
                                onclick="closeSessionExpiredModal(); document.getElementById('id01').style.display='block';"
                                style="
                                    background: linear-gradient(135deg, rgba(67, 181, 129, 0.9) 0%, rgba(52, 168, 107, 0.9) 100%);
                                    color: white;
                                    padding: 12px 20px;
                                    border: none;
                                    border-radius: 7px;
                                    cursor: pointer;
                                    font-weight: 500;
                                    font-size: 14px;
                                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                                    box-shadow: 0 3px 8px rgba(67, 181, 129, 0.3);
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                "
                                onmouseover="
                                    this.style.background='linear-gradient(135deg, rgba(52, 168, 107, 0.95) 0%, rgba(39, 174, 96, 0.95) 100%)';
                                    this.style.transform='translateY(-1px)';
                                    this.style.boxShadow='0 4px 12px rgba(67, 181, 129, 0.4)';
                                "
                                onmouseout="
                                    this.style.background='linear-gradient(135deg, rgba(67, 181, 129, 0.9) 0%, rgba(52, 168, 107, 0.9) 100%)';
                                    this.style.transform='translateY(0)';
                                    this.style.boxShadow='0 3px 8px rgba(67, 181, 129, 0.3)';
                                ">
                            <span style="font-size: 12px;">🔑</span>
                            Log In Again
                        </button>
                        <button type="button" 
                                onclick="closeSessionExpiredModal()"
                                style="
                                    background: rgba(114, 118, 125, 0.15);
                                    color: #b9bbbe;
                                    padding: 12px 20px;
                                    border: 1px solid rgba(114, 118, 125, 0.4);
                                    border-radius: 7px;
                                    cursor: pointer;
                                    font-size: 14px;
                                    font-weight: 500;
                                    transition: all 0.2s ease;
                                    backdrop-filter: blur(10px);
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                "
                                onmouseover="
                                    this.style.background='rgba(114, 118, 125, 0.25)';
                                    this.style.color='#dcddde';
                                    this.style.borderColor='rgba(114, 118, 125, 0.6)';
                                    this.style.transform='translateY(-1px)';
                                "
                                onmouseout="
                                    this.style.background='rgba(114, 118, 125, 0.15)';
                                    this.style.color='#b9bbbe';
                                    this.style.borderColor='rgba(114, 118, 125, 0.4)';
                                    this.style.transform='translateY(0)';
                                ">
                            <span style="font-size: 12px;">✖️</span>
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to close the session expired modal
function closeSessionExpiredModal() {
    const modal = document.getElementById('sessionExpiredModal');
    if (modal) {
        modal.remove();
    }
}

// Function to create and show a glassmorphism alert modal
function showGlassmorphismAlert(title, message, type = 'info', onConfirm = null) {
    // Remove any existing alert modal
    const existingModal = document.getElementById('glassmorphismAlertModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Set colors and icons based on type
    let gradient, icon;
    switch(type) {
        case 'success':
            gradient = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            icon = '✅';
            break;
        case 'error':
            gradient = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            icon = '❌';
            break;
        case 'warning':
            gradient = 'linear-gradient(135deg, #f39c12, #e67e22)';
            icon = '⚠️';
            break;
        default:
            gradient = 'linear-gradient(135deg, #667aff, #7386ff)';
            icon = 'ℹ️';
            break;
    }

    const modalHTML = `
        <div id="glassmorphismAlertModal" class="modal" style="
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: block;
            z-index: 10001;
        ">
            <div class="modal-content animate" style="
                max-width: 400px;
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
                margin: 15% auto;
                position: relative;
            ">
                <div class="container" style="text-align: center; padding: 30px;">
                    <div style="
                        font-size: 36px;
                        margin-bottom: 12px;
                        opacity: 0.9;
                    ">${icon}</div>
                    
                    <h3 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        font-size: 18px;
                        margin: 0 0 12px 0;
                        background: ${gradient};
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    ">${title}</h3>
                    
                    <p style="
                        color: #b9bbbe; 
                        margin-bottom: 24px; 
                        font-size: 14px;
                        opacity: 0.9;
                        line-height: 1.4;
                    ">${message}</p>
                    
                    <button type="button" 
                            onclick="closeGlassmorphismAlert(); ${onConfirm ? onConfirm : ''}"
                            style="
                                background: ${gradient};
                                color: white;
                                padding: 10px 20px;
                                border: none;
                                border-radius: 7px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 14px;
                                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                margin: 0 auto;
                            "
                            onmouseover="
                                this.style.transform='translateY(-1px)';
                                this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)';
                            "
                            onmouseout="
                                this.style.transform='translateY(0)';
                                this.style.boxShadow='0 3px 8px rgba(0, 0, 0, 0.3)';
                            ">
                        OK
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to close the glassmorphism alert modal
function closeGlassmorphismAlert() {
    const modal = document.getElementById('glassmorphismAlertModal');
    if (modal) {
        modal.remove();
    }
}
