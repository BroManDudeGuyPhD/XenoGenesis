// ================================================
// EXPERIMENT END MODAL MODULE
// Retro-future neon experiment completion stats screen
// Tabbed: Overview · Round Results · CSV Data
// ================================================

// ── State for CSV validation inside the modal ──
let _expEndCSVChecks = [];   // {name, pass}
let _expEndCSVLoading = false;

// ── Tab switching for experiment-end modal ──
function _expEndSwitchTab(tab) {
    const tabs = {
        overview: { btn: document.getElementById('exp-end-tab-overview'), content: document.getElementById('exp-end-tab-content-overview') },
        rounds:  { btn: document.getElementById('exp-end-tab-rounds'),  content: document.getElementById('exp-end-tab-content-rounds') },
        csv:     { btn: document.getElementById('exp-end-tab-csv'),     content: document.getElementById('exp-end-tab-content-csv') },
    };

    // Check if CSV has problems (red dot present = problems)
    const csvHasProblems = tabs.csv.btn && tabs.csv.btn.innerHTML.includes('exp-end-csv-dot');

    Object.keys(tabs).forEach(key => {
        const t = tabs[key];
        if (!t.btn || !t.content) return;

        if (key === tab) {
            t.btn.style.color = '#00ffff';
            t.btn.style.borderBottomColor = '#00ffff';
            t.btn.style.fontWeight = '600';
            t.content.style.display = '';
        } else {
            if (key === 'csv' && csvHasProblems) {
                t.btn.style.color = '#f04747';
                t.btn.style.borderBottomColor = 'transparent';
                t.btn.style.fontWeight = '700';
            } else {
                t.btn.style.color = 'rgba(255,255,255,0.5)';
                t.btn.style.borderBottomColor = 'transparent';
                t.btn.style.fontWeight = '500';
            }
            t.content.style.display = 'none';
        }
    });
}

// ── Build Round Results tab HTML from roundHistory array ──
function _expEndBuildRoundsHTML(roundHistory) {
    if (!roundHistory || roundHistory.length === 0) {
        return '<div style="color:rgba(255,255,255,0.4); font-size:12px; font-family:\'Courier New\',monospace; text-align:center; padding:20px;">No round data available.</div>';
    }

    let html = '';

    // Summary stats row
    const condSet = new Set(roundHistory.map(r => (r.condition && r.condition.name) || '—'));
    const firstTokens = roundHistory[0].whiteTokensRemaining || 0;
    const lastTokens = roundHistory[roundHistory.length - 1].whiteTokensRemaining || 0;
    const culturantCount = roundHistory.filter(r => r.culturantProduced).length;

    html += `<div style="margin-bottom:10px; padding:8px 12px; background:rgba(0,255,255,0.04); border:1px solid rgba(0,255,255,0.12); border-radius:6px; display:flex; gap:16px; flex-wrap:wrap; font-size:11px; color:rgba(0,255,255,0.7); font-family:'Courier New',monospace;">
        <span>📋 ${roundHistory.length} rounds</span>
        <span>🔬 ${condSet.size} condition${condSet.size > 1 ? 's' : ''}</span>
        <span>⚫ ${culturantCount} culturant${culturantCount !== 1 ? 's' : ''}</span>
        <span>🪙 ${firstTokens.toLocaleString()} → ${lastTokens.toLocaleString()} tokens</span>
    </div>`;

    // Table header
    html += `<div style="display:grid; grid-template-columns:42px 1fr 1fr 50px 60px; gap:2px 8px; font-size:10px; padding:4px 0 2px; border-bottom:1px solid rgba(0,255,255,0.15); color:rgba(255,255,255,0.5); font-weight:600; font-family:'Courier New',monospace; text-transform:uppercase; letter-spacing:1px;">
        <span>Rnd</span><span>Condition</span><span>Incentive</span><span style="text-align:center;">⚫</span><span style="text-align:right;">Tokens</span>
    </div>`;

    // Table rows (scrollable)
    html += '<div style="max-height:200px; overflow-y:auto;">';
    roundHistory.forEach((r, i) => {
        const bg = i % 2 === 0 ? 'transparent' : 'rgba(0,255,255,0.02)';
        const condName = (r.condition && r.condition.name) || '—';
        const incentive = r.incentiveDisplay || r.incentive || '—';
        const tokens = r.whiteTokensRemaining || 0;
        const tokenColor = tokens < 100 ? '#f04747' : tokens < 500 ? '#f59e0b' : 'rgba(255,255,255,0.6)';
        const culturantIcon = r.culturantProduced ? '⚫' : '—';
        const culturantColor = r.culturantProduced ? '#ff0080' : 'rgba(255,255,255,0.25)';

        html += `<div style="display:grid; grid-template-columns:42px 1fr 1fr 50px 60px; gap:2px 8px; font-size:11px; padding:3px 0; background:${bg}; color:rgba(255,255,255,0.6); font-family:'Courier New',monospace;">
            <span style="color:#00ffff;">${r.round}</span>
            <span style="color:rgba(224,195,252,0.8); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${condName}</span>
            <span style="color:${incentive === 'No Incentive' || incentive === 'none' || incentive === '—' ? 'rgba(255,255,255,0.3)' : '#34d399'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${incentive}</span>
            <span style="text-align:center; color:${culturantColor};">${culturantIcon}</span>
            <span style="text-align:right; color:${tokenColor};">${tokens.toLocaleString()}</span>
        </div>`;
    });
    html += '</div>';

    return html;
}

