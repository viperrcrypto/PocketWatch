/**
 * POST /api/backup/browse-dirs
 * Two modes:
 *   1. { action: "resolve", marker: "<uuid>" } — find a .pwmarker file on disk to resolve the native picker's selected path
 *   2. { action: "validate", path: "~/..." } — validate/create a directory path
 */

import { NextRequest, NextResponse } from "next/server"
import { resolve, sep, join } from "node:path"
import { homedir } from "node:os"
import { mkdir, lstat, readdir, unlink } from "node:fs/promises"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"

function toDisplay(absPath: string, home: string): string {
  return absPath.startsWith(home) ? "~" + absPath.slice(home.length) : absPath
}

function checkHome(absPath: string, home: string): boolean {
  return absPath.startsWith(home + sep) || absPath === home
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("B5001", "Authentication required", 401)

  let body: { action?: string; marker?: string; path?: string; create?: boolean }
  try { body = await req.json() } catch { return apiError("B5003", "Invalid request body", 400) }

  const home = homedir()

  // Mode 1: Find marker file to resolve native picker path
  if (body.action === "resolve" && typeof body.marker === "string") {
    const markerName = `.pwmarker-${body.marker}`
    const found = await findMarker(home, markerName, 3)
    if (found) {
      await unlink(join(found, markerName)).catch(() => {})
      if (!checkHome(found, home)) return apiError("B5002", "Path must be within home directory", 403)
      return NextResponse.json({ path: toDisplay(found, home) })
    }
    return apiError("B5004", "Could not resolve selected folder. Try pasting the path manually.", 404)
  }

  // Mode 2: Validate / create path
  const rawPath = typeof body.path === "string" ? body.path : "~"
  const expanded = rawPath.replace(/^~/, home)
  const resolvedDir = resolve(expanded)

  if (!checkHome(resolvedDir, home)) return apiError("B5002", "Path must be within home directory", 403)

  if (body.create) {
    try {
      await mkdir(resolvedDir, { recursive: true })
      const stat = await lstat(resolvedDir)
      if (!stat.isDirectory() || stat.isSymbolicLink()) return apiError("B5006", "Invalid directory target", 400)
    } catch { return apiError("B5003", "Failed to create directory", 500) }
  }

  let exists = false
  try { const s = await lstat(resolvedDir); exists = s.isDirectory() && !s.isSymbolicLink() } catch {}

  return NextResponse.json({ path: toDisplay(resolvedDir, home), exists })
}

/** Recursively search for a marker file, limited depth to avoid scanning entire disk */
async function findMarker(dir: string, markerName: string, maxDepth: number): Promise<string | null> {
  if (maxDepth <= 0) return null
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name === markerName && !e.isDirectory()) return dir
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith(".")) {
        const found = await findMarker(join(dir, e.name), markerName, maxDepth - 1)
        if (found) return found
      }
    }
  } catch {}
  return null
}
