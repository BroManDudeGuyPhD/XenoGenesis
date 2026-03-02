// ================================================
// LIGHTNING TEST MODALS MODULE  
// Lightning test results, progress, and CSV download modals
// ================================================

// Function to show Lightning Test results modal
function showLightningTestResults(message, stats, duration, csvData) {
    // Remove any existing modal
    const existingModal = document.getElementById('lightningTestResultsModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="lightningTestResultsModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                background: linear-gradient(145deg, 
                    rgba(30, 25, 50, 0.98) 0%, 
                    rgba(45, 35, 65, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 2px solid rgba(192, 38, 211, 0.4);
                border-radius: 20px;
                box-shadow: 
                    0 25px 80px rgba(0, 0, 0, 0.7),
                    0 10px 40px rgba(192, 38, 211, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                padding: 30px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 25px;
                ">
                    <div style="
                        font-size: 48px;
                        margin-bottom: 10px;
                        animation: lightningBounce 2s infinite;
                    ">⚡</div>
                    <h2 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        margin: 0;
                        font-size: 24px;
                        letter-spacing: -0.5px;
                        background: linear-gradient(135deg, #c026d3, #7c3aed);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    ">Lightning Test Complete</h2>
                </div>
                
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 1px solid rgba(192, 38, 211, 0.3);
                    border-radius: 16px;
                    padding: 20px;
                    margin: 20px 0;
                    backdrop-filter: blur(10px);
                    text-align: left;
                ">
                    <div style="
                        color: #dcddde; 
                        font-size: 14px; 
                        margin: 0; 
                        line-height: 1.6;
                        font-family: 'Courier New', monospace;
                        background: none;
                        border: none;
                        padding: 0;
                    ">${message}</div>
                </div>
                
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 30px;
                    align-items: center;
                ">
                    <!-- Download CSV Button -->
                    <button onclick="downloadLightningTestCSV()" style="
                        background: linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%);
                        color: white;
                        padding: 15px 28px;
                        border: 2px solid rgba(34, 197, 94, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(34, 197, 94, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        min-width: 200px;
                        justify-content: center;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(16, 185, 129, 1) 0%, rgba(5, 150, 105, 1) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 8px 25px rgba(34, 197, 94, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(34, 197, 94, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.98)'"
                    onmouseup="this.style.transform='translateY(-2px) scale(1)'">
                        <span style="font-size: 14px;">📊</span>
                        Download CSV Results
                    </button>
                    
                    <!-- Continue Button -->
                    <button onclick="closeLightningTestResults()" style="
                        background: linear-gradient(135deg, rgba(192, 38, 211, 0.9) 0%, rgba(124, 58, 237, 0.9) 100%);
                        color: white;
                        padding: 15px 28px;
                        border: 2px solid rgba(192, 38, 211, 0.6);
                        border-radius: 12px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 
                            0 6px 20px rgba(192, 38, 211, 0.6),
                            0 3px 10px rgba(0, 0, 0, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        min-width: 200px;
                        justify-content: center;
                    "
                    onmouseover="
                        this.style.background='linear-gradient(135deg, rgba(124, 58, 237, 1) 0%, rgba(147, 51, 234, 1) 100%)';
                        this.style.transform='translateY(-2px)';
                        this.style.boxShadow='0 8px 25px rgba(192, 38, 211, 0.7), 0 4px 15px rgba(0, 0, 0, 0.4)';
                    "
                    onmouseout="
                        this.style.background='linear-gradient(135deg, rgba(192, 38, 211, 0.9) 0%, rgba(124, 58, 237, 0.9) 100%)';
                        this.style.transform='translateY(0)';
                        this.style.boxShadow='0 6px 20px rgba(192, 38, 211, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3)';
                    "
                    onmousedown="this.style.transform='translateY(0) scale(0.98)'"
                    onmouseup="this.style.transform='translateY(-2px) scale(1)'">
                        <span style="font-size: 14px;">✨</span>
                        Continue
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes lightningShimmer {
                0%, 100% { background: linear-gradient(90deg, #c026d3, #7c3aed, #c026d3); }
                50% { background: linear-gradient(90deg, #7c3aed, #c026d3, #7c3aed); }
            }
            
            @keyframes lightningBounce {
                0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                50% { transform: translateY(-8px) scale(1.1) rotate(5deg); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to close lightning test results modal
function closeLightningTestResults() {
    const modal = document.getElementById('lightningTestResultsModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Function to download lightning test CSV results
function downloadLightningTestCSV() {
    try {
        // Check if CSV data is available
        if (!window.lightningTestCsvData) {
            console.error('No CSV data available for download');
            alert('CSV data is not available. Please run the lightning test again.');
            return;
        }
        
        // Create filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `lightning_test_results_${timestamp}.csv`;
        
        // Create blob and download
        const blob = new Blob([window.lightningTestCsvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            // Create download link
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`📊 Lightning test CSV downloaded: ${filename}`);
            
            // Show success feedback
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<span style="font-size: 14px;">✅</span> Downloaded!';
            button.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 1) 0%, rgba(16, 185, 129, 1) 100%)';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%)';
            }, 2000);
        } else {
            // Fallback for older browsers
            console.error('File download not supported in this browser');
            alert('File download not supported in this browser. Please copy the CSV data manually.');
        }
        
    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Error downloading CSV file. Please try again.');
    }
}

// Function to download experiment CSV from moderator panel
function downloadExperimentCSV() {
    try {
        // Check if we have an active experiment room
        if (!currentRoom || currentRoom === 'Global') {
            console.error('No active experiment found');
            alert('No active experiment found. Join an experiment room to enable CSV download.');
            return;
        }

        // Create direct download URL with room ID as parameter
        const downloadUrl = `/api/download-experiment-csv/${encodeURIComponent(currentRoom)}`;
        
        // Create filename with timestamp and room ID
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `experiment_data_${currentRoom}_${timestamp}.csv`;
        
        // Create temporary link for download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`📊 Experiment CSV download initiated: ${filename}`);
        
        // Show success feedback
        const button = document.getElementById('csvDownloadBtn');
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<span style="font-size: 14px;">✅</span> Downloaded!';
            button.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 1) 0%, rgba(16, 185, 129, 1) 100%)';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = 'linear-gradient(135deg, rgba(46, 159, 255, 0.9) 0%, rgba(0, 123, 255, 0.85) 100%)';
            }, 2000);
        }
        
        // Update status
        updateCSVStatus(`Downloaded ${filename}`);
        
    } catch (error) {
        console.error('Error downloading experiment CSV:', error);
        alert('Error downloading CSV file. Please try again.');
        updateCSVStatus('Error downloading CSV');
    }
}

// Helper function to update CSV status display
function updateCSVStatus(message) {
    const statusElement = document.getElementById('csvStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = message.includes('Error') ? '#e74c3c' : '#43b581';
    }
}

// Function to show Lightning Test progress modal
function showLightningTestProgressModal(data) {
    // Remove any existing modal
    const existingModal = document.getElementById('lightningTestProgressModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="lightningTestProgressModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                max-width: 500px;
                width: 90%;
                background: linear-gradient(145deg, 
                    rgba(30, 25, 50, 0.98) 0%, 
                    rgba(45, 35, 65, 0.95) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 2px solid rgba(192, 38, 211, 0.4);
                border-radius: 20px;
                box-shadow: 
                    0 25px 80px rgba(0, 0, 0, 0.7),
                    0 10px 40px rgba(192, 38, 211, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                padding: 30px;
                text-align: center;
                position: relative;
                animation: modalSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                <!-- Decorative lightning border -->
                <div style="
                    position: absolute;
                    top: -2px;
                    left: -2px;
                    right: -2px;
                    height: 4px;
                    background: linear-gradient(90deg, #c026d3, #7c3aed, #c026d3);
                    border-radius: 20px 20px 0 0;
                    opacity: 0.8;
                    animation: lightningShimmer 3s infinite;
                "></div>
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 25px;
                ">
                    <div style="
                        font-size: 36px;
                        animation: lightningBounce 2s infinite;
                    ">⚡</div>
                    <h2 style="
                        color: #dcddde; 
                        font-weight: 600; 
                        margin: 0;
                        font-size: 20px;
                        letter-spacing: -0.5px;
                        background: linear-gradient(135deg, #c026d3, #7c3aed);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    ">Lightning Test Running</h2>
                </div>
                
                <!-- Fixed: progress modal decorative border -->  
                <div style="
                    position: absolute;
                    top: 0px;
                    left: 0px;
                    right: 0px;
                    height: 4px;
                    background: linear-gradient(90deg, #c026d3, #7c3aed, #c026d3);
                    border-radius: 20px 20px 0 0;
                    opacity: 0.8;
                    animation: lightningShimmer 3s infinite;
                "></div>
                
                <div style="
                    background: rgba(15, 15, 15, 0.7);
                    border: 1px solid rgba(192, 38, 211, 0.3);
                    border-radius: 16px;
                    padding: 20px;
                    margin: 20px 0;
                    backdrop-filter: blur(10px);
                ">
                    <!-- Wallet Totals -->
                    <div id="walletTotals" style="
                        background: rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(124, 58, 237, 0.3);
                        border-radius: 12px;
                        padding: 15px;
                        margin-bottom: 20px;
                        text-align: left;
                    ">
                        <div style="
                            color: #7c3aed;
                            font-size: 14px;
                            font-weight: 600;
                            margin-bottom: 10px;
                            text-align: center;
                        ">💰 TOTAL EARNINGS</div>
                        <div id="walletContent" style="
                            color: #dcddde;
                            font-size: 13px;
                            line-height: 1.4;
                            font-family: 'Courier New', monospace;
                        ">
                            ${data.playerEarnings ? Object.entries(data.playerEarnings).map(([player, amount]) => 
                                `${player}: <span style="color: #22c55e;">$${amount.toFixed(2)}</span>`
                            ).join('<br>') : 'Calculating...'}
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div style="
                        background: rgba(0, 0, 0, 0.4);
                        border-radius: 10px;
                        height: 12px;
                        overflow: hidden;
                        margin-bottom: 10px;
                        border: 1px solid rgba(192, 38, 211, 0.3);
                    ">
                        <div id="progressBar" style="
                            height: 100%;
                            background: linear-gradient(90deg, #c026d3, #7c3aed);
                            border-radius: 10px;
                            width: ${data.progress}%;
                            transition: width 0.1s ease-out;
                            box-shadow: 0 0 10px rgba(192, 38, 211, 0.5);
                        "></div>
                    </div>
                    
                    <div style="
                        color: #b9bbbe;
                        font-size: 12px;
                        text-align: center;
                    ">
                        <span id="progressPercent">${data.progress.toFixed(1)}%</span> Complete
                    </div>
                </div>
                
                <div style="
                    color: #b9bbbe; 
                    font-size: 14px; 
                    margin-top: 20px;
                    opacity: 0.8;
                ">Running experimental simulation...</div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to update Lightning Test progress
function updateLightningTestProgress(data) {
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const walletContent = document.getElementById('walletContent');
    
    if (progressBar) {
        progressBar.style.width = `${data.progress}%`;
    }
    if (progressPercent) progressPercent.textContent = `${data.progress.toFixed(1)}%`;
    
    // Update wallet totals if provided
    if (walletContent && data.playerEarnings) {
        const earningsHTML = Object.entries(data.playerEarnings)
            .map(([player, amount]) => `${player}: <span style="color: #22c55e;">$${amount.toFixed(2)}</span>`)
            .join('<br>');
        walletContent.innerHTML = earningsHTML;
    }
}

// Function to close Lightning Test progress modal
function closeLightningTestProgressModal() {
    const modal = document.getElementById('lightningTestProgressModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}
