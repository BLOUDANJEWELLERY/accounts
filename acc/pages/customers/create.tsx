import { useState, ChangeEvent, FormEvent } from "react";

interface CustomerForm {
  accountNo: string;
  name: string;
  phone: string;
  civilId: string;
}

export default function CreateCustomer() {
  const [form, setForm] = useState<CustomerForm>({
    accountNo: "",
    name: "",
    phone: "",
    civilId: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);

  try {
    const res = await fetch("/api/customers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    type CustomerResponse = { success: boolean; customer?: unknown; error?: string };
    const data: CustomerResponse = await res.json();

    setLoading(false);

    if (data.success) {
      setMsg("Customer created successfully!");
      setForm({ accountNo: "", name: "", phone: "", civilId: "" });
    } else {
      setMsg("Error: " + data.error);
    }
  } catch {
    setLoading(false);
    setMsg("Unexpected error occurred");
  }
};


  return (
    <div style={{ maxWidth: "500px", margin: "40px auto" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>Create Customer Account</h1>

      <form onSubmit={handleSubmit}>
        <label>Account No</label>
        <input
          name="accountNo"
          value={form.accountNo}
          onChange={handleChange}
          required
          className="border p-2 w-full mb-3"
        />

        <label>Name</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          className="border p-2 w-full mb-3"
        />

        <label>Phone No</label>
        <input
          name="phone"
          value={form.phone}
          onChange={handleChange}
          required
          className="border p-2 w-full mb-3"
        />

        <label>Civil ID / CR No</label>
        <input
          name="civilId"
          value={form.civilId}
          onChange={handleChange}
          required
          className="border p-2 w-full mb-3"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 mt-2"
        >
          {loading ? "Saving..." : "Create Customer"}
        </button>
      </form>

      {msg && <p className="mt-4 text-blue-600">{msg}</p>}
    </div>
  );
}
