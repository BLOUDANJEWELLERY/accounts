// pages/api/voucher/finalize.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../server/prisma";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { b2, authorizeB2 } from "../../../server/b2";

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

interface Customer {
  id: string;
  name: string;
  accountNo: string;
  phone: string;
  civilId: string;
}

interface VoucherData {
  id: string;
  accountId: string;
  voucherType: "INV" | "REC";
  rows: VoucherRow[];
  totalNet: number;
  totalKWD: number;
  date: string;
  customer: Customer;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { voucherId, salesSign, customerSign } = req.body as {
      voucherId: string;
      salesSign: string;
      customerSign: string;
    };

    // Fetch voucher data
    const voucher = await prisma.voucher.findUnique({ 
      where: { id: voucherId }
    });
    
    if (!voucher) return res.status(404).json({ success: false, error: "Voucher not found" });

    // Fetch customer data separately since there's no relation in schema
    const customer = await prisma.customer.findUnique({
      where: { id: voucher.accountId }
    });

    if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

    const rows: VoucherRow[] = JSON.parse(voucher.rows);

    // Create PDF with A4 size
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    const { width, height } = page.getSize();

    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const primaryColor = rgb(79 / 255, 70 / 255, 229 / 255); // Indigo-600
    const secondaryColor = rgb(124 / 255, 58 / 255, 237 / 255); // Purple-600
    const successColor = rgb(22 / 255, 163 / 255, 74 / 255); // Green-600
    const grayColor = rgb(107 / 255, 114 / 255, 128 / 255); // Gray-500
    const lightGrayColor = rgb(243 / 255, 244 / 255, 246 / 255); // Gray-100
    const borderColor = rgb(209 / 255, 213 / 255, 219 / 255); // Gray-300

