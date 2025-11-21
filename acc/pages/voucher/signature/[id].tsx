// pages/voucher/signature/[id].tsx
import { useState, useRef, useEffect, MutableRefObject } from "react";
import { useRouter } from "next/router";
import SignatureCanvas from "react-signature-canvas";

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
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");

  // Safe refs to SignatureCanvas
  const salesSignRef = useRef<SignatureCanvas | null>(null);
  const customerSignRef = useRef<SignatureCanvas | null>(null);

  // Fetch voucher data
  useEffect(() => {
    if (!id) return;

    const fetchVoucher = async () => {
      try {
        const res = await fetch(`/api/voucher/${id}`);
        const data: { voucher: Voucher } = await res.json();
        setVoucher(data.voucher);
      } catch (err) {
        console.error(err);
        setMsg("Failed to fetch voucher.");
      } finally {
        setLoading(false);
      }
    };

    fetchVoucher();
  }, [id]);

  // Clear signature canvas
  const handleClear = (who: "sales" | "customer") => {
    if (who === "sales") salesSignRef.current?.clear();
    else customerSignRef.current?.clear();
  };

  // Safely get signature data URL

// Safe function to get canvas data
const getSignatureData = (ref: React.RefObject<SignatureCanvas>): string | null => {
  if (!ref.current) return null;                // Ref not ready
  if (typeof ref.current.getTrimmedCanvas !== "function") return null; // Safety check
  if (ref.current.isEmpty()) return null;       // Canvas empty
  const canvas = ref.current.getTrimmedCanvas();
  if (!canvas) return null;                     // Extra safety
  return canvas.toDataURL("image/png");
};

  // Submit signatures and generate PDF
const handleSubmit = async () => {
  const salesSign = getSignatureData(salesSignRef);
  const customerSign = getSignatureData(customerSignRef);

  if (!salesSign || !customerSign) {
    alert("Both signatures are required!");
    return;
  }

  setSaving(true);

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
    setMsg(data.success ? "PDF generated successfully!" : "Error: " + data.error);
    if (data.pdfUrl) window.open(data.pdfUrl, "_blank");
  } catch (err) {
    console.error(err);
    setMsg("Unexpected error occurred");
  } finally {
    setSaving(false);
  }
};

  if (loading) return <p>Loading voucher...</p>;
  if (!voucher) return <p>Voucher not found</p>;

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto" }}>
      <h1 className="text-2xl font-bold mb-4">Sign Voucher</h1>

      <div className="mb-6">
        <h2 className="font-bold mb-2">Salesperson Signature</h2>
        <SignatureCanvas
          ref={salesSignRef}
          penColor="black"
          canvasProps={{ width: 500, height: 150, className: "border mb-2" }}
        />
        <button
          type="button"
          onClick={() => handleClear("sales")}
          className="bg-gray-500 text-white px-2 py-1"
        >
          Clear
        </button>
      </div>

      <div className="mb-6">
        <h2 className="font-bold mb-2">Customer Signature</h2>
        <SignatureCanvas
          ref={customerSignRef}
          penColor="black"
          canvasProps={{ width: 500, height: 150, className: "border mb-2" }}
        />
        <button
          type="button"
          onClick={() => handleClear("customer")}
          className="bg-gray-500 text-white px-2 py-1"
        >
          Clear
        </button>
      </div>

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