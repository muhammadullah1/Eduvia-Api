class ApiError extends Error {
  constructor(statusCode, message, data = undefined) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.success = false;
    this.data = data;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

module.exports = ApiError;
