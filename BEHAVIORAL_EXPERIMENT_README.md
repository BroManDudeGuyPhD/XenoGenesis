# Behavioral Economics Experiment - Implementation Guide

## 🎯 **Phase 2+ Complete: Full Client Interface + AI Players**

### ✅ **What's Implemented:**

#### **1. Backend (Entity.js)**
- **Flexible Triad Management**: 1-3 players per room (AI fills remaining spots)
- **AI Player System**: 
  - Random behavioral patterns (Random, Impulsive, Conservative, Adaptive)
  - Automatic decision making with 0-2 second delays
  - No socket connections needed (server-side only)
- **Game Session System**: Tracks rounds, conditions, tokens, data logging
- **Token Economics**: 
  - White tokens: Impulsive choice = 3, Self-control = 1
  - Black tokens: All players choose self-control = +1 each
  - Global pool: Starts with 2,500 white tokens, unlimited black
- **Experimental Conditions**: Baseline, High Culturant, High Operant, Equal Culturant-Operant
- **Round Processing**: Choice collection, token awards, culturant detection (includes AI choices)
- **Data Logging**: Complete CSV-exportable session data (includes AI player data)
- **End Conditions**: 500 rounds or white token pool exhausted

#### **2. Frontend Interface (game.ejs + client.js)**
- **Modern UI**: Discord-style dark theme with responsive design
- **Flexible Triad Formation**: Works with 1, 2, or 3 human players
- **AI Player Integration**: 
  - Visual indicators (🤖) for AI players
  - Real-time display of AI choices
  - "AI will be added" preview in lobby
- **Decision Grid**: 2x3 grid with randomized +/- symbols
  - Row 1 (Impulsive): Red buttons, awards 3 white tokens
  - Row 2 (Self-control): Green buttons, awards 1 white token
- **Status Dashboard**: 
  - Current round/500 total rounds
  - Individual white/black token counts (human player only)
  - Real-time earnings display ($0.00 format)
  - Global token pool remaining
  - AI player count display
- **Real-time Updates**: 
  - Round results showing both human and AI choices
  - Token awards with animations
  - Culturant detection notifications
- **Data Export**: CSV download with complete session data (including AI decisions)

#### **3. Socket Communication**
- `triadComplete`: Notifies when players ready (1-3 humans)
- `aiPlayersAdded`: Confirms AI players were created
- `startExperiment`: Begin experiment (auto-adds AI players)
- `newRound`: Round info and turn management
- `makeChoice`: Player decision submission (triggers AI decisions)
- `roundResult`: Results and token updates (includes AI choices)
- `experimentEnd`: Final statistics and data export

#### **4. AI Player Features**
- **Behavioral Types**:
  - Random: 50% chance impulsive
  - Impulsive: 80% chance impulsive  
  - Conservative: 20% chance impulsive
  - Adaptive: 50% chance (can be enhanced later)
- **Decision Timing**: 0-2 second random delays to simulate thinking
- **Data Integration**: AI choices included in all data exports and displays
- **No Socket Required**: Server-side only, no network overhead

### 🎮 **How to Use (Updated for AI):**

#### **For Solo Testing:**
1. **Login**: Sign in with any username/password (auth disabled)
2. **Create Room**: Use "Create Game" button  
3. **Start Immediately**: Click "Start Experiment" with just 1 player
4. **AI Auto-Added**: Server automatically adds 2 AI players
5. **Test Choices**: Make your choices, watch AI players decide automatically
6. **View Results**: See mixed human/AI results with 🤖 indicators
7. **Export Data**: Download CSV with all choices (human and AI)

#### **For Multi-Player Testing:**
1. **Multiple Users**: 2-3 humans can join same room
2. **Flexible Start**: Start with any number 1-3 humans
3. **AI Fill**: Remaining spots filled with AI players
4. **Mixed Results**: See combinations of human and AI choices

#### **For Researchers:**
- **Easy Testing**: No need for multiple people - test alone with AI
- **Realistic Scenarios**: AI players create varied choice patterns  
- **Full Data**: AI decisions included in research data exports
- **Controlled Variables**: AI behavior types can be adjusted
- **Multiple Sessions**: Run multiple solo experiments simultaneously

### 🤖 **AI Player Details:**
- **Automatic Creation**: Added when experiment starts if < 3 players
- **Behavioral Variety**: Different AI types create diverse choice patterns
- **Realistic Timing**: Random delays make choices feel natural
- **Data Integrity**: All choices logged with clear human/AI distinction
- **No Interference**: AI players don't need sockets or client connections
- **Scalable**: Can adjust AI count, behavior types, decision delays

### 🧪 **Testing Scenarios:**
1. **Solo Test**: 1 human + 2 AI players
2. **Duo Test**: 2 humans + 1 AI player  
3. **Full Human**: 3 humans + 0 AI players
4. **Mixed Behavior**: Different AI types create various choice combinations

### 🚀 **Next Steps (Phase 3):**
- [ ] Enhanced AI behavior (learning from human choices)
- [ ] Condition switching during experiment
- [ ] Individual player manipulations
- [ ] Admin controls and monitoring dashboard
- [ ] Observer agreement/fidelity tools
- [ ] Advanced data analytics
- [ ] Multi-session experiment management

---
**Status**: Phase 2+ Complete ✅  
**Ready for**: Solo testing, AI-enhanced experiments, and Phase 3 advanced features