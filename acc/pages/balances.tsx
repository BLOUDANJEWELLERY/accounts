// pages/balances.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

interface Customer {
  id: string;
  accountNo: string;
  name: string;
  phone: string;
  civilId: string;
}

interface Voucher {
  id: string;
  voucherType: "INV" | "REC";
  date: string;
  totalNet: number; // Gold amount
  totalKWD: number; // KWD amount
  accountId: string;
}

interface CustomerBalance {
  customer: Customer;
  goldBalance: number;
  kwdBalance: number;
  lastTransactionDate: string | null;
  voucherCount: number;
}

type SortableField = 'customer' | 'goldBalance' | 'kwdBalance' | 'lastTransactionDate' | 'voucherCount';

export default function BalancesPage() {
  const router = useRouter();
  const [customerBalances, setCustomerBalances] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortableField>("customer");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch all customers and their balances
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Starting to fetch balances...");

        // Fetch all customers
        const customersRes = await fetch("/api/customers");
        if (!customersRes.ok) {
          throw new Error("Failed to fetch customers");
        }
        const customersData: { customers: Customer[] } = await customersRes.json();
        console.log("Fetched customers:", customersData.customers.length);

        // For each customer, fetch their vouchers and calculate balances
        const balancesPromises = customersData.customers.map(async (customer) => {
          try {
            console.log(`Fetching vouchers for customer: ${customer.name} (${customer.id})`);
            const vouchersRes = await fetch(`/api/voucher/customer/${customer.id}`);
            
            if (!vouchersRes.ok) {
              console.warn(`No vouchers found for customer ${customer.name}, status: ${vouchersRes.status}`);
              return {
                customer,
                goldBalance: 0,
                kwdBalance: 0,
                lastTransactionDate: null,
                voucherCount: 0,
              };
            }

            const vouchersData: { vouchers: Voucher[] } = await vouchersRes.json();
            const vouchers = vouchersData.vouchers;
            console.log(`Found ${vouchers.length} vouchers for customer ${customer.name}`);

            // Calculate balances
            let goldBalance = 0;
            let kwdBalance = 0;
            let lastTransactionDate: string | null = null;

            if (vouchers.length > 0) {
              // Sort vouchers by date to process in chronological order
              const sortedVouchers = [...vouchers].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );

              // Get the latest transaction date
              lastTransactionDate = new Date(sortedVouchers[sortedVouchers.length - 1].date).toLocaleDateString();

              // Calculate running balances chronologically
              sortedVouchers.forEach((voucher) => {
                if (voucher.voucherType === "INV") {
                  // Invoice - increases what customer owes (debit)
                  goldBalance += voucher.totalNet;
                  kwdBalance += voucher.totalKWD;
                } else if (voucher.voucherType === "REC") {
                  // Receipt - decreases what customer owes (credit)
                  goldBalance -= voucher.totalNet;
                  kwdBalance -= voucher.totalKWD;
                }
              });

              console.log(`Calculated balances for ${customer.name}: Gold=${goldBalance}, KWD=${kwdBalance}`);
            }

            return {
              customer,
              goldBalance,
              kwdBalance,
              lastTransactionDate,
              voucherCount: vouchers.length,
            };
          } catch (err) {
            console.error(`Error processing customer ${customer.name}:`, err);
            return {
              customer,
              goldBalance: 0,
              kwdBalance: 0,
              lastTransactionDate: null,
              voucherCount: 0,
            };
          }
        });

        const balances = await Promise.all(balancesPromises);
        console.log("Final balances:", balances);
        setCustomerBalances(balances);
      } catch (err) {
        console.error("Error fetching balances:", err);
        setError(err instanceof Error ? err.message : "Failed to load balances");
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, []);

  // Filter and sort customers
  const filteredAndSortedBalances = customerBalances
    .filter((balance) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        balance.customer.name.toLowerCase().includes(searchLower) ||
        balance.customer.accountNo.toLowerCase().includes(searchLower) ||
        balance.customer.phone.includes(searchTerm) ||
        balance.customer.civilId.includes(searchTerm)
      );
    })
    .sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      // Handle nested customer fields and different field types
      if (sortField === "customer") {
        aValue = a.customer.name;
        bValue = b.customer.name;
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      // Handle null values
      if (aValue === null) aValue = "";
      if (bValue === null) bValue = "";

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Calculate totals
  const totalGoldBalance = customerBalances.reduce((sum, balance) => sum + balance.goldBalance, 0);
  const totalKWDBalance = customerBalances.reduce((sum, balance) => sum + balance.kwdBalance, 0);
  const totalCustomers = customerBalances.length;
  const customersWithDebt = customerBalances.filter(balance => balance.goldBalance > 0 || balance.kwdBalance > 0).length;
  const customersWithCredit = customerBalances.filter(balance => balance.goldBalance < 0 || balance.kwdBalance < 0).length;

  const handleSort = (field: SortableField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortableField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? "↑" : "↓";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading balances...</p>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Balances</h2>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Customer Balances</h1>
          <p className="text-lg text-gray-600">Overview of all account balances</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total Customers</p>
            <p className="text-3xl font-bold">{totalCustomers}</p>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total Gold Balance</p>
            <p className="text-2xl font-bold">{totalGoldBalance.toFixed(3)} g</p>
          </div>
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total KWD Balance</p>
            <p className="text-2xl font-bold">{totalKWDBalance.toFixed(3)} KWD</p>
          </div>
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Customers with Debt</p>
            <p className="text-3xl font-bold">{customersWithDebt}</p>
            <p className="text-xs opacity-90 mt-1">
              {customersWithCredit} with credit
            </p>
          </div>
        </div>

        {/* Debug Info - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium text-yellow-800">Debug Info</span>
            </div>
            <div className="mt-2 text-sm text-yellow-700">
              <p>Total customers: {customerBalances.length}</p>
              <p>Customers with transactions: {customerBalances.filter(b => b.voucherCount > 0).length}</p>
              <p>Total transactions: {customerBalances.reduce((sum, b) => sum + b.voucherCount, 0)}</p>
            </div>
          </div>
        )}

        {/* Search and Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by name, account, phone, or civil ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {filteredAndSortedBalances.length} customers
              </span>
            </div>
          </div>
        </div>

        {/* Balances Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("customer")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Customer</span>
                      <SortIcon field="customer" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("goldBalance")}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Gold Balance (g)</span>
                      <SortIcon field="goldBalance" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("kwdBalance")}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>KWD Balance</span>
                      <SortIcon field="kwdBalance" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("voucherCount")}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Transactions</span>
                      <SortIcon field="voucherCount" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("lastTransactionDate")}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Last Activity</span>
                      <SortIcon field="lastTransactionDate" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedBalances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                      <p className="text-gray-500">
                        {searchTerm ? "Try adjusting your search terms" : "No customers in the system"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedBalances.map((balance) => (
                    <tr key={balance.customer.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{balance.customer.name}</div>
                          <div className="text-sm text-gray-500">Acc: {balance.customer.accountNo}</div>
                          <div className="text-xs text-gray-400">CID: {balance.customer.civilId}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {balance.customer.phone}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-semibold ${
                        balance.goldBalance >= 0 ? "text-purple-600" : "text-red-600"
                      }`}>
                        {balance.goldBalance.toFixed(3)} g
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-semibold ${
                        balance.kwdBalance >= 0 ? "text-indigo-600" : "text-orange-600"
                      }`}>
                        {balance.kwdBalance.toFixed(3)} KWD
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          balance.voucherCount > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {balance.voucherCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {balance.lastTransactionDate || "No transactions"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => router.push(`/ledger/${balance.customer.accountNo}`)}
                          className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredAndSortedBalances.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      Totals:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-purple-600">
                      {totalGoldBalance.toFixed(3)} g
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-indigo-600">
                      {totalKWDBalance.toFixed(3)} KWD
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/customers"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Manage Customers
          </Link>
          <Link
            href="/voucher/create"
            className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Voucher
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}