// ── CSV validation: fetch CSV and run integrity checks ──
async function _expEndValidateCSV(roomName) {
    _expEndCSVChecks = [];
    _expEndCSVLoading = true;
    _expEndRenderCSVTab(roomName);

    // Visual feedback: disable button and show loading state
    const validateBtn = document.getElementById('exp-end-csv-validate-btn');
    if (validateBtn) {
        validateBtn.disabled = true;
        validateBtn.dataset.originalText = validateBtn.innerHTML;
        validateBtn.innerHTML = '<span>⏳</span> Validating...';
        validateBtn.style.opacity = '0.6';
        validateBtn.style.cursor = 'wait';
    }

    try {
        const resp = await fetch(`/api/download-experiment-csv/${encodeURIComponent(roomName)}`);
        if (!resp.ok) {
            _expEndCSVChecks = [{ name: `CSV download failed: HTTP ${resp.status}`, pass: false }];
            _expEndCSVLoading = false;
            _expEndRenderCSVTab(roomName);
            _expEndUpdateCSVTabLabel();
            return;
        }

        const csvText = await resp.text();
        const lines = csvText.split('\n').filter(l => l.trim().length > 0);

        // Check 1: CSV has content
        _expEndCSVChecks.push({
            name: `CSV file is not empty (${csvText.length.toLocaleString()} bytes)`,
            pass: csvText.length > 0
        });

        // Check 2: Has header row
        const hasHeader = lines.length > 0 && lines[0].includes(',');
        _expEndCSVChecks.push({
            name: `CSV has header row${hasHeader ? ' (' + lines[0].split(',').length + ' columns)' : ''}`,
            pass: hasHeader
        });

        // Check 3: Has data rows beyond header
        const dataRowCount = lines.length - 1;
        _expEndCSVChecks.push({
            name: `CSV has data rows (${dataRowCount} rows)`,
            pass: dataRowCount > 0
        });

        if (hasHeader && dataRowCount > 0) {
            const headerCols = lines[0].split(',').length;

            // Check 4: All rows have consistent column count
            let inconsistentRows = 0;
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').length;
                if (cols !== headerCols) inconsistentRows++;
            }
            _expEndCSVChecks.push({
                name: `Column count consistent across all rows${inconsistentRows > 0 ? ' (' + inconsistentRows + ' mismatched)' : ''}`,
                pass: inconsistentRows === 0
            });

            // Check 5: Required headers present
            const headerRow = lines[0].toLowerCase();
            const requiredHeaders = ['round', 'condition', 'player'];
            const foundHeaders = requiredHeaders.filter(h => headerRow.includes(h));
            _expEndCSVChecks.push({
                name: `Required headers present (${foundHeaders.join(', ')}${foundHeaders.length < requiredHeaders.length ? ' — missing: ' + requiredHeaders.filter(h => !headerRow.includes(h)).join(', ') : ''})`,
                pass: foundHeaders.length === requiredHeaders.length
            });

            // Check 6: No empty critical fields in first data row
            if (lines.length > 1) {
                const firstDataRow = lines[1].split(',');
                const emptyFields = firstDataRow.filter(f => f.trim() === '').length;
                _expEndCSVChecks.push({
                    name: `First data row populated (${firstDataRow.length - emptyFields}/${firstDataRow.length} fields have values)`,
                    pass: emptyFields < firstDataRow.length / 2
                });
            }

            // Check 7: Round numbers present and sequential
            const roundColIdx = lines[0].split(',').findIndex(h => h.trim().toLowerCase().includes('round'));
            if (roundColIdx >= 0) {
                const rounds = [];
                for (let i = 1; i < lines.length; i++) {
                    const val = parseInt(lines[i].split(',')[roundColIdx]);
                    if (!isNaN(val) && !rounds.includes(val)) rounds.push(val);
                }
                rounds.sort((a, b) => a - b);
                _expEndCSVChecks.push({
                    name: `Round numbers found (${rounds.length} unique: ${rounds[0]}–${rounds[rounds.length - 1]})`,
                    pass: rounds.length > 0
                });
            }
        }

    } catch (err) {
        _expEndCSVChecks.push({ name: `CSV validation error: ${err.message}`, pass: false });
    }

    _expEndCSVLoading = false;
    _expEndRenderCSVTab(roomName);
    _expEndUpdateCSVTabLabel();
    _expEndUpdateOverviewCSVBanner();

    // Restore button and flash to signal completion
    const validateBtnDone = document.getElementById('exp-end-csv-validate-btn');
    if (validateBtnDone) {
        validateBtnDone.disabled = false;
        validateBtnDone.innerHTML = validateBtnDone.dataset.originalText || '<span>🔍</span> Validate CSV';
        validateBtnDone.style.opacity = '1';
        validateBtnDone.style.cursor = 'pointer';
        // Brief flash to confirm re-validation completed
        validateBtnDone.style.boxShadow = '0 0 15px rgba(114, 137, 255, 0.5)';
        setTimeout(() => { validateBtnDone.style.boxShadow = ''; }, 800);
    }
}

