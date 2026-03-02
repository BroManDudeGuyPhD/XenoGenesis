/**
 * Experimental Round Scheduler for XenoGenesis
 * Handles scheduling for Conditions experiment mode
 * 
 * Experiment (Conditions):
 * - 2500 white tokens shared pool  
 * - 21 rounds per block (default 9 blocks = 189 total rounds)
 * - Each player gets 7 assignments per block:
 *   - 3 Self Control Incentive
 *   - 3 Impulse Incentive
 *   - 1 No Incentive
 * - Per block totals:
 *   - 9 Self Control Incentives (3 per player)
 *   - 9 Impulse Incentives (3 per player)
 *   - 3 No Incentives (1 per player)
 * - 3 conditions distributed evenly: 7 occurrences of each per block
 *   - High Culturant
 *   - High Operant
 *   - Equal Culturant-Operant
 * - LEDs track progress within each block (resets every 21 rounds)
 */

const { c } = require('./utils/logger');

class ExperimentScheduler {
    constructor() {
        this.conditions = {
            HIGH_CULTURANT: 'High Culturant',
            HIGH_OPERANT: 'High Operant', 
            EQUAL_CULTURANT_OPERANT: 'Equal Culturant–Operant'
        };
        
        this.incentives = {
            NO_INCENTIVE: 'No Incentive',
            CULTURANT_INCENTIVE: 'Self Control Incentive',
            OPERANT_INCENTIVE: 'Impulse Incentive'
        };
        
        this.players = ['A', 'B', 'C'];
        
        // 21-round block structure:
        // Each player gets 7 assignments per block (21 rounds / 3 players)
        // Per player: 3 Self Control + 3 Impulse + 1 None = 7 total
        this.ROUNDS_PER_BLOCK = 21;
        this.NONE_PER_BLOCK = 3; // 1 per player
        this.INCENTIVES_PER_BLOCK = 18; // 21 - 3
        this.INCENTIVES_PER_PLAYER_PER_TYPE = 3; // Self Control and Impulse each
    }

    /**
     * Generate a complete 21-round block with balanced per-player distribution
     * Creates a FIXED template where each player experiences each condition exactly:
     * - High Culturant: 2-3 times per player
     * - High Operant: 2-3 times per player  
     * - Equal C-O: 2-3 times per player
     * Total: 7 assignments per player, 21 rounds per block
     * 
     * @param {number} blockNumber - Block number for tracking
     * @returns {Array} Array of 21 round objects
     */
    generateBlock(blockNumber) {
        const rounds = [];

        // For each player, produce the six condition×incentive combos
        this.players.forEach(player => {
            Object.values(this.conditions).forEach(conditionName => {
                // Self-control (Culturant) incentive for this condition
                rounds.push({
                    player: player,
                    incentive: this.incentives.CULTURANT_INCENTIVE,
                    condition: conditionName,
                    blockNumber: blockNumber
                });

                // Impulsive (Operant) incentive for this condition
                rounds.push({
                    player: player,
                    incentive: this.incentives.OPERANT_INCENTIVE,
                    condition: conditionName,
                    blockNumber: blockNumber
                });
            });
        });

        // Add the three NO_INCENTIVE rounds (one per condition) with no recipient
        Object.values(this.conditions).forEach(conditionName => {
            rounds.push({
                player: null,
                incentive: this.incentives.NO_INCENTIVE,
                condition: conditionName,
                blockNumber: blockNumber
            });
        });

        // Sanity check: rounds should be 21
        if (rounds.length !== this.ROUNDS_PER_BLOCK) {
            console.warn(`Generated ${rounds.length} rounds for block ${blockNumber}, expected ${this.ROUNDS_PER_BLOCK}`);
        }

        // Shuffle to randomize order within block while keeping distribution
        return this.shuffleArray(rounds);
    }

