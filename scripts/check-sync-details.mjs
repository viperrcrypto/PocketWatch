import pg from "pg";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/wealthtracker" });
await client.connect();

// Full sync state details for all wallets
const states = await client.query(`SELECT "walletAddress", chain, phase, "isComplete", "requestsProcessed", "recordsInserted", "lastErrorCode", "lastErrorMessage", "highWaterMark", "syncMode", "retryAfter", "pageKey" FROM "TransactionSyncState" ORDER BY chain`);
console.log("=== Full Sync State Details ===");
for (const s of states.rows) {
  console.log(`\n--- ${s.walletAddress.slice(0,12)}... | chain: ${s.chain} ---`);
  console.log(`  phase: ${s.phase} | complete: ${s.isComplete} | mode: ${s.syncMode}`);
  console.log(`  requests: ${s.requestsProcessed} | records: ${s.recordsInserted}`);
  console.log(`  lastError: ${s.lastErrorCode || 'none'} | msg: ${s.lastErrorMessage || 'none'}`);
  console.log(`  highWaterMark: ${s.highWaterMark} | retryAfter: ${s.retryAfter}`);
  console.log(`  pageKey: ${s.pageKey ? s.pageKey.slice(0,30)+'...' : 'null'}`);
}

// Check tracked wallet addresses
const wallets = await client.query(`SELECT address, label, chains FROM "TrackedWallet" ORDER BY "createdAt"`);
console.log("\n=== Tracked Wallet Addresses ===");
for (const w of wallets.rows) {
  console.log(`${w.address} | label(enc): ${(w.label||'').slice(0,20)} | chains: ${w.chains.join(',')}`);
}

// Check Zerion key
const keys = await client.query(`SELECT id, "serviceName", verified, consecutive429, "lastUsedAt", "lastErrorAt" FROM "ExternalApiKey" WHERE "serviceName" = 'zerion'`);
console.log("\n=== Zerion API Keys ===");
for (const k of keys.rows) {
  console.log(`id: ${k.id} | verified: ${k.verified} | 429s: ${k.consecutive429} | lastUsed: ${k.lastUsedAt} | lastError: ${k.lastErrorAt}`);
}

await client.end();
