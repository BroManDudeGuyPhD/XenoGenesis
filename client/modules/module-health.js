// ================================================
// MODULE HEALTH CHECK
// Runtime diagnostic screen for moderators/admins.
// Validates that every extracted client module loaded
// correctly and all expected functions are available.
// Also supports running the full server-side integration
// test suite with live terminal output streaming.
// ================================================

/**
 * Registry of every module and its expected top-level functions.
 * Keep this in sync when modules are added / renamed.
 */
const MODULE_HEALTH_REGISTRY = [
    {
        name: 'modals.js',
        icon: '🪟',
        functions: [
            'showSessionExpiredModal',
            'closeSessionExpiredModal',
            'showGlassmorphismAlert',
            'closeGlassmorphismAlert'
        ]
    },
    {
        name: 'neon-alerts.js',
        icon: '💡',
        functions: [
            'showNeonRoomJoinAlert',
            'showNeonWelcomeAlert'
        ]
    },
    {
        name: 'invite-modals.js',
        icon: '✉️',
        functions: [
            'showInviteCodeAlert',
            'copyInviteCode',
            'copyInviteLink',
            'closeInviteCodeAlert'
        ]
    },
    {
        name: 'experiment-end-modal.js',
        icon: '🏁',
        functions: [
            'showExperimentEndedModal',
            'downloadExperimentCSVFromModal'
        ]
    },
    {
        name: 'lightning-modals.js',
        icon: '⚡',
        functions: [
            'showLightningTestResults',
            'closeLightningTestResults',
            'downloadLightningTestCSV',
            'downloadExperimentCSV',
            'updateCSVStatus',
            'showLightningTestProgressModal',
            'updateLightningTestProgress',
            'closeLightningTestProgressModal'
        ]
    },
    {
        name: 'notifications.js',
        icon: '🔔',
        functions: [
            'getNotificationArea',
            'showSystemNotification'
        ]
    },
    {
        name: 'debug-utils.js',
        icon: '🐛',
        functions: [
            'debugDOMState',
            'forceHeaderVisibility',
            'ensureHeaderVisibility'
        ]
    },
    {
        name: 'invite-system.js',
        icon: '🎟️',
        functions: [
            'setupPermanentInviteHandler',
            'setupInviteButtonFix',
            'createInviteChoiceModal',
            'setupSubmenuButtons',
            'showModeratorContextMenu',
            'hideModeratorContextMenu',
            'setupModeratorMenuHandlers',
            'handleEndExperiment'
        ]
    },
    {
        name: 'confirmation-modals.js',
        icon: '✅',
        functions: [
            'showEndExperimentConfirmation',
            'cancelEndExperiment',
            'confirmEndExperiment',
            'showLightningExperimentConfirmation',
            'cancelLightningExperiment',
            'confirmLightningExperiment',
            'showStartExperimentConfirmation',
            'cancelStartExperiment',
            'confirmStartExperiment',
            'handlePauseExperiment'
        ]
    },
    {
        name: 'switchboard.js',
        icon: '🎛️',
        functions: [
            'initializeSwitchboardFunctions',
            'initializeInfoTooltips',
            'updateSwitchboardClock'
        ]
    },
    {
        name: 'incentive-banner.js',
        icon: '🏷️',
        functions: [
            'showIncentiveBanner',
            'hideIncentiveBanner'
        ]
    },
    {
        name: 'token-animations.js',
        icon: '🎰',
        functions: [
            'showIncentiveTokenAnimation',
            'showTokenAnimation'
        ]
    },
    {
        name: 'results-panel.js',
        icon: '📊',
        functions: [
            'initializeRoundResultsPanel',
            'updateRoundResultsPanel'
        ]
    }
];

// ─── Integration test state ────────────────────────────────
let _healthTestRunning = false;
let _healthTestLines = [];          // collected terminal output
let _healthTestChecks = [];         // parsed validation checks
let _healthTestCSVChecks = [];      // parsed CSV integrity checks
let _healthTestRoundResults = [];   // parsed [ROUND] block summaries
let _mhInCSVSection = false;        // tracking CSV DATA INTEGRITY CHECKS section
let _healthTestStartTime = null;

/**
 * Run a health check against every registered module.
 */
function runModuleHealthCheck() {
    let funcTotal = 0;
    let funcPassed = 0;

    const modules = MODULE_HEALTH_REGISTRY.map(mod => {
        const funcs = mod.functions.map(fnName => {
            funcTotal++;
            const ok = typeof window[fnName] === 'function';
            if (ok) funcPassed++;
            return { name: fnName, ok: ok };
        });
        const allOk = funcs.every(f => f.ok);
        return {
            name: mod.name,
            icon: mod.icon,
            ok: allOk,
            functions: funcs,
            passed: funcs.filter(f => f.ok).length,
            total: funcs.length
        };
    });

    const passed = modules.filter(m => m.ok).length;

    return {
        modules: modules,
        summary: {
            total: modules.length,
            passed: passed,
            failed: modules.length - passed,
            funcTotal: funcTotal,
            funcPassed: funcPassed
        },
        timestamp: new Date().toLocaleTimeString()
    };
}

/**
 * Build the HTML table rows for the module health report.
 */
