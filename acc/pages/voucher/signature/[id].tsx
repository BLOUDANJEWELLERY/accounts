// pages/voucher/signature/[id].tsx
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import SignaturePad from "react-signature-canvas";

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
  const [hasSalesSigned, setHasSalesSigned] = useState(false);
  const [hasCustomerSigned, setHasCustomerSigned] = useState(false);

  const salesSignRef = useRef<any>(null);
  const customerSignRef = useRef<any>(null);

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

  const handleClear = (who: "sales" | "customer") => {
    if (who === "sales") {
      salesSignRef.current?.clear();
      setHasSalesSigned(false);
    } else {
      customerSignRef.current?.clear();
      setHasCustomerSigned(false);
    }
  };

  const handleSignatureEnd = (who: "sales" | "customer") => {
    if (who === "sales") {
      setHasSalesSigned(true);
    } else {
      setHasCustomerSigned(true);
    }
  };

  const getSignatureData = (ref: React.RefObject<any>): string | null => {
    if (!ref.current) {
      console.error("Signature ref not available");
      return null;
    }
    
    try {
      // Check if signature is empty
      if (ref.current.isEmpty()) {
        return null;
      }
      
      // Alternative method to get signature data
      const canvas = ref.current.getCanvas();
      if (canvas && canvas.toDataURL) {
        return canvas.toDataURL("image/png");
      }
      
      // Fallback: try the original method but with better error handling
      try {
        return ref.current.getTrimmedCanvas().toDataURL("image/png");
      } catch (trimmedError) {
        console.warn("getTrimmedCanvas failed, using regular canvas:", trimmedError);
        return ref.current.toDataURL("image/png");
      }
    } catch (err) {
      console.error("Error extracting signature:", err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!hasSalesSigned || !hasCustomerSigned) {
      alert("Both signatures are required! Please provide both salesperson and customer signatures.");
      return;
    }

    const salesSign = getSignatureData(salesSignRef);
    const customerSign = getSignatureData(customerSignRef);

    console.log("Sales signature available:", !!salesSign);
    console.log("Customer signature available:", !!customerSign);

    if (!salesSign || !customerSign) {
      alert("Failed to capture signature data. Please try signing again.");
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
        // Clear signatures after successful submission
        handleClear("sales");
        handleClear("customer");
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
        <div style={{ border: "1px solid #000", background: "white", width: "500px", height: "150px" }}>
          <SignaturePad
            ref={salesSignRef}
            penColor="black"
            canvasProps={{ 
              width: 500, 
              height: 150,
              style: { width: "500px", height: "150px" }
            }}
            onEnd={() => handleSignatureEnd("sales")}
          />
        </div>
        <button
          onClick={() => handleClear("sales")}
          className="bg-gray-500 text-white px-4 py-2 mb-4 rounded mt-2"
        >
          Clear Sales Signature
        </button>
        {hasSalesSigned && <p className="text-green-600">✓ Signature provided</p>}
      </div>

      <div className="mb-8">
        <h2 className="font-bold mb-2">Customer Signature</h2>
        <div style={{ border: "1px solid #000", background: "white", width: "500px", height: "150px" }}>
          <SignaturePad
            ref={customerSignRef}
            penColor="black"
            canvasProps={{ 
              width: 500, 
              height: 150,
              style: { width: "500px", height: "150px" }
            }}
            onEnd={() => handleSignatureEnd("customer")}
          />
        </div>
        <button
          onClick={() => handleClear("customer")}
          className="bg-gray-500 text-white px-4 py-2 mb-4 rounded mt-2"
        >
          Clear Customer Signature
        </button>
        {hasCustomerSigned && <p className="text-green-600">✓ Signature provided</p>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !hasSalesSigned || !hasCustomerSigned}
        className={`px-6 py-3 mt-4 rounded ${
          saving || !hasSalesSigned || !hasCustomerSigned
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {saving ? "Generating PDF..." : "Generate PDF"}
      </button>

      {msg && (
        <p className={`mt-4 ${msg.includes("Error") ? "text-red-600" : "text-green-600"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}