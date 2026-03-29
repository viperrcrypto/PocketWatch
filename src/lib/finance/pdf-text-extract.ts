/**
 * Server-side PDF text extraction using pdfjs-dist directly.
 * Bypasses pdf-parse wrapper which has worker issues in Next.js Turbopack.
 */

import { join } from "path"

/* eslint-disable @typescript-eslint/no-explicit-any */

let workerConfigured = false

export async function extractTextFromPDF(data: Uint8Array): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs")

  // Configure worker once — point to the actual file on disk
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = join(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    )
    workerConfigured = true
  }

  const doc = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => item.str ?? "")
      .join(" ")
    pages.push(pageText)
  }

  doc.destroy()
  return pages.join("\n")
}
