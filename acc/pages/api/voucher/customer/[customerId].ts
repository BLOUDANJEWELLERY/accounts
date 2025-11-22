import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma"; // adjust path

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { customerId } = req.query;

  if (typeof customerId !== "string") {
    return res.status(400).json({ error: "Invalid customer ID" });
  }

  try {
    const vouchers = await prisma.voucher.findMany({
      where: { accountId: customerId },
      orderBy: { date: "asc" },
    });

    res.status(200).json({ vouchers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}