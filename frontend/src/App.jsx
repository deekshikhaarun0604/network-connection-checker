import React, { useState, useEffect } from 'react';
import { STATES, EVENTS, transition } from './fsm/connectionFSM';
import './App.css';

function App() {
  // Input and FSM state management
  const [fsmState, setFsmState] = useState(STATES.READY);
  const [hostname, setHostname] = useState('');
  const [validationError, setValidationError] = useState('');
  const [checkResult, setCheckResult] = useState(null);

  // History state
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('All'); // 'All' | 'Success' | 'Failed'
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState('');

  // Fetch connection history from MongoDB on initial mount
  useEffect(() => {
    fetchHistory();
  }, []);

  /**
   * Fetches previous check history from backend
   */
  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  /**
   * Validates target hostname or IPv4 locally before dispatching to backend
   */
  const validateClientInput = (input) => {
    if (!input || !input.trim()) {
      return { isValid: false, error: 'Hostname or IPv4 address cannot be empty.' };
    }

    const trimmed = input.trim().toLowerCase();

    // Check for localhost and loopback
    if (
      trimmed === 'localhost' ||
      trimmed.startsWith('localhost:') ||
      trimmed.endsWith('.localhost') ||
      trimmed.endsWith('.local')
    ) {
      return { isValid: false, error: 'Access denied: Localhost is restricted.' };
    }

    // Check for common private IP prefixes
    if (
      trimmed === '127.0.0.1' ||
      trimmed.startsWith('127.') ||
      trimmed.startsWith('10.') ||
      trimmed.startsWith('192.168.') ||
      trimmed.startsWith('169.254.')
    ) {
      return { isValid: false, error: 'Access denied: Private and loopback IP addresses are not permitted.' };
    }

    return { isValid: true, sanitized: input.trim() };
  };

  /**
   * Handles Form Submission & FSM Transitions
   */
  const handleCheckConnection = async (e) => {
    if (e) e.preventDefault();

    setValidationError('');

    // Client-side validation
    const valResult = validateClientInput(hostname);

    if (!valResult.isValid) {
      // Transition: Ready + Invalid Input -> Ready (display validation error)
      const nextState = transition(fsmState, EVENTS.SUBMIT_INVALID);
      setFsmState(nextState);
      setValidationError(valResult.error);
      return;
    }

    // Determine event: if coming from Success or Failed, event is CHECK_AGAIN, else SUBMIT_VALID
    const submitEvent =
      fsmState === STATES.SUCCESS || fsmState === STATES.FAILED
        ? EVENTS.CHECK_AGAIN
        : EVENTS.SUBMIT_VALID;

    // Transition to Checking state
    const checkingState = transition(fsmState, submitEvent);
    setFsmState(checkingState);
    setCheckResult(null);

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: valResult.sanitized }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'Success') {
        // Transition: Checking + Reachable -> Success
        const nextState = transition(STATES.CHECKING, EVENTS.REACHABLE);
        setFsmState(nextState);
        setCheckResult(data);
      } else {
        // Transition: Checking + Unreachable -> Failed
        const nextState = transition(STATES.CHECKING, EVENTS.UNREACHABLE);
        setFsmState(nextState);
        setCheckResult({
          hostname: data.hostname || valResult.sanitized,
          status: 'Failed',
          responseTime: data.responseTime || null,
          message: data.message || 'Host is unreachable or connection timed out.',
        });
      }

      // Refresh history list from MongoDB
      fetchHistory();
    } catch (err) {
      const nextState = transition(STATES.CHECKING, EVENTS.UNREACHABLE);
      setFsmState(nextState);
      setCheckResult({
        hostname: valResult.sanitized,
        status: 'Failed',
        responseTime: null,
        message: `Network error connecting to backend: ${err.message}`,
      });
    }
  };

  /**
   * Resets the form and returns FSM to Ready state
   * Transition: Success/Failed + Reset -> Ready
   */
  const handleReset = () => {
    const nextState = transition(fsmState, EVENTS.RESET);
    setFsmState(nextState);
    setHostname('');
    setValidationError('');
    setCheckResult(null);
  };

  /**
   * Clears connection history with confirmation
   */
  const handleClearHistory = async () => {
    const confirmed = window.confirm('Are you sure you want to clear all connection history?');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/history', { method: 'DELETE' });
      if (response.ok) {
        setHistory([]);
        setHistoryMessage('History cleared successfully.');
        setTimeout(() => setHistoryMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  /**
   * Filtered list of history records
   */
  const filteredHistory = history.filter((item) => {
    if (historyFilter === 'All') return true;
    return item.status === historyFilter;
  });

  /**
   * Quick fill helper for assignment evaluation and testing
   */
  const applyPreset = (presetValue) => {
    setHostname(presetValue);
    setValidationError('');
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <h1 className="title">Network Connection Checker</h1>
        <p className="subtitle">
          Verify whether a website or server is reachable by checking TCP port 443. Enter a domain or public IPv4 address below.
        </p>

        {/* FSM State Indicator Badge */}
        <div className="fsm-status-bar">
          <span className="fsm-label">Automata State:</span>
          <span className={`fsm-badge fsm-${fsmState.toLowerCase()}`}>
            {fsmState}
          </span>
        </div>
      </header>

      {/* Main Checker Card */}
      <main className="card">
        <form onSubmit={handleCheckConnection} className="checker-form">
          <div className="form-group">
            <label htmlFor="hostname-input" className="form-label">
              Hostname or IPv4 Address:
            </label>
            <div className="input-row">
              <input
                id="hostname-input"
                type="text"
                className="text-input"
                placeholder="e.g., google.com or 1.1.1.1"
                value={hostname}
                onChange={(e) => {
                  setHostname(e.target.value);
                  if (validationError) setValidationError('');
                }}
                disabled={fsmState === STATES.CHECKING}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={fsmState === STATES.CHECKING}
              >
                {fsmState === STATES.CHECKING ? 'Checking...' : 'Check Connection'}
              </button>
              {(fsmState === STATES.SUCCESS || fsmState === STATES.FAILED) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleReset}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Validation Error Message */}
            {validationError && (
              <div className="validation-error" role="alert">
                ⚠️ {validationError}
              </div>
            )}
          </div>

          {/* Quick preset buttons for easy student / evaluator testing */}
          <div className="preset-container">
            <span className="preset-label">Quick Test Presets:</span>
            <div className="preset-buttons">
              <button
                type="button"
                className="btn-preset btn-preset-valid"
                onClick={() => applyPreset('google.com')}
                disabled={fsmState === STATES.CHECKING}
              >
                google.com
              </button>
              <button
                type="button"
                className="btn-preset btn-preset-valid"
                onClick={() => applyPreset('github.com')}
                disabled={fsmState === STATES.CHECKING}
              >
                github.com
              </button>
              <button
                type="button"
                className="btn-preset btn-preset-valid"
                onClick={() => applyPreset('1.1.1.1')}
                disabled={fsmState === STATES.CHECKING}
              >
                1.1.1.1 (Public IP)
              </button>
              <button
                type="button"
                className="btn-preset btn-preset-invalid"
                onClick={() => applyPreset('localhost')}
                disabled={fsmState === STATES.CHECKING}
              >
                localhost (Restricted)
              </button>
              <button
                type="button"
                className="btn-preset btn-preset-invalid"
                onClick={() => applyPreset('192.168.1.1')}
                disabled={fsmState === STATES.CHECKING}
              >
                192.168.1.1 (Private IP)
              </button>
            </div>
          </div>
        </form>

        {/* Loading Indicator */}
        {fsmState === STATES.CHECKING && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Resolving DNS and establishing TCP connection on port 443...</p>
          </div>
        )}

        {/* Result Section */}
        {checkResult && (
          <section
            className={`result-section result-${checkResult.status.toLowerCase()}`}
            aria-live="polite"
          >
            <div className="result-header">
              <span className={`status-pill pill-${checkResult.status.toLowerCase()}`}>
                {checkResult.status === 'Success' ? '✓ Success' : '✗ Failed'}
              </span>
              <span className="result-target">Target: <strong>{checkResult.hostname}</strong></span>
            </div>

            <div className="result-body">
              <div className="result-row">
                <span className="result-label">Status:</span>
                <span className={`result-value val-${checkResult.status.toLowerCase()}`}>
                  {checkResult.status}
                </span>
              </div>
              <div className="result-row">
                <span className="result-label">Response Time:</span>
                <span className="result-value">
                  {checkResult.responseTime !== null && checkResult.responseTime !== undefined
                    ? `${checkResult.responseTime} ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="result-row">
                <span className="result-label">Details:</span>
                <span className="result-value result-message">{checkResult.message}</span>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* History Section */}
      <section className="card history-section">
        <div className="history-header">
          <div>
            <h2 className="history-title">Connection History</h2>
            <p className="history-subtitle">Previous reachability checks stored in MongoDB (newest first)</p>
          </div>
          <div className="history-actions">
            <div className="filter-group">
              <label htmlFor="filter-select" className="filter-label">Filter:</label>
              <select
                id="filter-select"
                className="filter-select"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleClearHistory}
              disabled={history.length === 0}
            >
              Clear History
            </button>
          </div>
        </div>

        {historyMessage && (
          <div className="history-alert">{historyMessage}</div>
        )}

        {isHistoryLoading ? (
          <p className="empty-message">Loading history records...</p>
        ) : filteredHistory.length === 0 ? (
          <p className="empty-message">
            {history.length === 0
              ? 'No connection checks recorded yet. Perform a check above to see history.'
              : `No '${historyFilter}' records found.`}
          </p>
        ) : (
          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Hostname</th>
                  <th>Response Time</th>
                  <th>Message</th>
                  <th>Checked At</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item._id || item.checkedAt + item.hostname}>
                    <td>
                      <span className={`table-badge badge-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="hostname-cell">
                      <code>{item.hostname}</code>
                    </td>
                    <td>
                      {item.responseTime !== null && item.responseTime !== undefined
                        ? `${item.responseTime} ms`
                        : '—'}
                    </td>
                    <td className="message-cell">{item.message}</td>
                    <td className="date-cell">
                      {new Date(item.checkedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Network Connection Checker • MERN Stack & Automata Theory Assignment</p>
      </footer>
    </div>
  );
}

export default App;
