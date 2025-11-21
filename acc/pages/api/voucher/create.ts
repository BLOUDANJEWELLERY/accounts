import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { accountId, voucherType, rows, totalNet, totalKWD, date } = req.body;

    const voucher = await prisma.voucher.create({
      data: {
        accountId,
        voucherType,
        date: new Date(date),
        rows: JSON.stringify(rows),
        totalNet,
        totalKWD,
      },
    });

    return res.json({ success: true, voucher });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
