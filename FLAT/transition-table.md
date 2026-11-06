# FSM Transition Table

This document provides the formal state transition table $\delta(q, \sigma)$ for the **Network Connection Checker** finite state machine.

## 1. Formal Transition Table $\delta: Q \times \Sigma \to Q$

| Current State ($q \in Q$) | Input Event ($\sigma \in \Sigma$) | Next State ($\delta(q, \sigma)$) | Description / Action Taken |
|---|---|---|---|
| **Ready** | `SUBMIT_VALID` | **Checking** | User submitted a valid target; network test begins; loading spinner shown. |
| **Ready** | `SUBMIT_INVALID` | **Ready** | Input is empty, invalid format, localhost, or private IP. Validation error displayed; state remains Ready. |
| **Ready** | `REACHABLE` | *Undefined* | Ignored / No operation (cannot occur from Ready). |
| **Ready** | `UNREACHABLE` | *Undefined* | Ignored / No operation (cannot occur from Ready). |
| **Ready** | `RESET` | **Ready** | No-op; stays in Ready. |
| **Checking** | `REACHABLE` | **Success** | TCP handshake succeeded on port 443; displays response time in green. |
| **Checking** | `UNREACHABLE` | **Failed** | Connection timed out, refused, or DNS failed; displays error in red. |
| **Checking** | `SUBMIT_VALID` | **Checking** | Ignored while a check is actively pending. |
| **Checking** | `SUBMIT_INVALID` | **Checking** | Ignored while a check is actively pending. |
| **Checking** | `RESET` | **Ready** | Optional user cancellation; aborts checking and returns to Ready. |
| **Success** | `CHECK_AGAIN` / `SUBMIT_VALID` | **Checking** | User initiates a new test; starts connection test. |
| **Success** | `SUBMIT_INVALID` | **Success** | Invalid input rejected; displays validation message. |
| **Success** | `RESET` | **Ready** | Form and status cleared; returns to initial Ready state. |
| **Failed** | `CHECK_AGAIN` / `SUBMIT_VALID` | **Checking** | User retries connection or enters new target; starts test. |
| **Failed** | `SUBMIT_INVALID` | **Failed** | Invalid input rejected; displays validation message. |
| **Failed** | `RESET` | **Ready** | Form and status cleared; returns to initial Ready state. |

---

## 2. Condensed Mathematical Transition Matrix

| State \ Input | `SUBMIT_VALID` | `SUBMIT_INVALID` | `REACHABLE` | `UNREACHABLE` | `CHECK_AGAIN` | `RESET` |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Ready** ($q_0$) | Checking ($q_1$) | Ready ($q_0$) | — | — | Checking ($q_1$) | Ready ($q_0$) |
| **Checking** ($q_1$) | — | — | Success ($q_2$) | Failed ($q_3$) | — | Ready ($q_0$) |
| **Success** ($q_2$) | Checking ($q_1$) | Success ($q_2$) | — | — | Checking ($q_1$) | Ready ($q_0$) |
| **Failed** ($q_3$) | Checking ($q_1$) | Failed ($q_3$) | — | — | Checking ($q_1$) | Ready ($q_0$) |

---

## 3. Implementation Mapping

In JavaScript (`frontend/src/fsm/connectionFSM.js`), this transition table is implemented directly:

```javascript
const TRANSITION_TABLE = {
  Ready: {
    SUBMIT_VALID: 'Checking',
    SUBMIT_INVALID: 'Ready',
  },
  Checking: {
    REACHABLE: 'Success',
    UNREACHABLE: 'Failed',
  },
  Success: {
    CHECK_AGAIN: 'Checking',
    RESET: 'Ready',
  },
  Failed: {
    CHECK_AGAIN: 'Checking',
    RESET: 'Ready',
  },
};
```