// ── Full block-level evaluation: fetch CSV → POST to /api/evaluate-csv → showEvaluationModal ──
async function _expEndFullEvaluateCSV(roomName) {
    const validateBtn = document.getElementById('exp-end-csv-validate-btn');
    if (validateBtn) {
        validateBtn.disabled = true;
        validateBtn.dataset.originalText = validateBtn.innerHTML;
        validateBtn.innerHTML = '<span>⏳</span> Evaluating...';
        validateBtn.style.opacity = '0.6';
        validateBtn.style.cursor = 'wait';
    }

    try {
        // Step 1: Fetch the CSV from the server (uses recentCSVCache after cleanup)
        const csvResp = await fetch(`/api/download-experiment-csv/${encodeURIComponent(roomName)}`);
        if (!csvResp.ok) {
            alert(`CSV download failed: HTTP ${csvResp.status}. Try downloading manually first.`);
            return;
        }
        const csvText = await csvResp.text();

        if (!csvText || csvText.trim().length === 0) {
            alert('CSV content is empty. Cannot evaluate.');
            return;
        }

        // Step 2: POST CSV content to /api/evaluate-csv for deep block validation
        const evalResp = await fetch('/api/evaluate-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: csvText, room: roomName })
        });
        const result = await evalResp.json();

        if (!result) {
            alert('No response from evaluation server.');
            return;
        }
        if (result.error) {
            alert('Evaluation error: ' + result.error);
            return;
        }

        // Step 3: Show the full block health evaluation modal (z-index 20000, layers above experiment-end modal)
        const report = result.report || {};
        if (typeof showEvaluationModal === 'function') {
            showEvaluationModal(report);
        } else {
            alert('Evaluation modal not available. Please use the Evaluate CSV option from the main menu.');
        }
    } catch (err) {
        console.error('❌ Full CSV evaluation failed:', err);
        alert('Evaluation failed: ' + err.message);
    } finally {
        // Restore button state
        if (validateBtn) {
            validateBtn.disabled = false;
            validateBtn.innerHTML = validateBtn.dataset.originalText || '<span>🔍</span> Validate CSV';
            validateBtn.style.opacity = '1';
            validateBtn.style.cursor = 'pointer';
            validateBtn.style.boxShadow = '0 0 15px rgba(114, 137, 255, 0.5)';
            setTimeout(() => { if (validateBtn) validateBtn.style.boxShadow = ''; }, 800);
        }
    }
}

