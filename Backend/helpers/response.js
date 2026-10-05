function success(data, message, statusCode) {
  const res = data && typeof data === "object" && !Array.isArray(data) && data.statusCode
    ? null
    : null;
  return {
    success: true,
    message: message || null,
    data: data !== undefined ? data : null,
    statusCode: statusCode || 200,
  };
}

function error(message, statusCode) {
  return {
    success: false,
    message: message || "An error occurred",
    data: null,
    statusCode: statusCode || 500,
  };
}

function sendSuccess(res, data, message, statusCode) {
  const payload = success(data, message, statusCode);
  res.status(payload.statusCode).json(payload);
}

function sendError(res, message, statusCode) {
  const payload = error(message, statusCode);
  res.status(payload.statusCode).json(payload);
}

module.exports = { success, error, sendSuccess, sendError };
