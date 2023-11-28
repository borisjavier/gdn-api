const express = require('express');
const app = express();

app.get('/nombre/:nombre', (req, res) => {
  const nombre = req.params.nombre || req.query.nombre || req.body.nombre; 
  const saludo = `Hola ${nombre}`;
  res.send(saludo);
});

app.listen(8080, () => {
  console.log('Servidor API REST escuchando en el puerto indicado');
});


/*const express = require('express');
const cors = require('cors');
const app = express();
const errorHandler = require('./errorhandler');
const rateLimit = require('./ratelimit');
const routes = require('./routes/network');

app.use(cors());
app.use('/api/v1', routes);
app.use(errorHandler);
app.use(rateLimit);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});*/