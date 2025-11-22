// pages/api/vouchers/customer/[customerId].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../server/prisma";

interface VoucherRow {
  description: string;
  weight: number;
  purity?: number;
  makingCharges?: number;
  discountPercent?: number;
  netWeight: number;
  kwd: number;
  weightAfterDiscount?: number;
}

interface Voucher {
  id: string;
  voucherType: "INV" | "REC";
  date: string;
  totalNet: number;
  totalKWD: number;
  rows: string; // JSON string
  pdfUrl?: string | null;
}

interface VouchersResponse {
  vouchers: Voucher[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VouchersResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ vouchers: [], error: "Method not allowed" });
  }

  try {
    const { customerId } = req.query;

    if (!customerId || typeof customerId !== "string") {
      return res.status(400).json({ vouchers: [], error: "Customer ID is required" });
    }

    // First verify the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ vouchers: [], error: "Customer not found" });
    }

    // Fetch all vouchers for this customer
    const vouchers = await prisma.voucher.findMany({
      where: {
        accountId: customerId,
      },
      select: {
        id: true,
        voucherType: true,
        date: true,
        totalNet: true,
        totalKWD: true,
        rows: true,
        pdfUrl: true,
      },
      orderBy: {
        date: "asc", // Sort by date ascending for chronological order
      },
    });

    // Convert the rows from JSON string to proper type
    const formattedVouchers: Voucher[] = vouchers.map(voucher => ({
      ...voucher,
      voucherType: voucher.voucherType as "INV" | "REC",
      date: voucher.date.toISOString(),
    }));

    return res.status(200).json({ vouchers: formattedVouchers });
  } catch (error: unknown) {
    console.error("Error fetching vouchers:", error);
    return res.status(500).json({
      vouchers: [],
      error: "Internal server error",
    });
  }
}