    /**
     * Generate a complete experimental schedule for Conditions mode
     * Multiple blocks of 21 rounds each
     * 
     * @param {number} numBlocks - Number of blocks to generate (default 9 for 189 rounds)
     * @returns {Array} Array of round objects with round numbers
     */
    generateConditionsSchedule(numBlocks = 9) {
        const fullSchedule = [];
        let roundNumber = 1;
        
        // Generate blocks
        for (let block = 1; block <= numBlocks; block++) {
            console.log(`${c.data('[LIST]')} Generating block ${block}/${numBlocks}...`);
            const blockRounds = this.generateBlock(block);
            
            // Assign round numbers to each round in this block
            blockRounds.forEach(round => {
                round.roundNumber = roundNumber;
                fullSchedule.push(round);
                roundNumber++;
            });
        }
        
        const totalRounds = fullSchedule.length;
        console.log(`✅ Generated complete conditions schedule: ${totalRounds} rounds across ${numBlocks} blocks`);
        this.validateSchedule(fullSchedule, numBlocks);
        return fullSchedule;
    }



    /**
     * Generate baseline experiment schedule
     * Simple structure for baseline mode - no complex scheduling needed
     * 
     * @param {number} maxRounds - Maximum number of rounds (500)
     * @returns {Object} Baseline configuration object
     */
    generateBaselineSchedule(maxRounds = 500) {
        return {
            mode: 'baseline',
            maxRounds: maxRounds,
            initialWhiteTokens: 100,
            condition: 'BASELINE',
            rules: {
                oddRowWhiteTokens: 3,    // Odd row → 3 white tokens ($0.03)
                evenRowWhiteTokens: 1,   // Even row → 1 white token ($0.01)
                allEvenBlackTokens: 1    // All even → +1 black token each ($0.05)
            }
        };
    }

    /**
     * Shuffle array using Fisher-Yates algorithm for randomization
     * 
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Validate the generated schedule for proper balance and distribution
     * 
     * @param {Array} schedule - The complete schedule to validate
     * @param {number} numBlocks - Number of blocks in the schedule
     * @returns {Object} Validation results
     */
    validateSchedule(schedule, numBlocks) {
        const validation = {
            totalRounds: schedule.length,
            conditionCounts: {},
            incentiveCounts: {},
            playerCounts: {},
            blockCounts: {},
            errors: []
        };

        // Count occurrences of each category
        schedule.forEach(round => {
            // Count conditions
            validation.conditionCounts[round.condition] = 
                (validation.conditionCounts[round.condition] || 0) + 1;
            
            // Count incentives  
            validation.incentiveCounts[round.incentive] = 
                (validation.incentiveCounts[round.incentive] || 0) + 1;
            
            // Count players
            validation.playerCounts[round.player] = 
                (validation.playerCounts[round.player] || 0) + 1;
            
            // Count blocks
            validation.blockCounts[round.blockNumber] = 
                (validation.blockCounts[round.blockNumber] || 0) + 1;
        });

        const expectedTotal = numBlocks * this.ROUNDS_PER_BLOCK;
        // Each player receives 6 incentive rounds per block (3 conditions × 2 incentive types)
        const roundsPerPlayer = numBlocks * 6;

        // Each condition appears 7 times per block (6 incentive rounds + 1 none), so per schedule:
        const roundsPerCondition = numBlocks * 7;

        // Expected incentive totals across the full schedule
        const expectedNoneTotal = numBlocks * this.NONE_PER_BLOCK; // 3 per block
        const expectedCulturantTotal = numBlocks * 9; // per block: 3 conditions × 3 players = 9 culturant incentives
        const expectedOperantTotal = numBlocks * 9;  // per block: 9 operant incentives

        // Validate expected totals
        if (validation.totalRounds !== expectedTotal) {
            validation.errors.push(`Expected ${expectedTotal} rounds, got ${validation.totalRounds}`);
        }

        // Each condition should appear exactly roundsPerCondition times
        Object.entries(validation.conditionCounts).forEach(([condition, count]) => {
            if (count !== roundsPerCondition) {
                validation.errors.push(`Condition "${condition}" appears ${count} times, expected ${roundsPerCondition}`);
            }
        });

        // Validate incentive distribution
        if ((validation.incentiveCounts[this.incentives.NO_INCENTIVE] || 0) !== expectedNoneTotal) {
            validation.errors.push(`"No Incentive" appears ${validation.incentiveCounts[this.incentives.NO_INCENTIVE] || 0} times, expected ${expectedNoneTotal}`);
        }

        if ((validation.incentiveCounts[this.incentives.CULTURANT_INCENTIVE] || 0) !== expectedCulturantTotal) {
            validation.errors.push(`"${this.incentives.CULTURANT_INCENTIVE}" appears ${validation.incentiveCounts[this.incentives.CULTURANT_INCENTIVE] || 0} times, expected ${expectedCulturantTotal}`);
        }

        if ((validation.incentiveCounts[this.incentives.OPERANT_INCENTIVE] || 0) !== expectedOperantTotal) {
            validation.errors.push(`"${this.incentives.OPERANT_INCENTIVE}" appears ${validation.incentiveCounts[this.incentives.OPERANT_INCENTIVE] || 0} times, expected ${expectedOperantTotal}`);
        }

        // Each player should appear evenly
        Object.entries(validation.playerCounts).forEach(([player, count]) => {
            if (count !== roundsPerPlayer) {
                validation.errors.push(`Player "${player}" appears ${count} times, expected ${roundsPerPlayer}`);
            }
        });

        // Each block should have 21 rounds
        Object.entries(validation.blockCounts).forEach(([block, count]) => {
            if (count !== this.ROUNDS_PER_BLOCK) {
                validation.errors.push(`Block ${block} has ${count} rounds, expected ${this.ROUNDS_PER_BLOCK}`);
            }
        });

        if (validation.errors.length === 0) {
            console.log('✅ Schedule validation passed');
        } else {
            console.log('❌ Schedule validation failed:');
            validation.errors.forEach(error => console.log(`   - ${error}`));
        }

        console.log(`${c.data('[DATA]')} Schedule summary:`);
        console.log(`   Total rounds: ${validation.totalRounds}`);
        console.log(`   Blocks: ${numBlocks} × ${this.ROUNDS_PER_BLOCK} rounds`);
        console.log(`   Conditions:`, validation.conditionCounts);
        console.log(`   Incentives:`, validation.incentiveCounts);
        console.log(`   Players:`, validation.playerCounts);

        return validation;
    }

