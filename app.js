const express = require('express');
const axios = require('axios');
const app = express();
const errorHandler = require('./errorhandler');
const rateLimit = require('./ratelimit');
const winston = require('winston');

app.use(rateLimit);
app.use(errorHandler);

// Create a logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

app.get('/network/:network/txid/:txid/voutI/:voutIndex', async (req, res) => {
  try {
    const { network, txid, voutIndex } = { ...req.params, ...req.query, ...req.body };

    if (!['main', 'test'].includes(network)) {
      throw new Error('Red no válida');
    }

    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      throw new Error('txid no válido');
    }

    const parsedVoutIndex = parseInt(voutIndex);
    if (!Number.isInteger(parsedVoutIndex) || parsedVoutIndex < 0) {
      throw new Error('voutIndex no válido');
    }

    const url1 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/hash/${txid}`;
    const res1 = await axios.get(url1);
    if (res1.error) {
      throw new Error(`Error en la respuesta de whatsonchain url1: ${res1.error.message}`);
    }
    if (res1.status !== 200) {
      throw new Error(`Error en la respuesta de whatsonchain url1: ${res1.status}`);
    }

    let tx = res1.data;

    const url2 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/${parsedVoutIndex}/spent`;
    let spentTxId = null;
    let spent;
    try {
      const res2 = await axios.get(url2);
      if (res2.error) {
        throw new Error(`Error en la respuesta de whatsonchain url2: ${res2.error.message}`);
      }
      if (res2.status !== 200 && res2.status !== 404) {
        throw new Error(`Error en la respuesta de whatsonchain url2: ${res2.status}`);
      }
      if (res2.status === 404) {
        spentTxId = null;
      } else {
        spent = res2.data;
        spentTxId = spent.txid;
      }
    } catch (err) {
      logger.error('Error en la respuesta de whatsonchain url2: ', err.message);
    }

    tx.vout[parsedVoutIndex].spentTxId = spentTxId;
    res.status(200).json(tx);
  } catch (error) {
    logger.error('Error al llamar a la función primordial getTransactionDetails:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
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