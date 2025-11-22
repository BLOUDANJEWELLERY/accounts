// pages/api/customers/account/[accountNo].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../server/prisma";

interface CustomerResponse {
  customer: {
    id: string;
    accountNo: string;
    name: string;
    phone: string;
    civilId: string;
  } | null;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CustomerResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ customer: null, error: "Method not allowed" });
  }

  try {
    const { accountNo } = req.query;

    if (!accountNo || typeof accountNo !== "string") {
      return res.status(400).json({ customer: null, error: "Account number is required" });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        accountNo: accountNo,
      },
      select: {
        id: true,
        accountNo: true,
        name: true,
        phone: true,
        civilId: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ customer: null, error: "Customer not found" });
    }

    return res.status(200).json({ customer });
  } catch (error: unknown) {
    console.error("Error fetching customer:", error);
    return res.status(500).json({
      customer: null,
      error: "Internal server error",
    });
  }
}