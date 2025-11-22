import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../server/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accountNo } = req.query;

  if (typeof accountNo !== "string") {
    return res.status(400).json({ error: "Invalid account number" });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { accountNo },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json({ customer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}



import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";

interface CustomerBody {
  accountNo: string;
  name: string;
  phone: string;
  civilId: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { accountNo, name, phone, civilId } = req.body as CustomerBody;

    const customer = await prisma.customer.create({
      data: { accountNo, name, phone, civilId },
    });

    return res.json({ success: true, customer });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
}
