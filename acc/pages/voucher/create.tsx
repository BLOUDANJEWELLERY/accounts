import { useState, useEffect, ChangeEvent, FormEvent } from "react";

interface Customer {
  id: string;
  name: string;
  accountNo: string;
}

interface InvoiceRow {
  description: string;
  weight: number;
  purity?: number;          // INV only
  makingCharges?: number;   // INV only
  discountPercent?: number; // REC only
  netWeight: number;
  kwd: number;
}

type VoucherType = "INV" | "REC";

export default function CreateVoucher() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [voucherType, setVoucherType] = useState<VoucherType>("INV");
  const [rows, setRows] = useState<InvoiceRow[]>([{ description: "", weight: 0, netWeight: 0, kwd: 0 }]);
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");

  // Fetch customers
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data: { customers: Customer[] }) => setCustomers(data.customers || []));
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
      row.netWeight = row.weight && row.purity ? (row.weight * row.purity) / 999 : 0;
      row.kwd = row.weight && row.makingCharges ? row.weight * row.makingCharges : 0;
    } else {
      row.netWeight = row.weight && row.discountPercent !== undefined ? row.weight * (1 - row.discountPercent / 100) : 0;
      // kwd is manually entered
    }

    newRows[index] = row;
    setRows(newRows);
  };

  const addRow = () => setRows([...rows, { description: "", weight: 0, netWeight: 0, kwd: 0 }]);
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index));

  const totalNet = rows.reduce((acc, r) => acc + r.netWeight, 0);
  const totalKWD = rows.reduce((acc, r) => acc + r.kwd, 0);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accountId) return alert("Select account");
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
          date: new Date(),
        }),
      });

      const data: { success: boolean; voucher?: any; error?: string } = await res.json();
      setLoading(false);

      if (data.success) {
        setMsg("Voucher created successfully!");
        setRows([{ description: "", weight: 0, netWeight: 0, kwd: 0 }]);
      } else {
        setMsg("Error: " + data.error);
      }
    } catch (err: unknown) {
      setLoading(false);
      setMsg("Unexpected error occurred");
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>Create Voucher</h1>

      <form onSubmit={handleSubmit}>
        <label>Account</label>
        <select
          value={accountId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setAccountId(e.target.value)}
          required
          className="border p-2 w-full mb-4"
        >
          <option value="">Select Account</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.accountNo})
            </option>
          ))}
        </select>

        <label>Voucher Type</label>
        <select
          value={voucherType}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setVoucherType(e.target.value as VoucherType)}
          className="border p-2 w-full mb-4"
        >
          <option value="INV">Invoice (INV)</option>
          <option value="REC">Receipt (REC)</option>
        </select>

        <h2 className="mt-4 font-bold mb-2">Rows</h2>
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-6 gap-2 mb-2 items-end">
            <input
              type="text"
              placeholder="Description"
              value={row.description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "description", e.target.value)}
              className="border p-2 col-span-2"
              required
            />
            <input
              type="number"
              placeholder="Weight"
              value={row.weight}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "weight", e.target.value)}
              className="border p-2"
              required
            />

            {voucherType === "INV" ? (
              <>
                <input
                  type="number"
                  placeholder="Purity"
                  value={row.purity ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "purity", e.target.value)}
                  className="border p-2"
                  required
                />
                <input
                  type="number"
                  placeholder="Making Charges"
                  value={row.makingCharges ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "makingCharges", e.target.value)}
                  className="border p-2"
                  required
                />
              </>
            ) : (
              <>
                <input
                  type="number"
                  placeholder="Discount %"
                  value={row.discountPercent ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "discountPercent", e.target.value)}
                  className="border p-2"
                  required
                />
                <input
                  type="number"
                  placeholder="KWD"
                  value={row.kwd}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleRowChange(idx, "kwd", e.target.value)}
                  className="border p-2"
                  required
                />
              </>
            )}

            <input
              type="number"
              placeholder="Net Weight"
              value={row.netWeight.toFixed(3)}
              className="border p-2 w-full bg-gray-100"
              disabled
            />

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="bg-red-500 text-white px-2 py-1"
              >
                X
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addRow} className="bg-gray-500 text-white px-4 py-1 mt-2">
          + Add Row
        </button>

        <div className="mt-4 font-bold">
          <p>Total Net Weight: {totalNet.toFixed(3)}</p>
          <p>Total KWD: {totalKWD.toFixed(3)}</p>
        </div>

        <button type="submit" disabled={loading} className="bg-black text-white px-4 py-2 mt-4">
          {loading ? "Saving..." : "Create Voucher"}
        </button>
      </form>

      {msg && <p className="mt-4 text-blue-600">{msg}</p>}
    </div>
  );
}
