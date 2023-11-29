const rateLimit = require('express-rate-limit');

// Limitar a 100 solicitudes por hora desde una misma IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100000
});

module.exports = rateLimit;

