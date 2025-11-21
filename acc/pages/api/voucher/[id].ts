import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!id || typeof id !== "string") {
    return res.status(400).json({ success: false, error: "Invalid voucher ID" });
  }

  try {
    const voucher = await prisma.voucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      return res.status(404).json({ success: false, error: "Voucher not found" });
    }

    // Parse rows JSON if stored as string
    const rows = typeof voucher.rows === "string" ? JSON.parse(voucher.rows) : voucher.rows;

    return res.status(200).json({
      success: true,
      voucher: {
        id: voucher.id,
        accountId: voucher.accountId,
        voucherType: voucher.voucherType,
        rows,
        totalNet: voucher.totalNet,
        totalKWD: voucher.totalKWD,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to fetch voucher" });
  }
}