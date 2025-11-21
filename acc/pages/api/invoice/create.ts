// pages/api/invoice/create.ts
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { customerId, items, notes } = req.body;

    const invoice = await prisma.invoice.create({
      data: {
        customerId,
        items: JSON.stringify(items),
        notes,
      },
    });

    return res.json({ success: true, invoice });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
