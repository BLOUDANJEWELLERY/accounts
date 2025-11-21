import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { b2, authorizeB2 } from "../../../server/b2";

interface VoucherRow {
  description: string;
  weight: number;
  purity?: number;
  makingCharges?: number;
  discountPercent?: number;
  netWeight: number;
  kwd: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { voucherId, salesSign, customerSign } = req.body as {
      voucherId: string;
      salesSign: string;
      customerSign: string;
    };

    const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
    if (!voucher) return res.status(404).json({ success: false, error: "Voucher not found" });

    const rows: VoucherRow[] = JSON.parse(voucher.rows);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText(`Voucher ID: ${voucherId}`, { x: 50, y: 750, size: 14, font });
    page.drawText(`Type: ${voucher.voucherType}`, { x: 50, y: 730, size: 12, font });

    let y = 700;
    rows.forEach((r, i) => {
      page.drawText(
        `${i + 1}. ${r.description} | Weight: ${r.weight} | Net: ${r.netWeight} | KWD: ${r.kwd}`,
        { x: 50, y, size: 10, font }
      );
      y -= 20;
    });

    page.drawText(`Total Net: ${voucher.totalNet}`, { x: 50, y: y - 10, size: 12, font });
    page.drawText(`Total KWD: ${voucher.totalKWD}`, { x: 200, y: y - 10, size: 12, font });

    // Add signatures
    const salesImage = await pdfDoc.embedPng(salesSign);
    const customerImage = await pdfDoc.embedPng(customerSign);
    page.drawImage(salesImage, { x: 50, y: 50, width: 200, height: 80 });
    page.drawImage(customerImage, { x: 350, y: 50, width: 200, height: 80 });

    const pdfBytes = await pdfDoc.save();

    // Upload to Backblaze B2
    await authorizeB2();
    const fileName = `voucher-${voucherId}.pdf`;
    const uploadUrlResponse = await b2.getUploadUrl({ bucketId: process.env.B2_BUCKET_ID! });
    await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName,
      data: Buffer.from(pdfBytes),
      info: { "Content-Type": "application/pdf" },
    });

    const pdfUrl = `https://f000.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

    // Save PDF URL in DB
    await prisma.voucher.update({ where: { id: voucherId }, data: { pdfUrl } });

    return res.json({ success: true, pdfUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "PDF generation failed" });
  }
}
