// pages/api/voucher/finalize.ts
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
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Header
    page.drawText("VOUCHER", { x: 250, y: 770, size: 18, font: boldFont });
    page.drawText(`Voucher ID: ${voucherId}`, { x: 50, y: 740, size: 12, font });
    page.drawText(`Type: ${voucher.voucherType}`, { x: 50, y: 720, size: 12, font });
    page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 400, y: 740, size: 12, font });

    // Table Headers
    page.drawText("Description", { x: 50, y: 680, size: 10, font: boldFont });
    page.drawText("Weight", { x: 300, y: 680, size: 10, font: boldFont });
    page.drawText("Net Weight", { x: 370, y: 680, size: 10, font: boldFont });
    page.drawText("KWD", { x: 450, y: 680, size: 10, font: boldFont });

    // Rows
    let y = 650;
    rows.forEach((row, i) => {
      page.drawText(`${i + 1}. ${row.description}`, { x: 50, y, size: 9, font });
      page.drawText(row.weight.toString(), { x: 300, y, size: 9, font });
      page.drawText(row.netWeight.toString(), { x: 370, y, size: 9, font });
      page.drawText(row.kwd.toString(), { x: 450, y, size: 9, font });
      y -= 20;
    });

    // Totals
    page.drawText(`Total Net Weight: ${voucher.totalNet}`, { x: 50, y: y - 20, size: 12, font: boldFont });
    page.drawText(`Total KWD: ${voucher.totalKWD}`, { x: 300, y: y - 20, size: 12, font: boldFont });

    // Signatures Section
    page.drawText("Salesperson Signature:", { x: 50, y: 150, size: 10, font: boldFont });
    page.drawText("Customer Signature:", { x: 350, y: 150, size: 10, font: boldFont });

    // Add signature images
    try {
      const salesImage = await pdfDoc.embedPng(salesSign);
      const customerImage = await pdfDoc.embedPng(customerSign);
      page.drawImage(salesImage, { x: 50, y: 50, width: 200, height: 80 });
      page.drawImage(customerImage, { x: 350, y: 50, width: 200, height: 80 });
    } catch (signatureError) {
      console.warn("Error embedding signatures:", signatureError);
      page.drawText("Signatures not available", { x: 50, y: 80, size: 10, font });
    }

    const pdfBytes = await pdfDoc.save();

    // Convert to base64 for frontend preview
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    // Upload to Backblaze B2 in the background (don't await for response)
    let b2PdfUrl = null;
    try {
      await authorizeB2();
      const fileName = `voucher-${voucherId}.pdf`;
      
      const uploadUrlResponse = await b2.getUploadUrl({ 
        bucketId: process.env.B2_BUCKET_ID! 
      });
      
      await b2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName,
        data: Buffer.from(pdfBytes),
        info: { 
          "Content-Type": "application/pdf",
          "X-Bz-File-Name": fileName 
        },
      });

      const bucketName = process.env.B2_BUCKET_NAME || "Zamzam";
      b2PdfUrl = `https://f005.backblazeb2.com/file/${bucketName}/${fileName}`;

      // Save B2 URL in DB
      await prisma.voucher.update({ 
        where: { id: voucherId }, 
        data: { pdfUrl: b2PdfUrl } 
      });

      console.log("PDF uploaded to B2 successfully");
    } catch (b2Error) {
      console.error("B2 upload failed, but PDF was generated:", b2Error);
      // Continue even if B2 upload fails
    }

    return res.json({ 
      success: true, 
      pdfUrl: b2PdfUrl,
      pdfData: pdfBase64, // Send PDF data for immediate preview
      message: "PDF generated successfully" 
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return res.status(500).json({ 
      success: false, 
      error: "PDF generation failed",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
}