const express = require('express');
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
});