    // Draw background gradient (subtle)
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: rgb(239 / 255, 246 / 255, 255 / 255), // Light blue background
      opacity: 0.3,
    });

    // Header Section
    // Company Info
    page.drawText("GOLDEN JEWELERS", {
      x: 50,
      y: height - 60,
      size: 20,
      font: titleFont,
      color: primaryColor,
    });

    page.drawText("123 Jewelry Street", {
      x: 50,
      y: height - 85,
      size: 10,
      font: font,
      color: grayColor,
    });

    page.drawText("Kuwait City, Kuwait", {
      x: 50,
      y: height - 100,
      size: 10,
      font: font,
      color: grayColor,
    });

    page.drawText("Tel: +965 1234 5678", {
      x: 50,
      y: height - 115,
      size: 10,
      font: font,
      color: grayColor,
    });

    // Voucher Number and Date
    const voucherNumber = `Voucher No: ${voucher.id.slice(-8).toUpperCase()}`;
    const voucherNumberWidth = boldFont.widthOfTextAtSize(voucherNumber, 14);
    page.drawText(voucherNumber, {
      x: width - 50 - voucherNumberWidth,
      y: height - 60,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });

    const voucherDate = `Date: ${new Date(voucher.date).toLocaleDateString()}`;
    const voucherDateWidth = font.widthOfTextAtSize(voucherDate, 10);
    page.drawText(voucherDate, {
      x: width - 50 - voucherDateWidth,
      y: height - 80,
      size: 10,
      font: font,
      color: grayColor,
    });

    // Voucher Type Badge
    const voucherTypeText = voucher.voucherType === "INV" ? "INVOICE" : "RECEIPT";
    const voucherTypeWidth = titleFont.widthOfTextAtSize(voucherTypeText, 24);
    page.drawText(voucherTypeText, {
      x: (width - voucherTypeWidth) / 2,
      y: height - 150,
      size: 24,
      font: titleFont,
      color: primaryColor,
    });

    // Customer Information Section
    let currentY = height - 200;

    // Section Title
    page.drawText("Customer Information", {
      x: 50,
      y: currentY,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });

    currentY -= 25;

    // Customer Details
    page.drawText(`Name: ${customer.name}`, {
      x: 50,
      y: currentY,
      size: 10,
      font: font,
      color: grayColor,
    });

    page.drawText(`Account No: ${customer.accountNo}`, {
      x: 250,
      y: currentY,
      size: 10,
      font: font,
      color: grayColor,
    });

    currentY -= 15;

    page.drawText(`Civil ID: ${customer.civilId}`, {
      x: 50,
      y: currentY,
      size: 10,
      font: font,
      color: grayColor,
    });

    page.drawText(`Phone: ${customer.phone}`, {
      x: 250,
      y: currentY,
      size: 10,
      font: font,
      color: grayColor,
    });

    currentY -= 40;

    // Items Table Section
    page.drawText("Items", {
      x: 50,
      y: currentY,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });

    currentY -= 30;

    // Table Headers
    const tableTop = currentY;
    const colWidths = voucher.voucherType === "INV" 
      ? [180, 60, 50, 70, 60, 70] // INV columns
      : [150, 50, 50, 50, 70, 60, 70]; // REC columns

    let xPosition = 50;
    
    // Draw table header background
    page.drawRectangle({
      x: xPosition,
      y: tableTop - 20,
      width: width - 100,
      height: 25,
      color: lightGrayColor,
    });

    // Table Headers for INV
    if (voucher.voucherType === "INV") {
      const invHeaders = ["Description", "Weight", "Purity", "Making Charges", "KWD", "Net Weight"];
      invHeaders.forEach((header, index) => {
        page.drawText(header, {
          x: xPosition + 5,
          y: tableTop - 5,
          size: 9,
          font: boldFont,
          color: grayColor,
        });
        xPosition += colWidths[index];
      });
    } else {
      // Table Headers for REC
      const recHeaders = ["Description", "Weight", "Discount %", "Purity", "Weight After Disc.", "KWD", "Net Weight"];
      recHeaders.forEach((header, index) => {
        page.drawText(header, {
          x: xPosition + 5,
          y: tableTop - 5,
          size: 9,
          font: boldFont,
          color: grayColor,
        });
        xPosition += colWidths[index];
      });
    }

    // Draw header border
    page.drawRectangle({
      x: 50,
      y: tableTop - 20,
      width: width - 100,
      height: 25,
      borderColor: borderColor,
      borderWidth: 1,
    });

    // Table Rows
    currentY = tableTop - 45;
    rows.forEach((row, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 50,
          y: currentY - 5,
          width: width - 100,
          height: 20,
          color: rgb(249 / 255, 250 / 255, 251 / 255), // Very light gray
        });
      }

      xPosition = 50;

      if (voucher.voucherType === "INV") {
        // INV Row Data
        const invData = [
          row.description,
          row.weight.toFixed(3),
          row.purity?.toString() || "N/A",
          row.makingCharges?.toFixed(2) || "0.00",
          row.kwd.toFixed(3),
          row.netWeight.toFixed(3)
        ];

        invData.forEach((data, colIndex) => {
          page.drawText(data, {
            x: xPosition + 5,
            y: currentY,
            size: 8,
            font: font,
            color: rgb(0, 0, 0),
          });
          xPosition += colWidths[colIndex];
        });
      } else {
        // REC Row Data
        const recData = [
          row.description,
          row.weight.toFixed(3),
          row.discountPercent ? `${row.discountPercent.toFixed(1)}%` : "0.0%",
          row.purity?.toString() || "N/A",
          row.weightAfterDiscount?.toFixed(3) || "0.000",
          row.kwd.toFixed(3),
          row.netWeight.toFixed(3)
        ];

        recData.forEach((data, colIndex) => {
          page.drawText(data, {
            x: xPosition + 5,
            y: currentY,
            size: 8,
            font: font,
            color: rgb(0, 0, 0),
          });
          xPosition += colWidths[colIndex];
        });
      }

      // Draw row border
      page.drawRectangle({
        x: 50,
        y: currentY - 5,
        width: width - 100,
        height: 20,
        borderColor: borderColor,
        borderWidth: 0.5,
      });

      currentY -= 25;
    });

    // Totals Section
    const totalsTop = currentY - 30;

    // Calculate total weight after discount for REC
    const totalWeightAfterDiscount = rows.reduce((acc, r) => acc + (r.weightAfterDiscount || 0), 0);

    // Totals Background
    page.drawRectangle({
      x: 50,
      y: totalsTop - 40,
      width: width - 100,
      height: 60,
      color: rgb(238 / 255, 242 / 255, 255 / 255), // Indigo-50
      borderColor: primaryColor,
      borderWidth: 1,
    });

    if (voucher.voucherType === "INV") {
      // INV Totals
      const totalNetText = `Total Net Weight: ${voucher.totalNet.toFixed(3)}`;
      const totalKWDText = `Total KWD: ${voucher.totalKWD.toFixed(3)}`;

      page.drawText(totalNetText, {
        x: (width - boldFont.widthOfTextAtSize(totalNetText, 16)) / 2,
        y: totalsTop - 10,
        size: 16,
        font: boldFont,
        color: primaryColor,
      });

      page.drawText(totalKWDText, {
        x: (width - boldFont.widthOfTextAtSize(totalKWDText, 16)) / 2,
        y: totalsTop - 35,
        size: 16,
        font: boldFont,
        color: successColor,
      });
    } else {
      // REC Totals - Three columns
      const col1Text = `Total Weight After Discount: ${totalWeightAfterDiscount.toFixed(3)}`;
      const col2Text = `Total Net Weight: ${voucher.totalNet.toFixed(3)}`;
      const col3Text = `Total KWD: ${voucher.totalKWD.toFixed(3)}`;

      page.drawText(col1Text, {
        x: 80,
        y: totalsTop - 10,
        size: 12,
        font: boldFont,
        color: primaryColor,
      });

      page.drawText(col2Text, {
        x: (width - boldFont.widthOfTextAtSize(col2Text, 12)) / 2,
        y: totalsTop - 10,
        size: 12,
        font: boldFont,
        color: secondaryColor,
      });

      page.drawText(col3Text, {
        x: width - 80 - boldFont.widthOfTextAtSize(col3Text, 12),
        y: totalsTop - 10,
        size: 12,
        font: boldFont,
        color: successColor,
      });
    }

    // Signatures Section
    const signaturesTop = totalsTop - 100;

    page.drawText("Signatures", {
      x: 50,
      y: signaturesTop,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });

    // Signature boxes
    const signatureBoxHeight = 80;
    const signatureBoxWidth = 200;

    // Salesperson Signature
    page.drawRectangle({
      x: 50,
      y: signaturesTop - 100,
      width: signatureBoxWidth,
      height: signatureBoxHeight,
      borderColor: borderColor,
      borderWidth: 1,
    });

    page.drawText("Salesperson Signature", {
      x: 50,
      y: signaturesTop - 30,
      size: 10,
      font: boldFont,
      color: grayColor,
    });

    // Customer Signature
    page.drawRectangle({
      x: width - 50 - signatureBoxWidth,
      y: signaturesTop - 100,
      width: signatureBoxWidth,
      height: signatureBoxHeight,
      borderColor: borderColor,
      borderWidth: 1,
    });

    page.drawText("Customer Signature", {
      x: width - 50 - signatureBoxWidth,
      y: signaturesTop - 30,
      size: 10,
      font: boldFont,
      color: grayColor,
    });

    // Add signature images
    try {
      if (salesSign) {
        const salesImage = await pdfDoc.embedPng(salesSign);
        page.drawImage(salesImage, {
          x: 60,
          y: signaturesTop - 90,
          width: 180,
          height: 60,
        });
      }

      if (customerSign) {
        const customerImage = await pdfDoc.embedPng(customerSign);
        page.drawImage(customerImage, {
          x: width - 50 - signatureBoxWidth + 10,
          y: signaturesTop - 90,
          width: 180,
          height: 60,
        });
      }
    } catch (signatureError) {
      console.warn("Error embedding signatures:", signatureError);
      // If signatures fail to embed, show placeholder text
      page.drawText("Signature Not Available", {
        x: 100,
        y: signaturesTop - 60,
        size: 8,
        font: font,
        color: grayColor,
      });

      page.drawText("Signature Not Available", {
        x: width - 50 - signatureBoxWidth + 60,
        y: signaturesTop - 60,
        size: 8,
        font: font,
        color: grayColor,
      });
    }

    // Footer
    const footerText = "Thank you for your business!";
    page.drawText(footerText, {
      x: (width - font.widthOfTextAtSize(footerText, 10)) / 2,
      y: 30,
      size: 10,
      font: font,
      color: grayColor,
    });

    const pageNumber = `Page 1 of 1`;
    page.drawText(pageNumber, {
      x: width - 50 - font.widthOfTextAtSize(pageNumber, 8),
      y: 20,
      size: 8,
      font: font,
      color: grayColor,
    });

    const pdfBytes = await pdfDoc.save();

    // Convert to base64 for frontend preview
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    // Upload to Backblaze B2 in the background
    let b2PdfUrl = null;
    try {
      await authorizeB2();
      const fileName = `voucher-${voucher.id.slice(-8)}.pdf`;
      
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