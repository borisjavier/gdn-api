const rateLimit = require('express-rate-limit');

// Middleware para aplicar el límite de solicitudes por IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10000, // máximo de 100 solicitudes por ventana
  keyGenerator: (req) => {
    if (req.originalUrl === process.env.GN_APP_URL) {
      return false; 
    }
    return req.ip; 
  },
  message: 'Demasiadas solicitudes para esta URL, por favor intenta de nuevo más tarde.',
});

module.exports = limiter;



