/**/**

 * Test script for the unified experiment system * Test script for the unified experiment system

 * Tests baseline-to-conditions flow with token pool updates * Tests baseline-to-conditions flow with token pool updates

 */ */



const ExperimentScheduler = require('./ExperimentScheduler'); */ */



// Mock Entity.js components for testing

const MockExperimentManager = {

    scheduler: new ExperimentScheduler(),const ExperimentScheduler = require('./ExperimentScheduler');const ExperimentScheduler = require('./ExperimentScheduler');

    

    initializeExperiment: function(roomName, mode = 'baseline') {

        console.log(`🧪 Initializing ${mode} experiment for room: ${roomName}`);

        // Mock Entity.js components for testing// Mock Entity.js components for testing

        if (mode === 'baseline') {

            // Baseline is now a unified experiment that flows into conditionsconst MockExperimentManager = {const MockExperimentManager = {

            const conditionsSchedule = this.scheduler.generateConditionsSchedule();

            return {    scheduler: new ExperimentScheduler(),    scheduler: new ExperimentScheduler(),

                mode: 'unified',

                phase: 'baseline',        

                schedule: conditionsSchedule,

                currentRound: 0,    initializeExperiment: function(roomName, mode = 'baseline') {    initializeExperiment: function(roomName, mode = 'baseline') {

                baselineRounds: 0,

                whiteTokenPool: 100,        console.log(`🧪 Initializing ${mode} experiment for room: ${roomName}`);        console.log(`🧪 Initializing ${mode} experiment for room: ${roomName}`);

                totalWhiteTokenPool: 2500,

                maxBaselineRounds: 500,                

                maxRounds: 441

            };        if (mode === 'baseline') {        if (mode === 'baseline') {

        } else if (mode === 'conditions') {

            return {            // Baseline is now a unified experiment that flows into conditions            // Baseline is now a unified experiment that flows into conditions

                mode: 'conditions', 

                phase: 'conditions',            const conditionsSchedule = this.scheduler.generateConditionsSchedule();            const conditionsSchedule = this.scheduler.generateConditionsSchedule();

                schedule: this.scheduler.generateConditionsSchedule(),

                currentRound: 0,            return {            return {

                whiteTokenPool: 2500,

                maxRounds: 441                mode: 'unified',                mode: 'unified',

            };

        }                phase: 'baseline',                phase: 'baseline',

        

        throw new Error(`Unknown experiment mode: ${mode}`);                schedule: conditionsSchedule,                schedule: conditionsSchedule,

    }

};                currentRound: 0,                currentRound: 0,



// Mock token pool                baselineRounds: 0,                baselineRounds: 0,

const MockGlobalTokenPool = {

    whiteTokens: 100,                whiteTokenPool: 100,                whiteTokenPool: 100,

    blackTokens: Infinity,

                    totalWhiteTokenPool: 2500,                totalWhiteTokenPool: 2500,

    initialize: function(experiment) {

        if (experiment.mode === 'unified') {                maxBaselineRounds: 500,                maxBaselineRounds: 500,

            if (experiment.phase === 'baseline') {

                this.whiteTokens = experiment.whiteTokenPool; // 100 for baseline                maxRounds: 441                maxRounds: 441

                console.log(`🪙 Token pool initialized for baseline phase: ${this.whiteTokens} white tokens`);

            } else {            };            };

                this.whiteTokens = experiment.whiteTokenPool; // 2500 for conditions

                console.log(`🪙 Token pool initialized for conditions phase: ${this.whiteTokens} white tokens`);        } else if (mode === 'conditions') {        } else if (mode === 'conditions') {

            }

        } else if (experiment.mode === 'conditions') {            return {            return {

            this.whiteTokens = experiment.whiteTokenPool; // 2500

            console.log(`🪙 Token pool initialized for conditions mode: ${this.whiteTokens} white tokens`);                mode: 'conditions',                 mode: 'conditions', 

        } else if (experiment.mode === 'baseline') {

            this.whiteTokens = experiment.whiteTokenPool; // 100                phase: 'conditions',                phase: 'conditions',

            console.log(`🪙 Token pool initialized for baseline mode: ${this.whiteTokens} white tokens`);

        }                schedule: this.scheduler.generateConditionsSchedule(),                schedule: this.scheduler.generateConditionsSchedule(),

    },

                    currentRound: 0,                currentRound: 0,

    transitionToConditions: function(experiment) {

        if (experiment.mode === 'unified' && experiment.phase === 'baseline') {                whiteTokenPool: 2500,                whiteTokenPool: 2500,

            this.whiteTokens = experiment.totalWhiteTokenPool; // 2500

            console.log(`🔄 Token pool transitioned to conditions phase: ${this.whiteTokens} white tokens`);                maxRounds: 441                maxRounds: 441

        }

    }            };            };

};

        }        }

// Test unified experiment initialization

console.log('\n=== Testing Unified Experiment Initialization ===');                

const testExperiment = MockExperimentManager.initializeExperiment('testRoom', 'baseline');

console.log('Experiment configuration:', {        throw new Error(`Unknown experiment mode: ${mode}`);        throw new Error(`Unknown experiment mode: ${mode}`);

    mode: testExperiment.mode,

    phase: testExperiment.phase,    }    }

    whiteTokenPool: testExperiment.whiteTokenPool,

    totalWhiteTokenPool: testExperiment.totalWhiteTokenPool,};};

    maxBaselineRounds: testExperiment.maxBaselineRounds,

    maxRounds: testExperiment.maxRounds,

    scheduleLength: testExperiment.schedule.length

});// Mock token pool// Mock token pool



