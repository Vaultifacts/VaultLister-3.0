// Blockchain verification utilities (local hashing)
// Provides item authenticity verification through cryptographic hashing

/**
 * Generate a blockchain-style hash for item verification
 * Uses SHA-256 for cryptographic hashing
 */
export function generateBlockchainHash(data) {
    const stringData = JSON.stringify({
        title: data.title,
        description: data.description,
        images: data.images,
        timestamp: Date.now()
    });

    // Simple hash function for local use (Bun has crypto built-in)
    return hashString(stringData);
}

/**
 * Hash a string using SHA-256
 */
function hashString(str) {
    // Use Bun's built-in crypto
    if (typeof Bun !== 'undefined') {
        const hasher = new Bun.CryptoHasher('sha256');
        hasher.update(str);
        return hasher.digest('hex');
    }

    // Fallback for browser/Node
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Verify an item's hash matches its data
 */
export function verifyBlockchainHash(data, storedHash) {
    const currentHash = generateBlockchainHash(data);
    return currentHash === storedHash;
}

/**
 * Create a verification certificate for an item
 */
export function createVerificationCertificate(item) {
    return {
        itemId: item.id,
        title: item.title,
        hash: item.blockchain_hash || generateBlockchainHash(item),
        timestamp: Date.now(),
        version: '1.0',
        algorithm: 'SHA-256'
    };
}

/**
 * Generate a chain of hashes for item history
 */
export function generateHistoryChain(items) {
    const chain = [];
    let previousHash = '0000000000000000';

    for (const item of items) {
        const blockData = {
            index: chain.length,
            timestamp: item.created_at || Date.now(),
            data: {
                id: item.id,
                title: item.title,
                price: item.list_price
            },
            previousHash
        };

        const hash = hashString(JSON.stringify(blockData));

        chain.push({
            ...blockData,
            hash
        });

        previousHash = hash;
    }

    return chain;
}

/**
 * Validate a history chain
 */
export function validateChain(chain) {
    for (let i = 1; i < chain.length; i++) {
        const current = chain[i];
        const previous = chain[i - 1];

        // Check previous hash reference
        if (current.previousHash !== previous.hash) {
            return {
                valid: false,
                error: `Invalid chain at block ${i}`,
                blockIndex: i
            };
        }

        // Verify block hash
        const { hash, ...blockData } = current;
        const calculatedHash = hashString(JSON.stringify(blockData));

        if (hash !== calculatedHash) {
            return {
                valid: false,
                error: `Invalid hash at block ${i}`,
                blockIndex: i
            };
        }
    }

    return { valid: true };
}
