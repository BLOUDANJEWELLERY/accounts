import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { accountNo } = req.query;

  if (req.method === 'GET') {
    try {
      const customer = await prisma.customer.findUnique({
        where: {
          accountNo: accountNo as string,
        },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.status(200).json({ customer });
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ error: 'Failed to fetch customer' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}