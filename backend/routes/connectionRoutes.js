const express = require('express');
const router = express.Router();
const Connection = require('../models/Connection');
const {
  validateInput,
  checkPrivateOrReservedIPv4,
  resolveHostname,
  testTcpReachability,
} = require('../utils/networkChecker');

/**
 * POST /api/check
 * Performs a network reachability test to port 443 for a single hostname or public IPv4.
 * Saves the completed check in MongoDB and returns the result.
 */
router.post('/check', async (req, res) => {
  const { hostname } = req.body;

  // 1. Validate raw input format and security restrictions
  const validation = validateInput(hostname);
  if (!validation.isValid) {
    return res.status(400).json({
      status: 'Failed',
      hostname: hostname || '',
      message: validation.error,
    });
  }

  const cleanTarget = validation.sanitized;
  let targetIp = null;

  try {
    // 2. Resolve domain name or handle direct IPv4
    if (validation.isIp) {
      targetIp = cleanTarget;
    } else {
      // Resolve hostname using DNS
      const dnsResult = await resolveHostname(cleanTarget);
      if (dnsResult.error) {
        // DNS lookup failed: server cannot be reached
        const failedRecord = await Connection.create({
          hostname: cleanTarget,
          status: 'Failed',
          message: `DNS resolution failed: Unable to resolve domain '${cleanTarget}' (${dnsResult.error.code || 'ENOTFOUND'}).`,
          responseTime: null,
          checkedAt: new Date(),
        });
        return res.status(200).json(failedRecord);
      }

      targetIp = dnsResult.resolvedIp;

      // Validate the resolved IP address before making any connection
      const resolvedCheck = checkPrivateOrReservedIPv4(targetIp);
      if (resolvedCheck.isPrivate) {
        return res.status(400).json({
          status: 'Failed',
          hostname: cleanTarget,
          message: `Security violation: Domain resolves to private or restricted IP address (${targetIp}). Connection aborted.`,
        });
      }
    }

    // 3. Test TCP reachability to port 443 only (5-second timeout)
    const tcpResult = await testTcpReachability(targetIp, 5000);

    // 4. Prepare result data
    const status = tcpResult.reachable ? 'Success' : 'Failed';
    const message = tcpResult.reachable
      ? `Successfully reached ${cleanTarget} (${targetIp}) on port 443.`
      : tcpResult.message;

    // 5. Save completed check in MongoDB
    const connectionRecord = await Connection.create({
      hostname: cleanTarget,
      status,
      message,
      responseTime: tcpResult.responseTime,
      checkedAt: new Date(),
    });

    return res.status(200).json(connectionRecord);
  } catch (error) {
    console.error('Error during connection check:', error);
    return res.status(500).json({
      status: 'Failed',
      hostname: cleanTarget || hostname || '',
      message: `Internal server error: ${error.message}`,
    });
  }
});

/**
 * GET /api/history
 * Retrieves all previous connection checks, sorted newest first.
 */
router.get('/history', async (req, res) => {
  try {
    const history = await Connection.find().sort({ checkedAt: -1 }).limit(100);
    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({
      message: 'Failed to retrieve connection history.',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/history
 * Clears all connection check history from MongoDB.
 */
router.delete('/history', async (req, res) => {
  try {
    const result = await Connection.deleteMany({});
    return res.status(200).json({
      message: 'Connection history cleared successfully.',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error clearing history:', error);
    return res.status(500).json({
      message: 'Failed to clear connection history.',
      error: error.message,
    });
  }
});

module.exports = router;
