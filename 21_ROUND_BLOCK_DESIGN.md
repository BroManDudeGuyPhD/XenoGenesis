# 21-Round Block Scheduler Design (9 Blocks)

## Overview
The experimental scheduler uses **21-round blocks** with balanced per-player incentive distribution. With **9 blocks total**, the experiment consists of **189 rounds** (same as the original 3×63 design, but with better granularity and tracking).

## Block Structure

### Rounds Per Block
- **21 rounds** per block
- **9 blocks total** = 189 rounds
- Configurable via `generateConditionsSchedule(numBlocks)`

### Player Distribution
Each player receives **7 assignments per block**:
- 3 × Self Control Incentive
- 3 × Impulse Incentive  
- 1 × No Incentive
- **Total: 7 assignments** (21 rounds ÷ 3 players)

### Block-Level Totals
Per 21-round block:
- **9 Self Control Incentives** (3 per player × 3 players)
- **9 Impulse Incentives** (3 per player × 3 players)
- **3 No Incentives** (1 per player × 3 players)
- **Total: 21 rounds**

### Condition Distribution
Each condition appears **exactly 7 times per block**:
- High Culturant: 7 occurrences
- High Operant: 7 occurrences
- Equal Culturant-Operant: 7 occurrences
- **Total: 21 rounds** (7 × 3 conditions)

## LED Tracker

### Visual Structure
- **21 LEDs total** organized by condition
- **7 LEDs per condition row** (matching 7 occurrences per block)
- 3 condition rows × 7 LEDs = 21 total

### LED States
- 🟢 **Green**: Normal occurrence (condition appeared as scheduled)
- 🔴 **Red**: ERROR - Duplicate occurrence (scheduling error)
- ⚪ **Off**: Not yet occurred in current block

### Block Tracking
- LEDs **reset at the start of each new block** (every 21 rounds)
- Block number displayed: `"Block X/21"` in status display
- Current block calculated from round number: `blockNumber = ceil(roundNumber / 21)`

## Validation

### Automated Checks
The scheduler validates each generated schedule for:

1. **Total Rounds**: Each block has exactly 21 rounds ✓
2. **Player Distribution**: Each player has exactly 7 assignments per block ✓
3. **Incentive Balance (per player)**:
   - Self Control: 3 ✓
   - Impulse: 3 ✓
   - None: 1 ✓
4. **Incentive Totals (per block)**:
   - Self Control: 9 ✓
   - Impulse: 9 ✓
   - None: 3 ✓
5. **Condition Balance**: Each condition appears 7 times per block ✓

### Test Results
All validation tests pass for:
- Single block generation ✅
- Multiple block generation (3 blocks tested) ✅
- Cross-block consistency ✅

## Implementation Files

### Core Logic
- **ExperimentScheduler.js**: Scheduler class with 21-round block generation
  - `generateBlock(blockNumber)`: Creates balanced 21-round block
  - `generateConditionsSchedule(numBlocks)`: Generates full experiment schedule
  - `validateSchedule(schedule, numBlocks)`: Validates structure and balance

### Client-Side
- **client/client.js**: 
  - `updateConditionLED(condition, round, blockNumber, player)`: Updates LED state
  - `initializeConditionTracker()`: Resets LEDs and counters for new block
  - `conditionUpdate` event handler: Updates block display

### UI Components
- **login.ejs**:
  - LED tracker HTML structure (7 LEDs per condition)
  - Block number display: `<span id="currentBlockDisplay">`
  - Tooltip: "Tracks progress through each 21-round block..."

### Server-Side
- **Entity.js**:
  - Emits `conditionUpdate` events with `blockNumber` field
  - Schedules experiments using `ExperimentScheduler`

## Testing

### Test Scripts
1. **test_21_round_scheduler.js**: Single block validation
   - Validates 21-round structure
   - Checks player distribution (7 each)
   - Verifies incentive balance (3+3+1 per player)
   - Confirms condition balance (7 each)

2. **test_comprehensive_scheduler.js**: Multi-block validation
   - Tests 3 blocks (63 rounds)
   - Validates consistency across blocks
   - Checks overall statistics

### Running Tests
```powershell
# Single block test
node test_21_round_scheduler.js

# Comprehensive test (3 blocks)
node test_comprehensive_scheduler.js
```

Both tests show **all validation checks passing** ✅

## Key Design Principles

1. **Balance**: Each player experiences conditions equally within each block
2. **Fairness**: No player is over-assigned or under-assigned incentives
3. **Randomization**: Rounds are shuffled within each block to prevent patterns
4. **Validation**: Comprehensive checks ensure schedule integrity
5. **Visual Feedback**: LED tracker provides real-time progress indication
6. **Block Independence**: Each 21-round block is self-contained and balanced

## Example Block

```
Block 1 (Rounds 1-21):
  Player A: 7 assignments (3 SC, 3 Imp, 1 None)
  Player B: 7 assignments (3 SC, 3 Imp, 1 None)
  Player C: 7 assignments (3 SC, 3 Imp, 1 None)
  
  Conditions:
    High Culturant: 7 occurrences
    High Operant: 7 occurrences
    Equal Culturant-Operant: 7 occurrences

Block 2 (Rounds 22-42):
  [Same structure, shuffled order]
  
Block 3 (Rounds 43-63):
  [Same structure, shuffled order]
  
... continues for 9 blocks (189 total rounds)
```

## Advantages Over Previous Design

### Before (63-round blocks)
- 3 blocks × 63 rounds = 189 total rounds
- 7 of each incentive per condition per block
- More complex validation
- Longer blocks harder to track
- 3 data points (blocks) for analysis

### After (21-round blocks with 9 repetitions)
- 9 blocks × 21 rounds = **189 total rounds (same total)**
- Simpler per-player distribution (3+3+1)
- Clearer LED tracking (7 LEDs per condition)
- Better granularity for progress tracking
- Each block is self-contained and balanced
- **9 data points (blocks) for analysis** - 3× more granular data
- More opportunities to observe learning/adaptation effects
- Easier to restart from a block boundary if needed

## Future Enhancements

Possible improvements:
- Configurable number of blocks via UI
- Export block-level statistics
- Block-by-block performance comparison
- Custom block sizes (currently 21 is optimal for 3 players)
