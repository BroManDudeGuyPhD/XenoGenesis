/**
 * Test script for 21-round block scheduler with 9 blocks
 * Validates 189 total rounds (9 blocks × 21 rounds)
 */

const ExperimentScheduler = require('./ExperimentScheduler');

console.log('🧪 Testing 21-Round Block Scheduler (9 Blocks = 189 Rounds)\n');
console.log('='.repeat(70));

const scheduler = new ExperimentScheduler();

// Generate full experiment (9 blocks)
console.log('\n📋 Generating 9 blocks (189 rounds total)...\n');
const schedule = scheduler.generateConditionsSchedule(); // Uses default of 9

console.log(`✅ Generated ${schedule.length} total rounds across 9 blocks\n`);

// Verify total
console.log('='.repeat(70));
console.log('📊 Overall Statistics:');
console.log('='.repeat(70));

console.log(`\nTotal Rounds: ${schedule.length} (expected 189)`);
console.log(`Total Blocks: 9`);
console.log(`Rounds per block: 21`);

// Count by block
const blockCounts = {};
schedule.forEach(round => {
    blockCounts[round.blockNumber] = (blockCounts[round.blockNumber] || 0) + 1;
});

console.log('\nRounds per block:');
Object.keys(blockCounts).sort((a, b) => Number(a) - Number(b)).forEach(blockNum => {
    const count = blockCounts[blockNum];
    const status = count === 21 ? '✅' : '❌';
    console.log(`  Block ${blockNum}: ${count} rounds ${status}`);
});

// Overall player distribution
const playerCounts = {};
schedule.forEach(round => {
    if (!playerCounts[round.player]) {
        playerCounts[round.player] = {
            total: 0,
            'Self Control Incentive': 0,
            'Impulse Incentive': 0,
            'No Incentive': 0
        };
    }
    playerCounts[round.player].total++;
    playerCounts[round.player][round.incentive]++;
});

console.log('\nPer Player (all 9 blocks):');
Object.keys(playerCounts).sort().forEach(player => {
    const counts = playerCounts[player];
    console.log(`  Player ${player}:`);
    console.log(`    Total: ${counts.total} (7 per block × 9 blocks = 63)`);
    console.log(`    Self Control: ${counts['Self Control Incentive']} (3 per block × 9 = 27)`);
    console.log(`    Impulse: ${counts['Impulse Incentive']} (3 per block × 9 = 27)`);
    console.log(`    None: ${counts['No Incentive']} (1 per block × 9 = 9)`);
});

// Overall incentive counts
const incentiveCounts = {};
schedule.forEach(round => {
    incentiveCounts[round.incentive] = (incentiveCounts[round.incentive] || 0) + 1;
});

console.log('\nIncentive Distribution (all 9 blocks):');
Object.keys(incentiveCounts).forEach(incentive => {
    const count = incentiveCounts[incentive];
    let expected = '';
    if (incentive === 'Self Control Incentive') expected = ' (9 per block × 9 = 81)';
    if (incentive === 'Impulse Incentive') expected = ' (9 per block × 9 = 81)';
    if (incentive === 'No Incentive') expected = ' (3 per block × 9 = 27)';
    console.log(`  ${incentive}: ${count}${expected}`);
});

// Overall condition counts
const conditionCounts = {};
schedule.forEach(round => {
    conditionCounts[round.condition] = (conditionCounts[round.condition] || 0) + 1;
});

console.log('\nCondition Distribution (all 9 blocks):');
Object.keys(conditionCounts).forEach(condition => {
    console.log(`  ${condition}: ${conditionCounts[condition]} (7 per block × 9 = 63)`);
});

// Validation
console.log('\n' + '='.repeat(70));
console.log('Validation Summary:');
console.log('='.repeat(70));

let allPassed = true;

// Check total rounds
if (schedule.length === 189) {
    console.log('✅ Total rounds: 189');
} else {
    console.log(`❌ Total rounds: ${schedule.length} (expected 189)`);
    allPassed = false;
}

// Check each block has 21 rounds
const allBlocksValid = Object.values(blockCounts).every(count => count === 21);
if (allBlocksValid) {
    console.log('✅ All blocks have 21 rounds');
} else {
    console.log('❌ Some blocks do not have 21 rounds');
    allPassed = false;
}

// Check player totals
Object.keys(playerCounts).forEach(player => {
    const counts = playerCounts[player];
    if (counts.total === 63 && 
        counts['Self Control Incentive'] === 27 && 
        counts['Impulse Incentive'] === 27 && 
        counts['No Incentive'] === 9) {
        console.log(`✅ Player ${player} has correct distribution`);
    } else {
        console.log(`❌ Player ${player} has incorrect distribution`);
        allPassed = false;
    }
});

// Check incentive totals
if (incentiveCounts['Self Control Incentive'] === 81 &&
    incentiveCounts['Impulse Incentive'] === 81 &&
    incentiveCounts['No Incentive'] === 27) {
    console.log('✅ Incentive totals correct');
} else {
    console.log('❌ Incentive totals incorrect');
    allPassed = false;
}

// Check condition totals
const allConditionsValid = Object.values(conditionCounts).every(count => count === 63);
if (allConditionsValid) {
    console.log('✅ All conditions have 63 occurrences');
} else {
    console.log('❌ Some conditions do not have 63 occurrences');
    allPassed = false;
}

console.log('\n' + '='.repeat(70));
if (allPassed) {
    console.log('✅✅✅ ALL VALIDATION CHECKS PASSED! ✅✅✅');
    console.log('🎉 9-Block Design (189 rounds) is READY! 🎉');
} else {
    console.log('❌❌❌ SOME VALIDATION CHECKS FAILED ❌❌❌');
}
console.log('='.repeat(70));
