// pages/api/vouchers/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    console.log('Fetching all vouchers...');

    // Get all vouchers from the database
    const vouchers = await prisma.voucher.findMany({
      orderBy: {
        date: 'asc', // Sort by date ascending for chronological order
      },
    });

    console.log(`Found ${vouchers.length} vouchers`);

    // Transform the data to match the frontend interface
    const transformedVouchers = vouchers.map(voucher => ({
      id: voucher.id,
      voucherType: voucher.voucherType as "INV" | "REC",
      date: voucher.date.toISOString(),
      totalNet: voucher.totalNet,
      totalKWD: voucher.totalKWD,
      accountId: voucher.accountId,
      rows: voucher.rows,
      pdfUrl: voucher.pdfUrl || undefined,
      createdAt: voucher.createdAt.toISOString(),
    }));

    return res.status(200).json({
      success: true,
      vouchers: transformedVouchers,
      count: transformedVouchers.length,
    });

  } catch (error) {
    console.error('Error fetching vouchers:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    await prisma.$disconnect();
  }
}