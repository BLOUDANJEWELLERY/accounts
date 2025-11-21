// server/prisma.ts
import { PrismaClient, type Prisma } from "@prisma/client";

// Ensure the URL exists
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable");
}

// Use correct config object — `datasources` instead of `datasourceUrl`
const prismaOptions: Prisma.PrismaClientOptions = {
  log: ["query"],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  global.prismaGlobal || new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}