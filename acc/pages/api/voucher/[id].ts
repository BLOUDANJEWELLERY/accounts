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
    // Fetch voucher data
    const voucher = await prisma.voucher.findUnique({
      where: { id },
      select: {
        id: true,
        accountId: true,
        voucherType: true,
        date: true,
        rows: true,
        totalNet: true,
        totalKWD: true,
      },
    });

    if (!voucher) {
      return res.status(404).json({ success: false, error: "Voucher not found" });
    }

    // Find customer where accountNo === voucher.accountId
    const customer = await prisma.customer.findFirst({
      where: { accountNo: voucher.accountId },
      select: {
        name: true,
        accountNo: true,
        phone: true,
        civilId: true,
      },
    });

    // Parse JSON rows if needed
    const rows =
      typeof voucher.rows === "string" ? JSON.parse(voucher.rows) : voucher.rows;

    return res.status(200).json({
      success: true,
      voucher: {
        ...voucher,
        rows,
        customer: customer || null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to fetch voucher" });
  }
}