// Test token pool initializationconst MockGlobalTokenPool = {const MockGlobalTokenPool = {

console.log('\n=== Testing Token Pool Initialization ===');

MockGlobalTokenPool.initialize(testExperiment);    whiteTokens: 100,    whiteTokens: 100,

console.log('Current token pool:', MockGlobalTokenPool.whiteTokens);

    blackTokens: Infinity,    blackTokens: Infinity,

// Simulate baseline to conditions transition

console.log('\n=== Testing Baseline to Conditions Transition ===');        

console.log('Before transition:');

console.log('  Phase:', testExperiment.phase);    initialize: function(experiment) {    initialize: function(experiment) {

console.log('  Token pool:', testExperiment.whiteTokenPool);

console.log('  Global token pool:', MockGlobalTokenPool.whiteTokens);        if (experiment.mode === 'unified') {        if (experiment.mode === 'unified') {



// Simulate transition            if (experiment.phase === 'baseline') {            if (experiment.phase === 'baseline') {

testExperiment.phase = 'conditions';

testExperiment.currentRound = 0;                this.whiteTokens = experiment.whiteTokenPool; // 100 for baseline                this.whiteTokens = experiment.whiteTokenPool; // 100 for baseline

testExperiment.whiteTokenPool = testExperiment.totalWhiteTokenPool;

MockGlobalTokenPool.transitionToConditions(testExperiment);                console.log(`🪙 Token pool initialized for baseline phase: ${this.whiteTokens} white tokens`);                console.log(`🪙 Token pool initialized for baseline phase: ${this.whiteTokens} white tokens`);



console.log('After transition:');            } else {            } else {

console.log('  Phase:', testExperiment.phase);

console.log('  Token pool:', testExperiment.whiteTokenPool);                this.whiteTokens = experiment.whiteTokenPool; // 2500 for conditions                this.whiteTokens = experiment.whiteTokenPool; // 2500 for conditions

console.log('  Global token pool:', MockGlobalTokenPool.whiteTokens);

                console.log(`🪙 Token pool initialized for conditions phase: ${this.whiteTokens} white tokens`);                console.log(`🪙 Token pool initialized for conditions phase: ${this.whiteTokens} white tokens`);

// Test direct conditions mode

console.log('\n=== Testing Direct Conditions Mode ===');            }            }

const conditionsExperiment = MockExperimentManager.initializeExperiment('testRoom2', 'conditions');

console.log('Conditions experiment configuration:', {        } else if (experiment.mode === 'conditions') {        } else if (experiment.mode === 'conditions') {

    mode: conditionsExperiment.mode,

    phase: conditionsExperiment.phase,            this.whiteTokens = experiment.whiteTokenPool; // 2500            this.whiteTokens = experiment.whiteTokenPool; // 2500

    whiteTokenPool: conditionsExperiment.whiteTokenPool,

    maxRounds: conditionsExperiment.maxRounds            console.log(`🪙 Token pool initialized for conditions mode: ${this.whiteTokens} white tokens`);            console.log(`🪙 Token pool initialized for conditions mode: ${this.whiteTokens} white tokens`);

});

        } else if (experiment.mode === 'baseline') {        } else if (experiment.mode === 'baseline') {

MockGlobalTokenPool.initialize(conditionsExperiment);

console.log('Conditions token pool:', MockGlobalTokenPool.whiteTokens);            this.whiteTokens = experiment.whiteTokenPool; // 100            this.whiteTokens = experiment.whiteTokenPool; // 100



console.log('\n✅ All tests completed successfully!');            console.log(`🪙 Token pool initialized for baseline mode: ${this.whiteTokens} white tokens`);            console.log(`🪙 Token pool initialized for baseline mode: ${this.whiteTokens} white tokens`);

        }        }

    },    },

        

    transitionToConditions: function(experiment) {    transitionToConditions: function(experiment) {

        if (experiment.mode === 'unified' && experiment.phase === 'baseline') {        if (experiment.mode === 'unified' && experiment.phase === 'baseline') {

            this.whiteTokens = experiment.totalWhiteTokenPool; // 2500            this.whiteTokens = experiment.totalWhiteTokenPool; // 2500

            console.log(`🔄 Token pool transitioned to conditions phase: ${this.whiteTokens} white tokens`);            console.log(`🔄 Token pool transitioned to conditions phase: ${this.whiteTokens} white tokens`);

        }        }

    }    }

};};



