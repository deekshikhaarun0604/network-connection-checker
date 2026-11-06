/**
 * Formal Finite State Machine Unit Verification
 * Tests all transitions from Automata Theory requirements.
 */

import { STATES, EVENTS, transition, ConnectionFSM } from './connectionFSM.js';

console.log('====================================================');
console.log('   FSM FORMAL AUTOMATA TRANSITION VERIFICATION      ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assertTransition(fromState, event, expectedState, description) {
  const resultState = transition(fromState, event);
  if (resultState === expectedState) {
    console.log(`✓ PASS: ${description}`);
    console.log(`        δ(${fromState}, ${event}) -> ${resultState}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${description}`);
    console.error(`        Expected δ(${fromState}, ${event}) -> ${expectedState}, got ${resultState}`);
    failed++;
  }
}

// 1. Ready + Valid Input -> Checking
assertTransition(
  STATES.READY,
  EVENTS.SUBMIT_VALID,
  STATES.CHECKING,
  'Ready + Valid Input -> Checking'
);

// 2. Ready + Invalid Input -> Ready (validation error loop)
assertTransition(
  STATES.READY,
  EVENTS.SUBMIT_INVALID,
  STATES.READY,
  'Ready + Invalid Input -> Ready'
);

// 3. Checking + Reachable -> Success
assertTransition(
  STATES.CHECKING,
  EVENTS.REACHABLE,
  STATES.SUCCESS,
  'Checking + Reachable -> Success'
);

// 4. Checking + Unreachable -> Failed
assertTransition(
  STATES.CHECKING,
  EVENTS.UNREACHABLE,
  STATES.FAILED,
  'Checking + Unreachable -> Failed'
);

// 5. Success + Check Again -> Checking
assertTransition(
  STATES.SUCCESS,
  EVENTS.CHECK_AGAIN,
  STATES.CHECKING,
  'Success + Check Again -> Checking'
);

// 6. Failed + Check Again -> Checking
assertTransition(
  STATES.FAILED,
  EVENTS.CHECK_AGAIN,
  STATES.CHECKING,
  'Failed + Check Again -> Checking'
);

// 7. Success + Reset -> Ready
assertTransition(
  STATES.SUCCESS,
  EVENTS.RESET,
  STATES.READY,
  'Success + Reset -> Ready'
);

// 8. Failed + Reset -> Ready
assertTransition(
  STATES.FAILED,
  EVENTS.RESET,
  STATES.READY,
  'Failed + Reset -> Ready'
);

// 9. Verify ConnectionFSM Controller Class & Subscriber Notifications
console.log('\nTesting ConnectionFSM Controller class:');
const fsm = new ConnectionFSM();
let observedTransitions = [];

fsm.subscribe((toState, fromState, event) => {
  observedTransitions.push({ from: fromState, to: toState, event });
});

fsm.send(EVENTS.SUBMIT_VALID);
fsm.send(EVENTS.REACHABLE);
fsm.send(EVENTS.RESET);

if (
  fsm.getState() === STATES.READY &&
  observedTransitions.length === 3 &&
  observedTransitions[0].to === STATES.CHECKING &&
  observedTransitions[1].to === STATES.SUCCESS &&
  observedTransitions[2].to === STATES.READY
) {
  console.log('✓ PASS: ConnectionFSM class state management and notifications verified');
  passed++;
} else {
  console.error('✗ FAIL: ConnectionFSM class state management');
  failed++;
}

console.log('\n====================================================');
console.log(`FSM TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
