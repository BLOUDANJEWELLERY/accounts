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
  weightAfterDiscount?: number;
}

interface Voucher {
  id: string;
  accountId: string;
  voucherType: "INV" | "REC";
  rows: VoucherRow[];
  totalNet: number;
  totalKWD: number;
  date: string;
  customer: {
    name: string;
    accountNo: string;
    phone: string;
    civilId: string;
  };
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
  const [activeSignature, setActiveSignature] = useState<"sales" | "customer" | null>(null);

  const salesSignRef = useRef<SignatureCanvas | null>(null);
  const customerSignRef = useRef<SignatureCanvas | null>(null);
  const signatureModalRef = useRef<HTMLDivElement>(null);

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

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (signatureModalRef.current && !signatureModalRef.current.contains(event.target as Node)) {
        setActiveSignature(null);
      }
    };

    if (activeSignature) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeSignature]);

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

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Loading voucher...</p>
      </div>
    </div>
  );
  
  if (!voucher) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 text-lg">Voucher not found</p>
      </div>
    </div>
  );

  const totalWeightAfterDiscount = voucher.rows.reduce((acc, r) => acc + (r.weightAfterDiscount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {voucher.voucherType === "INV" ? "INVOICE" : "RECEIPT"}
          </h1>
          <p className="text-lg text-gray-600">Please review and sign the document</p>
        </div>

        {/* Voucher Document */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 mb-8 border-2 border-gray-200">
          {/* Document Header */}
          <div className="border-b-2 border-gray-300 pb-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">GOLDEN JEWELERS</h2>
                <p className="text-gray-600">123 Jewelry Street</p>
                <p className="text-gray-600">Kuwait City, Kuwait</p>
                <p className="text-gray-600">Tel: +965 1234 5678</p>
              </div>
              <div className="text-center">
                <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg">
                  <p className="text-sm text-gray-600">Voucher No</p>
                  <p className="text-xl font-bold text-indigo-600">{voucher.id.slice(-8).toUpperCase()}</p>
                </div>
                <p className="text-gray-600 mt-2">
                  Date: {new Date(voucher.date).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-600">Account No: <span className="font-semibold">{voucher.customer.accountNo}</span></p>
                <p className="text-gray-600">Civil ID: <span className="font-semibold">{voucher.customer.civilId}</span></p>
                <p className="text-gray-600">Phone: <span className="font-semibold">{voucher.customer.phone}</span></p>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Customer Information</h3>
            <p className="text-gray-700">{voucher.customer.name}</p>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Weight</th>
                    {voucher.voucherType === "INV" ? (
                      <>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Purity</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Making Charges</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">KWD</th>
                      </>
                    ) : (
                      <>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Discount %</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Purity</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Weight After Discount</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">KWD</th>
                      </>
                    )}
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Net Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {voucher.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3">{row.description}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">{row.weight.toFixed(3)}</td>
                      {voucher.voucherType === "INV" ? (
                        <>
                          <td className="border border-gray-300 px-4 py-3 text-center">{row.purity}</td>
                          <td className="border border-gray-300 px-4 py-3 text-center">{row.makingCharges?.toFixed(2)}</td>
                          <td className="border border-gray-300 px-4 py-3 text-center">{row.kwd.toFixed(3)}</td>
                        </>
                      ) : (
                        <>
                          <td className="border border-gray-300 px-4 py-3 text-center">{row.discountPercent?.toFixed(1)}%</td>
                          <td className="border border-gray-300 px-4 py-3 text-center">{row.purity}</td>
                          <td className="border border-gray-300 px-4 py-3 text-center">{row.weightAfterDiscount?.toFixed(3)}</td>
                          <td className="border border-gray-300 px-4 py-3 text-center">{row.kwd.toFixed(3)}</td>
                        </>
                      )}
                      <td className="border border-gray-300 px-4 py-3 text-center font-semibold">{row.netWeight.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">
                {voucher.voucherType === "INV" ? "Total Net Weight" : "Total Weight After Discount"}
              </p>
              <p className="text-2xl font-bold text-indigo-700">
                {voucher.voucherType === "INV" ? voucher.totalNet.toFixed(3) : totalWeightAfterDiscount.toFixed(3)}
              </p>
            </div>
            {voucher.voucherType === "REC" && (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Total Net Weight</p>
                <p className="text-2xl font-bold text-purple-700">{voucher.totalNet.toFixed(3)}</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Amount (KWD)</p>
              <p className="text-2xl font-bold text-green-600">{voucher.totalKWD.toFixed(3)}</p>
            </div>
          </div>

          {/* Signatures Section */}
          <div className="border-t-2 border-gray-300 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Salesperson Signature */}
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 mb-4">Salesperson Signature</h3>
                <div 
                  className="border-2 border-dashed border-gray-400 rounded-lg bg-white p-4 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-200"
                  onClick={() => setActiveSignature("sales")}
                >
                  {hasSalesSigned ? (
                    <div className="h-24 flex items-center justify-center">
                      <p className="text-green-600 font-semibold">✓ Signature Provided</p>
                    </div>
                  ) : (
                    <div className="h-24 flex items-center justify-center">
                      <p className="text-gray-500">Click to sign</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleClear("sales")}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Clear Signature
                </button>
              </div>

              {/* Customer Signature */}
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 mb-4">Customer Signature</h3>
                <div 
                  className="border-2 border-dashed border-gray-400 rounded-lg bg-white p-4 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-200"
                  onClick={() => setActiveSignature("customer")}
                >
                  {hasCustomerSigned ? (
                    <div className="h-24 flex items-center justify-center">
                      <p className="text-green-600 font-semibold">✓ Signature Provided</p>
                    </div>
                  ) : (
                    <div className="h-24 flex items-center justify-center">
                      <p className="text-gray-500">Click to sign</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleClear("customer")}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Clear Signature
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Generate PDF Button */}
        <div className="text-center">
          <button
            onClick={handleSubmit}
            disabled={saving || !hasSalesSigned || !hasCustomerSigned}
            className={`px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-200 ${
              saving || !hasSalesSigned || !hasCustomerSigned
                ? "bg-gray-400 cursor-not-allowed text-gray-200"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating PDF...
              </span>
            ) : (
              "Generate PDF Document"
            )}
          </button>
        </div>

        {/* Message Display */}
        {msg && (
          <div className={`mt-6 p-4 rounded-lg text-center font-medium ${
            msg.includes("successfully") 
              ? "bg-green-50 text-green-700 border border-green-200" 
              : msg.includes("Error")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
            {msg}
          </div>
        )}
      </div>

      {/* Signature Modal */}
      {activeSignature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            ref={signatureModalRef}
            className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {activeSignature === "sales" ? "Salesperson Signature" : "Customer Signature"}
              </h2>
              <button
                onClick={() => setActiveSignature(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="border-2 border-gray-300 rounded-lg bg-white mb-4">
              <SignatureCanvas
                ref={activeSignature === "sales" ? salesSignRef : customerSignRef}
                penColor="black"
                canvasProps={{ 
                  width: 600, 
                  height: 200,
                  className: "w-full h-48 rounded-lg"
                }}
                onEnd={() => handleSignatureEnd(activeSignature)}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <button
                onClick={() => handleClear(activeSignature)}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Clear Signature
              </button>
              <p className="text-gray-600 text-sm">
                Click anywhere outside this box to save signature
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && pdfBlobUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-6xl w-full max-h-full overflow-auto">
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
                className="rounded-lg border"
              />
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleDownloadPdf}
                className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all duration-200 shadow-lg"
              >
                Download PDF
              </button>
              <button
                onClick={handleClosePreview}
                className="bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors duration-200"
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