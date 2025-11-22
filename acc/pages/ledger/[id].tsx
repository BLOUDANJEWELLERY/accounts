// pages/ledger/[id].tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

interface Voucher {
  id: string;
  voucherType: "INV" | "REC";
  date: string;
  totalNet: number; // Gold amount
  totalKWD: number; // KWD amount
  rows: string;
  pdfUrl?: string;
}

interface Customer {
  id: string;
  accountNo: string;
  name: string;
  phone: string;
  civilId: string;
}

interface LedgerEntry {
  date: string;
  voucherId: string;
  type: "INV" | "REC";
  description: string;
  goldDebit: number;
  goldCredit: number;
  goldBalance: number;
  kwdDebit: number;
  kwdCredit: number;
  kwdBalance: number;
  pdfUrl?: string;
}

interface VoucherRow {
  description: string;
  amount?: number;
  item?: string;
}

export default function LedgerPage() {
  const router = useRouter();
  const { id } = router.query;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentGoldBalance, setCurrentGoldBalance] = useState(0);
  const [currentKWDBalance, setCurrentKWDBalance] = useState(0);

  // Fetch customer and vouchers data
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch customer by account number
        const customerRes = await fetch(`/api/customers/account/${id}`);
        if (!customerRes.ok) {
          throw new Error("Customer not found");
        }
        const customerData: { customer: Customer } = await customerRes.json();
        setCustomer(customerData.customer);

        // Fetch vouchers for this customer
        const vouchersRes = await fetch(`/api/voucher/customer/${customerData.customer.id}`);
        if (!vouchersRes.ok) {
          throw new Error("Failed to fetch vouchers");
        }
        const vouchersData: { vouchers: Voucher[] } = await vouchersRes.json();
        setVouchers(vouchersData.vouchers);

        // Process vouchers into ledger entries
        const entries: LedgerEntry[] = [];
        let runningGoldBalance = 0;
        let runningKWDBalance = 0;

        // Sort vouchers by date
        const sortedVouchers = [...vouchersData.vouchers].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        sortedVouchers.forEach((voucher) => {
          const rows: VoucherRow[] = JSON.parse(voucher.rows);
          const description = rows.map((row: VoucherRow) => row.description).join(", ");

          if (voucher.voucherType === "INV") {
            // INV (Invoice) - Debit both gold and KWD
            runningGoldBalance += voucher.totalNet;
            runningKWDBalance += voucher.totalKWD;
            entries.push({
              date: new Date(voucher.date).toLocaleDateString(),
              voucherId: voucher.id,
              type: "INV",
              description: `Invoice - ${description}`,
              goldDebit: voucher.totalNet,
              goldCredit: 0,
              goldBalance: runningGoldBalance,
              kwdDebit: voucher.totalKWD,
              kwdCredit: 0,
              kwdBalance: runningKWDBalance,
              pdfUrl: voucher.pdfUrl,
            });
          } else {
            // REC (Receipt) - Credit both gold and KWD
            runningGoldBalance -= voucher.totalNet;
            runningKWDBalance -= voucher.totalKWD;
            entries.push({
              date: new Date(voucher.date).toLocaleDateString(),
              voucherId: voucher.id,
              type: "REC",
              description: `Receipt - ${description}`,
              goldDebit: 0,
              goldCredit: voucher.totalNet,
              goldBalance: runningGoldBalance,
              kwdDebit: 0,
              kwdCredit: voucher.totalKWD,
              kwdBalance: runningKWDBalance,
              pdfUrl: voucher.pdfUrl,
            });
          }
        });

        setLedgerEntries(entries);
        setCurrentGoldBalance(runningGoldBalance);
        setCurrentKWDBalance(runningKWDBalance);
      } catch (err) {
        console.error("Error fetching ledger data:", err);
        setError(err instanceof Error ? err.message : "Failed to load ledger data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Calculate totals
  const totalGoldDebit = ledgerEntries.reduce((sum, entry) => sum + entry.goldDebit, 0);
  const totalGoldCredit = ledgerEntries.reduce((sum, entry) => sum + entry.goldCredit, 0);
  const totalKWDDebit = ledgerEntries.reduce((sum, entry) => sum + entry.kwdDebit, 0);
  const totalKWDCredit = ledgerEntries.reduce((sum, entry) => sum + entry.kwdCredit, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading ledger...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Ledger</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">Customer not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Customer Ledger</h1>
          <p className="text-lg text-gray-600">Account No: {customer.accountNo}</p>
        </div>

        {/* Customer Info Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Customer Name</h3>
              <p className="text-lg font-semibold text-gray-900">{customer.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Account Number</h3>
              <p className="text-lg font-semibold text-indigo-600">{customer.accountNo}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
              <p className="text-lg font-semibold text-gray-900">{customer.phone}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Civil ID</h3>
              <p className="text-lg font-semibold text-gray-900">{customer.civilId}</p>
            </div>
          </div>
        </div>

        {/* Balance Summary - Updated for Gold and KWD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total Gold Debit</p>
            <p className="text-2xl font-bold">{totalGoldDebit.toFixed(3)} g</p>
          </div>
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total Gold Credit</p>
            <p className="text-2xl font-bold">{totalGoldCredit.toFixed(3)} g</p>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total KWD Debit</p>
            <p className="text-2xl font-bold">{totalKWDDebit.toFixed(3)} KWD</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total KWD Credit</p>
            <p className="text-2xl font-bold">{totalKWDCredit.toFixed(3)} KWD</p>
          </div>
        </div>

        {/* Current Balance Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`rounded-2xl p-6 text-center shadow-lg ${
            currentGoldBalance >= 0 
              ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
              : "bg-gradient-to-r from-red-500 to-red-600 text-white"
          }`}>
            <p className="text-sm font-medium mb-2">Current Gold Balance</p>
            <p className="text-3xl font-bold">{currentGoldBalance.toFixed(3)} g</p>
            <p className="text-sm mt-2 opacity-90">
              {currentGoldBalance >= 0 ? "Customer Owes Gold" : "You Owe Gold"}
            </p>
          </div>
          <div className={`rounded-2xl p-6 text-center shadow-lg ${
            currentKWDBalance >= 0 
              ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white"
              : "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
          }`}>
            <p className="text-sm font-medium mb-2">Current KWD Balance</p>
            <p className="text-3xl font-bold">{currentKWDBalance.toFixed(3)} KWD</p>
            <p className="text-sm mt-2 opacity-90">
              {currentKWDBalance >= 0 ? "Customer Owes KWD" : "You Owe KWD"}
            </p>
          </div>
        </div>

        {/* Ledger Table - Updated for Gold and KWD */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
              <span className="text-sm text-gray-500">
                {ledgerEntries.length} transaction(s)
              </span>
            </div>
          </div>

          {ledgerEntries.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-500">This customer hasn&apos;t made any transactions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gold Debit (g)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gold Credit (g)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gold Balance (g)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      KWD Debit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      KWD Credit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      KWD Balance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.voucherId} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.type === "INV" 
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {entry.description}
                      </td>
                      {/* Gold Columns */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                        {entry.goldDebit > 0 ? entry.goldDebit.toFixed(3) : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                        {entry.goldCredit > 0 ? entry.goldCredit.toFixed(3) : "-"}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-semibold ${
                        entry.goldBalance >= 0 ? "text-purple-600" : "text-red-600"
                      }`}>
                        {entry.goldBalance.toFixed(3)}
                      </td>
                      {/* KWD Columns */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                        {entry.kwdDebit > 0 ? entry.kwdDebit.toFixed(3) : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                        {entry.kwdCredit > 0 ? entry.kwdCredit.toFixed(3) : "-"}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-semibold ${
                        entry.kwdBalance >= 0 ? "text-indigo-600" : "text-orange-600"
                      }`}>
                        {entry.kwdBalance.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {entry.pdfUrl && (
                          <a
                            href={entry.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      Totals:
                    </td>
                    {/* Gold Totals */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalGoldDebit.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalGoldCredit.toFixed(3)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${
                      currentGoldBalance >= 0 ? "text-purple-600" : "text-red-600"
                    }`}>
                      {currentGoldBalance.toFixed(3)}
                    </td>
                    {/* KWD Totals */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalKWDDebit.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalKWDCredit.toFixed(3)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${
                      currentKWDBalance >= 0 ? "text-indigo-600" : "text-orange-600"
                    }`}>
                      {currentKWDBalance.toFixed(3)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/voucher/create"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Voucher
          </Link>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Customers
          </button>
        </div>
      </div>
    </div>
  );
}