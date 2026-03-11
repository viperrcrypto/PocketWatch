import { NextRequest } from "next/server"
import { POST as setupPost } from "../setup/route"

export async function POST(request: NextRequest) {
  return setupPost(request)
}
