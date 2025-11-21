// pages/api/customers/create.ts
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { accountNo, name, phone, civilId } = req.body;

    const customer = await prisma.customer.create({
      data: {
        accountNo,
        name,
        phone,
        civilId,
      },
    });

    return res.json({ success: true, customer });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
