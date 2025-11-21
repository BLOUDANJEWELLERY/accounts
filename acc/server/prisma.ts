// server/prisma.ts
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable");
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    log: ["query"],
    datasourceUrl: databaseUrl, // correct override
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
