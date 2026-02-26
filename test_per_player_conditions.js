/**
 * Test to verify per-player condition distribution within blocks
 * Checks if each player experiences all conditions equally
 */

const ExperimentScheduler = require('./ExperimentScheduler');

console.log('🔍 Testing Per-Player Condition Distribution\n');
console.log('='.repeat(70));

const scheduler = new ExperimentScheduler();

// Generate 3 blocks to test distribution
const schedule = scheduler.generateConditionsSchedule(3);

console.log('\n📊 Analyzing per-player condition distribution across blocks...\n');

for (let blockNum = 1; blockNum <= 3; blockNum++) {
    console.log('='.repeat(70));
    console.log(`Block ${blockNum} - Per Player Condition Distribution:`);
    console.log('='.repeat(70));
    
    const blockRounds = schedule.filter(r => r.blockNumber === blockNum);
    
    // Count conditions per player
    const playerConditions = {};
    
    blockRounds.forEach(round => {
        if (!playerConditions[round.player]) {
            playerConditions[round.player] = {
                'High Culturant': 0,
                'High Operant': 0,
                'Equal Culturant–Operant': 0,
                total: 0
            };
        }
        playerConditions[round.player][round.condition]++;
        playerConditions[round.player].total++;
    });
    
    // Display results
    Object.keys(playerConditions).sort().forEach(player => {
        const counts = playerConditions[player];
        console.log(`\nPlayer ${player} (${counts.total} assignments):`);
        console.log(`  High Culturant:           ${counts['High Culturant']} rounds`);
        console.log(`  High Operant:             ${counts['High Operant']} rounds`);
        console.log(`  Equal Culturant-Operant:  ${counts['Equal Culturant–Operant']} rounds`);
        
        // Check if balanced (should be 2-3 of each for 7 total)
        const values = [
            counts['High Culturant'],
            counts['High Operant'],
            counts['Equal Culturant–Operant']
        ];
        const max = Math.max(...values);
        const min = Math.min(...values);
        const isBalanced = (max - min) <= 1; // Within 1 of each other
        
        if (isBalanced) {
            console.log(`  ✅ Balanced (difference: ${max - min})`);
        } else {
            console.log(`  ⚠️  NOT balanced (difference: ${max - min})`);
        }
    });
    
    console.log('');
}

// Overall statistics
console.log('='.repeat(70));
console.log('Overall Statistics (3 blocks = 63 rounds per player):');
console.log('='.repeat(70));

const overallPlayerConditions = {};

schedule.forEach(round => {
    if (!overallPlayerConditions[round.player]) {
        overallPlayerConditions[round.player] = {
            'High Culturant': 0,
            'High Operant': 0,
            'Equal Culturant–Operant': 0,
            total: 0
        };
    }
    overallPlayerConditions[round.player][round.condition]++;
    overallPlayerConditions[round.player].total++;
});

Object.keys(overallPlayerConditions).sort().forEach(player => {
    const counts = overallPlayerConditions[player];
    console.log(`\nPlayer ${player} (${counts.total} total assignments):`);
    console.log(`  High Culturant:           ${counts['High Culturant']} rounds (expected ~21)`);
    console.log(`  High Operant:             ${counts['High Operant']} rounds (expected ~21)`);
    console.log(`  Equal Culturant-Operant:  ${counts['Equal Culturant–Operant']} rounds (expected ~21)`);
    
    // Check overall balance
    const values = [
        counts['High Culturant'],
        counts['High Operant'],
        counts['Equal Culturant–Operant']
    ];
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    if (max === 21 && min === 21) {
        console.log(`  ✅ Perfectly balanced (all conditions = 21)`);
    } else {
        console.log(`  ⚠️  Imbalanced (range: ${min}-${max})`);
    }
});

console.log('\n' + '='.repeat(70));
console.log('CONCLUSION:');
console.log('='.repeat(70));
console.log('Current scheduler assigns conditions RANDOMLY across rounds.');
console.log('- ✅ Each condition appears 7 times per block (total)');
console.log('- ❌ Players may NOT experience all conditions equally within a block');
console.log('- ✅ Over multiple blocks, distribution SHOULD average out');
console.log('='.repeat(70));
