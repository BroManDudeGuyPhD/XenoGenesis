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
 * - 3 incentive types: No Incentive, Culturant Incentive, Operant Incentive
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
            CULTURANT_INCENTIVE: 'Culturant Incentive',
            OPERANT_INCENTIVE: 'Operant Incentive'
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
}

module.exports = ExperimentScheduler;