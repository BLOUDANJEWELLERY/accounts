import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";

interface CustomerResponse {
  customers: {
    id: string;
    accountNo: string;
    name: string;
    phone: string;
    civilId: string;
  }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CustomerResponse | { error: string }>) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const customers = await prisma.customer.findMany({
      select: { id: true, accountNo: true, name: true, phone: true, civilId: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ customers });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
}