    /**
     * Get current round information from schedule
     * 
     * @param {Array} schedule - The experimental schedule
     * @param {number} roundNumber - Current round number (1-based)
     * @returns {Object|null} Current round object or null if round not found
     */
    getCurrentRound(schedule, roundNumber) {
        return schedule.find(round => round.roundNumber === roundNumber) || null;
    }

    /**
     * Check if experiment should end based on mode and conditions
     * 
     * @param {string} mode - 'conditions' mode
     * @param {number} currentRound - Current round number
     * @param {number} whiteTokensRemaining - White tokens left in pool
     * @param {number} maxRounds - Maximum rounds for mode
     * @returns {Object} End game status and reason
     */
    shouldEndExperiment(mode, currentRound, whiteTokensRemaining, maxRounds) {
        if (mode === 'conditions') {
            if (currentRound >= 189) {
                return { shouldEnd: true, reason: 'All 189 experimental rounds completed' };
            }
            if (whiteTokensRemaining <= 0) {
                return { shouldEnd: true, reason: 'White token pool exhausted (early termination)' };
            }
        }
        
        return { shouldEnd: false, reason: null };
    }

    /**
     * Export schedule to CSV format matching the provided sample
     * 
     * @param {Array} schedule - The schedule to export
     * @returns {string} CSV formatted string
     */
    exportToCSV(schedule) {
        const headers = ['Round', 'Condition', 'Player', 'Incentive'];
        const rows = [headers.join(',')];
        
        schedule.forEach(round => {
            const row = [
                round.roundNumber,
                round.condition,
                round.player,
                round.incentive
            ];
            rows.push(row.join(','));
        });
        
        return rows.join('\n');
    }

