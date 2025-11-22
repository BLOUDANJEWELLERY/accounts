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
        accountId: true,   // this is Customer.id
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

    // Fetch the customer using Voucher.accountId → Customer.id
    const customer = await prisma.customer.findUnique({
      where: { id: voucher.accountId },
      select: {
        name: true,
        accountNo: true,
        phone: true,
        civilId: true,
      },
    });

    // Parse rows if stored as JSON string
    const rows = typeof voucher.rows === "string" ? JSON.parse(voucher.rows) : voucher.rows;

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