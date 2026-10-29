// Network-level MySQL failures (as opposed to SQL errors such as a duplicate key).
// TiDB Cloud Serverless drops idle connections and can be slow to accept new ones
// after a quiet period, so these happen occasionally and usually succeed on retry.
const CONNECT_ERROR_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);
const TRANSIENT_ERROR_CODES = new Set([
  ...CONNECT_ERROR_CODES,
  "ETIMEDOUT",
  "ECONNRESET",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
]);

/** The connection could not be opened, so no statement reached the server. */
function isConnectError(error) {
  return Boolean(error) && (error.syscall === "connect" || CONNECT_ERROR_CODES.has(error.code));
}

function isTransientDbError(error) {
  return Boolean(error) && (isConnectError(error) || TRANSIENT_ERROR_CODES.has(error.code));
}

function isReadOnlyStatement(sql) {
  const text = typeof sql === "string" ? sql : sql?.sql;
  return /^\s*(SELECT|SHOW)\b/i.test(text || "");
}

/**
 * A failed statement is only retried when repeating it cannot apply a write
 * twice: either the connection never opened, or the statement is a read.
 */
function canRetryStatement(error, sql) {
  return isConnectError(error) || (isTransientDbError(error) && isReadOnlyStatement(sql));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withDbRetry(run, { shouldRetry, retries = 1, delayMs = 300, onRetry } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      onRetry?.(error, attempt + 1);
      await sleep(delayMs * (attempt + 1));
    }
  }
}

module.exports = {
  isConnectError,
  isTransientDbError,
  isReadOnlyStatement,
  canRetryStatement,
  withDbRetry,
};
