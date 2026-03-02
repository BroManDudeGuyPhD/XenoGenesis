// ================================================
// NOTIFICATIONS MODULE
// Poker table notification toasts and notification area
// ================================================

// Create or get notification area anchored to poker table
function getNotificationArea() {
    let notificationArea = document.getElementById('pokerTableNotifications');
    if (!notificationArea) {
        const pokerTable = document.getElementById('pokerTable');
        if (pokerTable) {
            notificationArea = document.createElement('div');
            notificationArea.id = 'pokerTableNotifications';
            notificationArea.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                width: 280px;
                z-index: 1000;
                pointer-events: none;
            `;
            pokerTable.appendChild(notificationArea);
        }
    }
    return notificationArea;
}

// Show system message in poker table notification area
function showSystemNotification(title, message, type = 'info') {
    // Get or create notification area
    const notificationArea = getNotificationArea();
    if (!notificationArea) {
        console.error('📢 Cannot show system notification: poker table not found, falling back to modal');
        showGlassmorphismAlert(title, message, type);
        return;
    }
    
    // Set colors and icons based on type
    let gradient, icon, borderColor;
    switch(type) {
        case 'success':
            gradient = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            borderColor = '#27ae60';
            icon = '✅';
            break;
        case 'error':
            gradient = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            borderColor = '#e74c3c';
            icon = '❌';
            break;
        case 'warning':
            gradient = 'linear-gradient(135deg, #f39c12, #e67e22)';
            borderColor = '#f39c12';
            icon = '⚠️';
            break;
        default:
            gradient = 'linear-gradient(135deg, #667aff, #7386ff)';
            borderColor = '#667aff';
            icon = '📢';
            break;
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'system-notification';
    
    // Create content
    const content = document.createElement('div');
    content.className = 'notification-content';
    
    const titleElement = document.createElement('h4');
    titleElement.innerHTML = `${icon} ${title}`;
    titleElement.className = 'notification-title';
    
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.className = 'notification-message';
    
    content.appendChild(titleElement);
    content.appendChild(messageElement);
    notification.appendChild(content);
    
    // Style the notification
    notification.style.cssText = `
        position: relative;
        width: 100%;
        background: ${gradient};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        text-align: left;
        border: 2px solid ${borderColor};
        animation: slideInRight 0.5s ease-out;
        margin-bottom: 10px;
        pointer-events: auto;
        cursor: pointer;
    `;
    
    titleElement.style.cssText = `
        margin: 0 0 4px 0;
        font-size: 13px;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
    `;
    
    messageElement.style.cssText = `
        margin: 0;
        font-size: 12px;
        line-height: 1.3;
        font-weight: 400;
        opacity: 0.95;
    `;
    
    // Add click to close functionality
    notification.onclick = function() {
        notification.remove();
    };
    
    // Auto-remove after 8 seconds for info messages, longer for errors
    const autoRemoveTime = type === 'error' ? 12000 : (type === 'warning' ? 10000 : 8000);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, autoRemoveTime);
    
    notificationArea.appendChild(notification);
    
    console.log('📢 System notification displayed in poker table area:', title, message);
}
