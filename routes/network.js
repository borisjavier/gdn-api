const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/network/:network/txid/:txid/voutI/:voutIndex', async (req, res) => {
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
}

module.exports = router;