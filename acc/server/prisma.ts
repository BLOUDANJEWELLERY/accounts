// server/prisma.ts
import { PrismaClient } from "@prisma/client";

// Ensure DATABASE_URL exists
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable");
}

// Hot-reload safe Prisma client
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    log: ["query"],
    datasourceUrl: databaseUrl, // TypeScript now knows this is string
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
