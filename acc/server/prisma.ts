// server/prisma.ts
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// @ts-ignore: bug in Prisma v7 typings
export const prisma = global.prismaGlobal ?? new PrismaClient({
  log: ["query"],
  datasourceUrl: databaseUrl,
});

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
