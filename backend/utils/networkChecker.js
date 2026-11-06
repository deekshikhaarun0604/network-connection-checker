const net = require('net');
const dns = require('dns').promises;

/**
 * Checks whether an IPv4 address is in a private, loopback, link-local,
 * multicast, or reserved range.
 *
 * @param {string} ip - IPv4 address string (e.g. "192.168.1.1")
 * @returns {{ isPrivate: boolean, reason?: string }}
 */
function checkPrivateOrReservedIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) {
    return { isPrivate: true, reason: 'Invalid IPv4 octets' };
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 - Current network ("this" network)
  if (a === 0) {
    return { isPrivate: true, reason: 'Current network (0.0.0.0/8) is not a public address' };
  }

  // 127.0.0.0/8 - Loopback addresses (e.g., 127.0.0.1)
  if (a === 127) {
    return { isPrivate: true, reason: 'Loopback address (127.0.0.0/8) is restricted' };
  }

  // 10.0.0.0/8 - RFC 1918 Private network
  if (a === 10) {
    return { isPrivate: true, reason: 'Private network address (10.0.0.0/8) is restricted' };
  }

  // 172.16.0.0/12 - RFC 1918 Private network (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) {
    return { isPrivate: true, reason: 'Private network address (172.16.0.0/12) is restricted' };
  }

  // 192.168.0.0/16 - RFC 1918 Private network
  if (a === 192 && b === 168) {
    return { isPrivate: true, reason: 'Private network address (192.168.0.0/16) is restricted' };
  }

  // 169.254.0.0/16 - Link-local (RFC 3927)
  if (a === 169 && b === 254) {
    return { isPrivate: true, reason: 'Link-local address (169.254.0.0/16) is restricted' };
  }

  // 100.64.0.0/10 - Carrier-grade NAT (RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) {
    return { isPrivate: true, reason: 'Carrier-grade NAT address (100.64.0.0/10) is restricted' };
  }

  // 192.0.2.0/24 - TEST-NET-1 documentation
  if (a === 192 && b === 0 && c === 2) {
    return { isPrivate: true, reason: 'Documentation address (192.0.2.0/24) is reserved' };
  }

  // 198.18.0.0/15 - Benchmarking
  if (a === 198 && (b === 18 || b === 19)) {
    return { isPrivate: true, reason: 'Benchmarking address (198.18.0.0/15) is reserved' };
  }

  // 198.51.100.0/24 - TEST-NET-2
  if (a === 198 && b === 51 && c === 100) {
    return { isPrivate: true, reason: 'Documentation address (198.51.100.0/24) is reserved' };
  }

  // 203.0.113.0/24 - TEST-NET-3
  if (a === 203 && b === 0 && c === 113) {
    return { isPrivate: true, reason: 'Documentation address (203.0.113.0/24) is reserved' };
  }

  // 224.0.0.0/4 - Multicast (224.0.0.0 to 239.255.255.255)
  if (a >= 224 && a <= 239) {
    return { isPrivate: true, reason: 'Multicast address range (224.0.0.0/4) is not allowed' };
  }

  // 240.0.0.0/4 - Reserved / Broadcast (includes 255.255.255.255)
  if (a >= 240) {
    return { isPrivate: true, reason: 'Reserved or broadcast address range is not allowed' };
  }

  return { isPrivate: false };
}

/**
 * Validates the raw hostname or IPv4 input string.
 * Rejects empty strings, invalid characters, localhost, and private IPs.
 *
 * @param {string} rawInput
 * @returns {{ isValid: boolean, error?: string, sanitized?: string, isIp?: boolean }}
 */
function validateInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, error: 'Hostname or IPv4 address cannot be empty.' };
  }

  let cleaned = rawInput.trim();

  if (cleaned.length === 0) {
    return { isValid: false, error: 'Hostname or IPv4 address cannot be empty.' };
  }

  // Strip protocol prefix if user pasted a URL (e.g. https://google.com)
  if (/^https?:\/\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^https?:\/\//i, '');
  }

  // Remove any port or trailing path (e.g. google.com:443/test -> google.com)
  cleaned = cleaned.split('/')[0].split(':')[0].trim();

  if (cleaned.length === 0) {
    return { isValid: false, error: 'Invalid input after stripping protocol or path.' };
  }

  if (cleaned.length > 253) {
    return { isValid: false, error: 'Hostname exceeds maximum length of 253 characters.' };
  }

  // Reject localhost specifically
  const lower = cleaned.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan') ||
    lower.endsWith('.home.arpa')
  ) {
    return {
      isValid: false,
      error: 'Access denied: Localhost and private domain names (.local, .internal) are restricted.',
    };
  }

  // Check if it's an IPv6 address
  if (net.isIPv6(cleaned)) {
    return {
      isValid: false,
      error: 'IPv6 addresses are not supported. Please provide a domain name or public IPv4 address.',
    };
  }

  // Check if input looks like an IP address (contains only digits and dots)
  const isNumericIpPattern = /^[\d.]+$/.test(cleaned);

  if (isNumericIpPattern) {
    // Validate IPv4 format
    const ipCheck = net.isIPv4(cleaned);
    if (!ipCheck) {
      return {
        isValid: false,
        error: 'Malformed IPv4 address. An IPv4 address must consist of 4 numbers between 0 and 255 separated by dots.',
      };
    }

    // Check if it is a private or reserved IPv4
    const privateCheck = checkPrivateOrReservedIPv4(cleaned);
    if (privateCheck.isPrivate) {
      return {
        isValid: false,
        error: `Access denied: ${privateCheck.reason}.`,
      };
    }

    return { isValid: true, sanitized: cleaned, isIp: true };
  }

  // Hostname regex validation (RFC 1123 compliant)
  // Each label must be 1 to 63 characters long, alphanumeric with hyphens in between, separated by dots
  const hostnameRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*$/;
  if (!hostnameRegex.test(cleaned)) {
    return {
      isValid: false,
      error: 'Invalid hostname format. Hostnames may only contain letters, numbers, hyphens, and dots.',
    };
  }

  // Must have at least one top-level domain if not IP (e.g. google.com, not just 'google')
  if (!cleaned.includes('.')) {
    return {
      isValid: false,
      error: 'Invalid hostname. Please provide a fully qualified domain name (e.g. google.com).',
    };
  }

  return { isValid: true, sanitized: cleaned, isIp: false };
}

/**
 * Resolves a domain name to an IPv4 address using DNS lookup.
 *
 * @param {string} hostname
 * @returns {Promise<{ resolvedIp: string }>}
 */
async function resolveHostname(hostname) {
  try {
    const lookupResult = await dns.lookup(hostname, { family: 4 });
    return { resolvedIp: lookupResult.address, error: null };
  } catch (err) {
    return { resolvedIp: null, error: err };
  }
}

/**
 * Performs a TCP reachability test to port 443 only.
 *
 * @param {string} ip - Target IPv4 address
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000ms)
 * @returns {Promise<{ reachable: boolean, responseTime: number|null, message: string }>}
 */
function testTcpReachability(ip, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let isSettled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    // Attempt TCP connection to port 443 ONLY
    socket.connect(443, ip, () => {
      if (isSettled) return;
      isSettled = true;
      const responseTime = Date.now() - startTime;
      cleanup();
      resolve({
        reachable: true,
        responseTime,
        message: `Connection successful on port 443 in ${responseTime} ms.`,
      });
    });

    socket.on('timeout', () => {
      if (isSettled) return;
      isSettled = true;
      const responseTime = Date.now() - startTime;
      cleanup();
      resolve({
        reachable: false,
        responseTime: responseTime,
        message: `Connection timed out after ${timeoutMs} ms on port 443.`,
      });
    });

    socket.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      let msg = `TCP connection failed on port 443: ${err.message}`;
      if (err.code === 'ECONNREFUSED') {
        msg = 'Connection refused by target server on port 443.';
      } else if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
        msg = 'Host is unreachable on the network.';
      }
      resolve({
        reachable: false,
        responseTime: null,
        message: msg,
      });
    });
  });
}

module.exports = {
  validateInput,
  checkPrivateOrReservedIPv4,
  resolveHostname,
  testTcpReachability,
};