function buildModuleHealthRows(report) {
    return report.modules.map(mod => {
        const statusIcon = mod.ok ? '✅' : '❌';
        const statusColor = mod.ok ? '#43b581' : '#f04747';
        const fnDetails = mod.functions.map(fn => {
            const fnIcon = fn.ok ? '✓' : '✗';
            const fnColor = fn.ok ? '#43b581' : '#f04747';
            return `<span style="color:${fnColor}; font-size:11px; font-family:'Courier New',monospace; margin-right:8px; white-space:nowrap;">${fnIcon} ${fn.name}</span>`;
        }).join('');

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding:10px 12px; font-size:13px; white-space:nowrap;">
                    <span style="margin-right:6px;">${mod.icon}</span>${mod.name}
                </td>
                <td style="padding:10px 12px; text-align:center;">
                    <span style="color:${statusColor}; font-weight:600; font-size:18px;">${statusIcon}</span>
                </td>
                <td style="padding:10px 12px; text-align:center; font-size:12px; color:#dcddde;">
                    ${mod.passed}/${mod.total}
                </td>
                <td style="padding:10px 14px; line-height:1.8; max-width:420px;">
                    ${fnDetails}
                </td>
            </tr>`;
    }).join('');
}

// ─── Modal shared chrome ───────────────────────────────────
const _MH_MODAL_STYLE = `
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    position: fixed;
    inset: 0;
`;

const _MH_CARD_STYLE = `
    width: 92%;
    max-width: 900px;
    max-height: 88vh;
    background: linear-gradient(145deg,
        rgba(43, 45, 59, 0.98) 0%,
        rgba(54, 57, 63, 0.96) 100%);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    box-shadow:
        0 24px 64px rgba(0,0,0,0.55),
        0 8px 32px rgba(0,0,0,0.35),
        inset 0 1px 0 rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const _MH_BTN = (label, onclick, opts = {}) => {
    const bg = opts.bg || 'rgba(114,137,255,0.15)';
    const border = opts.border || 'rgba(114,137,255,0.3)';
    const color = opts.color || '#7289da';
    const icon = opts.icon || '';
    return `<button onclick="${onclick}" style="
        background: ${bg};
        border: 1px solid ${border};
        border-radius: 8px;
        color: ${color};
        padding: 5px 14px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">${icon}${label}</button>`;
};

const _MH_CLOSE_X = `<span onclick="closeModuleHealthModal()" style="
    color: #b9bbbe; font-size: 24px; font-weight: bold; cursor: pointer;
    transition: all 0.2s ease; line-height: 1;
" onmouseover="this.style.color='#fff';this.style.transform='scale(1.1)'"
   onmouseout="this.style.color='#b9bbbe';this.style.transform='scale(1)'">&times;</span>`;

// ─── Main Modal — Module Health Table ──────────────────────
function showModuleHealthModal() {
    // Remove any existing modal
    const existing = document.getElementById('moduleHealthModal');
    if (existing) existing.remove();

    const report = runModuleHealthCheck();
    const allGreen = report.summary.failed === 0;
    const summaryColor = allGreen ? '#43b581' : '#f04747';
    const summaryText = allGreen
        ? `All ${report.summary.total} modules healthy — ${report.summary.funcPassed} functions verified`
        : `${report.summary.failed} module(s) have issues — ${report.summary.funcPassed}/${report.summary.funcTotal} functions OK`;

    const modalHTML = `
        <div id="moduleHealthModal" class="modal" style="${_MH_MODAL_STYLE}">
            <div style="${_MH_CARD_STYLE}">
                <!-- Header -->
                <div style="padding:20px 24px 16px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:22px;">🩺</span>
                        <h2 style="margin:0; color:#fff; font-size:18px; font-weight:600;">Module Health</h2>
                        <span style="
                            font-size:11px; color:${summaryColor};
                            background: ${allGreen ? 'rgba(67,181,129,0.15)' : 'rgba(240,71,71,0.15)'};
                            border: 1px solid ${allGreen ? 'rgba(67,181,129,0.3)' : 'rgba(240,71,71,0.3)'};
                            border-radius: 12px; padding:3px 10px; font-weight:500;
                        ">${allGreen ? 'ALL PASS' : 'ISSUES'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:11px; color:#72767d;">Checked ${report.timestamp}</span>
                        ${_MH_BTN('Re-check', 'showModuleHealthModal()', { icon: '<i class="fas fa-sync-alt" style="margin-right:4px;"></i>' })}
                        ${_MH_BTN('Run Integration Test', 'showIntegrationTestView()', { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', color: '#10b981', icon: '<i class="fas fa-flask" style="margin-right:4px;"></i>' })}
                        ${_MH_CLOSE_X}
                    </div>
                </div>

                <!-- Summary bar -->
                <div style="padding:12px 24px; display:flex; gap:24px; flex-shrink:0; background:rgba(0,0,0,0.15); border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="color:#43b581; font-size:16px;">✅</span>
                        <span style="color:#dcddde; font-size:13px;">${report.summary.passed} modules OK</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="color:${report.summary.failed > 0 ? '#f04747' : '#72767d'}; font-size:16px;">${report.summary.failed > 0 ? '❌' : '—'}</span>
                        <span style="color:#dcddde; font-size:13px;">${report.summary.failed} failed</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="color:#7289da; font-size:16px;">⚙️</span>
                        <span style="color:#dcddde; font-size:13px;">${report.summary.funcPassed}/${report.summary.funcTotal} functions</span>
                    </div>
                </div>

                <!-- Table -->
                <div style="overflow-y:auto; flex:1; padding:0;">
                    <table style="width:100%; border-collapse:collapse; color:#dcddde;">
                        <thead>
                            <tr style="background:rgba(0,0,0,0.2); position:sticky; top:0; z-index:1;">
                                <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; color:#72767d; font-weight:600; letter-spacing:0.5px;">Module</th>
                                <th style="padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; color:#72767d; font-weight:600; letter-spacing:0.5px;">Status</th>
                                <th style="padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; color:#72767d; font-weight:600; letter-spacing:0.5px;">Funcs</th>
                                <th style="padding:10px 14px; text-align:left; font-size:11px; text-transform:uppercase; color:#72767d; font-weight:600; letter-spacing:0.5px;">Details</th>
                            </tr>
                        </thead>
                        <tbody>${buildModuleHealthRows(report)}</tbody>
                    </table>
                </div>

                <!-- Footer -->
                <div style="padding:12px 24px; border-top:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; background:rgba(0,0,0,0.1);">
                    <span style="font-size:12px; color:${summaryColor};">${summaryText}</span>
                    ${_MH_BTN('Close', 'closeModuleHealthModal()', { bg: 'linear-gradient(135deg, rgba(114,137,255,0.2), rgba(99,102,241,0.15))', border: 'rgba(114,137,255,0.35)', color: '#a5b4fc' })}
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Close on backdrop click
    const modal = document.getElementById('moduleHealthModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModuleHealthModal();
        });
    }
}

// ─── Integration Test Terminal View ────────────────────────
function showIntegrationTestView() {
    // Remove existing modal and rebuild with terminal
    const existing = document.getElementById('moduleHealthModal');
    if (existing) existing.remove();

    _healthTestRunning = false;
    _healthTestLines = [];
    _healthTestChecks = [];
    _healthTestCSVChecks = [];
    _healthTestRoundResults = [];
    _mhInCSVSection = false;
    _healthTestStartTime = null;

    const modalHTML = `
        <div id="moduleHealthModal" class="modal" style="${_MH_MODAL_STYLE}">
            <div style="${_MH_CARD_STYLE}">
                <!-- Header -->
                <div style="padding:20px 24px 16px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:22px;">🧪</span>
                        <h2 style="margin:0; color:#fff; font-size:18px; font-weight:600;">Integration Test</h2>
                        <span id="mh-test-badge" style="
                            font-size:11px; color:#72767d;
                            background: rgba(114,137,255,0.12);
                            border: 1px solid rgba(114,137,255,0.25);
                            border-radius: 12px; padding:3px 10px; font-weight:500;
                        ">IDLE</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span id="mh-test-timer" style="font-size:11px; color:#72767d; font-family:'Courier New',monospace;">00:00</span>
                        <button id="mh-run-btn" onclick="_mhStartTest()" style="
                            background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.35);
                            border-radius: 8px; color: #10b981; padding:5px 14px; font-size:12px;
                            cursor: pointer; transition: all 0.2s ease; white-space:nowrap;
                        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            <i class="fas fa-play" style="margin-right:4px;"></i>Run Test
                        </button>
                        <button id="mh-cancel-btn" onclick="_mhCancelTest()" style="
                            background: rgba(240,71,71,0.15); border: 1px solid rgba(240,71,71,0.3);
                            border-radius: 8px; color: #f04747; padding:5px 14px; font-size:12px;
                            cursor: pointer; transition: all 0.2s ease; white-space:nowrap; display:none;
                        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            <i class="fas fa-stop" style="margin-right:4px;"></i>Cancel
                        </button>
                        ${_MH_BTN('← Modules', 'showModuleHealthModal()', { icon: '<i class="fas fa-arrow-left" style="margin-right:4px;"></i>' })}
                        ${_MH_CLOSE_X}
                    </div>
                </div>

                <!-- Progress bar -->
                <div style="height:6px; background:rgba(255,255,255,0.05); flex-shrink:0;">
                    <div id="mh-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #ff2d78, #ff69b4); transition:width 0.3s ease; border-radius:0 3px 3px 0; box-shadow:0 0 8px rgba(255,45,120,0.4);"></div>
                </div>

                <!-- Terminal output -->
                <div id="mh-terminal" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 20px;
                    background: rgba(0,0,0,0.35);
                    font-family: 'Courier New', 'Consolas', monospace;
                    font-size: 12px;
                    line-height: 1.6;
                    color: #b9bbbe;
                    white-space: pre-wrap;
                    word-break: break-all;
                ">
                    <span style="color:#72767d;">Click "Run Test" to start the integration test suite.
The test will connect as a test user, create a room, run an experiment,
and validate 15 checks across rounds, tokens, incentives, and more.

Output will stream here in real-time.</span>
                </div>

                <!-- Results panel (hidden until test completes) -->
                <div id="mh-results-panel" style="display:none; flex-shrink:0;"></div>

                <!-- Footer -->
                <div style="padding:10px 24px; border-top:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; background:rgba(0,0,0,0.1);">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <span id="mh-line-count" style="font-size:11px; color:#72767d;">0 lines</span>
                        <span id="mh-round-count" style="font-size:11px; color:#72767d;"></span>
                    </div>
                    ${_MH_BTN('Close', 'closeModuleHealthModal()', { bg: 'linear-gradient(135deg, rgba(114,137,255,0.2), rgba(99,102,241,0.15))', border: 'rgba(114,137,255,0.35)', color: '#a5b4fc' })}
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Close on backdrop click
    const modal = document.getElementById('moduleHealthModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModuleHealthModal();
        });
    }
}