// ── Render CSV tab content ──
function _expEndRenderCSVTab(roomName) {
    const container = document.getElementById('exp-end-csv-checks-container');
    if (!container) return;

    if (_expEndCSVLoading) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:rgba(0,255,255,0.6); font-family:'Courier New',monospace; font-size:12px;">
            <div style="margin-bottom:8px; font-size:18px;">⏳</div>
            Fetching & validating CSV data...
        </div>`;
        return;
    }

    if (_expEndCSVChecks.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:rgba(255,255,255,0.4); font-family:'Courier New',monospace; font-size:12px;">
            Click "Validate CSV" to check data integrity.
        </div>`;
        return;
    }

    const passed = _expEndCSVChecks.filter(c => c.pass).length;
    const failed = _expEndCSVChecks.filter(c => !c.pass).length;
    const allGood = failed === 0;

    let html = '';

    // Summary pill
    html += `<div style="margin-bottom:10px; padding:8px 14px; background:${allGood ? 'rgba(0,255,136,0.06)' : 'rgba(240,71,71,0.06)'}; border:1px solid ${allGood ? 'rgba(0,255,136,0.2)' : 'rgba(240,71,71,0.2)'}; border-radius:8px; text-align:center;">
        <span style="font-size:13px; font-weight:600; color:${allGood ? '#00ff88' : '#f04747'}; font-family:'Courier New',monospace;">
            ${allGood ? '✅ All CSV integrity checks passed' : `⚠️ ${failed} check${failed > 1 ? 's' : ''} failed`}
        </span>
        <span style="font-size:11px; color:rgba(255,255,255,0.4); margin-left:8px;">(${passed}/${_expEndCSVChecks.length})</span>
    </div>`;

    // Check list
    _expEndCSVChecks.forEach(c => {
        const icon = c.pass ? '✅' : '❌';
        const color = c.pass ? '#00ff88' : '#f04747';
        html += `<div style="display:flex; align-items:flex-start; gap:8px; padding:4px 0;">
            <span style="flex-shrink:0; font-size:13px;">${icon}</span>
            <span style="color:${color}; font-size:11px; font-family:'Courier New',monospace; line-height:1.4;">${c.name}</span>
        </div>`;
    });

    container.innerHTML = html;
}

// ── Update CSV tab label with red dot if failures ──
function _expEndUpdateCSVTabLabel() {
    const btn = document.getElementById('exp-end-tab-csv');
    if (!btn) return;

    const failed = _expEndCSVChecks.filter(c => !c.pass).length;
    const hasProblems = failed > 0 && _expEndCSVChecks.length > 0;
    const total = _expEndCSVChecks.length;

    const dot = hasProblems
        ? `<span class="exp-end-csv-dot" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#f04747; margin-left:6px; vertical-align:middle; box-shadow:0 0 4px rgba(240,71,71,0.6);"></span>`
        : '';

    btn.innerHTML = `📊 CSV Data${total > 0 ? ` (${total})` : ''}${dot}`;

    // Apply persistent red styling when not active
    if (hasProblems) {
        btn.setAttribute('data-csv-problems', 'true');
    } else {
        btn.removeAttribute('data-csv-problems');
    }
}

// ── Update Overview tab's CSV banner after validation ──
function _expEndUpdateOverviewCSVBanner() {
    const banner = document.getElementById('exp-end-csv-banner');
    if (!banner) return;

    if (_expEndCSVChecks.length === 0) {
        banner.style.display = 'none';
        return;
    }

    const passed = _expEndCSVChecks.filter(c => c.pass).length;
    const failed = _expEndCSVChecks.filter(c => !c.pass).length;
    const allGood = failed === 0;

    banner.style.display = 'flex';
    if (allGood) {
        banner.style.background = 'rgba(0,255,136,0.06)';
        banner.style.borderColor = 'rgba(0,255,136,0.2)';
        banner.innerHTML = `
            <span style="font-size:16px;">📊</span>
            <div>
                <div style="font-size:12px; font-weight:600; color:#00ff88; font-family:'Courier New',monospace;">CSV Data Integrity — All Clear</div>
                <div style="font-size:11px; color:rgba(255,255,255,0.4); margin-top:2px;">${passed}/${_expEndCSVChecks.length} integrity checks passed</div>
            </div>`;
    } else {
        banner.style.background = 'rgba(240,71,71,0.06)';
        banner.style.borderColor = 'rgba(240,71,71,0.2)';
        banner.innerHTML = `
            <span style="font-size:16px;">⚠️</span>
            <div>
                <div style="font-size:12px; font-weight:600; color:#f04747; font-family:'Courier New',monospace;">CSV Data Integrity — ${failed} Problem${failed > 1 ? 's' : ''}</div>
                <div style="font-size:11px; color:rgba(255,255,255,0.4); margin-top:2px;">See the CSV Data tab for details</div>
            </div>`;
    }
}

