import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import {
  ENCRYPTED_FIELDS,
  encryptField,
  decryptField,
  serializeField,
  deserializeField,
  isEncryptionConfigured,
} from "./encryption-fields"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured. Set DATABASE_URL before starting PocketWatch."
  )
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
})

// Operations that write data to the database
const WRITE_OPS = new Set([
  "create",
  "update",
  "upsert",
  "createMany",
  "createManyAndReturn",
  "updateMany",
])

// Operations that read data from the database
const READ_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "create",
  "update",
  "upsert",
  "createManyAndReturn",
])

function getModelName(model: string | undefined): string | undefined {
  if (!model) return undefined
  // Prisma passes model names in PascalCase already
  return model
}

async function processWriteData(
  data: Record<string, unknown>,
  fields: Record<string, string>,
  shouldEncrypt: boolean
): Promise<Record<string, unknown>> {
  const result = { ...data }
  for (const [field, type] of Object.entries(fields)) {
    if (field in result && result[field] !== undefined) {
      if (shouldEncrypt) {
        result[field] = await encryptField(result[field])
      } else {
        result[field] = serializeField(result[field], type as "string" | "json")
      }
    }
  }
  return result
}

async function processReadRecord(
  record: Record<string, unknown>,
  fields: Record<string, string>,
  shouldDecrypt: boolean
): Promise<Record<string, unknown>> {
  const result = { ...record }
  for (const [field, type] of Object.entries(fields)) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      if (shouldDecrypt) {
        result[field] = await decryptField(
          result[field] as string,
          type as "string" | "json"
        )
      } else {
        result[field] = deserializeField(result[field], type as "string" | "json")
      }
    }
  }
  return result
}

async function processReadResults(
  results: unknown,
  fields: Record<string, string>,
  shouldDecrypt: boolean
): Promise<unknown> {
  if (results === null || results === undefined) return results
  if (Array.isArray(results)) {
    return Promise.all(
      results.map((r) =>
        processReadRecord(r as Record<string, unknown>, fields, shouldDecrypt)
      )
    )
  }
  if (typeof results === "object") {
    return processReadRecord(
      results as Record<string, unknown>,
      fields,
      shouldDecrypt
    )
  }
  return results
}

function createEncryptedClient(): PrismaClient {
  const base = new PrismaClient({ adapter })

  const encryptionEnabled = isEncryptionConfigured()

  const extended = base.$extends({
    query: {
      $allOperations: async ({ model, operation, args, query }) => {
        const modelName = getModelName(model)
        const fields = modelName ? ENCRYPTED_FIELDS[modelName] : undefined

        if (!fields) {
          return query(args)
        }

        // Serialize (and optionally encrypt) on write
        if (WRITE_OPS.has(operation) && args.data) {
          if (Array.isArray(args.data)) {
            args.data = await Promise.all(
              args.data.map((d: Record<string, unknown>) =>
                processWriteData(d, fields, encryptionEnabled)
              )
            )
          } else {
            args.data = await processWriteData(
              args.data as Record<string, unknown>,
              fields,
              encryptionEnabled
            )
          }
        }

        // Handle upsert's create/update separately (they don't use args.data)
        if (operation === "upsert") {
          if (args.create) {
            args.create = await processWriteData(
              args.create as Record<string, unknown>,
              fields,
              encryptionEnabled
            )
          }
          if (args.update) {
            args.update = await processWriteData(
              args.update as Record<string, unknown>,
              fields,
              encryptionEnabled
            )
          }
        }

        const result = await query(args)

        // Deserialize (and optionally decrypt) on read
        if (READ_OPS.has(operation) && result) {
          return processReadResults(result, fields, encryptionEnabled)
        }

        return result
      },
    },
  })

  // The extension preserves PrismaClient's runtime behavior; cast to
  // keep the original generated types (encrypted String fields stay
  // typed as String, which matches the schema).
  return extended as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createEncryptedClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
