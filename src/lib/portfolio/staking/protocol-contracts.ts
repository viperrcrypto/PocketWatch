/**
 * Known contract addresses per protocol per chain.
 * Used to match transactions by from/to address against protocol contracts,
 * not just by symbol — catches cases where Alchemy assigns unexpected symbols.
 */

export const PROTOCOL_CONTRACTS: Record<string, Record<string, string[]>> = {
  "ether.fi": {
    ETHEREUM: [
      "0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee", // weETH
      "0x35fa164735182de50811e8e2e824cfb9b6118ac2", // eETH
      "0x308861a430be4cce5502d0a12724771fc6daf216", // eETH Liquidity Pool
      "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", // wstETH (shared)
    ],
    ARBITRUM: [
      "0x35751007a407ca6feffe80b3cb397736d2cf4dbe", // weETH (Arbitrum)
    ],
    BASE: [
      "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a", // weETH (Base)
    ],
  },
  "aave-v3": {
    ETHEREUM: [
      "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", // Pool
      "0xa238dd80c259a72e81d7e4664a9801593f98d1c5", // Pool (V3.1)
    ],
    ARBITRUM: [
      "0x794a61358d6845594f94dc1db02a252b5b4814ad", // Pool
    ],
    BASE: [
      "0xa238dd80c259a72e81d7e4664a9801593f98d1c5", // Pool
    ],
    POLYGON: [
      "0x794a61358d6845594f94dc1db02a252b5b4814ad", // Pool
    ],
    OPTIMISM: [
      "0x794a61358d6845594f94dc1db02a252b5b4814ad", // Pool
    ],
    AVALANCHE: [
      "0x794a61358d6845594f94dc1db02a252b5b4814ad", // Pool
    ],
  },
  pendle: {
    ETHEREUM: [
      "0x888888888889758f76e7103c6cbf23abbf58f946", // Router v4
      "0x00000000005bbb0ef59571e58418f9a4357b68a0", // Router v3
    ],
    ARBITRUM: [
      "0x888888888889758f76e7103c6cbf23abbf58f946", // Router v4
      "0x00000000005bbb0ef59571e58418f9a4357b68a0", // Router v3
    ],
  },
  ethena: {
    ETHEREUM: [
      "0x9d39a5de30e57443bff2a8307a4256c8797a3497", // sUSDe staking
      "0x4c9edd5852cd905f086c759e8383e09bff1e68b3", // USDe token
    ],
  },
  "maker-dsr": {
    ETHEREUM: [
      "0x83f20f44975d03b1b09e64809b757c47f942beea", // sDAI
      "0x373238337bfe1146fb49989fc222523799886a86", // sUSDai
    ],
  },
  "rocket-pool": {
    ETHEREUM: [
      "0xae78736cd615f374d3085123a210448e74fc6393", // rETH
      "0xdd9683530f8debc82c42e51ed3f413e1ce079fb4", // rETH deposit pool
    ],
  },
  "coinbase-wrapped-staked-eth": {
    ETHEREUM: [
      "0xbe9895146f7af43049ca1c1ae358b0541ea49704", // cbETH
    ],
    BASE: [
      "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22", // cbETH (Base)
    ],
  },
  "open-cash": {
    ETHEREUM: [
      "0x2e60e0a42e49e3e0f4caa27ffb9e2e7f6c2c9e6b", // cUSDO
    ],
  },
}

/**
 * Look up known contract addresses for a protocol on a specific chain.
 * Returns lowercase addresses or an empty array.
 */
export function getProtocolContracts(protocol: string | null, chain: string): string[] {
  if (!protocol) return []
  // Normalize protocol slug to match our keys
  const key = protocol.toLowerCase().replace(/\s+/g, "-")

  // Try exact match first
  const byProtocol = PROTOCOL_CONTRACTS[key]
  if (byProtocol) return byProtocol[chain] ?? []

  // Try partial match (e.g., "EtherFi" → "ether.fi")
  for (const [k, v] of Object.entries(PROTOCOL_CONTRACTS)) {
    if (key.includes(k.replace(/[.-]/g, "")) || k.replace(/[.-]/g, "").includes(key.replace(/[.-]/g, ""))) {
      return v[chain] ?? []
    }
  }
  return []
}

/**
 * Check if an address is a known protocol contract on the given chain.
 */
export function isKnownProtocolContract(address: string, chain: string): string | null {
  const normalized = address.toLowerCase()
  for (const [protocol, chains] of Object.entries(PROTOCOL_CONTRACTS)) {
    const addrs = chains[chain]
    if (addrs?.includes(normalized)) return protocol
  }
  return null
}
