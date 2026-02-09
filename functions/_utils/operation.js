// @ts-check

/**
 * @typedef {'pending' | 'success' | 'failed' | 'skipped'} ItemStatus
 */

/**
 * @typedef {Object} ItemResult
 * @property {string} key - The item key
 * @property {ItemStatus} status - The result status
 * @property {string} [error] - Error message if failed
 * @property {Object} [data] - Additional result data
 */

/**
 * @typedef {Object} OperationResult
 * @property {string} operationId - Unique operation identifier
 * @property {boolean} ok - Whether the overall operation succeeded
 * @property {number} total - Total items processed
 * @property {number} succeeded - Number of successful items
 * @property {number} failed - Number of failed items
 * @property {number} skipped - Number of skipped items
 * @property {ItemResult[]} details - Per-item results
 * @property {string[]} retryable - Keys that can be retried
 * @property {number} durationMs - Operation duration in milliseconds
 */

/**
 * Generate a unique operation ID.
 * Format: op_<timestamp>_<random>
 * @returns {string}
 */
export function generateOperationId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `op_${timestamp}_${random}`;
}

/**
 * Create a batch operation tracker.
 * @param {string} [operationId] - Optional predefined operation ID
 * @returns {{
 *   id: string,
 *   addSuccess: (key: string, data?: Object) => void,
 *   addFailed: (key: string, error: string, retryable?: boolean) => void,
 *   addSkipped: (key: string, reason?: string) => void,
 *   getResult: () => OperationResult
 * }}
 */
export function createOperationTracker(operationId) {
  const id = operationId || generateOperationId();
  const startTime = Date.now();

  /** @type {ItemResult[]} */
  const details = [];

  /** @type {Set<string>} */
  const retryableKeys = new Set();

  return {
    id,

    /**
     * Record a successful item.
     * @param {string} key
     * @param {Object} [data]
     */
    addSuccess(key, data) {
      details.push({ key, status: 'success', data });
    },

    /**
     * Record a failed item.
     * @param {string} key
     * @param {string} error
     * @param {boolean} [retryable=true]
     */
    addFailed(key, error, retryable = true) {
      details.push({ key, status: 'failed', error });
      if (retryable) {
        retryableKeys.add(key);
      }
    },

    /**
     * Record a skipped item.
     * @param {string} key
     * @param {string} [reason]
     */
    addSkipped(key, reason) {
      details.push({ key, status: 'skipped', error: reason });
    },

    /**
     * Get the final operation result.
     * @returns {OperationResult}
     */
    getResult() {
      const succeeded = details.filter(d => d.status === 'success').length;
      const failed = details.filter(d => d.status === 'failed').length;
      const skipped = details.filter(d => d.status === 'skipped').length;

      return {
        operationId: id,
        ok: failed === 0,
        total: details.length,
        succeeded,
        failed,
        skipped,
        details,
        retryable: Array.from(retryableKeys),
        durationMs: Date.now() - startTime,
      };
    },
  };
}
