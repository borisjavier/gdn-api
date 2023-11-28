const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const errorHandler = require('./errorhandler');
const rateLimit = require('./ratelimit');


app.get('/network/:network/txid/:txid/voutI/:voutIndex', async (req, res) => {
  try {
    const network = req.params.network || req.query.network || req.body.network; //'main'; 
  const txid = req.params.txid || req.query.txid || req.body.txid; //'a5c5b72267ea32eab1ff4c7a87da1d2c8515ddb260d88c05eb84b2c16e393e48';
  const voutIndex = req.params.voutIndex || req.query.voutIndex || req.body.voutIndex; // 1;
  if (!['main', 'test'].includes(network)) {
    throw new Error('Red no válida');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    throw new Error('txid no válido');
  }
  if (!Number.isInteger(parseInt(voutIndex)) || parseInt(voutIndex) < 0) {
    throw new Error('voutIndex no válido');
  }
  
  const url1 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/hash/${txid}`;
  const res1 = await axios.get(url1);
  console.log('Respuesta de la consulta en URL1: ', res1.data);//await fetch(url1);
  //const tx = await res1.json();
  if (res1.error) {
    throw new Error(`Error en la respuesta de whatsonchain url1: ${res1.error.message}`);
  }

  if (res1.status !== 200) {
    throw new Error(`Error en la respuesta de whatsonchain url1: ${res1.status}`);
  }
  let tx;
  try {
    tx = res1.data;
  } catch (error) {
    console.log(await res1.text());
    throw error; // Lanzar el error para que se maneje en el bloque catch externo
  }
  
  const url2 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/${voutIndex}/spent`;
  let spentTxId;
  let spent;
  const res2 = await axios.get(url2);
  if (res2.error) {
    throw new Error(`Error en la respuesta de whatsonchain url2: ${res2.error.message}`);
  }

  if (res2.status !== 200) {
    throw new Error(`Error en la respuesta de whatsonchain url2: ${res2.status}`);
  }
  try { 
    spent = res2.data;
    console.log('spent: ', spent)
    spentTxId = spent.txid;
    console.log('spentTxId: ', spentTxId)
  } catch (err) {
    spentTxId = null;
    console.log(await res2.text());
  }
  
  tx.vout[voutIndex].spentTxId = spentTxId;
  
  res.status(200).send(JSON.stringify(tx));
  } catch (error) {
    console.error('Error al llamar a la función primordial getTransactionDetails:', error);
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