// Test unified experiment initialization// Test unified experiment initialization

console.log('\n=== Testing Unified Experiment Initialization ===');console.log('\n=== Testing Unified Experiment Initialization ===');

const testExperiment = MockExperimentManager.initializeExperiment('testRoom', 'baseline');const testExperiment = MockExperimentManager.initializeExperiment('testRoom', 'baseline');

console.log('Experiment configuration:', {console.log('Experiment configuration:', {

    mode: testExperiment.mode,    mode: testExperiment.mode,

    phase: testExperiment.phase,    phase: testExperiment.phase,

    whiteTokenPool: testExperiment.whiteTokenPool,    whiteTokenPool: testExperiment.whiteTokenPool,

    totalWhiteTokenPool: testExperiment.totalWhiteTokenPool,    totalWhiteTokenPool: testExperiment.totalWhiteTokenPool,

    maxBaselineRounds: testExperiment.maxBaselineRounds,    maxBaselineRounds: testExperiment.maxBaselineRounds,

    maxRounds: testExperiment.maxRounds,    maxRounds: testExperiment.maxRounds,

    scheduleLength: testExperiment.schedule.length    scheduleLength: testExperiment.schedule.length

});});



// Test token pool initialization// Test token pool initialization

console.log('\n=== Testing Token Pool Initialization ===');console.log('\n=== Testing Token Pool Initialization ===');

MockGlobalTokenPool.initialize(testExperiment);MockGlobalTokenPool.initialize(testExperiment);

console.log('Current token pool:', MockGlobalTokenPool.whiteTokens);console.log('Current token pool:', MockGlobalTokenPool.whiteTokens);



// Simulate baseline to conditions transition// Simulate baseline to conditions transition

console.log('\n=== Testing Baseline to Conditions Transition ===');console.log('\n=== Testing Baseline to Conditions Transition ===');

console.log('Before transition:');console.log('Before transition:');

console.log('  Phase:', testExperiment.phase);console.log('  Phase:', testExperiment.phase);

console.log('  Token pool:', testExperiment.whiteTokenPool);console.log('  Token pool:', testExperiment.whiteTokenPool);

console.log('  Global token pool:', MockGlobalTokenPool.whiteTokens);console.log('  Global token pool:', MockGlobalTokenPool.whiteTokens);



// Simulate transition// Simulate transition

testExperiment.phase = 'conditions';testExperiment.phase = 'conditions';

testExperiment.currentRound = 0;testExperiment.currentRound = 0;

testExperiment.whiteTokenPool = testExperiment.totalWhiteTokenPool;testExperiment.whiteTokenPool = testExperiment.totalWhiteTokenPool;

MockGlobalTokenPool.transitionToConditions(testExperiment);MockGlobalTokenPool.transitionToConditions(testExperiment);



console.log('After transition:');console.log('After transition:');

console.log('  Phase:', testExperiment.phase);console.log('  Phase:', testExperiment.phase);

console.log('  Token pool:', testExperiment.whiteTokenPool);console.log('  Token pool:', testExperiment.whiteTokenPool);

console.log('  Global token pool:', MockGlobalTokenPool.whiteTokens);console.log('  Global token pool:', MockGlobalTokenPool.whiteTokens);



// Test direct conditions mode// Test direct conditions mode

console.log('\n=== Testing Direct Conditions Mode ===');console.log('\n=== Testing Direct Conditions Mode ===');

const conditionsExperiment = MockExperimentManager.initializeExperiment('testRoom2', 'conditions');const conditionsExperiment = MockExperimentManager.initializeExperiment('testRoom2', 'conditions');

console.log('Conditions experiment configuration:', {console.log('Conditions experiment configuration:', {

    mode: conditionsExperiment.mode,    mode: conditionsExperiment.mode,

    phase: conditionsExperiment.phase,    phase: conditionsExperiment.phase,

    whiteTokenPool: conditionsExperiment.whiteTokenPool,    whiteTokenPool: conditionsExperiment.whiteTokenPool,

    maxRounds: conditionsExperiment.maxRounds    maxRounds: conditionsExperiment.maxRounds

});});



MockGlobalTokenPool.initialize(conditionsExperiment);MockGlobalTokenPool.initialize(conditionsExperiment);

console.log('Conditions token pool:', MockGlobalTokenPool.whiteTokens);console.log('Conditions token pool:', MockGlobalTokenPool.whiteTokens);



console.log('\n✅ All tests completed successfully!');console.log('\n✅ All tests completed successfully!');