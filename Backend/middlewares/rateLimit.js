const rateLimitMap = new Map();

function rateLimit(options = {}) {
  const windowMs = options.windowMs || 60_000;
  const max = options.max || 20;
  const keyGenerator = options.keyGenerator || ((req) => req.ip || req.connection?.remoteAddress || "unknown");

  return (req, res, next) => {
    const key = `${options.name || "default"}:${keyGenerator(req)}`;
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (!record) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > record.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("RateLimit-Limit", String(max));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    }

    record.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(max - record.count));
    next();
  };
}

function loginRateLimit() {
  return rateLimit({
    name: "login",
    windowMs: 60_000,
    max: 10,
    keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  });
}

function registerRateLimit() {
  return rateLimit({
    name: "register",
    windowMs: 60_000,
    max: 3,
    keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  });
}

function trackingRateLimit() {
  return rateLimit({
    name: "tracking",
    windowMs: 60_000,
    max: 60,
    keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  });
}

module.exports = { rateLimit, loginRateLimit, registerRateLimit, trackingRateLimit, rateLimitMap };
