/**
 * POST /api/backup/browse-dirs
 * Opens the native OS folder picker dialog and returns the selected path.
 */

import { NextRequest, NextResponse } from "next/server"
import { execFile } from "node:child_process"
import { resolve, sep } from "node:path"
import { homedir } from "node:os"
import { promisify } from "node:util"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"

const execFileAsync = promisify(execFile)

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("B5001", "Authentication required", 401)

  let defaultPath: string
  try {
    const body = await req.json()
    defaultPath = typeof body.defaultPath === "string" ? body.defaultPath : "~"
  } catch {
    defaultPath = "~"
  }

  const home = homedir()
  const expanded = defaultPath.replace(/^~/, home)
  const resolvedDefault = resolve(expanded)

  try {
    const script = `set theFolder to POSIX path of (choose folder with prompt "Select backup folder" default location POSIX file "${resolvedDefault}")`
    const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 120_000 })

    const selected = stdout.trim().replace(/\/$/, "")
    if (!selected) {
      return NextResponse.json({ cancelled: true })
    }

    // Security: must be within home directory
    const resolvedSelected = resolve(selected)
    if (!resolvedSelected.startsWith(home + sep) && resolvedSelected !== home) {
      return apiError("B5002", "Selected folder must be within your home directory", 403)
    }

    const displayPath = resolvedSelected.startsWith(home)
      ? "~" + resolvedSelected.slice(home.length)
      : resolvedSelected

    return NextResponse.json({ path: displayPath, cancelled: false })
  } catch (err: unknown) {
    // User pressed Cancel — osascript exits with code 1
    const code = (err as { code?: number }).code
    if (code === 1) {
      return NextResponse.json({ cancelled: true })
    }
    return apiError("B5005", "Failed to open folder picker", 500, err)
  }
}
