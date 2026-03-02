// ================================================
// INVITE MODALS MODULE
// Invite code display, clipboard copy, and link sharing
// ================================================

// Function to show invite code with copy functionality
function showInviteCodeAlert(inviteCode, codeType = 'Single-Use', targetRoom = null) {
    // Remove any existing alert modal
    const existingModal = document.getElementById('inviteCodeModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Generate the shareable invite link
    const inviteLink = `${window.location.origin}/invite?code=${inviteCode}`;
    
    // Description based on whether there's a target room
    const hasRoom = targetRoom && targetRoom !== 'Global';
    const description = hasRoom 
        ? `New users will automatically join room "<strong>${targetRoom}</strong>" after signing up`
        : (codeType === 'Permanent' ? 'This code never expires and can be used multiple times' : 'Share this code with a user to let them create an account');

    const modalHTML = `
        <div id="inviteCodeModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                max-width: 480px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(43, 45, 59, 0.98) 0%, 
                    rgba(54, 57, 63, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 8px 32px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                padding: 30px;
                text-align: center;
                animation: modalSlideIn 0.3s ease-out;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 20px;
                ">
                    <div style="
                        width: 3px;
                        height: 3px;
                        background: linear-gradient(135deg, #667aff, #7386ff);
                        border-radius: 50%;
                        animation: subtlePulse 2s infinite;
                    "></div>
                    <h3 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        margin: 0;
                        font-size: 24px;
                        letter-spacing: -0.5px;
                    ">${hasRoom ? '🚪' : '✨'} ${codeType} Invite Code Generated!</h3>
                    <div style="
                        width: 3px;
                        height: 3px;
                        background: linear-gradient(135deg, #667aff, #7386ff);
                        border-radius: 50%;
                        animation: subtlePulse 2s infinite 0.5s;
                    "></div>
                </div>
                
                <p style="
                    color: #b9bbbe; 
                    font-size: 14px; 
                    margin-bottom: 25px; 
                    opacity: 0.8;
                ">${description}</p>

                <div style="
                    background: rgba(32, 34, 37, 0.8);
                    border: 2px solid rgba(102, 122, 255, 0.4);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 20px 0;
                    position: relative;
                ">
                    <div style="
                        font-family: 'Courier New', monospace;
                        font-size: 28px;
                        font-weight: bold;
                        color: #667aff;
                        letter-spacing: 3px;
                        margin-bottom: 10px;
                        text-shadow: 0 0 10px rgba(102, 122, 255, 0.3);
                    " id="inviteCodeText">${inviteCode}</div>
                    
                    <button onclick="copyInviteCode('${inviteCode}')" style="
                        background: linear-gradient(135deg, rgba(102, 122, 255, 0.9), rgba(115, 134, 255, 0.9));
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        margin-top: 10px;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(102, 122, 255, 1), rgba(115, 134, 255, 1))';
                        this.style.transform='translateY(-1px)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(102, 122, 255, 0.9), rgba(115, 134, 255, 0.9))';
                        this.style.transform='translateY(0)';
                    "
                    id="copyInviteBtn">
                        📋 Copy Code
                    </button>
                </div>
                
                <!-- Shareable Link Section -->
                <div style="
                    background: rgba(46, 204, 113, 0.1);
                    border: 2px solid rgba(46, 204, 113, 0.3);
                    border-radius: 12px;
                    padding: 15px;
                    margin: 15px 0;
                ">
                    <p style="
                        color: #2ecc71;
                        font-size: 12px;
                        font-weight: 600;
                        margin: 0 0 10px 0;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    ">🔗 Shareable Invite Link</p>
                    
                    <div style="
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        color: #b9bbbe;
                        word-break: break-all;
                        margin-bottom: 10px;
                        padding: 8px;
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 6px;
                    " id="inviteLinkText">${inviteLink}</div>
                    
                    <button onclick="copyInviteLink('${inviteLink}')" style="
                        background: linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9));
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 1), rgba(39, 174, 96, 1))';
                        this.style.transform='translateY(-1px)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9))';
                        this.style.transform='translateY(0)';
                    "
                    id="copyInviteLinkBtn">
                        🔗 Copy Link
                    </button>
                </div>

                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                    <button onclick="closeInviteCodeAlert()" style="
                        background: rgba(114, 118, 125, 0.2);
                        color: #b9bbbe;
                        padding: 12px 24px;
                        border: 1px solid rgba(114, 118, 125, 0.4);
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        backdrop-filter: blur(10px);
                    "
                    onmouseover="
                        this.style.background='rgba(114, 118, 125, 0.3)';
                        this.style.borderColor='rgba(114, 118, 125, 0.6)';
                    "
                    onmouseout="
                        this.style.background='rgba(114, 118, 125, 0.2)';
                        this.style.borderColor='rgba(114, 118, 125, 0.4)';
                    ">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add click-outside-to-close functionality
    const modal = document.getElementById('inviteCodeModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            // Only close if clicking the backdrop (not the inner content)
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

// Function to copy invite code to clipboard
function copyInviteCode(code) {
    navigator.clipboard.writeText(code).then(function() {
        const copyBtn = document.getElementById('copyInviteBtn');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ Copied!';
            copyBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.background = 'linear-gradient(135deg, rgba(102, 122, 255, 0.9), rgba(115, 134, 255, 0.9))';
            }, 2000);
        }
        
        showGlassmorphismAlert('Copied!', 'Invite code copied to clipboard.', 'success');
    }).catch(function() {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showGlassmorphismAlert('Copied!', 'Invite code copied to clipboard.', 'success');
        } catch (err) {
            showGlassmorphismAlert('Copy Failed', 'Please manually copy the invite code.', 'error');
        }
        document.body.removeChild(textArea);
    });
}

// Function to copy invite link to clipboard
function copyInviteLink(link) {
    navigator.clipboard.writeText(link).then(function() {
        const copyBtn = document.getElementById('copyInviteLinkBtn');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ Link Copied!';
            copyBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            copyBtn.style.transform = 'scale(1.05)';
            copyBtn.style.transition = 'all 0.2s ease';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.background = 'linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9))';
                copyBtn.style.transform = 'scale(1)';
            }, 1500);
        }
    }).catch(function() {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById('copyInviteLinkBtn');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '✅ Link Copied!';
                copyBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                copyBtn.style.transform = 'scale(1.05)';
                copyBtn.style.transition = 'all 0.2s ease';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.style.background = 'linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9))';
                    copyBtn.style.transform = 'scale(1)';
                }, 1500);
            }
        } catch (err) {
            showGlassmorphismAlert('Copy Failed', 'Please manually copy the invite link.', 'error');
        }
        document.body.removeChild(textArea);
    });
}

// Function to close invite code modal
function closeInviteCodeAlert() {
    const modal = document.getElementById('inviteCodeModal');
    if (modal) {
        modal.remove();
    }
}
