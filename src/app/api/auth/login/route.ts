import { NextRequest } from "next/server"
import { POST as unlockPost } from "../unlock/route"

export async function POST(request: NextRequest) {
  return unlockPost(request)
}
