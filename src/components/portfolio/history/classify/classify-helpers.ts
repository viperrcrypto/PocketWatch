import { getChainMeta } from "@/lib/portfolio/chains"

// ─── Explorer URL helper ───

export function getExplorerUrl(chain: string | undefined, path: string): string | null {
  if (!chain) return null
  const meta = getChainMeta(chain)
  if (!meta?.explorerUrl) return null
  return `${meta.explorerUrl}/${path}`
}