    /**
     * Export comprehensive experiment results to CSV format
     * Includes round, player choices, condition, incentive recipient, total payout per round
     * 
     * @param {Array} dataLog - The complete dataLog from gameSession
     * @param {Object} options - Export options and formatting preferences
     * @returns {string} CSV formatted string with comprehensive experiment data
     */
    exportExperimentResultsToCSV(dataLog, options = {}) {
        const headers = [
            'Round',
            'Condition',
            'Block_Number',
            'Incentive_Type',
            'Incentive_Recipient',
            'Player_A_Choice',
            'Player_B_Choice', 
            'Player_C_Choice',
            'Player_A_White_Tokens',
            'Player_A_Black_Tokens',
            'Player_A_Round_Earnings',
            'Player_A_Total_Payout',
            'Player_B_White_Tokens',
            'Player_B_Black_Tokens',
            'Player_B_Round_Earnings',
            'Player_B_Total_Payout',
            'Player_C_White_Tokens',
            'Player_C_Black_Tokens',
            'Player_C_Round_Earnings',
            'Player_C_Total_Payout',
            'Culturant_Produced',
            'White_Tokens_Remaining',
            'Timestamp'
        ];
        
        const rows = [headers.join(',')];
        
        // Track previous round earnings for calculating per-round earnings using username keys
        const previousEarnings = {};
        
        // First pass: collect all unique player usernames to create consistent mapping
        const allPlayerNames = new Set();
        dataLog.forEach(logEntry => {
            logEntry.players.forEach(player => {
                if (!player.isModerator) {
                    allPlayerNames.add(player.username);
                }
            });
        });
        const sortedPlayerNames = Array.from(allPlayerNames).sort(); // Consistent ordering
        
        dataLog.forEach((logEntry, index) => {
            // Extract player data - normalize to always have A, B, C structure with consistent mapping
            const playerData = { A: null, B: null, C: null };
            
            // Map actual players to A, B, C positions based on consistent username ordering
            logEntry.players.forEach((player) => {
                if (!player.isModerator) {
                    const playerIndex = sortedPlayerNames.indexOf(player.username);
                    const position = ['A', 'B', 'C'][playerIndex];
                    if (position) {
                        playerData[position] = player;
                        // Initialize previousEarnings for this player if needed
                        if (!(player.username in previousEarnings)) {
                            previousEarnings[player.username] = 0;
                        }
                    }
                }
            });
            
            // Determine condition display
            const condition = logEntry.condition || 'Baseline';
            
            // Calculate total payouts using correct condition token values
            const calculatePayout = (player) => {
                if (!player) return 0;
                
                // Get condition-specific token values
                let whiteValue = 0.01; // Default baseline value
                let blackValue = 0.05; // Default baseline value
                
                // Map condition names to token values
                switch (condition) {
                    case 'High Culturant':
                        whiteValue = 0.02;
                        blackValue = 0.07;
                        break;
                    case 'High Operant':
                        whiteValue = 0.03;
                        blackValue = 0.04;
                        break;
                    case 'Equal Culturant–Operant':
                        whiteValue = 0.01;
                        blackValue = 0.02;
                        break;
                    case 'Baseline':
                    default:
                        whiteValue = 0.01;
                        blackValue = 0.05;
                        break;
                }
                
                return (player.whiteTokens * whiteValue) + (player.blackTokens * blackValue);
            };
            
            // Calculate per-round earnings
            const calculateRoundEarnings = (player) => {
                if (!player) return '';
                
                // For Lightning test, use the actual stored cumulative earnings
                // and calculate the difference from previous round for this specific player
                const currentEarnings = player.earnings || 0;
                const previousPlayerEarnings = previousEarnings[player.username] || 0;
                const roundEarnings = currentEarnings - previousPlayerEarnings;
                previousEarnings[player.username] = currentEarnings;
                return roundEarnings.toFixed(2);
            };
            
            // Convert choices to ODD/EVEN
            const getChoiceType = (choice) => {
                if (!choice) return '';
                const choiceNum = parseInt(choice);
                return isNaN(choiceNum) ? '' : (choiceNum % 2 === 1 ? 'ODD' : 'EVEN');
            };

            const row = [
                logEntry.round,
                condition,
                logEntry.blockNumber || '',
                (logEntry.incentive && logEntry.incentive !== 'No Incentive') ? logEntry.incentive : 'None',
                (logEntry.incentive && logEntry.incentive !== 'No Incentive') ? (logEntry.player || 'None') : 'None',
                playerData.A ? getChoiceType(playerData.A.choice) : '',
                playerData.B ? getChoiceType(playerData.B.choice) : '',
                playerData.C ? getChoiceType(playerData.C.choice) : '',
                playerData.A ? playerData.A.whiteTokens : '',
                playerData.A ? playerData.A.blackTokens : '',
                calculateRoundEarnings(playerData.A),
                playerData.A ? (playerData.A.earnings || 0).toFixed(2) : '',
                playerData.B ? playerData.B.whiteTokens : '',
                playerData.B ? playerData.B.blackTokens : '',
                calculateRoundEarnings(playerData.B),
                playerData.B ? (playerData.B.earnings || 0).toFixed(2) : '',
                playerData.C ? playerData.C.whiteTokens : '',
                playerData.C ? playerData.C.blackTokens : '',
                calculateRoundEarnings(playerData.C),
                playerData.C ? (playerData.C.earnings || 0).toFixed(2) : '',
                logEntry.culturantProduced ? 'Yes' : 'No',
                logEntry.whiteTokensRemaining,
                logEntry.timestamp
            ];
            
            // Escape any commas in the data and wrap in quotes if needed
            const escapedRow = row.map(field => {
                const fieldStr = String(field);
                if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
                    return '"' + fieldStr.replace(/"/g, '""') + '"';
                }
                return fieldStr;
            });
            
            rows.push(escapedRow.join(','));
        });
        
        return rows.join('\n');
    }

