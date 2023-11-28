const express = require('express');
const axios = require('axios');
const router = express.Router();

/*router.get('/network/:network/txid/:txid/voutI/:voutIndex', async (req, res) => {
  try {
    const network = req.params.network || req.query.network;
    const txid = req.params.txid || req.query.txid;
    const voutIndex = req.params.voutIndex || req.query.voutIndex;

    // Validar y sanitizar las entradas
    if (!['mainnet', 'testnet'].includes(network)) {
    throw new Error('Red no válida');
    }
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    throw new Error('txid no válido');
    }
    if (!Number.isInteger(parseInt(voutIndex)) || parseInt(voutIndex) < 0) {
    throw new Error('voutIndex no válido');
    }

    const tx = await getTransactionDetails(txid, voutIndex, network);
    res.status(200).json(tx);
  } catch (error) {
    console.error('Error al llamar a la función primordial getTransactionDetails:', error);//Corregir detalles aquí
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

async function getTransactionDetails(txid, voutIndex, network) {
  try {
    const url1 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/hash/${txid}`;
    const url2 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/${voutIndex}/spent`;

    const [response1, response2] = await Promise.all([
      axios.get(url1),
      axios.get(url2)
    ]);

    console.log('Respuesta de la consulta en URL1: ', response1.data);
    console.log('Respuesta de la consulta en URL2: ', response2.data);


    if (response1.error) {
        throw new Error(`Error en la respuesta de whatsonchain url1: ${response1.error.message}`);
      }

    if (response2.error) {
        throw new Error(`Error en la respuesta de whatsonchain url2: ${response2.error.message}`);
      }

    if (response1.status !== 200) {
      throw new Error(`Error en la respuesta de whatsonchain url1: ${response1.status}`);
    }

    if (response2.status !== 200) {
      throw new Error(`Error en la respuesta de whatsonchain url2: ${response2.status}`);
    }

    const spentTxId = response2.data.spent.txid;
    return { txid, voutIndex, spentTxId };
  } catch (error) {
    console.error('Error en la obtención de los detalles de la transacción:', error);//Corregir detalles
    throw error;
  }
}*/

router.get('/network/:network/txid/:txid/voutI/:voutIndex', async (req, res) => {
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

module.exports = router;