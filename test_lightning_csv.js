/**
 * Test script to verify lightning test CSV data generation
 */

const ExperimentScheduler = require('./ExperimentScheduler');

// Create a mock lightning test dataLog entry to test CSV generation
const mockLightningDataLog = [
    {
        timestamp: new Date().toISOString(),
        round: 1,
        condition: 'High Culturant',
        incentive: 'Culturant Incentive',
        player: 'A',
        blockNumber: 1,
        experimentMode: 'lightning_test',
        players: [
            { username: 'AI_Player_Alpha', choice: '2', whiteTokens: 3, blackTokens: 0, earnings: 0.30, isAI: true, isModerator: false },
            { username: 'AI_Player_Beta', choice: '4', whiteTokens: 1, blackTokens: 0, earnings: 0.10, isAI: true, isModerator: false },
            { username: 'AI_Player_Gamma', choice: '6', whiteTokens: 1, blackTokens: 0, earnings: 0.10, isAI: true, isModerator: false }
        ],
        culturantProduced: true,
        whiteTokensRemaining: 2500
    },
    {
        timestamp: new Date().toISOString(),
        round: 2,
        condition: 'High Operant',
        incentive: 'Operant Incentive',
        player: 'B',
        blockNumber: 1,
        experimentMode: 'lightning_test',
        players: [
            { username: 'AI_Player_Alpha', choice: '1', whiteTokens: 6, blackTokens: 0, earnings: 0.45, isAI: true, isModerator: false },
            { username: 'AI_Player_Beta', choice: '3', whiteTokens: 4, blackTokens: 0, earnings: 0.25, isAI: true, isModerator: false },
            { username: 'AI_Player_Gamma', choice: '7', whiteTokens: 1, blackTokens: 0, earnings: 0.10, isAI: true, isModerator: false }
        ],
        culturantProduced: false,
        whiteTokensRemaining: 2500
    },
    {
        timestamp: new Date().toISOString(),
        round: 3,
        condition: 'Equal Culturant–Operant',
        incentive: 'No Incentive',
        player: null,
        blockNumber: 1,
        experimentMode: 'lightning_test',
        players: [
            { username: 'AI_Player_Alpha', choice: '2', whiteTokens: 8, blackTokens: 0, earnings: 0.69, isAI: true, isModerator: false },
            { username: 'AI_Player_Beta', choice: '2', whiteTokens: 6, blackTokens: 0, earnings: 0.49, isAI: true, isModerator: false },
            { username: 'AI_Player_Gamma', choice: '4', whiteTokens: 3, blackTokens: 0, earnings: 0.46, isAI: true, isModerator: false }
        ],
        culturantProduced: true,
        whiteTokensRemaining: 2500
    }
];

console.log('=== Testing Lightning Test CSV Generation ===');

// Test CSV export with mock lightning test data
const scheduler = new ExperimentScheduler();
const csvOutput = scheduler.exportExperimentResultsToCSV(mockLightningDataLog);

console.log('✅ Lightning Test CSV Output:');
console.log(csvOutput);

console.log('\n📊 CSV Analysis:');
const lines = csvOutput.split('\n');
console.log(`   Total lines: ${lines.length} (1 header + ${lines.length - 1} data rows)`);
console.log(`   Header: ${lines[0]}`);

console.log('\n📋 Sample Data Rows:');
for (let i = 1; i < Math.min(4, lines.length); i++) {
    console.log(`   Row ${i}: ${lines[i]}`);
}

// Verify that all expected columns are present
const expectedColumns = [
    'Round', 'Condition', 'Phase', 'Block_Number', 'Incentive_Type', 'Incentive_Recipient',
    'Player_A_Choice', 'Player_B_Choice', 'Player_C_Choice',
    'Player_A_White_Tokens', 'Player_A_Black_Tokens', 'Player_A_Total_Payout',
    'Player_B_White_Tokens', 'Player_B_Black_Tokens', 'Player_B_Total_Payout',
    'Player_C_White_Tokens', 'Player_C_Black_Tokens', 'Player_C_Total_Payout',
    'Culturant_Produced', 'White_Tokens_Remaining', 'Timestamp'
];

const headers = lines[0].split(',');
const missingColumns = expectedColumns.filter(col => !headers.includes(col));
const extraColumns = headers.filter(col => !expectedColumns.includes(col));

console.log('\n✅ Column Validation:');
console.log(`   Expected columns: ${expectedColumns.length}`);
console.log(`   Actual columns: ${headers.length}`);
console.log(`   Missing columns: ${missingColumns.length > 0 ? missingColumns.join(', ') : 'None'}`);
console.log(`   Extra columns: ${extraColumns.length > 0 ? extraColumns.join(', ') : 'None'}`);

// Test file generation
const fs = require('fs');
const path = require('path');

try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `test_lightning_csv_validation_${timestamp}.csv`;
    const filepath = path.join(__dirname, 'experiment_results', filename);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write test CSV file
    fs.writeFileSync(filepath, csvOutput, 'utf8');
    console.log(`\n✅ Test CSV file created: ${filepath}`);
    
    const fileSize = fs.statSync(filepath).size;
    console.log(`📊 File size: ${fileSize} bytes`);
    
} catch (error) {
    console.error(`❌ Error creating test file: ${error.message}`);
}

console.log('\n🚀 Lightning Test CSV validation complete!');