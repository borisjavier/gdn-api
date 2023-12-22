const express = require('express');
const axios = require('axios');
const app = express();
const errorHandler = require('./errorhandler');
const rateLimit = require('./ratelimit');
//const winston = require('winston');

app.use(rateLimit);
app.use(errorHandler);

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
    console.log('Respuesta de la consulta en URL1: ', res1.data);

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
      throw error;
    }

    const url2 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/${voutIndex}/spent`;
    let spentTxId = null; // Initialize spentTxId as null
    let spent;
    try {
      const res2 = await axios.get(url2);
      if (res2.error) {
        throw new Error(`Error en la respuesta de whatsonchain url2: ${res2.error.message}`);
      }
      if (res2.status !== 200) {
        throw new Error(`Error en la respuesta de whatsonchain url2: ${res2.status}`);
      }
      if (res2.status === 404) {
        spentTxId = null;
        console.log('spentTxId: ', spentTxId);
      } else {
        spent = res2.data;
        spentTxId = spent.txid;
        console.log('spent: ', spent);
        console.log('spentTxId: ', spentTxId);
      }
    } catch (err) {
      console.log(err);
    }

    tx.vout[voutIndex].spentTxId = spentTxId;
    res.status(200).json(tx);
  } catch (error) {
    console.error('Error al llamar a la función primordial getTransactionDetails:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


app.get('/v1/:network/state/:location/', async (req, res) => {
  const network = req.params.network || req.query.network || req.body.network; //'main';
  const txid_p1 = req.params.location || req.query.location || req.body.location;
  const prec = txid_p1.split("_o");
  let txid = prec[0];
  let voutIndex = prec[1];
    const url3 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/hex`;
    //const url4 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/opreturn`;
    const apiKey = 'mainnet_6c81a97a917bdab017bb02cd0d98f794';
    try {
      const response = await axios.get(url3, {
        headers: {
          'Apikey': apiKey
        }
      });
      const tx = response.data;
      //res.status(200).json(tx);
      const hexArray = [tx];
      res.status(200).json(hexArray);
    } catch (error) {
      console.error('Error al llamar a la url3:', error);
      res.status(500).json({ error: 'Error al llamar a la API externa' });
    }
  
});
//En todo caso debe existir un arreglo con height, time y hex, donde hex es 

app.listen(8080, () => {
  console.log('Servidor API REST escuchando en el puerto indicado');
});