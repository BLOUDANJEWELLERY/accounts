// pages/voucher/signature/[id].tsx
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import * as SignatureCanvas from "react-signature-canvas";

interface VoucherRow {
  description: string;
  weight: number;
  purity?: number;
  makingCharges?: number;
  discountPercent?: number;
  netWeight: number;
  kwd: number;
}

interface Voucher {
  id: string;
  accountId: string;
  voucherType: "INV" | "REC";
  rows: VoucherRow[];
  totalNet: number;
  totalKWD: number;
}

export default function VoucherSignature() {
  const router = useRouter();
  const { id } = router.query;

  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Use SignatureCanvas.default to get the actual class instance
  const salesSignRef = useRef<SignatureCanvas.default | null>(null);
  const customerSignRef = useRef<SignatureCanvas.default | null>(null);

  // Fetch voucher data
 useEffect(() => {
  if (!id) return;

  const fetchVoucher = async () => {
    try {
      setLoading(true); // move inside async function
      const res = await fetch(`/api/voucher/${id}`);
      const data: { voucher: Voucher } = await res.json();
      setVoucher(data.voucher);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  fetchVoucher();
}, [id]);


  const handleClear = (who: "sales" | "customer") => {
    if (who === "sales") salesSignRef.current?.clear();
    else customerSignRef.current?.clear();
  };

  const getSignatureData = (ref: React.RefObject<SignatureCanvas.default | null>): string | null => {
    if (!ref.current) return null;
    if (ref.current.isEmpty()) return null;
    try {
      return ref.current.getTrimmedCanvas().toDataURL("image/png");
    } catch (err) {
      console.error("Error extracting signature:", err);
      return null;
    }
  };

  const handleSubmit = async () => {
    const salesSign = getSignatureData(salesSignRef);
    const customerSign = getSignatureData(customerSignRef);

    if (!salesSign || !customerSign) {
      alert("Both signatures are required!");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/voucher/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherId: id,
          salesSign,
          customerSign,
        }),
      });

      const data: { success: boolean; pdfUrl?: string; error?: string } = await res.json();
      setSaving(false);

      if (data.success) {
        setMsg("PDF generated and saved successfully!");
        if (data.pdfUrl) window.open(data.pdfUrl, "_blank");
      } else {
        setMsg("Error: " + data.error);
      }
    } catch (err) {
      console.error(err);
      setSaving(false);
      setMsg("Unexpected error occurred");
    }
  };

  if (loading) return <p>Loading voucher...</p>;
  if (!voucher) return <p>Voucher not found</p>;

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto" }}>
      <h1 className="text-2xl font-bold mb-4">Sign Voucher</h1>

      <h2 className="font-bold mb-2">Salesperson Signature</h2>
      <SignatureCanvas.default
        ref={salesSignRef}
        penColor="black"
        canvasProps={{ width: 500, height: 150, className: "border mb-2" }}
      />
      <button
        onClick={() => handleClear("sales")}
        className="bg-gray-500 text-white px-2 py-1 mb-4"
      >
        Clear
      </button>

      <h2 className="font-bold mb-2">Customer Signature</h2>
      <SignatureCanvas.default
        ref={customerSignRef}
        penColor="black"
        canvasProps={{ width: 500, height: 150, className: "border mb-2" }}
      />
      <button
        onClick={() => handleClear("customer")}
        className="bg-gray-500 text-white px-2 py-1 mb-4"
      >
        Clear
      </button>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="bg-black text-white px-4 py-2 mt-4"
      >
        {saving ? "Generating PDF..." : "Generate PDF"}
      </button>

      {msg && <p className="mt-4 text-blue-600">{msg}</p>}
    </div>
  );
}
