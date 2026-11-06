/**
 * Formal Finite State Machine (FSM) Implementation
 *
 * Represents the Network Connection Checker life-cycle according to
 * Formal Languages and Automata Theory (FLAT).
 *
 * Formal 5-Tuple Definition: M = (Q, Σ, δ, q0, F)
 * - Q (States): { Ready, Checking, Success, Failed }
 * - Σ (Alphabet / Events): { SUBMIT_VALID, SUBMIT_INVALID, REACHABLE, UNREACHABLE, CHECK_AGAIN, RESET }
 * - q0 (Initial State): Ready
 * - F (Accepting / Operational States): { Success, Failed }
 * - δ (Transition Function): Q × Σ -> Q
 */

export const STATES = Object.freeze({
  READY: 'Ready',
  CHECKING: 'Checking',
  SUCCESS: 'Success',
  FAILED: 'Failed',
});

export const EVENTS = Object.freeze({
  SUBMIT_VALID: 'SUBMIT_VALID',
  SUBMIT_INVALID: 'SUBMIT_INVALID',
  REACHABLE: 'REACHABLE',
  UNREACHABLE: 'UNREACHABLE',
  CHECK_AGAIN: 'CHECK_AGAIN',
  RESET: 'RESET',
});

/**
 * State Transition Table (δ mapping)
 */
const TRANSITION_TABLE = {
  [STATES.READY]: {
    [EVENTS.SUBMIT_VALID]: STATES.CHECKING,
    [EVENTS.SUBMIT_INVALID]: STATES.READY,
  },
  [STATES.CHECKING]: {
    [EVENTS.REACHABLE]: STATES.SUCCESS,
    [EVENTS.UNREACHABLE]: STATES.FAILED,
  },
  [STATES.SUCCESS]: {
    [EVENTS.CHECK_AGAIN]: STATES.CHECKING,
    [EVENTS.RESET]: STATES.READY,
  },
  [STATES.FAILED]: {
    [EVENTS.CHECK_AGAIN]: STATES.CHECKING,
    [EVENTS.RESET]: STATES.READY,
  },
};

/**
 * Pure transition function: δ(currentState, event) -> nextState
 *
 * @param {string} currentState - One of STATES
 * @param {string} event - One of EVENTS
 * @returns {string} nextState
 */
export function transition(currentState, event) {
  const possibleTransitions = TRANSITION_TABLE[currentState];

  if (!possibleTransitions || !possibleTransitions[event]) {
    console.warn(`[FSM] Invalid transition attempted: state='${currentState}' with event='${event}'`);
    return currentState; // Remain in current state if transition is undefined
  }

  const nextState = possibleTransitions[event];
  return nextState;
}

/**
 * FSM Controller Class to manage state and listener subscriptions
 */
export class ConnectionFSM {
  constructor(initialState = STATES.READY) {
    this.state = initialState;
    this.listeners = new Set();
  }

  /**
   * Returns current active state
   */
  getState() {
    return this.state;
  }

  /**
   * Dispatches an event and executes the state transition
   * @param {string} event - One of EVENTS
   * @returns {string} new state
   */
  send(event) {
    const prevState = this.state;
    const nextState = transition(this.state, event);

    if (prevState !== nextState) {
      this.state = nextState;
      this.notify(prevState, nextState, event);
    }

    return this.state;
  }

  /**
   * Subscribe to state change notifications
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all registered listeners
   */
  notify(fromState, toState, event) {
    this.listeners.forEach((listener) => {
      try {
        listener(toState, fromState, event);
      } catch (err) {
        console.error('[FSM] Error in subscriber callback:', err);
      }
    });
  }
}
