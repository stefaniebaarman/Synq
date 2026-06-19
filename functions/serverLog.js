const logger = require("firebase-functions/logger");

/**
 * Normalize unknown throws for Cloud Logging structured fields.
 * @param {unknown} err
 * @returns {Record<string, unknown>}
 */
function serializeError(err) {
  if (err == null) return {};
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
    };
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    const o = /** @type {{ code?: unknown; message?: unknown }} */ (err);
    return {
      errorCode: o.code,
      errorMessage: o.message != null ? String(o.message) : String(err),
    };
  }
  return { errorMessage: String(err) };
}

/**
 * Structured error log for Cloud Functions (filterable in Cloud Logging).
 * @param {string} operation
 * @param {unknown} err
 * @param {Record<string, unknown>} [context]
 */
function logError(operation, err, context = {}) {
  logger.error("synq_fn_error", {
    operation,
    ...serializeError(err),
    ...context,
  });
}

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [fields]
 */
function logInfo(operation, fields = {}) {
  logger.info("synq_fn_info", { operation, ...fields });
}

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [fields]
 */
function logWarn(operation, fields = {}) {
  logger.warn("synq_fn_warn", { operation, ...fields });
}

module.exports = { logError, logInfo, logWarn, serializeError };
