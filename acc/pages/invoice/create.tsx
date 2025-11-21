import { useState, useEffect } from "react";

interface Customer {
  id: string;
  name: string;
  accountNo: string;
}

interface Item {
  description: string;
  quantity: number;
  price: number;
}

export default function CreateInvoice() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, price: 0 }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Fetch customers
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => setCustomers(data.customers || []));
  }, []);

  const handleItemChange = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    newItems[index][field] = field === "quantity" || field === "price" ? Number(value) : value;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { description: "", quantity: 1, price: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedCustomer) return alert("Select a customer");
    setLoading(true);

    const res = await fetch("/api/invoice/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: selectedCustomer, items, notes }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setMsg("Invoice created successfully!");
      setItems([{ description: "", quantity: 1, price: 0 }]);
      setNotes("");
    } else {
      setMsg("Error: " + data.error);
    }
  };

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>Create Invoice</h1>

      <form onSubmit={handleSubmit}>
        <label>Customer</label>
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          required
          className="border p-2 w-full mb-4"
        >
          <option value="">Select Customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.accountNo})
            </option>
          ))}
        </select>

        <h2 className="mt-4 font-bold mb-2">Items</h2>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Description"
              value={item.description}
              onChange={(e) => handleItemChange(idx, "description", e.target.value)}
              className="border p-2 flex-1"
              required
            />
            <input
              type="number"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
              className="border p-2 w-20"
              min={1}
              required
            />
            <input
              type="number"
              placeholder="Price"
              value={item.price}
              onChange={(e) => handleItemChange(idx, "price", e.target.value)}
              className="border p-2 w-28"
              min={0}
              required
            />
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(idx)} className="bg-red-500 text-white px-2">
                X
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addItem} className="bg-gray-500 text-white px-4 py-1 mt-2">
          + Add Item
        </button>

        <label className="mt-4 block">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border p-2 w-full mb-4"
          rows={3}
        ></textarea>

        <button type="submit" disabled={loading} className="bg-black text-white px-4 py-2">
          {loading ? "Creating..." : "Create Invoice"}
        </button>
      </form>

      {msg && <p className="mt-4 text-blue-600">{msg}</p>}
    </div>
  );
}
