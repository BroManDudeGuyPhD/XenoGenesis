/**
 * Test script for the ExperimentScheduler
 * Run with: node test_scheduler.js
 */

const ExperimentScheduler = require('./ExperimentScheduler');

console.log('🧪 Testing ExperimentScheduler...\n');

// Create scheduler instance
const scheduler = new ExperimentScheduler();

// Test 1: Generate a single 63-round block
console.log('📋 Test 1: Generating a single 63-round block...');
const block = scheduler.generateBlock();
console.log(`Generated ${block.length} rounds`);
console.log('Sample rounds:');
block.slice(0, 5).forEach((round, index) => {
    console.log(`  ${index + 1}. ${round.condition} | ${round.incentive} | Player ${round.player}`);
});

// Test 2: Generate full conditions schedule
console.log('\n📋 Test 2: Generating full conditions schedule (441 rounds)...');
const conditionsSchedule = scheduler.generateConditionsSchedule();
console.log(`Generated ${conditionsSchedule.length} rounds across 7 blocks`);

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
const round63 = scheduler.getCurrentRound(conditionsSchedule, 63);
const round441 = scheduler.getCurrentRound(conditionsSchedule, 441);

console.log('Round 1:', round1);
console.log('Round 63:', round63);
console.log('Round 441:', round441);

// Test 5: Test experiment end conditions
console.log('\n📋 Test 5: Testing experiment end conditions...');

// Baseline mode tests
const baselineEnd1 = scheduler.shouldEndExperiment('baseline', 100, 50, 500);
const baselineEnd2 = scheduler.shouldEndExperiment('baseline', 500, 10, 500);
const baselineEnd3 = scheduler.shouldEndExperiment('baseline', 300, 0, 500);

console.log('Baseline - Round 100, 50 tokens:', baselineEnd1);
console.log('Baseline - Round 500, 10 tokens:', baselineEnd2);
console.log('Baseline - Round 300, 0 tokens:', baselineEnd3);

// Conditions mode tests
const conditionsEnd1 = scheduler.shouldEndExperiment('conditions', 441, 100, 441);
const conditionsEnd2 = scheduler.shouldEndExperiment('conditions', 300, 0, 441);
const conditionsEnd3 = scheduler.shouldEndExperiment('conditions', 200, 1000, 441);

console.log('Conditions - Round 441, 100 tokens:', conditionsEnd1);
console.log('Conditions - Round 300, 0 tokens:', conditionsEnd2);
console.log('Conditions - Round 200, 1000 tokens:', conditionsEnd3);

// Test 6: Export to CSV
console.log('\n📋 Test 6: Testing CSV export...');
const sampleSchedule = conditionsSchedule.slice(0, 10); // First 10 rounds
const csv = scheduler.exportToCSV(sampleSchedule);
console.log('Sample CSV output:');
console.log(csv);

console.log('\n✅ All tests completed!');
console.log('\nTo verify the full schedule matches the sample:');
console.log('1. Check that all 441 rounds are present');
console.log('2. Verify balanced distribution across conditions, incentives, and players');
console.log('3. Confirm proper block structure (7 blocks of 63 rounds each)');
console.log('4. Validate counterbalancing within each block');