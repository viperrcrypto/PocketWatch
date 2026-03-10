import "dotenv/config"
import { db } from "@/lib/db"
import { getServiceKeys } from "@/lib/portfolio/service-keys"

async function main() {
  // Get userId
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) { console.log("No user"); return }

  // Get properly decrypted Zerion key
  const keys = await getServiceKeys(user.id, "zerion")
  if (keys.length === 0) { console.log("No Zerion keys"); return }

  const apiKey = keys[0].key
  console.log("Using key:", keys[0].label ?? "unlabeled", "verified:", keys[0].verified)

  // Get EVM wallet address
  const wallet = await db.trackedWallet.findFirst({
    where: { address: { startsWith: "0x" } },
    select: { address: true },
  })
  if (!wallet) { console.log("No EVM wallet"); return }

  const addr = wallet.address.toLowerCase()
  console.log("Testing wallet:", addr)

  // Direct API call
  const token = Buffer.from(`${apiKey}:`).toString("base64")
  const url = `https://api.zerion.io/v1/wallets/${addr}/transactions/?page[size]=10&currency=usd`

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${token}`,
      Accept: "application/json",
    },
  })

  console.log("Status:", res.status)
  if (!res.ok) {
    console.log("Error:", (await res.text()).slice(0, 500))
    return
  }

  const json = await res.json()
  const txs = json.data ?? []
  console.log(`\nTransactions returned: ${txs.length}`)
  console.log(`Has next page: ${!!json.links?.next}`)

  for (const tx of txs.slice(0, 5)) {
    const a = tx.attributes
    console.log(`\n  hash=${a.hash?.slice(0, 16)}… chain=${a.chain_id} op=${a.operation_type} status=${a.status}`)
    console.log(`    mined_at=${a.mined_at} transfers=${a.transfers?.length ?? 0}`)
    for (const t of (a.transfers ?? []).slice(0, 3)) {
      const fi = t.fungible_info
      const nft = t.nft_info
      console.log(`    ${t.direction} ${fi?.symbol ?? nft?.name ?? "?"} qty=${t.quantity?.float ?? "?"} usd=${t.value ?? "null"}`)
    }
  }

  // Count total from a few more pages
  let totalTxs = txs.length
  let pageCount = 1
  let nextUrl = json.links?.next as string | null
  while (nextUrl && pageCount < 5) {
    const pageRes = await fetch(nextUrl, {
      headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
    })
    if (!pageRes.ok) break
    const pageJson = await pageRes.json()
    totalTxs += (pageJson.data ?? []).length
    pageCount++
    nextUrl = pageJson.links?.next ?? null
  }
  console.log(`\nTotal txs in first ${pageCount} pages: ${totalTxs}`)
  console.log(`More pages: ${!!nextUrl}`)
}

main().finally(() => db.$disconnect())