    /**
     * Comprehensive test suite for scheduler validation
     * Tests distribution balance, randomization, and edge cases
     * 
     * @returns {Object} Test results with pass/fail status
     */
    runValidationTests() {
        console.log(`${c.game('[EXP]')} Running comprehensive scheduler validation tests...`);
        
        const testResults = {
            passed: 0,
            failed: 0,
            tests: []
        };

        const addTest = (name, passed, details = '') => {
            testResults.tests.push({ name, passed, details });
            if (passed) {
                testResults.passed++;
                console.log(`✅ ${name}`);
            } else {
                testResults.failed++;
                console.log(`❌ ${name}: ${details}`);
            }
        };

        // Test suite using a known number of blocks
        try {
            const numBlocks = 9;
            const schedule = this.generateConditionsSchedule(numBlocks);
            addTest('Schedule Generation', schedule.length === (numBlocks * this.ROUNDS_PER_BLOCK), `Generated ${schedule.length} rounds, expected ${numBlocks * this.ROUNDS_PER_BLOCK}`);

            // Condition distribution
            const conditionCounts = {};
            schedule.forEach(round => {
                conditionCounts[round.condition] = (conditionCounts[round.condition] || 0) + 1;
            });
            const expectedConditionCount = numBlocks * 7; // 7 occurrences per block per condition
            let conditionDistributionPassed = true;
            Object.entries(conditionCounts).forEach(([condition, count]) => {
                if (count !== expectedConditionCount) conditionDistributionPassed = false;
            });
            addTest('Condition Distribution', conditionDistributionPassed, `Conditions: ${JSON.stringify(conditionCounts)}, expected ${expectedConditionCount} each`);

            // Player distribution
            const playerCounts = {};
            schedule.forEach(round => {
                const p = round.player || 'None';
                playerCounts[p] = (playerCounts[p] || 0) + 1;
            });
            const expectedPlayerCount = numBlocks * 6; // 6 rounds per player per block
            let playerDistributionPassed = true;
            this.players.forEach(player => {
                if (playerCounts[player] !== expectedPlayerCount) playerDistributionPassed = false;
            });
            addTest('Player Distribution', playerDistributionPassed, `Players: ${JSON.stringify(playerCounts)}, expected ${expectedPlayerCount} each (None shows NO rounds)`);

            // Incentive distribution
            const incentiveCounts = {};
            schedule.forEach(round => {
                incentiveCounts[round.incentive] = (incentiveCounts[round.incentive] || 0) + 1;
            });
            const expectedNone = numBlocks * this.NONE_PER_BLOCK; // 3 per block
            const expectedCulturant = numBlocks * 9; // 9 culturant incentives per block * numBlocks
            const expectedOperant = numBlocks * 9;
            const incentivePassed = (incentiveCounts[this.incentives.NO_INCENTIVE] === expectedNone) &&
                                    (incentiveCounts[this.incentives.CULTURANT_INCENTIVE] === expectedCulturant) &&
                                    (incentiveCounts[this.incentives.OPERANT_INCENTIVE] === expectedOperant);
            addTest('Incentive Distribution', incentivePassed, `Incentives: ${JSON.stringify(incentiveCounts)}, expected None:${expectedNone}, Culturant:${expectedCulturant}, Operant:${expectedOperant}`);

            // Block structure
            const blockCounts = {};
            schedule.forEach(round => {
                blockCounts[round.blockNumber] = (blockCounts[round.blockNumber] || 0) + 1;
            });
            let blockStructurePassed = true;
            for (let block = 1; block <= numBlocks; block++) {
                if (blockCounts[block] !== this.ROUNDS_PER_BLOCK) blockStructurePassed = false;
            }
            addTest('Block Structure', blockStructurePassed, `Blocks: ${JSON.stringify(blockCounts)}, expected ${this.ROUNDS_PER_BLOCK} rounds each`);

            // Round continuity
            const roundNumbers = schedule.map(r => r.roundNumber).sort((a, b) => a - b);
            const continuityPassed = roundNumbers.every((num, index) => num === index + 1);
            addTest('Round Number Continuity', continuityPassed, `Round numbers continuous: ${continuityPassed}`);

            // Randomization - ensure subsequent generations differ
            const schedule2 = this.generateConditionsSchedule(numBlocks);
            const diff = schedule.map((r, i) => `${r.condition}|${r.player}|${r.incentive}`).join(',') !== schedule2.map((r, i) => `${r.condition}|${r.player}|${r.incentive}`).join(',');
            addTest('Randomization', diff, 'Schedule order differs between generations');

        } catch (error) {
            addTest('Test Execution', false, `Error during testing: ${error.message}`);
        }

        // Summary
        console.log(`\n${c.data('[DATA]')} Test Summary: ${testResults.passed} passed, ${testResults.failed} failed`);
        if (testResults.failed === 0) {
            console.log('🎉 All tests passed! Scheduler is working correctly.');
        } else {
            console.log(`${c.warn('[WARN]')} Some tests failed. Please review the scheduler logic.`);
        }

        return testResults;
    }

