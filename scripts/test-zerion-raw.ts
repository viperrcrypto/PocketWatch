import "dotenv/config"
import { db } from "@/lib/db"
import { getServiceKeys } from "@/lib/portfolio/service-keys"

async function main() {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) return

  const keys = await getServiceKeys(user.id, "zerion")
  const apiKey = keys[0].key

  const wallet = await db.trackedWallet.findFirst({
    where: { address: { startsWith: "0x" } },
    select: { address: true },
  })
  if (!wallet) return

  const addr = wallet.address.toLowerCase()
  const token = Buffer.from(`${apiKey}:`).toString("base64")
  const url = `https://api.zerion.io/v1/wallets/${addr}/transactions/?page[size]=3&currency=usd`

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
  })

  const json = await res.json()
  const tx = json.data?.[1]  // skip NFT, look at a token tx

  console.log("=== Full transaction JSON (2nd tx) ===")
  console.log(JSON.stringify(tx, null, 2).slice(0, 3000))

  // Look for chain_id in various locations
  console.log("\n=== Chain ID search ===")
  console.log("attributes.chain_id:", tx?.attributes?.chain_id)
  console.log("relationships.chain:", JSON.stringify(tx?.relationships?.chain))
  console.log("Top-level chain:", tx?.chain)
  console.log("Top-level type:", tx?.type)

  // Check all top-level keys
  console.log("\n=== Top-level keys ===", Object.keys(tx ?? {}))
  console.log("=== attributes keys ===", Object.keys(tx?.attributes ?? {}))
}

main().finally(() => db.$disconnect())
