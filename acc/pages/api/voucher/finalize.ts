import { b2, authorizeB2 } from "../../../server/b2";

// After generating PDF bytes
await authorizeB2();

const fileName = `voucher-${voucherId}.pdf`;

// Get upload URL
const uploadUrlResponse = await b2.getUploadUrl({
  bucketId: process.env.B2_BUCKET_ID!, // your bucket id
});

const uploadResponse = await b2.uploadFile({
  uploadUrl: uploadUrlResponse.data.uploadUrl,
  uploadAuthToken: uploadUrlResponse.data.authorizationToken,
  fileName,
  data: Buffer.from(pdfBytes),
  info: { "Content-Type": "application/pdf" },
});

const pdfUrl = `https://f000.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

// Save PDF URL in DB
await prisma.voucher.update({ where: { id: voucherId }, data: { pdfUrl } });
