// pages/voucher/signature/[id].tsx
import { useState, useRef, useEffect } from "react";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [signaturesReady, setSignaturesReady] = useState(false);

  // Use the correct ref type for react-signature-canvas
  const salesSignRef = useRef<SignatureCanvas | null>(null);
  const customerSignRef = useRef<SignatureCanvas | null>(null);

  // Fetch voucher data
  useEffect(() => {
    if (!id) return;

    const fetchVoucher = async () => {
      try {
        setLoading(true);
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

  // Check if signatures are ready
  useEffect(() => {
    // Set a small timeout to ensure the canvas is fully initialized
    const timer = setTimeout(() => {
      setSignaturesReady(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleClear = (who: "sales" | "customer") => {
    if (who === "sales") {
      salesSignRef.current?.clear();
    } else {
      customerSignRef.current?.clear();
    }
  };

  const getSignatureData = (ref: React.RefObject<SignatureCanvas | null>): string | null => {
    if (!ref.current) {
      console.error("Signature ref not available");
      return null;
    }
    
    try {
      // Check if signature canvas has any strokes
      if (ref.current.isEmpty()) {
        return null;
      }
      
      // Get the signature data
      const dataUrl = ref.current.getTrimmedCanvas().toDataURL("image/png");
      return dataUrl;
    } catch (err) {
      console.error("Error extracting signature:", err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!signaturesReady) {
      alert("Signatures are still initializing, please try again in a moment.");
      return;
    }

    const salesSign = getSignatureData(salesSignRef);
    const customerSign = getSignatureData(customerSignRef);

    console.log("Sales signature available:", !!salesSign);
    console.log("Customer signature available:", !!customerSign);

    if (!salesSign || !customerSign) {
      alert("Both signatures are required! Please provide both salesperson and customer signatures.");
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
      
      if (data.success) {
        setMsg("PDF generated and saved successfully!");
        if (data.pdfUrl) {
          window.open(data.pdfUrl, "_blank");
        }
      } else {
        setMsg("Error: " + data.error);
      }
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
    <div style={{ maxWidth: "900px", margin: "40px auto", padding: "20px" }}>
      <h1 className="text-2xl font-bold mb-4">Sign Voucher</h1>

      <div className="mb-8">
        <h2 className="font-bold mb-2">Salesperson Signature</h2>
        <SignatureCanvas
          ref={salesSignRef}
          penColor="black"
          canvasProps={{ 
            width: 500, 
            height: 150, 
            className: "border mb-2 bg-white",
            style: { border: "1px solid #000" }
          }}
        />
        <button
          onClick={() => handleClear("sales")}
          className="bg-gray-500 text-white px-4 py-2 mb-4 rounded"
        >
          Clear Sales Signature
        </button>
      </div>

      <div className="mb-8">
        <h2 className="font-bold mb-2">Customer Signature</h2>
        <SignatureCanvas
          ref={customerSignRef}
          penColor="black"
          canvasProps={{ 
            width: 500, 
            height: 150, 
            className: "border mb-2 bg-white",
            style: { border: "1px solid #000" }
          }}
        />
        <button
          onClick={() => handleClear("customer")}
          className="bg-gray-500 text-white px-4 py-2 mb-4 rounded"
        >
          Clear Customer Signature
        </button>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !signaturesReady}
        className="bg-black text-white px-6 py-3 mt-4 rounded disabled:bg-gray-400"
      >
        {saving ? "Generating PDF..." : "Generate PDF"}
      </button>

      {!signaturesReady && (
        <p className="mt-2 text-yellow-600">Initializing signature pads...</p>
      )}

      {msg && (
        <p className={`mt-4 ${msg.includes("Error") ? "text-red-600" : "text-blue-600"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}