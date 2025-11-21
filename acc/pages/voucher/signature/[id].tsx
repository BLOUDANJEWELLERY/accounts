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

  const salesCanvasRef = useRef<HTMLCanvasElement>(null);
  const customerCanvasRef = useRef<HTMLCanvasElement>(null);
  const salesSignaturePad = useRef<SignaturePad | null>(null);
  const customerSignaturePad = useRef<SignaturePad | null>(null);

  // Initialize signature pads
  useEffect(() => {
    if (salesCanvasRef.current && customerCanvasRef.current) {
      salesSignaturePad.current = new SignaturePad(salesCanvasRef.current, {
        penColor: "black",
        backgroundColor: "white"
      });
      
      customerSignaturePad.current = new SignaturePad(customerCanvasRef.current, {
        penColor: "black",
        backgroundColor: "white"
      });

      // Handle window resize
      const handleResize = () => {
        if (salesCanvasRef.current && customerCanvasRef.current) {
          const scale = window.devicePixelRatio || 1;
          const width = 500;
          const height = 150;

          [salesCanvasRef.current, customerCanvasRef.current].forEach(canvas => {
            canvas.width = width * scale;
            canvas.height = height * scale;
            canvas.getContext('2d')?.scale(scale, scale);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
          });
        }
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
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
    <div style={{ maxWidth: "900px", margin: "40px auto" }}>
      <h1 className="text-2xl font-bold mb-4">Sign Voucher</h1>

      <h2 className="font-bold mb-2">Salesperson Signature</h2>
      <canvas
        ref={salesCanvasRef}
        style={{ border: "1px solid black", marginBottom: "8px" }}
      />
      <button
        onClick={() => handleClear("sales")}
        className="bg-gray-500 text-white px-2 py-1 mb-4"
      >
        Clear
      </button>

      <h2 className="font-bold mb-2">Customer Signature</h2>
      <canvas
        ref={customerCanvasRef}
        style={{ border: "1px solid black", marginBottom: "8px" }}
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