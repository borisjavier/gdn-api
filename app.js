const express = require('express');
const axios = require('axios');
const cors = require('cors');
const errorHandler = require('./errorhandler');
//const rateLimit = require('./ratelimit');
const admin = require('firebase-admin');
const Bloom = require('./bloom.js');

const app = express();

app.use(cors({
  origin: ['https://golden-notes.io', 'https://golden-notes.com']
}));


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

//app.use(rateLimit);
app.use(errorHandler);

const WOC_API_KEY = process.env.WOC_API_KEY;
const TAAL_API_KEY = process.env.TAAL_API_KEY;

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Usa los roles que asignamos en IAM
        databaseURL: "https://goldennotes-app.firebaseio.com",
        projectId: 'goldennotes-app'
    });
}

const db = admin.database();
const db1 = admin.firestore();


db1.settings({ 
    ignoreUndefinedProperties: true,
    preferRest: true
});


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
    const res1 = await axios.get(url1, {
        headers: {
          'woc-api-key': WOC_API_KEY
        }
      });
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
      const res2 = await axios.get(url2, {
        headers: {
          'woc-api-key': WOC_API_KEY
        }
      });
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


app.get('/v1/:network/state/:location', async (req, res) => {
    try {
        const { location } = req.params;
        const filterB64 = req.query.filter;
        const docId = `jig-${location}`;
        
        const docRef = db1.collection('state').doc(docId);
        const doc = await docRef.get();
        if (!doc.exists) {
            // Si no existe, no imprimas todo el error, solo un 404 rápido
            return res.status(404).send('Not found');
        }
        const rawData = doc.data();

        if (!rawData || !rawData.value) {
            throw new Error(`El documento ${docId} existe pero no tiene el campo 'value'`);
        }

        const state = JSON.parse(rawData.value);

        // Lógica del Bloom Filter (Ingeniería Inversa)
        if (filterB64) {
            try {
                const filter = Bloom.fromBase64(filterB64);
                const filteredProps = {};
                for (const key in state.props) {
                    if (!Bloom.possiblyHas(filter, key)) {
                        filteredProps[key] = state.props[key];
                    }
                }
                state.props = filteredProps;
            } catch (bloomError) {
                console.error("Error procesando Bloom Filter, enviando estado completo:", bloomError);
            }
        }

        res.json({ [location]: state });

    } catch (error) {
        console.error('ERROR EN ENDPOINT STATE:', error);
        // Enviamos el mensaje de error real para diagnosticar en la laptop
        res.status(500).json({ 
            error: 'Internal Server Error', 
            message: error.message,
            stack: error.stack 
        });
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

app.get('/balance/:address/uid/:uid', async (req, res) => {
    const { address, uid } = req.params;
    console.log(`Address: ${address}, uid: ${uid}`)
    //const { uid } = req.query; // Necesitamos el UID para que Functions sepa de quién es la clave

    try {
        const doc = await db1.collection('goldennotes').doc(address).get();
        
        // ESCENARIO A: El balance ya existe en nuestra base de datos rápida
        if (doc.exists) {
            console.log(`Saldo recuperado de caché para: ${address}`);
            return res.json(doc.data());
        }

        // ESCENARIO B: No hay historial. Es un usuario nuevo o una dirección no indexada.
        console.log(`Primer encuentro con ${address}. Sincronizando por primera vez...`);

        // Llamamos a tu Firebase Function para obtener la "verdad" de la blockchain
        // Usamos la lógica de /mov que ya definimos
        const functionUrl = 'https://us-central1-goldennotes-app.cloudfunctions.net/app/mov';
        
        try {
            const response = await axios.post(functionUrl, { uid, dir: address });
            const dt = response.data;

            if (dt && dt.balance !== undefined) {
                const primerSaldo = {
                    balance: dt.balance,
                    update_count: 0,
                    last_txid: 'initial_sync',
                    timestamp: Date.now(),
                    status: 'verified'
                };

                // Guardamos en Firestore para que la PRÓXIMA consulta sea instantánea
                await db1.collection('goldennotes').doc(address).set(primerSaldo);

                return res.json(primerSaldo);
            }
        } catch (fError) {
            console.error("Error en sincronización inicial:", fError.message);
            return res.status(500).json({ error: "Error al sincronizar saldo inicial con la blockchain." });
        }

        res.json({ balance: 0, message: "No se encontraron fondos en la blockchain." });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/update-balance', async (req, res) => {
    const { emisor, txid, uidEmisor, transferencias } = req.body;
    console.log(`[UpdateBalance]: Iniciando transacción para TX: ${txid}`);

    // Array para guardar a todos los que necesitan validación profunda (emisor + receptores)
    let addressesToValidate = [];

    try {
        await db1.runTransaction(async (transaction) => {
            // 1. PRE-LECTURA
            const emiRef = db1.collection('goldennotes').doc(emisor);
            const emiDoc = await transaction.get(emiRef);

            const receptorRefs = transferencias.map(tr => db1.collection('goldennotes').doc(tr.receptor));
            const receptorDocs = await Promise.all(receptorRefs.map(ref => transaction.get(ref)));

            let totalSalidaEmisor = 0;

            // 2. PROCESAR RECEPTORES
            for (let i = 0; i < transferencias.length; i++) {
                const tr = transferencias[i];
                const recRef = receptorRefs[i];
                const recDoc = receptorDocs[i];

                totalSalidaEmisor += tr.amount;
                let finalRecBalance;
                let newRecCount;

                if (!recDoc.exists) {
                    const saldoBlockchain = await callFirebaseBal(tr.uidReceptor, tr.receptor, true);
                    finalRecBalance = saldoBlockchain;
                    newRecCount = 1;
                } else {
                    const recData = recDoc.data();
                    finalRecBalance = (recData.balance || 0) + tr.amount;
                    newRecCount = (recData.update_count || 0) + 1;
                }

                // VERIFICACIÓN PARA EL RECEPTOR
                if (newRecCount >= 10 && tr.uidReceptor) {
                    addressesToValidate.push({ uid: tr.uidReceptor, address: tr.receptor });
                    newRecCount = 0; // Reiniciamos contador en DB porque dispararemos validación
                }

                transaction.set(recRef, {
                    balance: finalRecBalance,
                    update_count: newRecCount,
                    last_txid: txid,
                    timestamp: Date.now()
                }, { merge: true });

                transaction.set(recRef.collection('history').doc(`${txid}_in`), {
                    type: 'receive',
                    amount: tr.amount,
                    from: emisor,
                    timestamp: Date.now()
                });
            }

            // 3. PROCESAR EMISOR
            let finalEmiBalance;
            let newEmiCount;

            if (!emiDoc.exists) {
                const saldoBlockchainEmi = await callFirebaseBal(uidEmisor, emisor, true);
                finalEmiBalance = saldoBlockchainEmi;
                newEmiCount = 1;
            } else {
                const emiData = emiDoc.data();
                finalEmiBalance = emiData.balance - totalSalidaEmisor;
                newEmiCount = (emiData.update_count || 0) + 1;
            }

            // VERIFICACIÓN PARA EL EMISOR
            if (newEmiCount >= 10 && uidEmisor) {
                addressesToValidate.push({ uid: uidEmisor, address: emisor });
                newEmiCount = 0; 
            }

            transaction.set(emiRef, {
                balance: finalEmiBalance,
                update_count: newEmiCount,
                last_txid: txid,
                timestamp: Date.now()
            }, { merge: true });

            transaction.set(emiRef.collection('history').doc(`${txid}_out`), {
                type: 'send',
                total_spent: totalSalidaEmisor,
                details: transferencias,
                timestamp: Date.now()
            });
        });

        // 4. VALIDACIÓN POST-TRANSACCIÓN (MULTIPLE)
        if (addressesToValidate.length > 0) {
            console.log(`[UpdateBalance]: 🔍 Umbral alcanzado para ${addressesToValidate.length} cuenta(s).`);
            
            // Ejecutamos todas las validaciones pendientes. 
            // Usamos Promise.all para que Cloud Run espere a que todas terminen.
            await Promise.all(addressesToValidate.map(item => {
                console.log(`[DeepValidation]: Sincronizando receptor/emisor: ${item.address}`);
                return callFirebaseBal(item.uid, item.address);
            }));
        }

        console.log(`[UpdateBalance]: ✅ Transacción exitosa para ${txid}`);
        res.json({ status: 'success', validated_count: addressesToValidate.length });

    } catch (error) {
        console.error(`[UpdateBalance]: ❌ Error en transacción: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* Using taal 
app.post('/broadcast', async (req, res) => {
  try {
    // 1. Estandarizar la entrada
    // WoC suele enviar { "txhex": "..." }
    // ARC espera { "rawTx": "..." }
    const txHex = req.body.txhex || req.body.rawTx || req.body.hex;
    const network = req.body.network || 'main';

    if (!txHex || typeof txHex !== 'string') {
      throw new Error('Falta el hex de la transacción (txhex)');
    }

    console.log(`[Puente] Recibiendo TX para broadcast via ARC...`);

    // 2. Llamada a TAAL ARC (Teranode)
    // Usamos axios, que ya lo tienes importado
    const arcResponse = await axios.post(
      'https://arc.taal.com/v1/tx',
      { rawTx: txHex }, // Payload formateado para ARC
      {
        headers: {
          'Authorization': `Bearer ${TAAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15s timeout
      }
    );

    // 3. Procesar la respuesta de ARC
    // ARC devuelve 200 OK con un JSON detallado si todo va bien.
    const arcData = arcResponse.data;

    if (arcResponse.status === 200 && arcData.txid) {
      console.log(`✅ [Puente] Éxito ARC. TXID: ${arcData.txid}`);
      const txid = arcData.txid      
      let indexed = false;
      const maxRetries = 10;
      await sleep(500);
        for (let i = 0; i < maxRetries; i++) {

        try {
            const wocUrl = `https://api.whatsonchain.com/v1/bsv/${network}/tx/hash/${txid}`;
            console.log(`🔍 [Intento ${i + 1}] Consultando WoC: ${wocUrl}`);
            const wocCheck = await axios.get(
                wocUrl,
                { headers: { 'woc-api-key': WOC_API_KEY } }
            );

            if (wocCheck.status === 200 && wocCheck.data && wocCheck.data.txid) {
                indexed = true;
                console.log(`✅ [WoC] TX indexada en intento ${i + 1}`);
                break;
            }
          } catch (err) {
                console.log(`... [Intento ${i + 1}] WoC aún no ve la TX, reintentando en 1s...`);
          }
        await sleep(1000); // Esperar 1 segundo antes del siguiente intento

        }

      if (!indexed) {
        console.warn(`⚠️ [Timeout] WoC no indexó a tiempo, pero la TX fue enviada.`);
      }

      return res.status(200).send(arcData.txid);
    } else {
      // Caso raro donde status es 200 pero no hay txid
      throw new Error('ARC respondió OK pero sin TXID: ' + JSON.stringify(arcData));
    }

  } catch (error) {
    console.error('❌ [Puente] Error en Broadcast:', error.message);

    // 4. Manejo de Errores detallado (Traducción de errores de ARC)
    let errorMsg = 'Error interno en broadcast';
    let statusCode = 500;

    if (error.response) {
      // El servidor de ARC respondió con un error (4xx, 5xx)
      statusCode = error.response.status;
      const arcError = error.response.data;
      
      // ARC suele devolver detalles en 'extraInfo' o 'title'
      errorMsg = arcError.extraInfo || arcError.title || arcError.detail || JSON.stringify(arcError);
      
      console.error(`[Puente] Detalle ARC: ${errorMsg}`);
    } else {
      // Error de red o configuración
      errorMsg = error.message;
    }

    // Devolvemos el error en un formato que tu frontend pueda leer
    return res.status(statusCode).json({ 
      error: errorMsg,
      provider: 'TAAL-ARC-BRIDGE'
    });
  }
});*/

/* Using WoC
app.post('/broadcast', async (req, res) => {
  try {
    // 1. Estandarizar la entrada
    const txHex = req.body.txhex || req.body.rawTx || req.body.hex;
    const network = req.body.network || 'main'; // 'main' o 'test'

    if (!txHex || typeof txHex !== 'string') {
      throw new Error('Falta el hex de la transacción (txhex)');
    }

    console.log(`[Puente] Recibiendo TX para broadcast via WhatsOnChain (${network})...`);

    // 2. Llamada directa a WhatsOnChain
    const wocUrl = `https://api.whatsonchain.com/v1/bsv/${network}/tx/raw`;
    
    const wocResponse = await axios.post(
      wocUrl,
      { txhex: txHex }, // Payload formateado para WoC
      {
        headers: {
          'woc-api-key': WOC_API_KEY, // Opcional, pero recomendado si tienes rate limits
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15s timeout
      }
    );

    // 3. Procesar la respuesta
    // WoC devuelve el TXID directamente como texto/string en `wocResponse.data` cuando es exitoso
    const txid = wocResponse.data;

    if (wocResponse.status === 200 && txid) {
      console.log(`✅ [Puente] Éxito WoC. TXID: ${txid}`);
      
      // Ya no necesitamos hacer polling/reintentos. 
      // Si el POST a WoC fue exitoso, ellos ya la tienen.
      return res.status(200).send(txid);
    } else {
      throw new Error('WoC respondió OK pero respuesta es anómala: ' + JSON.stringify(wocResponse.data));
    }

  } catch (error) {
    console.error('❌ [Puente] Error en Broadcast:', error.message);

    // 4. Manejo de Errores adaptado a WoC
    let errorMsg = 'Error interno en broadcast';
    let statusCode = 500;

    if (error.response) {
      // El servidor de WoC rechazó la TX (ej. doble gasto, fee insuficiente, mal formada)
      statusCode = error.response.status;
      const wocError = error.response.data;
      
      // WoC suele devolver los errores como texto plano o dentro de un objeto JSON
      errorMsg = typeof wocError === 'string' 
        ? wocError 
        : (wocError.error || JSON.stringify(wocError));
      
      console.error(`[Puente] Detalle WoC: ${errorMsg}`);
    } else {
      // Error de red (timeout, DNS, etc.)
      errorMsg = error.message;
    }

    // Devolvemos el error en un formato predecible para tu frontend
    return res.status(statusCode).json({ 
      error: errorMsg,
      provider: 'WOC-BRIDGE'
    });
  }
});*/

/** Using ARC */

app.post('/broadcast', async (req, res) => {
  try {
    // 1. Estandarizar la entrada
    const txHex = req.body.txhex || req.body.rawTx || req.body.hex;
    const network = req.body.network || 'main'; // ARC suele usar mainnet

    if (!txHex || typeof txHex !== 'string') {
      throw new Error('Falta el hex de la transacción (txhex/rawTx)');
    }

    // 2. Log Incial: Saber si viene extendido (EF) o corto (Raw normal)
    console.log(`[Puente ARC] Recibiendo TX de longitud ${txHex.length}...`);

    // 3. Llamada a TAAL ARC (Teranode)
    // endpoint de mainnet de Taal
    const arcUrl = 'https://arc.taal.com/v1/tx'; 

    const arcResponse = await axios.post(
      arcUrl,
      { rawTx: txHex }, // El payload para ARC. Acepta tanto HEX corto como EF (BIP-239)
      {
        headers: {
          'Authorization': `Bearer ${TAAL_API_KEY}`, // Tu llave de console.taal.com
          'Content-Type': 'application/json',
          'X-WaitForStatus': '3', // ARC esperará hasta que la transacción sea 'SEEN_IN_MEMPOOL' (3) o superior
          'X-SkipFeeCheck': 'false' // Asegura que ARC valide el fee y no rebote luego
        },
        timeout: 15000 // 15s timeout
      }
    );

    // 4. Procesar la respuesta
    const arcData = arcResponse.data;

    // ARC devuelve status 200 con un objeto que contiene txid y txStatus
    if (arcResponse.status === 200 && arcData.txid) {
      console.log(`✅ [Puente ARC] Éxito. TXID: ${arcData.txid} | Estado: ${arcData.txStatus}`);
      
      // Enviamos el TXID directamente de vuelta al cliente
      return res.status(200).send(arcData.txid);
    } else {
      throw new Error('ARC respondió OK pero sin TXID: ' + JSON.stringify(arcData));
    }

  } catch (error) {
    console.error('❌ [Puente ARC] Error en Broadcast:', error.message);

    // 5. Manejo de Errores detallado (Traducción de errores de ARC)
    let errorMsg = 'Error interno en broadcast';
    let statusCode = 500;

    if (error.response) {
      // El servidor de ARC respondió con un error (4xx, 5xx)
      statusCode = error.response.status;
      const arcError = error.response.data;
      
      // ARC suele devolver detalles en 'extraInfo' o 'title' o 'detail'
      // Esto es crucial para entender el error de "parent-tx-below-min-relay-fee" (Ancestros)
      errorMsg = arcError.extraInfo || arcError.title || arcError.detail || JSON.stringify(arcError);
      
      console.error(`[Puente ARC] Detalle ARC: ${errorMsg}`);
    } else {
      // Error de red, timeout, DNS, etc.
      errorMsg = error.message;
    }

    // Devolvemos el error en un formato que tu frontend pueda leer
    return res.status(statusCode).json({ 
      error: errorMsg,
      provider: 'TAAL-ARC-BRIDGE'
    });
  }
});


async function callFirebaseBal(uid, address, returnBalance = false) {
    try {
        const functionUrl = 'https://us-central1-goldennotes-app.cloudfunctions.net/app/mov';
        console.log(`[DeepValidation]: Consultando blockchain para ${address}...`);
        
        const response = await axios.post(functionUrl, { uid: uid, dir: address }, { timeout: 10000 });

        if (response.data && response.data.balance !== undefined) {
            const saldoReal = response.data.balance;
            
            // Usamos .set con merge para manejar la creación inicial de los 200 usuarios
            await db1.collection('goldennotes').doc(address).set({
                balance: saldoReal,
                update_count: 0, 
                last_verified: Date.now(),
                status: 'blockchain_verified'
            }, { merge: true });
            
            console.log(`[DeepValidation]: ✅ ${address} sincronizado: ${saldoReal} Quarks.`);
            return returnBalance ? saldoReal : true;
            //if (returnBalance) return saldoReal;
        } 
        return 0; 
    } catch (err) {
        console.error(`[DeepValidation]: ❌ Fallo en ${address}: ${err.message}`);
        return 0;
    }
}



// Captura el puerto de la variable de entorno o usa 8080 por defecto
const port = process.env.PORT || 8080;

// Es fundamental añadir '0.0.0.0' para que Cloud Run detecte el servicio
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor API REST escuchando en el puerto ${port}`);
});