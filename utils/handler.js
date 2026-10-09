"use strict";

/**
 * Wraps a controller body so every endpoint answers with the same envelope
 * `{ success, message, data }` and forwards errors to the error middleware.
 */
function handle(message, fn, status = 200) {
  return async (req, res, next) => {
    try {
      const data = await fn(req);
      res.status(status).json({ success: true, message, data });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { handle };
