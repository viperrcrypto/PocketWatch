import { db } from "@/lib/db"

export async function getHiddenTokenSymbols(userId: string): Promise<Set<string>> {
  const row = await db.portfolioSetting.findUnique({
    where: { userId },
    select: { settings: true },
  })
  const settings = (row?.settings as Record<string, unknown>) ?? {}
  const list = Array.isArray(settings.hiddenTokens) ? settings.hiddenTokens : []
  return new Set(list.filter((s): s is string => typeof s === "string"))
}

export async function setHiddenTokens(userId: string, symbols: string[]): Promise<void> {
  const existing = await db.portfolioSetting.findUnique({
    where: { userId },
    select: { settings: true },
  })
  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
  const merged = { ...currentSettings, hiddenTokens: symbols }

  await db.portfolioSetting.upsert({
    where: { userId },
    create: { userId, currency: "USD", settings: merged },
    update: { settings: merged },
  })
}
