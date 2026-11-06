/**
 * Comprehensive Automated Test Suite for Network Connection Checker
 * Tests all required scenarios:
 * - Empty input
 * - Invalid hostname
 * - Malformed IPv4 address
 * - localhost
 * - Private IP address
 * - Valid domains (google.com, github.com)
 * - Valid public IPv4 (1.1.1.1)
 * - Nonexistent domain
 * - History retrieval & clear
 */

const http = require('http');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING NETWORK CONNECTION CHECKER TEST SUITE     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const testCases = [
    // 1. Empty input
    {
      name: 'Empty input rejection',
      input: '',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('empty'),
    },
    // 2. Whitespace-only input
    {
      name: 'Whitespace input rejection',
      input: '   ',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('empty'),
    },
    // 3. Localhost rejection
    {
      name: 'Localhost rejection',
      input: 'localhost',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.toLowerCase().includes('localhost'),
    },
    // 4. Subdomain of localhost rejection
    {
      name: 'Subdomain localhost rejection',
      input: 'app.localhost',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.toLowerCase().includes('restricted'),
    },
    // 5. Loopback IP rejection
    {
      name: 'Loopback 127.0.0.1 rejection',
      input: '127.0.0.1',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('Loopback'),
    },
    // 6. Private IP RFC 1918 (192.168.1.1) rejection
    {
      name: 'Private IP 192.168.1.1 rejection',
      input: '192.168.1.1',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('Private network'),
    },
    // 7. Private IP RFC 1918 (10.0.0.1) rejection
    {
      name: 'Private IP 10.0.0.1 rejection',
      input: '10.0.0.1',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('Private network'),
    },
    // 8. Private IP RFC 1918 (172.16.0.1) rejection
    {
      name: 'Private IP 172.16.0.1 rejection',
      input: '172.16.0.1',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('Private network'),
    },
    // 9. Malformed IPv4
    {
      name: 'Malformed IPv4 (999.999.999.999) rejection',
      input: '999.999.999.999',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('Malformed IPv4'),
    },
    // 10. Malformed IPv4 incomplete octets
    {
      name: 'Malformed IPv4 (1.2.3) rejection',
      input: '1.2.3',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('Malformed IPv4'),
    },
    // 11. Invalid hostname format
    {
      name: 'Invalid hostname format (!@#$)',
      input: '!@#$',
      expectedStatus: 400,
      validate: (res) => res.data.message && res.data.message.includes('Invalid hostname'),
    },
    // 12. Valid public domain: google.com
    {
      name: 'Valid domain check: google.com',
      input: 'google.com',
      expectedStatus: 200,
      validate: (res) => res.data.status === 'Success' && typeof res.data.responseTime === 'number',
    },
    // 13. Valid public domain: github.com
    {
      name: 'Valid domain check: github.com',
      input: 'github.com',
      expectedStatus: 200,
      validate: (res) => res.data.status === 'Success' && typeof res.data.responseTime === 'number',
    },
    // 14. Valid public IPv4: 1.1.1.1 (Cloudflare DNS over HTTPS on 443)
    {
      name: 'Valid public IPv4 check: 1.1.1.1',
      input: '1.1.1.1',
      expectedStatus: 200,
      validate: (res) => res.data.status === 'Success' && typeof res.data.responseTime === 'number',
    },
    // 15. Nonexistent domain
    {
      name: 'Nonexistent domain check: invalid-domain-test-xyz-987.com',
      input: 'invalid-domain-test-xyz-987.com',
      expectedStatus: 200,
      validate: (res) => res.data.status === 'Failed' && res.data.message.includes('DNS resolution failed'),
    },
  ];

  for (const tc of testCases) {
    try {
      const res = await makeRequest('POST', '/api/check', { hostname: tc.input });
      const statusMatch = res.status === tc.expectedStatus;
      const logicMatch = tc.validate ? tc.validate(res) : true;

      if (statusMatch && logicMatch) {
        console.log(`✓ PASS: ${tc.name}`);
        if (res.data && res.data.responseTime) {
          console.log(`        Response Time: ${res.data.responseTime}ms`);
        }
        passed++;
      } else {
        console.error(`✗ FAIL: ${tc.name}`);
        console.error(`        Expected HTTP ${tc.expectedStatus}, got ${res.status}`);
        console.error(`        Response:`, res.data);
        failed++;
      }
    } catch (err) {
      console.error(`✗ ERROR: ${tc.name} - ${err.message}`);
      failed++;
    }
  }

  // 16. Test History Retrieval
  try {
    const historyRes = await makeRequest('GET', '/api/history');
    if (historyRes.status === 200 && Array.isArray(historyRes.data)) {
      console.log(`✓ PASS: GET /api/history (Retrieved ${historyRes.data.length} records)`);
      passed++;
    } else {
      console.error(`✗ FAIL: GET /api/history`);
      failed++;
    }
  } catch (err) {
    console.error(`✗ ERROR: GET /api/history - ${err.message}`);
    failed++;
  }

  // 17. Test History Deletion
  try {
    const delRes = await makeRequest('DELETE', '/api/history');
    if (delRes.status === 200 && typeof delRes.data.deletedCount === 'number') {
      console.log(`✓ PASS: DELETE /api/history (Deleted ${delRes.data.deletedCount} records)`);
      passed++;
    } else {
      console.error(`✗ FAIL: DELETE /api/history`);
      failed++;
    }
  } catch (err) {
    console.error(`✗ ERROR: DELETE /api/history - ${err.message}`);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
