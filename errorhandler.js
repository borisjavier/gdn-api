function errorHandler(err, req, res, next) {
  console.error('Error en la aplicación:', err);
  res.status(500).json({ error: 'Error en el servidor' });
}

module.exports = errorHandler;