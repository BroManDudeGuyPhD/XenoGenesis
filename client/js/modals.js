/**
 * XenoGenesis Client - Modal System
 * Handles all modal dialogs and popups in the application
 */

import { createElement, generateId, formatCurrency, copyToClipboard } from './utils.js';

/**
 * Create and show a glassmorphism session expired modal
 */
export function showSessionExpiredModal() {
    // Remove any existing modal
    const existingModal = document.getElementById('sessionExpiredModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = createElement('div', {
        id: 'sessionExpiredModal',
        className: 'modal-overlay',
        style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(10px); z-index: 10000; display: flex; justify-content: center; align-items: center;'
    });

    const modalContent = createElement('div', {
        className: 'modal-content',
        style: `
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
            color: white;
            animation: modalSlideIn 0.3s ease-out;
        `
    });

    const icon = createElement('div', {
        innerHTML: '⚠️',
        style: 'font-size: 60px; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));'
    });

    const title = createElement('h2', {
        textContent: 'Session Expired',
        style: 'margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);'
    });

    const message = createElement('p', {
        textContent: 'Your session has expired. Please sign in again to continue.',
        style: 'margin: 0 0 30px 0; font-size: 16px; line-height: 1.5; opacity: 0.9;'
    });

    const buttonContainer = createElement('div', {
        style: 'display: flex; gap: 15px; justify-content: center;'
    });

    const refreshButton = createElement('button', {
        textContent: 'Refresh Page',
        style: `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 12px;
            padding: 12px 24px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `
    });

    const signInButton = createElement('button', {
        textContent: 'Sign In',
        style: `
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border: none;
            border-radius: 12px;
            padding: 12px 24px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `
    });

    // Add hover effects
    [refreshButton, signInButton].forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        });
    });

    // Event listeners
    refreshButton.addEventListener('click', () => {
        window.location.reload();
    });

    signInButton.addEventListener('click', () => {
        closeSessionExpiredModal();
        // Show sign-in interface
        const signDiv = document.getElementById('signDiv');
        const chatDiv = document.getElementById('chatDiv');
        const gameDiv = document.getElementById('gameDiv');
        
        if (signDiv) signDiv.style.display = 'block';
        if (chatDiv) chatDiv.style.display = 'none';
        if (gameDiv) gameDiv.style.display = 'none';
    });

    // Assemble modal
    buttonContainer.appendChild(refreshButton);
    buttonContainer.appendChild(signInButton);
    
    modalContent.appendChild(icon);
    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modalContent.appendChild(buttonContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Add CSS animation keyframes if not already present
    if (!document.getElementById('modalAnimationStyles')) {
        const style = createElement('style', { id: 'modalAnimationStyles' });
        style.textContent = `
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.8) translateY(-50px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            @keyframes modalSlideOut {
                from {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
                to {
                    opacity: 0;
                    transform: scale(0.8) translateY(-50px);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Close the session expired modal
 */
export function closeSessionExpiredModal() {
    const modal = document.getElementById('sessionExpiredModal');
    if (modal) {
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.animation = 'modalSlideOut 0.3s ease-in';
            setTimeout(() => modal.remove(), 300);
        } else {
            modal.remove();
        }
    }
}

/**
 * Create and show a glassmorphism alert modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {string} type - Modal type (info, warning, error, success)
 * @param {Function|null} onConfirm - Callback function for confirm button
 */
export function showGlassmorphismAlert(title, message, type = 'info', onConfirm = null) {
    // Remove any existing alert modal
    const existingModal = document.getElementById('glassmorphismAlert');
    if (existingModal) {
        existingModal.remove();
    }

    // Type-specific styling
    const typeConfig = {
        info: { icon: 'ℹ️', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        warning: { icon: '⚠️', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
        error: { icon: '❌', gradient: 'linear-gradient(135deg, #fc466b 0%, #3f5efb 100%)' },
        success: { icon: '✅', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
    };

    const config = typeConfig[type] || typeConfig.info;

    const modal = createElement('div', {
        id: 'glassmorphismAlert',
        className: 'modal-overlay',
        style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(10px); z-index: 10000; display: flex; justify-content: center; align-items: center;'
    });

    const modalContent = createElement('div', {
        className: 'modal-content',
        style: `
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
            color: white;
            animation: modalSlideIn 0.3s ease-out;
        `
    });

    const icon = createElement('div', {
        innerHTML: config.icon,
        style: 'font-size: 60px; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));'
    });

    const titleElement = createElement('h2', {
        textContent: title,
        style: 'margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);'
    });

    const messageElement = createElement('p', {
        innerHTML: message,
        style: 'margin: 0 0 30px 0; font-size: 16px; line-height: 1.5; opacity: 0.9;'
    });

    const buttonContainer = createElement('div', {
        style: 'display: flex; gap: 15px; justify-content: center;'
    });

    const okButton = createElement('button', {
        textContent: onConfirm ? 'OK' : 'Close',
        style: `
            background: ${config.gradient};
            border: none;
            border-radius: 12px;
            padding: 12px 24px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `
    });

    // Add hover effect
    okButton.addEventListener('mouseenter', () => {
        okButton.style.transform = 'translateY(-2px)';
        okButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });
    
    okButton.addEventListener('mouseleave', () => {
        okButton.style.transform = 'translateY(0)';
        okButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    // Event listener
    okButton.addEventListener('click', () => {
        if (onConfirm) {
            onConfirm();
        }
        closeGlassmorphismAlert();
    });

    // If there's a confirm callback, add a cancel button
    if (onConfirm) {
        const cancelButton = createElement('button', {
            textContent: 'Cancel',
            style: `
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 12px;
                padding: 12px 24px;
                color: white;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            `
        });

        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.transform = 'translateY(-2px)';
            cancelButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
        });
        
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.transform = 'translateY(0)';
            cancelButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        });

        cancelButton.addEventListener('click', () => {
            closeGlassmorphismAlert();
        });

        buttonContainer.appendChild(cancelButton);
    }

    buttonContainer.appendChild(okButton);

    // Assemble modal
    modalContent.appendChild(icon);
    modalContent.appendChild(titleElement);
    modalContent.appendChild(messageElement);
    modalContent.appendChild(buttonContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeGlassmorphismAlert();
        }
    });
}

/**
 * Close the glassmorphism alert modal
 */
export function closeGlassmorphismAlert() {
    const modal = document.getElementById('glassmorphismAlert');
    if (modal) {
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.animation = 'modalSlideOut 0.3s ease-in';
            setTimeout(() => modal.remove(), 300);
        } else {
            modal.remove();
        }
    }
}

/**
 * Show invite code modal with copy functionality
 * @param {string} inviteCode - The invite code to display
 * @param {string} codeType - Type of code (Single-Use, Multi-Use, etc.)
 */
export function showInviteCodeAlert(inviteCode, codeType = 'Single-Use') {
    const title = `${codeType} Invite Code Generated`;
    const message = `
        <div style="margin: 20px 0;">
            <p style="margin-bottom: 15px;">Share this code with others to invite them:</p>
            <div style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 10px; padding: 15px; margin: 15px 0; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; word-break: break-all;">
                ${inviteCode}
            </div>
            <p style="font-size: 14px; opacity: 0.8; margin-top: 15px;">
                ${codeType === 'Single-Use' ? 'This code can only be used once.' : 'This code can be used multiple times.'}
            </p>
        </div>
    `;

    showGlassmorphismAlert(title, message, 'success', () => {
        copyInviteCode(inviteCode);
    });

    // Change OK button text to "Copy Code"
    setTimeout(() => {
        const okButton = document.querySelector('#glassmorphismAlert button');
        if (okButton) {
            okButton.textContent = 'Copy Code';
        }
    }, 100);
}

/**
 * Copy invite code to clipboard
 * @param {string} code - Code to copy
 */
async function copyInviteCode(code) {
    const success = await copyToClipboard(code);
    
    if (success) {
        // Show success feedback
        const button = document.querySelector('#glassmorphismAlert button');
        if (button) {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
            }, 2000);
        }
    } else {
        showGlassmorphismAlert('Copy Failed', 'Unable to copy to clipboard. Please copy the code manually.', 'error');
    }
}

/**
 * Show experiment ended modal
 * @param {string} message - End message
 * @param {boolean} moderator - Whether user is moderator
 */
export function showExperimentEndedModal(message, moderator) {
    showGlassmorphismAlert(
        'Experiment Ended',
        `<div style="text-align: left;">${message}</div>`,
        'info',
        () => {
            closeExperimentEndedModal();
        }
    );
}

/**
 * Close experiment ended modal and return to global chat
 */
export function closeExperimentEndedModal() {
    closeGlassmorphismAlert();
    // Return to global chat logic would be implemented here
}

// Export all modal functions
export default {
    showSessionExpiredModal,
    closeSessionExpiredModal,
    showGlassmorphismAlert,
    closeGlassmorphismAlert,
    showInviteCodeAlert,
    showExperimentEndedModal,
    closeExperimentEndedModal
};