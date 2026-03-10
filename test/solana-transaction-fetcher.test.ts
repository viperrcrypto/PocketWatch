import test from "node:test"
import assert from "node:assert/strict"
import { heliusTxToRecords, type HeliusTransaction } from "@/lib/portfolio/solana-tx-mapper"

const USER_ID = "test-user"
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
const OTHER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"

function baseTx(overrides: Partial<HeliusTransaction> = {}): HeliusTransaction {
  return {
    signature: "sig_" + Math.random().toString(36).slice(2),
    timestamp: 1700000000,
    type: "TRANSFER",
    source: "SYSTEM_PROGRAM",
    fee: 5000,
    feePayer: WALLET,
    slot: 250000000,
    ...overrides,
  }
}

test("SOL transfer in → 1 record, direction 'in', symbol SOL", () => {
  const htx = baseTx({
    nativeTransfers: [{ fromUserAccount: OTHER, toUserAccount: WALLET, amount: 1_000_000_000 }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 1)
  assert.equal(records[0].direction, "in")
  assert.equal(records[0].symbol, "SOL")
  assert.equal(records[0].category, "external")
  assert.equal(records[0].value, 1.0)
})

test("SOL transfer out → direction 'out'", () => {
  const htx = baseTx({
    nativeTransfers: [{ fromUserAccount: WALLET, toUserAccount: OTHER, amount: 500_000_000 }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 1)
  assert.equal(records[0].direction, "out")
  assert.equal(records[0].from, WALLET)
  assert.equal(records[0].to, OTHER)
})

test("Fee transfer filtered → feePayer sends exact fee to non-wallet, 0 records", () => {
  const htx = baseTx({
    fee: 5000,
    feePayer: WALLET,
    nativeTransfers: [{ fromUserAccount: WALLET, toUserAccount: OTHER, amount: 5000 }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 0)
})

test("Legit small SOL transfer NOT filtered → wallet sends 0.005 SOL (not matching fee)", () => {
  const htx = baseTx({
    fee: 5000,
    feePayer: WALLET,
    nativeTransfers: [{ fromUserAccount: WALLET, toUserAccount: OTHER, amount: 5_000_000 }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 1)
  assert.equal(records[0].direction, "out")
  assert.equal(records[0].value, 0.005)
})

test("SPL token transfer → category 'erc20', asset = mint address", () => {
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  const htx = baseTx({
    tokenTransfers: [{
      fromUserAccount: OTHER,
      toUserAccount: WALLET,
      fromTokenAccount: "tokenAccA",
      toTokenAccount: "tokenAccB",
      tokenAmount: 100.5,
      mint,
      tokenStandard: "Fungible",
    }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 1)
  assert.equal(records[0].category, "erc20")
  assert.equal(records[0].asset, mint)
  assert.equal(records[0].direction, "in")
  assert.equal(records[0].value, 100.5)
})

test("Swap (SOL out + token in) → produces 2 records", () => {
  const mint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
  const htx = baseTx({
    nativeTransfers: [{ fromUserAccount: WALLET, toUserAccount: OTHER, amount: 2_000_000_000 }],
    tokenTransfers: [{
      fromUserAccount: OTHER,
      toUserAccount: WALLET,
      fromTokenAccount: "tA",
      toTokenAccount: "tB",
      tokenAmount: 50000,
      mint,
      tokenStandard: "Fungible",
    }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 2)
  const solRec = records.find((r) => r.symbol === "SOL")!
  const tokenRec = records.find((r) => r.asset === mint)!
  assert.equal(solRec.direction, "out")
  assert.equal(tokenRec.direction, "in")
})

test("accountData fallback → no transfers, balance changes extracted", () => {
  const htx = baseTx({
    accountData: [{
      account: WALLET,
      nativeBalanceChange: -500_000_000,
      tokenBalanceChanges: [{
        userAccount: WALLET,
        tokenAccount: "tA",
        rawTokenAmount: { tokenAmount: "1000000", decimals: 6 },
        mint: "So11111111111111111111111111111111111111112",
      }],
    }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 2)
  const native = records.find((r) => r.asset === "native")!
  const token = records.find((r) => r.category === "erc20")!
  assert.equal(native.direction, "out")
  assert.equal(native.value, 0.5)
  assert.equal(token.direction, "in")
  assert.equal(token.value, 1)
})

test("Tiny native balance change in accountData is NOT filtered (threshold removed)", () => {
  const htx = baseTx({
    accountData: [{
      account: WALLET,
      nativeBalanceChange: -5000, // tiny fee-like amount
    }],
  })
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  // With threshold removed, this should produce a record
  assert.equal(records.length, 1)
  assert.equal(records[0].direction, "out")
})

test("Empty transaction → 0 records", () => {
  const htx = baseTx({})
  const records = heliusTxToRecords(htx, USER_ID, WALLET)
  assert.equal(records.length, 0)
})
