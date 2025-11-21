import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";

interface VoucherRow {
  description: string;
  weight: number;
  purity?: number;
  makingCharges?: number;
  discountPercent?: number;
  netWeight: number;
  kwd: number;
}

interface VoucherBody {
  accountId: string;
  voucherType: "INV" | "REC";
  rows: VoucherRow[];
  totalNet: number;
  totalKWD: number;
  date: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { accountId, voucherType, rows, totalNet, totalKWD, date } = req.body as VoucherBody;

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
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
}
