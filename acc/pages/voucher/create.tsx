import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/router";

interface Customer {
  id: string;
  name: string;
  accountNo: string;
}

interface InvoiceRow {
  description: string;
  weight: number;
  purity: number;           // Now available for both INV and REC
  makingCharges?: number;   // INV only
  discountPercent?: number; // REC only
  netWeight: number;
  weightAfterDiscount?: number; // REC only
  kwd: number;
}

type VoucherType = "INV" | "REC";

export default function CreateVoucher() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [voucherType, setVoucherType] = useState<VoucherType>("INV");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<InvoiceRow[]>([{ 
    description: "", 
    weight: 0, 
    purity: 999, 
    netWeight: 0, 
    kwd: 0 
  }]);
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");

  // Fetch customers
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data: { customers: Customer[] }) => setCustomers(data.customers || []))
      .catch(() => setCustomers([]));
  }, []);

  // Handle row changes
  const handleRowChange = (index: number, field: keyof InvoiceRow, value: string | number) => {
    const newRows = [...rows];
    const row = newRows[index];

    if (field === "weight" || field === "purity" || field === "makingCharges" || field === "discountPercent" || field === "kwd") {
      row[field] = Number(value);
    } else if (field === "description") {
      row[field] = String(value);
    }

    // Live calculations
    if (voucherType === "INV") {
      // Invoice calculations
      row.netWeight = row.weight && row.purity ? (row.weight * row.purity) / 999 : 0;
      row.kwd = row.weight && row.makingCharges ? row.weight * row.makingCharges : 0;
    } else {
      // Receipt calculations
      const weightAfterDiscount = row.weight && row.discountPercent !== undefined ? 
        row.weight * (1 - row.discountPercent / 100) : 0;
      row.weightAfterDiscount = weightAfterDiscount;
      row.netWeight = weightAfterDiscount && row.purity ? (weightAfterDiscount * row.purity) / 999 : 0;
      // kwd is manually entered for REC
    }

    newRows[index] = row;
    setRows(newRows);
  };

  const addRow = () => setRows([...rows, { 
    description: "", 
    weight: 0, 
    purity: 999, 
    netWeight: 0, 
    kwd: 0 
  }]);
  
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index));

  const totalNet = rows.reduce((acc, r) => acc + r.netWeight, 0);
  const totalKWD = rows.reduce((acc, r) => acc + r.kwd, 0);
  const totalWeightAfterDiscount = rows.reduce((acc, r) => acc + (r.weightAfterDiscount || 0), 0);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accountId) {
      setMsg("Please select a customer account");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/voucher/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          voucherType,
          rows,
          totalNet,
          totalKWD,
          date,
        }),
      });

      type VoucherResponse = { 
        success: boolean; 
        voucher?: { id: string }; 
        error?: string 
      };
      
      const data: VoucherResponse = await res.json();

      setLoading(false);

      if (data.success && data.voucher) {
        setMsg("Voucher created successfully! Redirecting...");
        // Redirect to signature page
        setTimeout(() => {
          router.push(`/voucher/signature/${data.voucher!.id}`);
        }, 1500);
      } else {
        setMsg("Error: " + data.error);
      }
    } catch (error) {
      setLoading(false);
      setMsg("Unexpected error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Voucher</h1>
          <p className="text-lg text-gray-600">Generate {voucherType === "INV" ? "invoices" : "receipts"} for your customers</p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer, Voucher Type and Date Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Customer
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <select
                    value={accountId}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setAccountId(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none appearance-none bg-white"
                  >
                    <option value="">Choose a customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.accountNo})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Voucher Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voucher Type
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <select
                    value={voucherType}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setVoucherType(e.target.value as VoucherType)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none appearance-none bg-white"
                  >
                    <option value="INV">📄 Invoice (INV)</option>
                    <option value="REC">🧾 Receipt (REC)</option>
                  </select>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                  required
                />
              </div>
            </div>

            {/* Rows Section */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Items</h2>
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Row
                </button>
              </div>

              {/* Table Headers */}
              <div className="hidden lg:grid grid-cols-13 gap-2 mb-4 px-2 text-sm font-medium text-gray-700 uppercase tracking-wider">
                <div className="col-span-3">Description</div>
                <div className="col-span-1">Weight</div>
                {voucherType === "INV" ? (
                  <>
                    <div className="col-span-1">Purity</div>
                    <div className="col-span-1">Making Charges</div>
                    <div className="col-span-2">Net Weight</div>
                    <div className="col-span-1">KWD</div>
                  </>
                ) : (
                  <>
                    <div className="col-span-1">Discount %</div>
                    <div className="col-span-1">Purity</div>
                    <div className="col-span-2">Weight After Discount</div>
                    <div className="col-span-2">Net Weight</div>
                    <div className="col-span-1">KWD</div>
                  </>
                )}
                <div className="col-span-1">Action</div>
              </div>

              {/* Rows */}
              <div className="space-y-4">
                {rows.map((row, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-indigo-300 transition-all duration-200">
                    {/* Mobile Header */}
                    <div className="lg:hidden flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-700">Item {idx + 1}</span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className={`grid grid-cols-1 ${voucherType === "INV" ? "lg:grid-cols-12" : "lg:grid-cols-13"} gap-2 items-end`}>
                      
                      {/* Description */}
                      <div className="lg:col-span-3">
                        <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          placeholder="Item description"
                          value={row.description}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "description", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                          required
                        />
                      </div>

                      {/* Weight */}
                      <div className="lg:col-span-1">
                        <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Weight</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.001"
                          value={row.weight}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "weight", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                          required
                        />
                      </div>

                      {/* INV Fields */}
                      {voucherType === "INV" ? (
                        <>
                          {/* Purity */}
                          <div className="lg:col-span-1">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Purity</label>
                            <input
                              type="number"
                              placeholder="999"
                              step="1"
                              value={row.purity}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "purity", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                              required
                            />
                          </div>

                          {/* Making Charges */}
                          <div className="lg:col-span-1">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Making Charges</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              value={row.makingCharges ?? ""}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "makingCharges", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                              required
                            />
                          </div>

                          {/* Net Weight */}
                          <div className="lg:col-span-2">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Net Weight</label>
                            <input
                              type="number"
                              placeholder="0.000"
                              step="0.001"
                              value={row.netWeight.toFixed(3)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 font-mono font-bold cursor-not-allowed"
                              disabled
                            />
                          </div>

                          {/* KWD */}
                          <div className="lg:col-span-1">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">KWD</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              value={row.kwd.toFixed(3)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 font-mono font-bold cursor-not-allowed"
                              disabled
                            />
                          </div>
                        </>
                      ) : (
                        /* REC Fields */
                        <>
                          {/* Discount */}
                          <div className="lg:col-span-1">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                            <input
                              type="number"
                              placeholder="0%"
                              step="0.1"
                              value={row.discountPercent ?? ""}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "discountPercent", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                              required
                            />
                          </div>

                          {/* Purity */}
                          <div className="lg:col-span-1">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Purity</label>
                            <input
                              type="number"
                              placeholder="999"
                              step="1"
                              value={row.purity}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "purity", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                              required
                            />
                          </div>

                          {/* Weight After Discount */}
                          <div className="lg:col-span-2">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Weight After Discount</label>
                            <input
                              type="number"
                              placeholder="0.000"
                              step="0.001"
                              value={row.weightAfterDiscount?.toFixed(3) || "0.000"}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 font-mono font-bold cursor-not-allowed"
                              disabled
                            />
                          </div>

                          {/* Net Weight */}
                          <div className="lg:col-span-2">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">Net Weight</label>
                            <input
                              type="number"
                              placeholder="0.000"
                              step="0.001"
                              value={row.netWeight.toFixed(3)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 font-mono font-bold cursor-not-allowed"
                              disabled
                            />
                          </div>

                          {/* KWD */}
                          <div className="lg:col-span-1">
                            <label className="lg:hidden block text-sm font-medium text-gray-700 mb-1">KWD</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              value={row.kwd}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "kwd", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none"
                              required
                            />
                          </div>
                        </>
                      )}

                      {/* Remove Button - Desktop */}
                      <div className="lg:col-span-1 hidden lg:flex justify-center">
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Section */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
              <div className={`grid ${voucherType === "INV" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"} gap-4`}>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {voucherType === "INV" ? "Total Net Weight" : "Total Weight After Discount"}
                  </p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {voucherType === "INV" ? totalNet.toFixed(3) : totalWeightAfterDiscount.toFixed(3)}
                  </p>
                </div>
                
                {voucherType === "REC" && (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Net Weight</p>
                    <p className="text-2xl font-bold text-purple-700">{totalNet.toFixed(3)}</p>
                  </div>
                )}
                
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total KWD</p>
                  <p className="text-2xl font-bold text-green-600">{totalKWD.toFixed(3)}</p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !accountId}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Voucher...
                </span>
              ) : (
                "Create Voucher"
              )}
            </button>
          </form>

          {/* Message Display */}
          {msg && (
            <div className={`mt-6 p-4 rounded-lg text-center font-medium ${
              msg.includes("successfully") 
                ? "bg-green-50 text-green-700 border border-green-200" 
                : msg.includes("Redirecting")
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}