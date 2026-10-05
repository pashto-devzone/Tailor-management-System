function v1ResponseWrapper(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (data && typeof data === "object" && data.success !== undefined) {
      return originalJson(data);
    }

    const statusCode = res.statusCode;
    const isError = statusCode >= 400;

    if (isError) {
      return originalJson({
        success: false,
        message: data?.message || "An error occurred",
        data: null,
      });
    }

    let message = "";
    let responseData = data;

    if (data && typeof data === "object" && !Array.isArray(data) && data.message) {
      message = data.message;
      const { message: _msg, ...rest } = data;
      responseData = Object.keys(rest).length > 0 ? rest : null;
    }

    if (Array.isArray(data)) {
      message = "Records loaded successfully";
    }

    return originalJson({
      success: true,
      message: message || "Success",
      data: responseData !== undefined ? responseData : null,
    });
  };
  next();
}

module.exports = { v1ResponseWrapper };
