import pg from "pg";
import { webcrypto } from "crypto";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/wealthtracker" });
await client.connect();

const ENC_KEY_HEX = process.env.ENCRYPTION_KEY;

async function decryptKey(encrypted) {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(ENC_KEY_HEX.slice(i * 2, i * 2 + 2), 16);
  }
  const key = await webcrypto.subtle.importKey("raw", keyBytes.buffer, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const decrypted = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// Get healthy Helius key
const keys = await client.query(`
  SELECT "apiKeyEnc" FROM "ExternalApiKey"
  WHERE "serviceName" = 'helius' AND consecutive429 < 10
  ORDER BY consecutive429 ASC LIMIT 1
`);

if (keys.rows.length === 0) {
  console.log("No healthy Helius key found");
  await client.end();
  process.exit(1);
}

const apiKey = await decryptKey(keys.rows[0].apiKeyEnc);

const addr = "4pAJxvdydQtQqdERZM4fYMce9DSAV3PJJj6G3dwrTnpE";
console.log(`Fetching newest 5 txns for ${addr}...`);

const url = `https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${apiKey}&limit=5`;
const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

if (!res.ok) {
  console.log(`Helius error: ${res.status} ${await res.text()}`);
  await client.end();
  process.exit(1);
}

const txs = await res.json();
console.log(`\nHelius returned ${txs.length} transactions:`);
for (const tx of txs) {
  const d = new Date(tx.timestamp * 1000).toISOString();
  console.log(`  ${d} | sig:${tx.signature.slice(0,20)}... | type:${tx.type} | source:${tx.source}`);
  if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    for (const tt of tx.tokenTransfers.slice(0, 3)) {
      console.log(`    SPL: mint=${(tt.mint || "").slice(0,16)}... | amt=${tt.tokenAmount} | ${(tt.fromUserAccount || "").slice(0,8)}→${(tt.toUserAccount || "").slice(0,8)}`);
    }
  }
  if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
    for (const nt of tx.nativeTransfers.slice(0, 2)) {
      console.log(`    SOL: ${nt.amount / 1e9} | ${(nt.fromUserAccount || "").slice(0,8)}→${(nt.toUserAccount || "").slice(0,8)}`);
    }
  }
}

// Also check: are any of these already in the cache?
const sigs = txs.map(t => t.signature);
const existing = await client.query(
  `SELECT "txHash" FROM "TransactionCache" WHERE chain = 'SOLANA' AND "txHash" = ANY($1)`,
  [sigs]
);
console.log(`\nOf ${txs.length} newest txs, ${existing.rows.length} already in cache`);
for (const e of existing.rows) {
  console.log(`  cached: ${e.txHash.slice(0,20)}...`);
}

await client.end();