// ── Main: Show experiment ended modal with tabbed UI ──
function showExperimentEndedModal(data) {
    // Remove any existing modal
    const existingModal = document.getElementById('experimentEndedModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Reset CSV state
    _expEndCSVChecks = [];
    _expEndCSVLoading = false;

    // Extract data with defaults
    const reason = data.reason || data.message || 'Experiment completed';
    const totalRounds = data.totalRounds || 0;
    const maxRounds = data.maxRounds || 189;
    const tokensUsed = data.tokensUsed || 0;
    const startingTokenPool = data.startingTokenPool || 0;
    const finalTokenPool = data.finalTokenPool || 0;
    const culturantsProduced = data.culturantsProduced || 0;
    const selfControlChoices = data.selfControlChoices || 0;
    const impulsiveChoices = data.impulsiveChoices || 0;
    const sessionDuration = data.sessionDuration || 0;
    const playerStats = data.playerStats || [];
    const isModerator = data.isModerator || window.currentUserIsModerator || false;
    const roomName = data.roomName || currentRoom || 'Unknown';
    const roundHistory = data.roundHistory || [];
    
    // Format session duration
    const minutes = Math.floor(sessionDuration / 60);
    const seconds = sessionDuration % 60;
    const durationStr = sessionDuration > 0 ? `${minutes}m ${seconds}s` : '—';
    
    // Calculate choice percentages
    const totalChoices = selfControlChoices + impulsiveChoices;
    const selfControlPct = totalChoices > 0 ? Math.round((selfControlChoices / totalChoices) * 100) : 0;
    const impulsivePct = totalChoices > 0 ? Math.round((impulsiveChoices / totalChoices) * 100) : 0;
    
    // Generate player stats HTML
    const playerStatsHTML = playerStats.length > 0 ? playerStats.map(p => `
        <div class="exp-end-player-row">
            <span class="exp-end-player-name">${p.isAI ? '🤖' : '👤'} ${p.username}</span>
            <span class="exp-end-player-tokens">
                <span class="exp-end-white-token">⚪ ${p.whiteTokens}</span>
                <span class="exp-end-black-token">⚫ ${p.blackTokens}</span>
            </span>
        </div>
    `).join('') : '<div style="color:rgba(255,255,255,0.4); font-size:12px; font-family:\'Courier New\',monospace; text-align:center; padding:10px;">No player data available</div>';
    
    // CSV download button (moderator only)
    const csvDownloadBtnHTML = isModerator ? `
        <button onclick="downloadExperimentCSVFromModal('${roomName}')" class="exp-end-csv-download-btn">
            <span>💾</span> Download CSV
        </button>
    ` : '';

    // CSV validate button (moderator only) — runs full block-level evaluation via /api/evaluate-csv
    const csvValidateBtnHTML = isModerator ? `
        <button onclick="_expEndFullEvaluateCSV('${roomName}')" class="exp-end-csv-validate-btn" id="exp-end-csv-validate-btn">
            <span>🔍</span> Validate CSV
        </button>
    ` : '';

    // Build round results tab content
    const roundsTabHTML = _expEndBuildRoundsHTML(roundHistory);

    // Determine if we have stats (rich payload from Entity.js) or minimal (moderator force-end)
    const hasStats = totalRounds > 0 || tokensUsed > 0 || totalChoices > 0;

    // ── Tab styling constants ──
    const tabBase = `padding:10px 16px; font-size:12px; font-weight:500; cursor:pointer; border:none; border-bottom:2px solid transparent; background:none; transition:all 0.2s ease; font-family:'Courier New',monospace; letter-spacing:1px;`;
    const tabActive = `color:#00ffff; border-bottom-color:#00ffff; font-weight:600;`;
    const tabInactive = `color:rgba(255,255,255,0.5);`;

    const modalHTML = `
        <div id="experimentEndedModal" class="exp-end-overlay">
            <div class="exp-end-container">
                <!-- Scanline overlay -->
                <div class="exp-end-scanlines"></div>
                
                <!-- Neon border glow -->
                <div class="exp-end-neon-border"></div>
                
                <!-- Header -->
                <div class="exp-end-header">
                    <div class="exp-end-title-glow">EXPERIMENT COMPLETE</div>
                    <div class="exp-end-subtitle">${reason}</div>
                </div>
                
                <!-- Tabs -->
                <div class="exp-end-tab-bar">
                    <button id="exp-end-tab-overview" onclick="_expEndSwitchTab('overview')" style="${tabBase} ${tabActive}">
                        📈 Overview
                    </button>
                    <button id="exp-end-tab-rounds" onclick="_expEndSwitchTab('rounds')" style="${tabBase} ${tabInactive}">
                        📋 Rounds (${roundHistory.length})
                    </button>
                    <button id="exp-end-tab-csv" onclick="_expEndSwitchTab('csv')" style="${tabBase} ${tabInactive}">
                        📊 CSV Data
                    </button>
                </div>
                
                <!-- Tab Content: Overview -->
                <div id="exp-end-tab-content-overview" class="exp-end-tab-content">
                    <!-- CSV Status Banner (hidden until validation runs) -->
                    <div id="exp-end-csv-banner" style="display:none; margin-bottom:15px; padding:10px 14px; border:1px solid rgba(0,255,255,0.15); border-radius:8px; align-items:center; gap:10px;"></div>
                    
                    ${hasStats ? `
                    <!-- Main stats grid -->
                    <div class="exp-end-stats-grid">
                        <div class="exp-end-stat-card exp-end-stat-rounds">
                            <div class="exp-end-stat-icon">🔄</div>
                            <div class="exp-end-stat-value">${totalRounds}<span class="exp-end-stat-max">/${maxRounds}</span></div>
                            <div class="exp-end-stat-label">ROUNDS</div>
                        </div>
                        
                        <div class="exp-end-stat-card exp-end-stat-duration">
                            <div class="exp-end-stat-icon">⏱️</div>
                            <div class="exp-end-stat-value">${durationStr}</div>
                            <div class="exp-end-stat-label">DURATION</div>
                        </div>
                        
                        <div class="exp-end-stat-card exp-end-stat-tokens">
                            <div class="exp-end-stat-icon">🪙</div>
                            <div class="exp-end-stat-value">${tokensUsed}<span class="exp-end-stat-max">/${startingTokenPool}</span></div>
                            <div class="exp-end-stat-label">TOKENS USED</div>
                        </div>
                        
                        <div class="exp-end-stat-card exp-end-stat-culturants">
                            <div class="exp-end-stat-icon">⚫</div>
                            <div class="exp-end-stat-value">${culturantsProduced}</div>
                            <div class="exp-end-stat-label">CULTURANTS</div>
                        </div>
                    </div>
                    
                    <!-- Choice breakdown -->
                    <div class="exp-end-choices-section">
                        <div class="exp-end-section-title">CHOICE BREAKDOWN</div>
                        <div class="exp-end-choice-bar-container">
                            <div class="exp-end-choice-bar">
                                <div class="exp-end-choice-self-control" style="width: ${selfControlPct}%"></div>
                                <div class="exp-end-choice-impulsive" style="width: ${impulsivePct}%"></div>
                            </div>
                            <div class="exp-end-choice-labels">
                                <span class="exp-end-choice-label-sc">🧘 Self-Control: ${selfControlPct}%</span>
                                <span class="exp-end-choice-label-imp">⚡ Impulsive: ${impulsivePct}%</span>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div style="text-align:center; padding:20px; color:rgba(255,255,255,0.5); font-family:'Courier New',monospace; font-size:13px;">
                        Experiment ended by moderator. Detailed stats not available.
                    </div>
                    `}
                    
                    <!-- Player leaderboard -->
                    <div class="exp-end-players-section">
                        <div class="exp-end-section-title">PLAYER RESULTS</div>
                        <div class="exp-end-players-list">
                            ${playerStatsHTML}
                        </div>
                    </div>
                </div>
                
                <!-- Tab Content: Round Results -->
                <div id="exp-end-tab-content-rounds" class="exp-end-tab-content" style="display:none;">
                    ${roundsTabHTML}
                </div>
                
                <!-- Tab Content: CSV Data -->
                <div id="exp-end-tab-content-csv" class="exp-end-tab-content" style="display:none;">
                    ${isModerator ? `
                    <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                        ${csvDownloadBtnHTML}
                        ${csvValidateBtnHTML}
                    </div>
                    <div id="exp-end-csv-checks-container">
                        <div style="text-align:center; padding:20px; color:rgba(255,255,255,0.4); font-family:'Courier New',monospace; font-size:12px;">
                            Click "Validate CSV" to check data integrity.
                        </div>
                    </div>
                    ` : `
                    <div style="text-align:center; padding:30px; color:rgba(255,255,255,0.4); font-family:'Courier New',monospace; font-size:12px;">
                        CSV data download is available to the room moderator only.
                    </div>
                    `}
                </div>
                
                <!-- Action buttons (always visible) -->
                <div class="exp-end-actions">
                    <button onclick="closeExperimentEndedModal()" class="exp-end-return-btn">
                        <span>🏠</span> Return to Global Chat
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            .exp-end-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.92);
                backdrop-filter: blur(8px);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: expEndFadeIn 0.4s ease-out;
            }
            
            .exp-end-container {
                max-width: 640px;
                width: 95%;
                max-height: 90vh;
                overflow-y: auto;
                background: linear-gradient(180deg, 
                    rgba(10, 12, 20, 0.98) 0%, 
                    rgba(15, 18, 30, 0.98) 100%);
                border: 2px solid rgba(0, 255, 255, 0.3);
                border-radius: 12px;
                padding: 0;
                position: relative;
                box-shadow: 
                    0 0 40px rgba(0, 255, 255, 0.15),
                    0 0 80px rgba(255, 0, 128, 0.1),
                    inset 0 0 60px rgba(0, 0, 0, 0.5);
                animation: expEndSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .exp-end-scanlines {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 255, 255, 0.02) 2px,
                    rgba(0, 255, 255, 0.02) 4px
                );
                pointer-events: none;
                border-radius: 12px;
                z-index: 1;
            }
            
            .exp-end-neon-border {
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 14px;
                background: linear-gradient(45deg, 
                    rgba(0, 255, 255, 0.5), 
                    rgba(255, 0, 128, 0.5), 
                    rgba(0, 255, 255, 0.5));
                z-index: -1;
                animation: expEndNeonPulse 3s ease-in-out infinite;
                filter: blur(3px);
            }
            
            .exp-end-header {
                text-align: center;
                padding: 25px 30px 15px;
                position: relative;
                z-index: 2;
            }
            
            .exp-end-title-glow {
                font-size: 28px;
                font-weight: 800;
                letter-spacing: 4px;
                color: #00ffff;
                text-shadow: 
                    0 0 10px rgba(0, 255, 255, 0.8),
                    0 0 20px rgba(0, 255, 255, 0.6),
                    0 0 40px rgba(0, 255, 255, 0.4);
                animation: expEndTitleFlicker 4s ease-in-out infinite;
                font-family: 'Courier New', monospace;
            }
            
            .exp-end-subtitle {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 8px;
                font-family: 'Courier New', monospace;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            
            /* ── Tab bar ── */
            .exp-end-tab-bar {
                display: flex;
                gap: 2px;
                padding: 0 20px;
                border-bottom: 1px solid rgba(0, 255, 255, 0.12);
                position: relative;
                z-index: 2;
            }
            
            .exp-end-tab-content {
                padding: 20px 25px;
                position: relative;
                z-index: 2;
            }
            
            .exp-end-stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .exp-end-stat-card {
                background: rgba(0, 20, 40, 0.6);
                border: 1px solid rgba(0, 255, 255, 0.2);
                border-radius: 8px;
                padding: 12px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .exp-end-stat-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.5), transparent);
            }
            
            .exp-end-stat-icon {
                font-size: 22px;
                margin-bottom: 4px;
            }
            
            .exp-end-stat-value {
                font-size: 26px;
                font-weight: 700;
                color: #00ffff;
                font-family: 'Courier New', monospace;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            }
            
            .exp-end-stat-max {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .exp-end-stat-label {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.6);
                letter-spacing: 2px;
                margin-top: 4px;
                font-family: 'Courier New', monospace;
            }
            
            .exp-end-stat-culturants {
                border-color: rgba(255, 0, 128, 0.3);
            }
            
            .exp-end-stat-culturants .exp-end-stat-value {
                color: #ff0080;
                text-shadow: 0 0 10px rgba(255, 0, 128, 0.5);
            }
            
            .exp-end-stat-culturants::before {
                background: linear-gradient(90deg, transparent, rgba(255, 0, 128, 0.5), transparent);
            }
            
            .exp-end-section-title {
                font-size: 11px;
                color: rgba(0, 255, 255, 0.8);
                letter-spacing: 3px;
                margin-bottom: 10px;
                font-family: 'Courier New', monospace;
                text-align: center;
            }
            
            .exp-end-choices-section {
                margin-bottom: 20px;
            }
            
            .exp-end-choice-bar-container {
                background: rgba(0, 20, 40, 0.6);
                border: 1px solid rgba(0, 255, 255, 0.2);
                border-radius: 8px;
                padding: 12px;
            }
            
            .exp-end-choice-bar {
                height: 18px;
                border-radius: 9px;
                overflow: hidden;
                display: flex;
                background: rgba(0, 0, 0, 0.5);
            }
            
            .exp-end-choice-self-control {
                background: linear-gradient(90deg, #00ff88, #00cc6a);
                box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
                transition: width 1s ease-out;
            }
            
            .exp-end-choice-impulsive {
                background: linear-gradient(90deg, #ff4444, #cc0000);
                box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
                transition: width 1s ease-out;
            }
            
            .exp-end-choice-labels {
                display: flex;
                justify-content: space-between;
                margin-top: 8px;
                font-size: 11px;
                font-family: 'Courier New', monospace;
            }
            
            .exp-end-choice-label-sc {
                color: #00ff88;
            }
            
            .exp-end-choice-label-imp {
                color: #ff4444;
            }
            
            .exp-end-players-section {
                margin-bottom: 5px;
            }
            
            .exp-end-players-list {
                background: rgba(0, 20, 40, 0.6);
                border: 1px solid rgba(0, 255, 255, 0.2);
                border-radius: 8px;
                padding: 8px;
            }
            
            .exp-end-player-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 7px 10px;
                border-bottom: 1px solid rgba(0, 255, 255, 0.08);
            }
            
            .exp-end-player-row:last-child {
                border-bottom: none;
            }
            
            .exp-end-player-name {
                color: rgba(255, 255, 255, 0.9);
                font-family: 'Courier New', monospace;
                font-size: 13px;
            }
            
            .exp-end-player-tokens {
                display: flex;
                gap: 15px;
                font-family: 'Courier New', monospace;
                font-size: 13px;
            }
            
            .exp-end-white-token {
                color: #ffffff;
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
            }
            
            .exp-end-black-token {
                color: #ff0080;
                text-shadow: 0 0 5px rgba(255, 0, 128, 0.5);
            }
            
            .exp-end-actions {
                padding: 15px 25px 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                position: relative;
                z-index: 2;
                border-top: 1px solid rgba(0, 255, 255, 0.08);
            }
            
            .exp-end-csv-download-btn {
                background: linear-gradient(135deg, rgba(255, 165, 0, 0.15) 0%, rgba(255, 140, 0, 0.15) 100%);
                border: 1px solid rgba(255, 165, 0, 0.4);
                color: #ffa500;
                padding: 10px 18px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                text-shadow: 0 0 8px rgba(255, 165, 0, 0.4);
                flex: 1;
            }
            
            .exp-end-csv-download-btn:hover {
                background: linear-gradient(135deg, rgba(255, 165, 0, 0.3) 0%, rgba(255, 140, 0, 0.3) 100%);
                box-shadow: 0 0 15px rgba(255, 165, 0, 0.25);
                transform: translateY(-1px);
            }

            .exp-end-csv-validate-btn {
                background: linear-gradient(135deg, rgba(114, 137, 255, 0.15) 0%, rgba(90, 110, 220, 0.15) 100%);
                border: 1px solid rgba(114, 137, 255, 0.4);
                color: #7289ff;
                padding: 10px 18px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                text-shadow: 0 0 8px rgba(114, 137, 255, 0.4);
                flex: 1;
            }
            
            .exp-end-csv-validate-btn:hover {
                background: linear-gradient(135deg, rgba(114, 137, 255, 0.3) 0%, rgba(90, 110, 220, 0.3) 100%);
                box-shadow: 0 0 15px rgba(114, 137, 255, 0.25);
                transform: translateY(-1px);
            }
            
            .exp-end-return-btn {
                background: linear-gradient(135deg, rgba(0, 255, 255, 0.15) 0%, rgba(0, 200, 200, 0.15) 100%);
                border: 1px solid rgba(0, 255, 255, 0.4);
                color: #00ffff;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            }
            
            .exp-end-return-btn:hover {
                background: linear-gradient(135deg, rgba(0, 255, 255, 0.3) 0%, rgba(0, 200, 200, 0.3) 100%);
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
                transform: translateY(-2px);
            }
            
            @keyframes expEndFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes expEndSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-30px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes expEndNeonPulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 0.8; }
            }
            
            @keyframes expEndTitleFlicker {
                0%, 100% { opacity: 1; }
                92% { opacity: 1; }
                93% { opacity: 0.8; }
                94% { opacity: 1; }
                95% { opacity: 0.9; }
                96% { opacity: 1; }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Auto-validate CSV for moderators after a short delay
    if (isModerator) {
        setTimeout(() => _expEndValidateCSV(roomName), 600);
    }
}

// Download CSV from the experiment end modal
function downloadExperimentCSVFromModal(roomName) {
    const downloadUrl = `/api/download-experiment-csv/${encodeURIComponent(roomName)}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `experiment_${roomName}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`📊 CSV download initiated from experiment end modal for room: ${roomName}`);
}
