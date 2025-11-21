// pages/voucher/signature/[id].tsx
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import SignaturePad from "signature_pad";

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
  const [padsInitialized, setPadsInitialized] = useState(false);

  const salesCanvasRef = useRef<HTMLCanvasElement>(null);
  const customerCanvasRef = useRef<HTMLCanvasElement>(null);
  const salesSignaturePad = useRef<SignaturePad | null>(null);
  const customerSignaturePad = useRef<SignaturePad | null>(null);

  // Initialize signature pads
  useEffect(() => {
    const initializeSignaturePads = () => {
      if (salesCanvasRef.current && customerCanvasRef.current) {
        // Set canvas dimensions first
        const width = 500;
        const height = 150;

        [salesCanvasRef.current, customerCanvasRef.current].forEach(canvas => {
          canvas.width = width;
          canvas.height = height;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        });

        // Initialize signature pads
        salesSignaturePad.current = new SignaturePad(salesCanvasRef.current, {
          minWidth: 1,
          maxWidth: 3,
          penColor: "rgb(0, 0, 0)",
          backgroundColor: "rgb(255, 255, 255)",
          throttle: 16
        });
        
        customerSignaturePad.current = new SignaturePad(customerCanvasRef.current, {
          minWidth: 1,
          maxWidth: 3,
          penColor: "rgb(0, 0, 0)",
          backgroundColor: "rgb(255, 255, 255)",
          throttle: 16
        });

        setPadsInitialized(true);
        console.log("Signature pads initialized");
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeSignaturePads, 100);
    return () => clearTimeout(timer);
  }, []);

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
    if (who === "sales" && salesSignaturePad.current) {
      salesSignaturePad.current.clear();
    } else if (who === "customer" && customerSignaturePad.current) {
      customerSignaturePad.current.clear();
    }
  };

  const getSignatureData = (signaturePad: SignaturePad | null): string | null => {
    if (!signaturePad || signaturePad.isEmpty()) {
      return null;
    }
    
    try {
      return signaturePad.toDataURL();
    } catch (err) {
      console.error("Error extracting signature:", err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!padsInitialized) {
      alert("Signature pads are not ready yet. Please wait a moment.");
      return;
    }

    const salesSign = getSignatureData(salesSignaturePad.current);
    const customerSign = getSignatureData(customerSignaturePad.current);

    console.log("Sales signature:", salesSign ? "exists" : "missing");
    console.log("Customer signature:", customerSign ? "exists" : "missing");

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
    <div style={{ maxWidth: "900px", margin: "40px auto", padding: "20px" }}>
      <h1 className="text-2xl font-bold mb-4">Sign Voucher</h1>

      <div className="mb-6">
        <h2 className="font-bold mb-2">Salesperson Signature</h2>
        <div style={{ border: "1px solid #ccc", background: "white", display: "inline-block" }}>
          <canvas
            ref={salesCanvasRef}
            style={{ display: "block", cursor: "crosshair" }}
          />
        </div>
        <br />
        <button
          onClick={() => handleClear("sales")}
          className="bg-gray-500 text-white px-3 py-1 mt-2 rounded"
        >
          Clear Sales Signature
        </button>
      </div>

      <div className="mb-6">
        <h2 className="font-bold mb-2">Customer Signature</h2>
        <div style={{ border: "1px solid #ccc", background: "white", display: "inline-block" }}>
          <canvas
            ref={customerCanvasRef}
            style={{ display: "block", cursor: "crosshair" }}
          />
        </div>
        <br />
        <button
          onClick={() => handleClear("customer")}
          className="bg-gray-500 text-white px-3 py-1 mt-2 rounded"
        >
          Clear Customer Signature
        </button>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !padsInitialized}
        className="bg-black text-white px-4 py-2 mt-4 rounded disabled:bg-gray-400"
      >
        {saving ? "Generating PDF..." : "Generate PDF"}
      </button>

      {!padsInitialized && <p className="mt-2 text-yellow-600">Initializing signature pads...</p>}
      {msg && <p className="mt-4 text-blue-600">{msg}</p>}
    </div>
  );
}