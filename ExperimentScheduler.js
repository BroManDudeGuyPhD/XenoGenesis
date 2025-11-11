/**
 * Experimental Round Scheduler for XenoGenesis
 * Handles scheduling for both Baseline and Conditions experiment modes
 * 
 * Experiment 1 (Baseline): 
 * - 100 white tokens shared pool
 * - Max 500 rounds
 * - Fixed payout rules
 * 
 * Experiment 2 (Conditions):
 * - 2500 white tokens shared pool  
 * - 441 rounds across 7 blocks of 63 rounds each
 * - 3 conditions: High Culturant, High Operant, Equal Culturant-Operant
 * - 3 incentive types: No Incentive, Self Control Incentive, Impulse Incentive
 * - Balanced distribution and counterbalancing
 */

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
    }

    /**
     * Generate a complete 63-round block with balanced distribution
     * Each block contains:
     * - 21 rounds per condition (3 conditions × 21 rounds = 63 total)
     * - Equal distribution of incentives within each condition
     * - Counterbalanced player assignments
     * 
     * @returns {Array} Array of 63 round objects
     */
    generateBlock() {
        const rounds = [];
        
        // Generate 21 rounds for each condition
        Object.values(this.conditions).forEach(condition => {
            const conditionRounds = this.generateConditionRounds(condition, 21);
            rounds.push(...conditionRounds);
        });
        
        // Shuffle the rounds to avoid predictable patterns
        return this.shuffleArray(rounds);
    }

    /**
     * Generate rounds for a specific condition with balanced incentive distribution
     * 
     * @param {string} condition - The experimental condition
     * @param {number} roundCount - Number of rounds to generate (21)
     * @returns {Array} Array of round objects for this condition
     */
    generateConditionRounds(condition, roundCount) {
        const rounds = [];
        const incentiveTypes = Object.values(this.incentives);
        const roundsPerIncentive = Math.floor(roundCount / incentiveTypes.length); // 7 rounds per incentive
        const extraRounds = roundCount % incentiveTypes.length; // Handle remainder
        
        // Generate base rounds (7 rounds per incentive type)
        incentiveTypes.forEach((incentive, index) => {
            let roundsForThisIncentive = roundsPerIncentive;
            // Distribute extra rounds evenly
            if (index < extraRounds) {
                roundsForThisIncentive += 1;
            }
            
            for (let i = 0; i < roundsForThisIncentive; i++) {
                // Rotate through players for each round to ensure balance
                const playerIndex = (rounds.length) % this.players.length;
                const player = this.players[playerIndex];
                
                rounds.push({
                    condition: condition,
                    player: player,
                    incentive: incentive,
                    roundNumber: null // Will be set when building full schedule
                });
            }
        });
        
        return rounds;
    }

    /**
     * Generate a complete experimental schedule for Conditions mode
     * 441 rounds across 7 blocks of 63 rounds each
     * 
     * @returns {Array} Array of 441 round objects with round numbers
     */
    generateConditionsSchedule() {
        const fullSchedule = [];
        let roundNumber = 1;
        
        // Generate 7 blocks of 63 rounds each
        for (let block = 1; block <= 7; block++) {
            console.log(`📋 Generating block ${block}/7...`);
            const blockRounds = this.generateBlock();
            
            // Assign round numbers to each round in this block
            blockRounds.forEach(round => {
                round.roundNumber = roundNumber;
                round.blockNumber = block;
                fullSchedule.push(round);
                roundNumber++;
            });
        }
        
        console.log(`✅ Generated complete conditions schedule: ${fullSchedule.length} rounds across 7 blocks`);
        this.validateSchedule(fullSchedule);
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
     * @returns {Object} Validation results
     */
    validateSchedule(schedule) {
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

        // Validate expected totals
        if (validation.totalRounds !== 441) {
            validation.errors.push(`Expected 441 rounds, got ${validation.totalRounds}`);
        }

        // Each condition should appear 147 times (21 rounds × 7 blocks)
        Object.entries(validation.conditionCounts).forEach(([condition, count]) => {
            if (count !== 147) {
                validation.errors.push(`Condition "${condition}" appears ${count} times, expected 147`);
            }
        });

        // Each incentive should appear 147 times 
        Object.entries(validation.incentiveCounts).forEach(([incentive, count]) => {
            if (count !== 147) {
                validation.errors.push(`Incentive "${incentive}" appears ${count} times, expected 147`);
            }
        });

        // Each player should appear 147 times
        Object.entries(validation.playerCounts).forEach(([player, count]) => {
            if (count !== 147) {
                validation.errors.push(`Player "${player}" appears ${count} times, expected 147`);
            }
        });

        // Each block should have 63 rounds
        Object.entries(validation.blockCounts).forEach(([block, count]) => {
            if (count !== 63) {
                validation.errors.push(`Block ${block} has ${count} rounds, expected 63`);
            }
        });

        if (validation.errors.length === 0) {
            console.log('✅ Schedule validation passed');
        } else {
            console.log('❌ Schedule validation failed:');
            validation.errors.forEach(error => console.log(`   - ${error}`));
        }

        console.log('📊 Schedule summary:');
        console.log(`   Total rounds: ${validation.totalRounds}`);
        console.log(`   Conditions:`, validation.conditionCounts);
        console.log(`   Incentives:`, validation.incentiveCounts);
        console.log(`   Players:`, validation.playerCounts);
        console.log(`   Blocks:`, validation.blockCounts);

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
     * @param {string} mode - 'baseline' or 'conditions'
     * @param {number} currentRound - Current round number
     * @param {number} whiteTokensRemaining - White tokens left in pool
     * @param {number} maxRounds - Maximum rounds for mode
     * @returns {Object} End game status and reason
     */
    shouldEndExperiment(mode, currentRound, whiteTokensRemaining, maxRounds) {
        if (mode === 'baseline') {
            if (whiteTokensRemaining <= 0) {
                return { shouldEnd: true, reason: 'White token pool exhausted' };
            }
            if (currentRound >= maxRounds) {
                return { shouldEnd: true, reason: 'Maximum rounds reached (500)' };
            }
        } else if (mode === 'conditions') {
            if (currentRound >= 441) {
                return { shouldEnd: true, reason: 'All 441 experimental rounds completed' };
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
            'Phase',
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
            
            // For Lightning test, use the phase field directly; otherwise use legacy logic
            let phase;
            if (logEntry.experimentMode === 'lightning_test' && logEntry.phase) {
                phase = logEntry.phase;
            } else {
                phase = logEntry.experimentMode === 'unified' ? 
                    (condition === 'Baseline' ? 'baseline' : 'conditions') :
                    (logEntry.experimentMode === 'baseline' ? 'baseline' : 'conditions');
            }
            
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
                phase,
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
        console.log('🧪 Running comprehensive scheduler validation tests...');
        
        const testResults = {
            passed: 0,
            failed: 0,
            tests: []
        };

        const addTest = (name, passed, details = '') => {
            testResults.tests.push({
                name,
                passed,
                details
            });
            if (passed) {
                testResults.passed++;
                console.log(`✅ ${name}`);
            } else {
                testResults.failed++;
                console.log(`❌ ${name}: ${details}`);
            }
        };

        // Test 1: Generate multiple schedules and verify basic structure
        try {
            const schedule = this.generateConditionsSchedule();
            addTest('Schedule Generation', schedule.length === 441, `Generated ${schedule.length} rounds, expected 441`);
            
            // Test 2: Verify condition distribution
            const conditionCounts = {};
            schedule.forEach(round => {
                conditionCounts[round.condition] = (conditionCounts[round.condition] || 0) + 1;
            });
            
            const expectedConditionCount = 147; // 21 rounds × 7 blocks
            let conditionDistributionPassed = true;
            Object.entries(conditionCounts).forEach(([condition, count]) => {
                if (count !== expectedConditionCount) {
                    conditionDistributionPassed = false;
                }
            });
            addTest('Condition Distribution', conditionDistributionPassed, 
                `Conditions: ${JSON.stringify(conditionCounts)}, expected ${expectedConditionCount} each`);

            // Test 3: Verify player distribution
            const playerCounts = {};
            schedule.forEach(round => {
                playerCounts[round.player] = (playerCounts[round.player] || 0) + 1;
            });
            
            const expectedPlayerCount = 147; // 441 rounds ÷ 3 players
            let playerDistributionPassed = true;
            Object.entries(playerCounts).forEach(([player, count]) => {
                if (count !== expectedPlayerCount) {
                    playerDistributionPassed = false;
                }
            });
            addTest('Player Distribution', playerDistributionPassed,
                `Players: ${JSON.stringify(playerCounts)}, expected ${expectedPlayerCount} each`);

            // Test 4: Verify incentive distribution
            const incentiveCounts = {};
            schedule.forEach(round => {
                incentiveCounts[round.incentive] = (incentiveCounts[round.incentive] || 0) + 1;
            });
            
            const expectedIncentiveCount = 147; // Equal distribution
            let incentiveDistributionPassed = true;
            Object.entries(incentiveCounts).forEach(([incentive, count]) => {
                if (count !== expectedIncentiveCount) {
                    incentiveDistributionPassed = false;
                }
            });
            addTest('Incentive Distribution', incentiveDistributionPassed,
                `Incentives: ${JSON.stringify(incentiveCounts)}, expected ${expectedIncentiveCount} each`);

            // Test 5: Verify block structure
            const blockCounts = {};
            schedule.forEach(round => {
                blockCounts[round.blockNumber] = (blockCounts[round.blockNumber] || 0) + 1;
            });
            
            const expectedBlockCount = 63; // 63 rounds per block
            let blockStructurePassed = true;
            for (let block = 1; block <= 7; block++) {
                if (blockCounts[block] !== expectedBlockCount) {
                    blockStructurePassed = false;
                }
            }
            addTest('Block Structure', blockStructurePassed,
                `Blocks: ${JSON.stringify(blockCounts)}, expected ${expectedBlockCount} rounds each`);

            // Test 6: Verify round number continuity
            const roundNumbers = schedule.map(r => r.roundNumber).sort((a, b) => a - b);
            const continuityPassed = roundNumbers.every((num, index) => num === index + 1);
            addTest('Round Number Continuity', continuityPassed,
                `Round numbers: ${roundNumbers.slice(0, 5)}...${roundNumbers.slice(-5)}`);

            // Test 7: Test randomization - multiple generations should produce different orders
            const schedule2 = this.generateConditionsSchedule();
            const firstBlockOrder1 = schedule.slice(0, 10).map(r => r.condition).join(',');
            const firstBlockOrder2 = schedule2.slice(0, 10).map(r => r.condition).join(',');
            const randomizationPassed = firstBlockOrder1 !== firstBlockOrder2;
            addTest('Randomization', randomizationPassed,
                `First 10 rounds differ between generations: ${firstBlockOrder1 !== firstBlockOrder2}`);

            // Test 8: Verify each block has balanced sub-distribution
            let blockBalancePassed = true;
            for (let blockNum = 1; blockNum <= 7; blockNum++) {
                const blockRounds = schedule.filter(r => r.blockNumber === blockNum);
                const blockConditions = {};
                blockRounds.forEach(r => {
                    blockConditions[r.condition] = (blockConditions[r.condition] || 0) + 1;
                });
                
                // Each condition should appear exactly 21 times per block
                Object.entries(blockConditions).forEach(([condition, count]) => {
                    if (count !== 21) {
                        blockBalancePassed = false;
                    }
                });
            }
            addTest('Block-Level Balance', blockBalancePassed,
                'Each block contains 21 rounds per condition');

        } catch (error) {
            addTest('Test Execution', false, `Error during testing: ${error.message}`);
        }

        // Summary
        console.log(`\n📊 Test Summary: ${testResults.passed} passed, ${testResults.failed} failed`);
        if (testResults.failed === 0) {
            console.log('🎉 All tests passed! Scheduler is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Please review the scheduler logic.');
        }

        return testResults;
    }

    /**
     * Analyze scheduler performance and generate detailed statistics
     * 
     * @returns {Object} Detailed analysis results
     */
    analyzeSchedulerPerformance() {
        console.log('📈 Analyzing scheduler performance and statistics...');
        
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
        
        console.log('📊 Performance Analysis Results:');
        console.log(`   Generation Time: ${analysis.generationTime}`);
        console.log(`   Max Cluster Size: ${analysis.maxClusterSize} rounds`);
        console.log(`   Clustering Score: ${(analysis.clusteringScore * 100).toFixed(2)}% consecutive`);
        console.log(`   Recommendation: ${analysis.recommendation}`);
        
        return analysis;
    }
}

module.exports = ExperimentScheduler;