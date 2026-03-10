// Test environment setup — imported before modules that need DATABASE_URL.
// No actual DB connection is made; this just prevents the Prisma init guard from throwing.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
}