    /**
     * Analyze scheduler performance and generate detailed statistics
     * 
     * @returns {Object} Detailed analysis results
     */
    analyzeSchedulerPerformance() {
        console.log(`${c.data('[METRIC]')} Analyzing scheduler performance and statistics...`);
        
        const startTime = Date.now();
        const schedule = this.generateConditionsSchedule();
        const generationTime = Date.now() - startTime;
        
        // Analyze condition transitions to check for clustering
        const transitions = {};
        for (let i = 1; i < schedule.length; i++) {
            const from = schedule[i-1].condition;
            const to = schedule[i].condition;
            const key = `${from} → ${to}`;
            transitions[key] = (transitions[key] || 0) + 1;
        }
        
        // Calculate clustering metrics
        let consecutiveSameCondition = 0;
        let maxCluster = 0;
        let currentCluster = 1;
        
        for (let i = 1; i < schedule.length; i++) {
            if (schedule[i].condition === schedule[i-1].condition) {
                currentCluster++;
                consecutiveSameCondition++;
            } else {
                maxCluster = Math.max(maxCluster, currentCluster);
                currentCluster = 1;
            }
        }
        maxCluster = Math.max(maxCluster, currentCluster);
        
        const analysis = {
            generationTime: `${generationTime}ms`,
            totalRounds: schedule.length,
            consecutiveSameCondition,
            maxClusterSize: maxCluster,
            transitionMatrix: transitions,
            clusteringScore: consecutiveSameCondition / schedule.length,
            recommendation: maxCluster > 5 ? 'Consider improving randomization' : 'Good randomization'
        };
        
        console.log(`${c.data('[DATA]')} Performance Analysis Results:`);
        console.log(`   Generation Time: ${analysis.generationTime}`);
        console.log(`   Max Cluster Size: ${analysis.maxClusterSize} rounds`);
        console.log(`   Clustering Score: ${(analysis.clusteringScore * 100).toFixed(2)}% consecutive`);
        console.log(`   Recommendation: ${analysis.recommendation}`);
        
        return analysis;
    }
}

module.exports = ExperimentScheduler;