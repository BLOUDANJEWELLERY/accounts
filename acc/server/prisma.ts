import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,   // override the URL here
  log: ["query"],
});