/**
 * Start the integration test via Socket.IO.
 */
function _mhStartTest() {
    if (_healthTestRunning) return;
    if (typeof socket === 'undefined') {
        _mhAppendLine('❌ No socket connection — cannot run test', 'error');
        return;
    }

    _healthTestRunning = true;
    _healthTestLines = [];
    _healthTestChecks = [];
    _healthTestCSVChecks = [];
    _healthTestRoundResults = [];
    _mhInCSVSection = false;
    _healthTestStartTime = Date.now();

    // Update UI
    const badge = document.getElementById('mh-test-badge');
    if (badge) { badge.textContent = 'RUNNING'; badge.style.color = '#f59e0b'; badge.style.borderColor = 'rgba(245,158,11,0.35)'; badge.style.background = 'rgba(245,158,11,0.12)'; }
    const runBtn = document.getElementById('mh-run-btn');
    if (runBtn) runBtn.style.display = 'none';
    const cancelBtn = document.getElementById('mh-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = '';
    const terminal = document.getElementById('mh-terminal');
    if (terminal) terminal.innerHTML = '';
    const resultsPanel = document.getElementById('mh-results-panel');
    if (resultsPanel) { resultsPanel.style.display = 'none'; resultsPanel.innerHTML = ''; }
    const progressBar = document.getElementById('mh-progress-bar');
    if (progressBar) progressBar.style.width = '0%';

    _mhAppendLine('🚀 Starting integration test…', 'info');

    // Start timer
    _mhTimerInterval = setInterval(_mhUpdateTimer, 1000);

    // Wire up Socket.IO listeners
    socket.on('integrationTestOutput', _mhOnOutput);
    socket.on('integrationTestComplete', _mhOnComplete);

    // Emit the run request
    socket.emit('runIntegrationTest', { rounds: 21 });
}

let _mhTimerInterval = null;

function _mhUpdateTimer() {
    if (!_healthTestStartTime) return;
    const elapsed = Math.floor((Date.now() - _healthTestStartTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    const timer = document.getElementById('mh-test-timer');
    if (timer) timer.textContent = `${min}:${sec}`;
}

/**
 * Handle a line of test output from the server.
 */
function _mhOnOutput(data) {
    if (!data || !data.line) return;
    const line = data.line;
    _healthTestLines.push(line);

    _mhAppendLine(line, data.type || 'stdout');

    // Update line counter
    const lineCount = document.getElementById('mh-line-count');
    if (lineCount) lineCount.textContent = `${_healthTestLines.length} lines`;

    // Note: [PROGRESS] lines update the progress bar and ETA directly inside _mhAppendLine.
    // This fallback catches Rounds completed in the summary for when progress lines aren't emitted.
    const roundMatch = line.match(/Rounds completed:\s*(\d+)\/(\d+)/i);
    if (roundMatch) {
        const current = parseInt(roundMatch[1], 10);
        const total = parseInt(roundMatch[2], 10);
        const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        const progressBar = document.getElementById('mh-progress-bar');
        if (progressBar) progressBar.style.width = pct + '%';
        const roundCount = document.getElementById('mh-round-count');
        if (roundCount) roundCount.textContent = `Round ${current}/${total}`;
    }

    // ── CSV section tracking ──
    // Detect when we enter/leave the CSV DATA INTEGRITY CHECKS section
    if (line.match(/CSV DATA INTEGRITY CHECKS:/i)) {
        _mhInCSVSection = true;
    } else if (_mhInCSVSection && line.match(/VALIDATION CHECKS:/i)) {
        _mhInCSVSection = false;
    }

    // Parse validation checks for the results splash
    // Checks appear as lines containing ✅ or ❌ followed by the check description
    const checkMatch = line.match(/(✅|❌)\s+(.+)/);

    // Collect CSV integrity checks (inside CSV section)
    if (_mhInCSVSection && checkMatch) {
        _healthTestCSVChecks.push({
            pass: checkMatch[1] === '✅',
            name: checkMatch[2].trim()
        });
    }
    // Also capture the CSV INTEGRITY summary line (comes right at the end of CSV section)
    if (!_mhInCSVSection && checkMatch && line.match(/CSV INTEGRITY:/i)) {
        _healthTestCSVChecks.push({
            pass: checkMatch[1] === '✅',
            name: checkMatch[2].trim(),
            isSummary: true
        });
    }

    // Collect final validation checks (outside CSV section)
    if (checkMatch && !_mhInCSVSection && line.match(/Rounds completed|Blocks seen|Conditions variety|Incentive variety|No errors|Columns selected|Player data|Token values|CSV export|Token economics|Culturant|Token pool|Experiment lifecycle|Reconnect|Incentive bonuses/i)) {
        _healthTestChecks.push({
            pass: checkMatch[1] === '✅',
            name: checkMatch[2].trim()
        });
    }
}

// ─── TAG → color mapping for terminal rendering ───────────
const _MH_TAG_COLORS = {
    '[SOCK]':    '#3b82f6',  // blue — network/socket
    '[AUTH]':    '#eab308',  // yellow — authentication
    '[SYNC]':    '#3b82f6',  // blue — sync/reconnect
    '[ROOM]':    '#8b5cf6',  // purple — room ops
    '[USERS]':   '#8b5cf6',  // purple — player list
    '[EXP]':     '#ec4899',  // pink — experiment
    '[GAME]':    '#ec4899',  // pink — game lifecycle
    '[INIT]':    '#a78bfa',  // light purple — init
    '[BLOCK]':   '#f59e0b',  // amber — block transitions
    '[TRIAD]':   '#a78bfa',  // light purple — triad
    '[TURN]':    '#6366f1',  // indigo — turns
    '[LOCK]':    '#6366f1',  // indigo — lock-in
    '[DATA]':    '#60a5fa',  // light blue — data/stats
    '[COND]':    '#c084fc',  // violet — condition
    '[BONUS]':   '#34d399',  // emerald — incentive bonus
    '[TOKEN]':   '#fbbf24',  // gold — token economics
    '[END]':     '#7289da',  // discord blue — endings
    '[PAUSE]':   '#f59e0b',  // amber
    '[RESUME]':  '#34d399',  // emerald
    '[LEAVE]':   '#72767d',  // gray
    '[CHAT]':    '#72767d',  // gray
    '[SYS]':     '#72767d',  // gray
    '[STATE]':   '#60a5fa',  // light blue — state restore
    '[DL]':      '#60a5fa',  // light blue — download
    '[FULL]':    '#f59e0b',  // amber
    '[ALERT]':   '#f04747',  // red
    '[CHECK]':   '#e0c3fc',  // lavender — validation
    '[TIMEOUT]': '#f59e0b',  // amber
    '[STALL]':   '#f04747',  // red
    '[STOP]':    '#f04747',  // red
    '[CRASH]':   '#f04747',  // red
    '[FAIL]':    '#f04747',  // red
    '[UNK]':     '#f59e0b',  // amber — unknown event
    '[WARN]':    '#f59e0b',  // amber
    '[LIST]':    '#60a5fa',  // light blue
};

/**
 * Append a styled line to the terminal with TAG colorization.
 */
function _mhAppendLine(text, type) {
    const terminal = document.getElementById('mh-terminal');
    if (!terminal) return;

    // ── Handle [PROGRESS] bar lines — update top bar + ETA, don't print in terminal ──
    const progressMatch = text.match(/^\[PROGRESS\]\s+([█░]+)\s+(\d+)%\s+\((\d+)\/(\d+)\)\s+ETA\s+(\S+)/);
    if (progressMatch) {
        const pct = parseInt(progressMatch[2], 10);
        const current = progressMatch[3];
        const total = progressMatch[4];
        const eta = progressMatch[5];
        const progressBar = document.getElementById('mh-progress-bar');
        if (progressBar) progressBar.style.width = pct + '%';
        const roundCount = document.getElementById('mh-round-count');
        if (roundCount) roundCount.textContent = `Round ${current}/${total}`;
        const timer = document.getElementById('mh-test-timer');
        if (timer && eta !== '--:--') {
            timer.textContent = `ETA ${eta}`;
            timer.style.color = '#60a5fa';
        }
        return; // Don't render progress bar as a terminal line
    }

    // ── Handle [ROUND] block lines — styled as a highlighted section header ──
    // Also collect round data for the Round Results tab
    const roundBlockMatch = text.match(/^\[ROUND\]\s+(.+)/);
    if (roundBlockMatch) {
        const detail = roundBlockMatch[1];
        // Parse: ──── Round 3/21 | Block 1 | High Culturant | No Incentive | Tokens: 2479 ────
        const rm = detail.match(/Round\s+(\d+)\/(\d+)\s*\|\s*Block\s+(\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*Tokens:\s*(\d+)/);
        if (rm) {
            _healthTestRoundResults.push({
                round: parseInt(rm[1], 10),
                total: parseInt(rm[2], 10),
                block: parseInt(rm[3], 10),
                condition: rm[4].trim(),
                incentive: rm[5].trim(),
                tokens: parseInt(rm[6], 10),
                raw: detail.replace(/[─]/g, '').trim()
            });
        }

        const div = document.createElement('div');
        div.style.cssText = 'margin:6px 0 2px; padding:4px 8px; border-left:3px solid #7289da; background:rgba(114,137,255,0.08); color:#a5b4fc; font-weight:600; border-radius:0 4px 4px 0;';
        div.textContent = detail;
        terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
        return;
    }

    const div = document.createElement('div');
    div.style.padding = '1px 0';

    // ── Determine line-level style from type and content ──
    let lineColor = '#b9bbbe';
    let lineWeight = 'normal';

    if (type === 'error' || type === 'stderr') {
        lineColor = '#f04747';
    } else if (text.includes('✅') || text.includes('ALL CHECKS PASSED')) {
        lineColor = '#43b581';
    } else if (text.includes('❌') || text.includes('SOME CHECKS FAILED')) {
        lineColor = '#f04747';
    } else if (text.includes('═') || text.includes('TEST COMPLETE')) {
        lineColor = '#7289da'; lineWeight = '600';
    } else if (text.includes('VALIDATION CHECKS')) {
        lineColor = '#e0c3fc'; lineWeight = '600';
    } else if (text.includes('*** ')) {
        lineColor = '#7289da'; lineWeight = '600';
    }

    div.style.color = lineColor;
    div.style.fontWeight = lineWeight;

    // ── Colorize [TAG] labels inline ──
    const tagRegex = /\[([A-Z]+)\]/g;
    let lastIdx = 0;
    let match;
    let hasTag = false;

    while ((match = tagRegex.exec(text)) !== null) {
        const tag = match[0];
        const color = _MH_TAG_COLORS[tag];
        if (!color) continue;
        hasTag = true;

        // Text before the tag
        if (match.index > lastIdx) {
            div.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
        }

        // The colored tag span
        const tagSpan = document.createElement('span');
        tagSpan.style.cssText = `color:${color}; font-weight:600;`;
        tagSpan.textContent = tag;
        div.appendChild(tagSpan);

        lastIdx = match.index + tag.length;
    }

    // Remaining text after last tag
    if (hasTag && lastIdx < text.length) {
        div.appendChild(document.createTextNode(text.slice(lastIdx)));
    } else if (!hasTag) {
        div.textContent = text;
    }

    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Handle test completion.
 */
function _mhOnComplete(data) {
    _healthTestRunning = false;

    // Clean up listeners
    if (typeof socket !== 'undefined') {
        socket.off('integrationTestOutput', _mhOnOutput);
        socket.off('integrationTestComplete', _mhOnComplete);
    }

    // Stop timer
    if (_mhTimerInterval) { clearInterval(_mhTimerInterval); _mhTimerInterval = null; }

    const exitCode = data && data.code;
    const allPassed = exitCode === 0;

    // Update badge
    const badge = document.getElementById('mh-test-badge');
    if (badge) {
        badge.textContent = allPassed ? 'PASSED' : 'FAILED';
        badge.style.color = allPassed ? '#43b581' : '#f04747';
        badge.style.borderColor = allPassed ? 'rgba(67,181,129,0.35)' : 'rgba(240,71,71,0.35)';
        badge.style.background = allPassed ? 'rgba(67,181,129,0.12)' : 'rgba(240,71,71,0.12)';
    }

    // Progress bar full
    const progressBar = document.getElementById('mh-progress-bar');
    if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.style.background = allPassed
            ? 'linear-gradient(90deg, #ff2d78, #ff69b4)'
            : 'linear-gradient(90deg, #f04747, #e03131)';
    }

    // Show run again / hide cancel
    const runBtn = document.getElementById('mh-run-btn');
    if (runBtn) {
        runBtn.innerHTML = '<i class="fas fa-redo" style="margin-right:4px;"></i>Run Again';
        runBtn.style.display = '';
    }
    const cancelBtn = document.getElementById('mh-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    // Build results splash
    _mhShowResultsSplash(allPassed, exitCode);
}

/**
 * Build the results splash panel shown after test completes.
 * Three tabs: "Validation Checks" (15 checks + CSV banner), "Round Results" (per-round data), "CSV Integrity" (15 CSV checks).
 * CSV tab label is highlighted red if any CSV checks failed.
 */
function _mhShowResultsSplash(allPassed, exitCode) {
    const panel = document.getElementById('mh-results-panel');
    if (!panel) return;

    const elapsed = _healthTestStartTime ? ((Date.now() - _healthTestStartTime) / 1000).toFixed(1) : '?';
    const checks = _healthTestChecks;
    const csvChecks = _healthTestCSVChecks.filter(c => !c.isSummary);
    const csvSummary = _healthTestCSVChecks.find(c => c.isSummary);
    const passed = checks.filter(c => c.pass).length;
    const failed = checks.filter(c => !c.pass).length;
    const csvPassed = csvChecks.filter(c => c.pass).length;
    const csvFailed = csvChecks.filter(c => !c.pass).length;
    const csvAllGood = csvChecks.length > 0 && csvFailed === 0;
    const csvHasProblems = csvFailed > 0;
    const rounds = _healthTestRoundResults;

    const headerColor = allPassed ? '#43b581' : '#f04747';
    const headerIcon = allPassed ? '🎉' : '💥';
    const headerText = allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED';

    // Build check list HTML for a given array of checks
    function buildCheckListHTML(items, emptyMsg) {
        if (items.length > 0) {
            return items.map(c => {
                const icon = c.pass ? '✅' : '❌';
                const color = c.pass ? '#43b581' : '#f04747';
                return `<div style="display:flex; align-items:flex-start; gap:8px; padding:4px 0;">
                    <span style="flex-shrink:0; font-size:14px;">${icon}</span>
                    <span style="color:${color}; font-size:12px; font-family:'Courier New',monospace; line-height:1.4;">${c.name}</span>
                </div>`;
            }).join('');
        }
        return `<span style="color:#72767d; font-size:12px;">${emptyMsg}</span>`;
    }

    const checksHTML = buildCheckListHTML(checks, 'No validation checks parsed from output.');
    const csvChecksHTML = buildCheckListHTML(csvChecks, 'No CSV integrity checks available (CSV download may have been skipped).');

    // CSV summary badge (shown at bottom of CSV tab)
    const csvSummaryHTML = csvSummary
        ? `<div style="margin-top:8px; padding:8px 12px; background:${csvSummary.pass ? 'rgba(67,181,129,0.08)' : 'rgba(240,71,71,0.08)'}; border:1px solid ${csvSummary.pass ? 'rgba(67,181,129,0.2)' : 'rgba(240,71,71,0.2)'}; border-radius:6px;">
            <span style="font-size:12px; color:${csvSummary.pass ? '#43b581' : '#f04747'}; font-family:'Courier New',monospace;">${csvSummary.pass ? '✅' : '❌'} ${csvSummary.name}</span>
           </div>`
        : '';

    // ── CSV status banner for the main Validation Checks tab ──
    let csvBannerHTML = '';
    if (csvAllGood) {
        csvBannerHTML = `<div style="margin:8px 0 4px; padding:10px 14px; background:rgba(67,181,129,0.08); border:1px solid rgba(67,181,129,0.2); border-radius:8px; display:flex; align-items:center; gap:10px;">
            <span style="font-size:16px;">📊</span>
            <div>
                <div style="font-size:12px; font-weight:600; color:#43b581;">CSV Data Integrity — All Clear</div>
                <div style="font-size:11px; color:#72767d; margin-top:2px;">${csvPassed}/${csvChecks.length} integrity checks passed · ${csvSummary ? csvSummary.name.replace(/.*\(/, '(') : ''}</div>
            </div>
        </div>`;
    } else if (csvHasProblems) {
        csvBannerHTML = `<div style="margin:8px 0 4px; padding:10px 14px; background:rgba(240,71,71,0.08); border:1px solid rgba(240,71,71,0.2); border-radius:8px; display:flex; align-items:center; gap:10px;">
            <span style="font-size:16px;">⚠️</span>
            <div>
                <div style="font-size:12px; font-weight:600; color:#f04747;">CSV Data Integrity — ${csvFailed} Problem${csvFailed > 1 ? 's' : ''} Found</div>
                <div style="font-size:11px; color:#72767d; margin-top:2px;">See the CSV Integrity tab for details</div>
            </div>
        </div>`;
    } else if (csvChecks.length === 0) {
        csvBannerHTML = `<div style="margin:8px 0 4px; padding:10px 14px; background:rgba(114,137,255,0.06); border:1px solid rgba(114,137,255,0.15); border-radius:8px; display:flex; align-items:center; gap:10px;">
            <span style="font-size:16px;">📊</span>
            <div>
                <div style="font-size:12px; font-weight:500; color:#72767d;">CSV data not available (download may have been skipped)</div>
            </div>
        </div>`;
    }

    // ── Round Results tab content ──
    let roundsHTML = '';
    if (rounds.length > 0) {
        // Summary stats row
        const blockSet = new Set(rounds.map(r => r.block));
        const condSet = new Set(rounds.map(r => r.condition));
        const firstTokens = rounds[0].tokens;
        const lastTokens = rounds[rounds.length - 1].tokens;
        roundsHTML += `<div style="margin-bottom:8px; padding:8px 12px; background:rgba(114,137,255,0.06); border:1px solid rgba(114,137,255,0.12); border-radius:6px; display:flex; gap:16px; flex-wrap:wrap; font-size:11px; color:#a5b4fc;">
            <span>📋 ${rounds.length} rounds</span>
            <span>🧱 ${blockSet.size} block${blockSet.size > 1 ? 's' : ''}</span>
            <span>🔬 ${condSet.size} condition${condSet.size > 1 ? 's' : ''}</span>
            <span>🪙 ${firstTokens} → ${lastTokens} tokens</span>
        </div>`;
        // Table header
        roundsHTML += `<div style="display:grid; grid-template-columns:42px 42px 1fr 1fr 70px; gap:2px 8px; font-size:11px; padding:4px 0 2px; border-bottom:1px solid rgba(255,255,255,0.08); color:#72767d; font-weight:600;">
            <span>Rnd</span><span>Blk</span><span>Condition</span><span>Incentive</span><span style="text-align:right;">Tokens</span>
        </div>`;
        // Table rows
        roundsHTML += `<div style="max-height:140px; overflow-y:auto;">`;
        rounds.forEach((r, i) => {
            const bg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
            const tokenColor = r.tokens < 100 ? '#f04747' : r.tokens < 500 ? '#f59e0b' : '#b9bbbe';
            roundsHTML += `<div style="display:grid; grid-template-columns:42px 42px 1fr 1fr 70px; gap:2px 8px; font-size:11px; padding:3px 0; background:${bg}; color:#b9bbbe; font-family:'Courier New',monospace;">
                <span style="color:#7289da;">${r.round}</span>
                <span style="color:#a78bfa;">${r.block}</span>
                <span style="color:#e0c3fc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.condition}</span>
                <span style="color:${r.incentive === 'No Incentive' ? '#72767d' : '#34d399'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.incentive}</span>
                <span style="text-align:right; color:${tokenColor};">${r.tokens.toLocaleString()}</span>
            </div>`;
        });
        roundsHTML += `</div>`;
    } else {
        roundsHTML = `<span style="color:#72767d; font-size:12px;">No round data collected.</span>`;
    }

    // ── Tab styles ──
    const tabBase = 'padding:8px 16px; font-size:12px; font-weight:500; cursor:pointer; border:none; border-bottom:2px solid transparent; background:none; transition:all 0.2s ease;';
    const tabActive = 'color:#fff; border-bottom-color:#ff2d78;';
    const tabInactive = 'color:#72767d;';

    // CSV tab: red label if problems, otherwise normal
    const csvTabColor = csvHasProblems ? 'color:#f04747; font-weight:700;' : '';
    const csvTabBorder = csvHasProblems ? 'border-bottom-color:#f04747;' : '';
    // Red dot indicator next to CSV tab when problems exist
    const csvTabDot = csvHasProblems
        ? `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#f04747; margin-left:6px; vertical-align:middle; box-shadow:0 0 4px rgba(240,71,71,0.6);"></span>`
        : '';

    const hasCSV = csvChecks.length > 0;

    panel.style.display = 'block';
    panel.innerHTML = `
        <div style="border-top:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.2);">
            <!-- Results header -->
            <div style="padding:16px 24px 12px; display:flex; align-items:center; gap:12px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <span style="font-size:24px;">${headerIcon}</span>
                <span style="font-size:15px; font-weight:600; color:${headerColor};">${headerText}</span>
                <span style="font-size:11px; color:#72767d; margin-left:auto;">${elapsed}s · exit code ${exitCode}</span>
            </div>

            <!-- Summary pills -->
            <div style="padding:10px 24px; display:flex; gap:16px; flex-wrap:wrap;">
                <span style="font-size:12px; color:#43b581; background:rgba(67,181,129,0.1); border:1px solid rgba(67,181,129,0.25); border-radius:10px; padding:3px 10px;">✅ ${passed} passed</span>
                ${failed > 0 ? `<span style="font-size:12px; color:#f04747; background:rgba(240,71,71,0.1); border:1px solid rgba(240,71,71,0.25); border-radius:10px; padding:3px 10px;">❌ ${failed} failed</span>` : ''}
                <span style="font-size:12px; color:#7289da; background:rgba(114,137,255,0.1); border:1px solid rgba(114,137,255,0.25); border-radius:10px; padding:3px 10px;">📋 ${_healthTestLines.length} lines output</span>
                ${hasCSV ? `<span style="font-size:12px; color:${csvHasProblems ? '#f04747' : '#e0c3fc'}; background:${csvHasProblems ? 'rgba(240,71,71,0.1)' : 'rgba(224,195,252,0.1)'}; border:1px solid ${csvHasProblems ? 'rgba(240,71,71,0.25)' : 'rgba(224,195,252,0.25)'}; border-radius:10px; padding:3px 10px;">📊 ${csvPassed}/${csvChecks.length} CSV checks</span>` : ''}
            </div>

            <!-- Tabs -->
            <div style="padding:0 24px; display:flex; gap:4px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <button id="mh-tab-checks" onclick="_mhSwitchResultsTab('checks')" style="${tabBase} ${tabActive}">
                    Validation Checks (${checks.length})
                </button>
                <button id="mh-tab-rounds" onclick="_mhSwitchResultsTab('rounds')" style="${tabBase} ${tabInactive}">
                    Round Results (${rounds.length})
                </button>
                <button id="mh-tab-csv" onclick="_mhSwitchResultsTab('csv')" style="${tabBase} ${tabInactive} ${csvTabColor} ${csvTabBorder}">
                    CSV Integrity${hasCSV ? ` (${csvChecks.length})` : ''}${csvTabDot}
                </button>
            </div>

            <!-- Tab content: Validation Checks -->
            <div id="mh-tab-content-checks" style="padding:6px 24px 16px; max-height:220px; overflow-y:auto;">
                ${csvBannerHTML}
                ${checksHTML}
            </div>

            <!-- Tab content: Round Results -->
            <div id="mh-tab-content-rounds" style="padding:6px 24px 16px; max-height:220px; overflow-y:auto; display:none;">
                ${roundsHTML}
            </div>

            <!-- Tab content: CSV Integrity -->
            <div id="mh-tab-content-csv" style="padding:6px 24px 16px; max-height:220px; overflow-y:auto; display:none;">
                ${csvChecksHTML}
                ${csvSummaryHTML}
            </div>
        </div>
    `;
}

/**
 * Switch between Checks, Round Results, and CSV tabs in the results splash.
 * Preserves red highlight on CSV tab when it has failures.
 */
function _mhSwitchResultsTab(tab) {
    const tabs = {
        checks: { btn: document.getElementById('mh-tab-checks'), content: document.getElementById('mh-tab-content-checks') },
        rounds: { btn: document.getElementById('mh-tab-rounds'), content: document.getElementById('mh-tab-content-rounds') },
        csv:    { btn: document.getElementById('mh-tab-csv'),    content: document.getElementById('mh-tab-content-csv') },
    };

    // Check if CSV has problems (red dot present = problems)
    const csvHasProblems = tabs.csv.btn && tabs.csv.btn.innerHTML.includes('border-radius:50%');

    Object.keys(tabs).forEach(key => {
        const t = tabs[key];
        if (!t.btn || !t.content) return;

        if (key === tab) {
            // Active tab
            t.btn.style.color = '#fff';
            t.btn.style.borderBottomColor = '#ff2d78';
            t.btn.style.fontWeight = '500';
            t.content.style.display = '';
        } else {
            // Inactive tab — CSV gets red styling if it has problems
            if (key === 'csv' && csvHasProblems) {
                t.btn.style.color = '#f04747';
                t.btn.style.borderBottomColor = 'transparent';
                t.btn.style.fontWeight = '700';
            } else {
                t.btn.style.color = '#72767d';
                t.btn.style.borderBottomColor = 'transparent';
                t.btn.style.fontWeight = '500';
            }
            t.content.style.display = 'none';
        }
    });
}

/**
 * Cancel a running test.
 */
function _mhCancelTest() {
    if (!_healthTestRunning) return;
    if (typeof socket !== 'undefined') {
        socket.emit('cancelIntegrationTest');
    }
    _mhAppendLine('🛑 Cancelling test…', 'warn');
}

/**
 * Close the Module Health modal and clean up.
 */
function closeModuleHealthModal() {
    // If test is running, cancel it
    if (_healthTestRunning && typeof socket !== 'undefined') {
        socket.emit('cancelIntegrationTest');
        socket.off('integrationTestOutput', _mhOnOutput);
        socket.off('integrationTestComplete', _mhOnComplete);
        _healthTestRunning = false;
    }
    if (_mhTimerInterval) { clearInterval(_mhTimerInterval); _mhTimerInterval = null; }

    const modal = document.getElementById('moduleHealthModal');
    if (modal) modal.remove();
}

/**
 * Update visibility of the module-health pill.
 * Visible only to moderators or global admins.
 */
function updateModuleHealthPillVisibility() {
    const pill = document.getElementById('module-health-pill');
    if (!pill) return;

    const isMod = (typeof isCurrentRoomModerator === 'function') && isCurrentRoomModerator();
    const isAdmin = window.isGlobalAdmin || (typeof isGlobalAdmin !== 'undefined' && isGlobalAdmin);

    if (isMod || isAdmin) {
        pill.style.display = 'flex';
        pill.style.pointerEvents = 'auto';
    } else {
        pill.style.display = 'none';
        pill.style.pointerEvents = 'none';
    }
}
