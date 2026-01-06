// bloom.js

/**
 * Motor de Hash MurmurHash3 (La función 'e' que encontraste)
 */
function hash(key, seed) {
    const remainder = 3 & key.length;
    const bytes = key.length - remainder;
    let h1 = seed;
    const c1 = 3432918353;
    const c2 = 461845907;
    let i = 0;

    while (i < bytes) {
        let k1 = (255 & key.charCodeAt(i)) | 
                 ((255 & key.charCodeAt(++i)) << 8) | 
                 ((255 & key.charCodeAt(++i)) << 16) | 
                 ((255 & key.charCodeAt(++i)) << 24);
        ++i;

        k1 = ((65535 & k1) * c1 + ((((k1 >>> 16) * c1) & 65535) << 16)) & 4294967295;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = ((65535 & k1) * c2 + ((((k1 >>> 16) * c2) & 65535) << 16)) & 4294967295;

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        let h1_5 = (5 * (65535 & h1) + (((5 * (h1 >>> 16)) & 65535) << 16)) & 4294967295;
        h1 = 27492 + (65535 & h1_5) + (((58964 + (h1_5 >>> 16)) & 65535) << 16);
    }

    let k1 = 0;
    switch (remainder) {
        case 3: k1 ^= (255 & key.charCodeAt(i + 2)) << 16;
        case 2: k1 ^= (255 & key.charCodeAt(i + 1)) << 8;
        case 1:
            k1 ^= 255 & key.charCodeAt(i);
            k1 = ((65535 & k1) * c1 + ((((k1 >>> 16) * c1) & 65535) << 16)) & 4294967295;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = ((65535 & k1) * c2 + ((((k1 >>> 16) * c2) & 65535) << 16)) & 4294967295;
            h1 ^= k1;
    }

    h1 ^= key.length;
    h1 ^= h1 >>> 16;
    h1 = (2246822507 * (65535 & h1) + (((2246822507 * (h1 >>> 16)) & 65535) << 16)) & 4294967295;
    h1 ^= h1 >>> 13;
    h1 = (3266489909 * (65535 & h1) + (((3266489909 * (h1 >>> 16)) & 65535) << 16)) & 4294967295;
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
}

const Bloom = {
    /**
     * Convierte el string Base64 que envía el cliente en un objeto de filtro usable
     */
    fromBase64: function (base64String) {
        const buffer = Buffer.from(base64String, "base64");
        const numHashes = buffer[0];
        const buckets = new Array(8 * (buffer.length - 1));
        
        for (let i = 1, bucketIdx = 0; i < buffer.length; i++, bucketIdx += 8) {
            buckets[bucketIdx + 0] = (buffer[i] >> 7) & 1;
            buckets[bucketIdx + 1] = (buffer[i] >> 6) & 1;
            buckets[bucketIdx + 2] = (buffer[i] >> 5) & 1;
            buckets[bucketIdx + 3] = (buffer[i] >> 4) & 1;
            buckets[bucketIdx + 4] = (buffer[i] >> 3) & 1;
            buckets[bucketIdx + 5] = (buffer[i] >> 2) & 1;
            buckets[bucketIdx + 6] = (buffer[i] >> 1) & 1;
            buckets[bucketIdx + 7] = (buffer[i] >> 0) & 1;
        }
        return { numHashes, buckets };
    },

    /**
     * Verifica si una llave POSIBLEMENTE existe en el filtro
     */
    possiblyHas: function (filter, key) {
        for (let seed = 1; seed <= filter.numHashes; seed++) {
            const index = hash(key, seed) % filter.buckets.length;
            if (!filter.buckets[index]) return false;
        }
        return true;
    }
};

module.exports = Bloom;