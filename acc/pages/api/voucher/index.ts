import { prisma } from "../../../server/prisma";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const vouchers = await prisma.voucher.findMany({
      orderBy: { date: "asc" }, // chronological to match your frontend logic
    });

    // Parse rows before sending to frontend
    const formatted = vouchers.map(v => ({
      ...v,
      rows: JSON.parse(v.rows),
    }));

    return res.status(200).json({ vouchers: formatted });
  } catch (err) {
    console.error("Error fetching vouchers:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
