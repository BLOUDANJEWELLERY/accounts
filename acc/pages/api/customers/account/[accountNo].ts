import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma"; // adjust path to your prisma instance

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accountNo } = req.query;

  if (typeof accountNo !== "string") {
    return res.status(400).json({ error: "Invalid account number" });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { accountNo },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json({ customer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}