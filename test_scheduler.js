/**
 * Test script for the ExperimentScheduler
 * Tests the 9-block, 21-round system (189 total rounds)
 * Run with: node test_scheduler.js
 */

const ExperimentScheduler = require('./ExperimentScheduler');

console.log('🧪 Testing ExperimentScheduler (9 Blocks × 21 Rounds)...\n');

// Create scheduler instance
const scheduler = new ExperimentScheduler();

// Test 1: Generate a single 21-round block
console.log('📋 Test 1: Generating a single 21-round block...');
const block = scheduler.generateBlock(1);
console.log(`Generated ${block.length} rounds (expected 21)`);
console.log('Sample rounds:');
block.slice(0, 5).forEach((round, index) => {
    console.log(`  ${index + 1}. ${round.condition} | ${round.incentive} | Player ${round.player}`);
});

// Test 2: Generate full conditions schedule (9 blocks)
console.log('\n📋 Test 2: Generating full conditions schedule (9 blocks = 189 rounds)...');
const conditionsSchedule = scheduler.generateConditionsSchedule();
console.log(`Generated ${conditionsSchedule.length} rounds across 9 blocks (expected 189)`);

// Test 3: Generate baseline schedule
console.log('\n📋 Test 3: Generating baseline schedule...');
const baselineSchedule = scheduler.generateBaselineSchedule();
console.log('Baseline configuration:');
console.log(`  Mode: ${baselineSchedule.mode}`);
console.log(`  Max rounds: ${baselineSchedule.maxRounds}`);
console.log(`  Initial white tokens: ${baselineSchedule.initialWhiteTokens}`);
console.log(`  Rules:`, baselineSchedule.rules);

// Test 4: Test getCurrentRound function
console.log('\n📋 Test 4: Testing getCurrentRound function...');
const round1 = scheduler.getCurrentRound(conditionsSchedule, 1);
const round21 = scheduler.getCurrentRound(conditionsSchedule, 21);
const round189 = scheduler.getCurrentRound(conditionsSchedule, 189);

console.log('Round 1:', round1);
console.log('Round 21 (end of block 1):', round21);
console.log('Round 189 (end of block 9):', round189);

// Test 5: Test experiment end conditions
console.log('\n📋 Test 5: Testing experiment end conditions...');

// Baseline mode tests
const baselineEnd1 = scheduler.shouldEndExperiment('baseline', 100, 50, 500);
const baselineEnd2 = scheduler.shouldEndExperiment('baseline', 500, 10, 500);
const baselineEnd3 = scheduler.shouldEndExperiment('baseline', 300, 0, 500);

console.log('Baseline - Round 100, 50 tokens:', baselineEnd1);
console.log('Baseline - Round 500, 10 tokens:', baselineEnd2);
console.log('Baseline - Round 300, 0 tokens:', baselineEnd3);

// Conditions mode tests (189 rounds with 9 blocks)
const conditionsEnd1 = scheduler.shouldEndExperiment('conditions', 189, 100, 189);
const conditionsEnd2 = scheduler.shouldEndExperiment('conditions', 150, 0, 189);
const conditionsEnd3 = scheduler.shouldEndExperiment('conditions', 100, 1000, 189);

console.log('Conditions - Round 189 (end), 100 tokens:', conditionsEnd1);
console.log('Conditions - Round 150, 0 tokens:', conditionsEnd2);
console.log('Conditions - Round 100, 1000 tokens:', conditionsEnd3);

// Test 6: Export to CSV
console.log('\n📋 Test 6: Testing CSV export...');
const sampleSchedule = conditionsSchedule.slice(0, 10); // First 10 rounds
const csv = scheduler.exportToCSV(sampleSchedule);
console.log('Sample CSV output:');
console.log(csv);

console.log('\n✅ All tests completed!');
console.log('\nSchedule Summary:');
console.log('• 189 total rounds (9 blocks × 21 rounds)');
console.log('• Each block: 9 SC + 9 Impulse + 3 None');
console.log('• Each player per block: 3 SC + 3 Impulse + 1 None = 7 assignments');
console.log('• Each condition appears 7 times per block');
console.log('4. Validate counterbalancing within each block');