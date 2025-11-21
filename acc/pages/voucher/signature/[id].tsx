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
  const [hasSalesSigned, setHasSalesSigned] = useState(false);
  const [hasCustomerSigned, setHasCustomerSigned] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

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

  // Clean up blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

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

  const getSignatureData = (ref: React.RefObject<SignatureCanvas | null>): string | null => {
    if (!ref.current) {
      console.error("Signature ref not available");
      return null;
    }
    
    try {
      if (ref.current.isEmpty()) {
        return null;
      }
      
      return ref.current.toDataURL("image/png");
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

    if (!salesSign || !customerSign) {
      alert("Failed to capture signature data. Please try signing again.");
      return;
    }

    setSaving(true);
    setMsg("");
    setPdfBlobUrl(null);
    setShowPdfPreview(false);

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

      const data: { success: boolean; pdfUrl?: string; pdfData?: string; error?: string } = await res.json();
      
      if (data.success) {
        setMsg("PDF generated successfully!");
        
        // If we have PDF data, create a blob URL for immediate preview
        if (data.pdfData) {
          // Convert base64 to blob
          const byteCharacters = atob(data.pdfData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          
          setPdfBlobUrl(blobUrl);
          setShowPdfPreview(true);
        } else if (data.pdfUrl) {
          // Fallback: open the B2 URL in new tab
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

  const handleDownloadPdf = () => {
    if (pdfBlobUrl) {
      const link = document.createElement('a');
      link.href = pdfBlobUrl;
      link.download = `voucher-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClosePreview = () => {
    setShowPdfPreview(false);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
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
          <SignatureCanvas
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
          <SignatureCanvas
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

      {/* PDF Preview Modal */}
      {showPdfPreview && pdfBlobUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Voucher PDF Preview</h2>
              <button
                onClick={handleClosePreview}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="mb-4">
              <embed
                src={pdfBlobUrl}
                type="application/pdf"
                width="100%"
                height="600px"
              />
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleDownloadPdf}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Download PDF
              </button>
              <button
                onClick={handleClosePreview}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}