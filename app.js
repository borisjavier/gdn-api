const express = require('express');
const axios = require('axios');
const app = express();
const cors = require('cors');
const errorHandler = require('./errorhandler');
const rateLimit = require('./ratelimit');
const admin = require('firebase-admin');


app.use(rateLimit);
app.use(errorHandler);
app.use(cors({
  origin: ['https://golden-notes.io', 'https://golden-notes.com']
}));

const WOC_API_KEY = process.env.WOC_API_KEY;

admin.initializeApp({
    credential: admin.credential.applicationDefault(), 
    databaseURL: "https://goldennotes-app.firebaseio.com" 
});

const db = admin.database();

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
  let voutIndex = parseInt(prec[1]) - 1;
    //const url3 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/opreturn`;
    const url3 = `https://api.whatsonchain.com/v1/bsv/${network}/tx/${txid}/out/${voutIndex}/hex`
    //https://goldennotes-api-c3s3gjywza-uc.a.run.app/v1/main/state/1786296c21416f1e5ed3ebbd95d64a9c79a39c31fd3efce3de767e2b57bfdb43_o1
    //https://api.whatsonchain.com/v1/bsv/main/tx/1786296c21416f1e5ed3ebbd95d64a9c79a39c31fd3efce3de767e2b57bfdb43/out/0/hex
    const apiKey = 'mainnet_6c81a97a917bdab017bb02cd0d98f794';
    try {
      const response = await axios.get(url3, {
        headers: {
          'Apikey': apiKey
        }
      });
      /*const tx = response.data;
      //res.status(200).json(tx);
      const hexArray = tx.map(item => item.hex);
      //const hex = tx[0].hex;
      res.status(200).json(hexArray);
      Si el resultado fuera un arreglo, como en el caso de opreturn, este sería el aproach
      */
      const hex = response.data;
      const hexArray = [hex]; // Envolver hex en un arreglo
  
      res.status(200).json(hexArray);
    } catch (error) {
      console.error(`Error al llamar a la url3: (${url3}):`, error);
      res.status(500).json({ error: 'Error al llamar a la API externa' });
    }
  
});


app.get('/v1/:network/script/:scriptHash/unspent/all', async (req, res) => {
    const network = req.params.network || req.query.network || req.body.network;
    const scriptHash = req.params.scriptHash || req.query.scriptHash || req.body.scriptHash;

    const url = `https://api.whatsonchain.com/v1/bsv/${network}/script/${scriptHash}/unspent/all`;

    try {
        const response = await axios.get(url, { headers: { 'woc-api-key': WOC_API_KEY, cache: 1e3 } });
        
        // Extraemos los resultados del nuevo formato de WoC
        const utxos = response.data.result || [];

        // Normalizamos al formato que RUN.js mapea internamente
        // Nota: Devolvemos el array plano para que el .map() de la librería funcione igual
        const normalized = utxos.map(u => ({
            tx_hash: u.tx_hash,
            tx_pos: u.tx_pos,
            value: u.value,
            height: u.height
        }));

        res.status(200).json(normalized);
    } catch (error) {
        console.error('Error en patch UTXOs:', error.message);
        res.status(500).json({ error: 'Error al consultar UTXOs' });
    }
});


// Esta es tu lista base de seguridad, pero se expandirá dinámicamente
let defaultCurrencies = ["PAB", "USD", "EUR", "PEN", "ARS", "CLP", "COP", "UYU", "BRL", "ZAR"];

app.get('/v1/rates/batch', async (req, res) => {
    const { symbols } = req.query;
    if (!symbols) return res.status(400).json({ error: "Faltan símbolos" });

    const requestedSymbols = symbols.toUpperCase().split(',').map(s => s.trim());
    const masterList = [...new Set([...defaultCurrencies, ...requestedSymbols])];
    const ahora = Math.floor(Date.now() / 1000);
    const CINCO_MINUTOS = 300;

    try {
        const snapshot = await db.ref('rates').once('value');
        const allCachedRates = snapshot.val() || {};

        // --- LÓGICA DE DECISIÓN REFORZADA ---
        const usdCache = allCachedRates["USD_XAU"];
        const cacheExpirado = !usdCache || (ahora - usdCache.timestamp) > CINCO_MINUTOS;
        
        // Verificamos si alguna de las monedas pedidas NO existe en el caché actual
        const algunaMonedaFaltante = requestedSymbols.some(s => !allCachedRates[`${s}_XAU`]);

        // Si el caché expiró O si la App pide algo nuevo que no tenemos: Vamos a la API
        if (cacheExpirado || algunaMonedaFaltante) {
            console.log(cacheExpirado ? "[Cache Miss] Tiempo expirado" : "[New Symbol] Moneda nueva detectada");
            
            const symbolsCsv = masterList.join(',');
            const url = `https://openexchangerates.org/api/latest.json?app_id=${process.env.OPEN_EXCHANGE_APP_ID}&base=XAU&symbols=${symbolsCsv}`;

            const response = await axios.get(url);
            const oxrRates = response.data.rates;

            const batchUpdate = {};
            const updatedData = {};

            for (const sym of masterList) {
                if (oxrRates[sym]) {
                    const currencyPerGram = Number((oxrRates[sym] / 31.1035).toFixed(4));
                    batchUpdate[`${sym}_XAU`] = {
                        rate: currencyPerGram,
                        timestamp: ahora
                    };
                    updatedData[sym] = currencyPerGram;
                }
            }

            await db.ref('rates').update(batchUpdate);

            const filteredResult = {};
            requestedSymbols.forEach(s => {
                if (updatedData[s]) filteredResult[s] = updatedData[s];
            });

            return res.status(200).json(filteredResult);

        } else {
            // --- CACHE HIT TOTAL ---
            console.log("[Cache Hit] Todos los símbolos encontrados y vigentes");
            const filteredResult = {};
            requestedSymbols.forEach(s => {
                filteredResult[s] = allCachedRates[`${s}_XAU`].rate;
            });
            return res.status(200).json(filteredResult);
        }

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

app.listen(8080, () => {
  console.log('Servidor API REST escuchando en el puerto indicado');
});