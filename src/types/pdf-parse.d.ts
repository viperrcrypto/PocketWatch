declare module "pdf-parse" {
  interface PDFParseOptions {
    verbosity?: number
    [key: string]: unknown
  }

  class PDFParse {
    constructor(options: PDFParseOptions)
    load(data: Buffer | Uint8Array): Promise<void>
    getText(): Promise<string>
    getInfo(): Promise<Record<string, unknown>>
    destroy(): void
  }

  export { PDFParse }
}
