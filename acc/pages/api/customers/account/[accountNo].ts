import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accountNo } = req.query;

  if (req.method === 'GET') {
    try {
      // First get the customer to verify they exist
      const customer = await prisma.customer.findUnique({
        where: {
          accountNo: accountNo as string,
        },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Then fetch vouchers for this customer using accountId
      const vouchers = await prisma.voucher.findMany({
        where: {
          accountId: customer.id, // Using customer ID as accountId in Voucher model
        },
        orderBy: {
          date: 'asc',
        },
      });

      res.status(200).json({ vouchers });
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      res.status(500).json({ error: 'Failed to fetch vouchers' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}