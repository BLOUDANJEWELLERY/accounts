import B2 from "backblaze-b2";

export const b2 = new B2({
  applicationKeyId: process.env.B2_APP_KEY_ID!,
  applicationKey: process.env.B2_APP_KEY!,
});

export async function authorizeB2() {
  await b2.authorize();
}
