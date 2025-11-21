// server/prisma.ts
import { PrismaClient } from "@prisma/client";

// Extend Node.js global type
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Use existing global instance if it exists (hot reload safe)
export const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    log: ["query"],            // Optional: logs all queries
    datasourceUrl: process.env.DATABASE_URL, // Prisma 7 requires datasourceUrl here
  });

// Preserve Prisma instance during development to prevent multiple connections
if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
