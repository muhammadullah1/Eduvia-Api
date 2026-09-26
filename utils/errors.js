function isDbConnectivityError(err, message = "") {
  const dbConnectErrorNames = new Set([
    "SequelizeConnectionError",
    "SequelizeConnectionRefusedError",
    "SequelizeHostNotFoundError",
    "SequelizeHostNotReachableError",
    "SequelizeInvalidConnectionError",
    "SequelizeAccessDeniedError",
  ]);

  const msg = String(message || err?.message || "");
  const name = String(err?.name || "");
  const code = String(
    err?.code || err?.original?.code || err?.parent?.code || "",
  );

  const dbMessagePattern =
    /(no pg_hba\.conf entry|password authentication failed|getaddrinfo ENOTFOUND|connect ECONNREFUSED|remaining connection slots are reserved|sorry, too many clients already|Connection terminated unexpectedly)/i;
  const dbCodePattern = /(ECONNREFUSED|ENOTFOUND|ETIMEDOUT)/i;

  return (
    dbConnectErrorNames.has(name) ||
    dbMessagePattern.test(msg) ||
    dbCodePattern.test(code)
  );
}

module.exports = { isDbConnectivityError };
