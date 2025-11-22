// pages/full-ledger.tsx
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
  rows: string;
  pdfUrl?: string;
}

interface VoucherRow {
  description: string;
  amount?: number;
  item?: string;
}

interface LedgerEntry {
  date: string;
  voucherId: string;
  customer: Customer;
  type: "INV" | "REC";
  description: string;
  goldDebit: number;
  goldCredit: number;
  goldBalance: number;
  kwdDebit: number;
  kwdCredit: number;
  kwdBalance: number;
  pdfUrl?: string;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
}

type SortField = 'date' | 'customer' | 'type' | 'goldDebit' | 'goldCredit' | 'kwdDebit' | 'kwdCredit';

// Helper function to get current month date range
const getCurrentMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    start: firstDay.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0]
  };
};

export default function FullLedgerPage() {
  const router = useRouter();
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [allLedgerEntries, setAllLedgerEntries] = useState<LedgerEntry[]>([]); // Store all entries for running balance
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters - removed searchTerm, selectedCustomer, selectedType
  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Set current month as default on component mount
  useEffect(() => {
    const currentMonth = getCurrentMonthRange();
    setDateRange(currentMonth);
  }, []);

  // Fetch all data for full ledger
  useEffect(() => {
    const fetchFullLedger = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Fetching full ledger data...");

        // Fetch all customers
        const customersRes = await fetch("/api/customers");
        if (!customersRes.ok) {
          throw new Error("Failed to fetch customers");
        }
        const customersData: { customers: Customer[] } = await customersRes.json();
        console.log("Fetched customers:", customersData.customers.length);

        // Fetch all vouchers
        const vouchersRes = await fetch("/api/vouchers");
        if (!vouchersRes.ok) {
          throw new Error("Failed to fetch vouchers");
        }
        const vouchersData: { vouchers: Voucher[] } = await vouchersRes.json();
        console.log("Fetched vouchers:", vouchersData.vouchers.length);

        // Create a map of customers by ID for quick lookup
        const customerMap = new Map();
        customersData.customers.forEach(customer => {
          customerMap.set(customer.id, customer);
        });

        // Process all vouchers into ledger entries
        const entries: LedgerEntry[] = [];
        let runningGoldBalance = 0;
        let runningKWDBalance = 0;

        // Sort vouchers by date chronologically
        const sortedVouchers = [...vouchersData.vouchers].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        sortedVouchers.forEach((voucher) => {
          const customer = customerMap.get(voucher.accountId);
          if (!customer) {
            console.warn(`Customer not found for voucher ${voucher.id} with accountId ${voucher.accountId}`);
            return;
          }

          const rows: VoucherRow[] = JSON.parse(voucher.rows);
          const description = rows.map((row: VoucherRow) => row.description).join(", ");

          if (voucher.voucherType === "INV") {
            // Invoice - increases balances
            runningGoldBalance += voucher.totalNet;
            runningKWDBalance += voucher.totalKWD;
            entries.push({
              date: new Date(voucher.date).toLocaleDateString(),
              voucherId: voucher.id,
              customer,
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
            // Receipt - decreases balances
            runningGoldBalance -= voucher.totalNet;
            runningKWDBalance -= voucher.totalKWD;
            entries.push({
              date: new Date(voucher.date).toLocaleDateString(),
              voucherId: voucher.id,
              customer,
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

        console.log("Processed ledger entries:", entries.length);
        setAllLedgerEntries(entries); // Store all entries for running balance calculation
        setLedgerEntries(entries); // This will be filtered based on current filters
      } catch (err) {
        console.error("Error fetching full ledger:", err);
        setError(err instanceof Error ? err.message : "Failed to load full ledger");
      } finally {
        setLoading(false);
      }
    };

    fetchFullLedger();
  }, []);

  // Calculate opening balance (balance before the date range)
  const calculateOpeningBalance = () => {
    if (!dateRange.start || allLedgerEntries.length === 0) {
      return { gold: 0, kwd: 0 };
    }

    const startDate = new Date(dateRange.start);
    let openingGoldBalance = 0;
    let openingKWDBalance = 0;

    // Find the last entry before the start date
    for (let i = allLedgerEntries.length - 1; i >= 0; i--) {
      const entryDate = new Date(allLedgerEntries[i].date);
      if (entryDate < startDate) {
        openingGoldBalance = allLedgerEntries[i].goldBalance;
        openingKWDBalance = allLedgerEntries[i].kwdBalance;
        break;
      }
    }

    return { gold: openingGoldBalance, kwd: openingKWDBalance };
  };

  // Calculate closing balance (balance at the end of date range)
  const calculateClosingBalance = (filteredEntries: LedgerEntry[]) => {
    if (filteredEntries.length === 0) {
      return calculateOpeningBalance();
    }

    const lastEntry = filteredEntries[filteredEntries.length - 1];
    return { 
      gold: lastEntry.goldBalance, 
      kwd: lastEntry.kwdBalance 
    };
  };

  // Apply filters and sorting - removed search, customer, and type filters
  const filteredAndSortedEntries = ledgerEntries
    .filter((entry) => {
      // Date range filter only
      const entryDate = new Date(entry.date);
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;
      
      const matchesDateRange = 
        (!startDate || entryDate >= startDate) && 
        (!endDate || entryDate <= endDate);

      return matchesDateRange;
    })
    .sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      // Handle nested fields and different data types
      switch (sortField) {
        case 'customer':
          aValue = a.customer.name;
          bValue = b.customer.name;
          break;
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'goldDebit':
          aValue = a.goldDebit;
          bValue = b.goldDebit;
          break;
        case 'goldCredit':
          aValue = a.goldCredit;
          bValue = b.goldCredit;
          break;
        case 'kwdDebit':
          aValue = a.kwdDebit;
          bValue = b.kwdDebit;
          break;
        case 'kwdCredit':
          aValue = a.kwdCredit;
          bValue = b.kwdCredit;
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      // Handle date comparison
      if (aValue instanceof Date && bValue instanceof Date) {
        if (sortDirection === "asc") {
          return aValue.getTime() - bValue.getTime();
        } else {
          return bValue.getTime() - aValue.getTime();
        }
      }

      // Handle string and number comparison
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Add opening and closing balance rows
  const openingBalance = calculateOpeningBalance();
  const closingBalance = calculateClosingBalance(filteredAndSortedEntries);
  
  const entriesWithBalances: LedgerEntry[] = [
    // Opening balance row
    {
      date: dateRange.start || "Beginning",
      voucherId: "opening-balance",
      customer: { id: "", accountNo: "", name: "Opening Balance", phone: "", civilId: "" },
      type: "INV",
      description: "Balance brought forward",
      goldDebit: 0,
      goldCredit: 0,
      goldBalance: openingBalance.gold,
      kwdDebit: 0,
      kwdCredit: 0,
      kwdBalance: openingBalance.kwd,
      isOpeningBalance: true,
    },
    ...filteredAndSortedEntries,
    // Closing balance row
    {
      date: dateRange.end || "Current",
      voucherId: "closing-balance",
      customer: { id: "", accountNo: "", name: "Closing Balance", phone: "", civilId: "" },
      type: "INV",
      description: "Balance carried forward",
      goldDebit: 0,
      goldCredit: 0,
      goldBalance: closingBalance.gold,
      kwdDebit: 0,
      kwdCredit: 0,
      kwdBalance: closingBalance.kwd,
      isClosingBalance: true,
    }
  ];

  // Calculate totals for filtered results only (excluding opening/closing rows)
  const totalGoldDebit = filteredAndSortedEntries.reduce((sum, entry) => sum + entry.goldDebit, 0);
  const totalGoldCredit = filteredAndSortedEntries.reduce((sum, entry) => sum + entry.goldCredit, 0);
  const totalKWDDebit = filteredAndSortedEntries.reduce((sum, entry) => sum + entry.kwdDebit, 0);
  const totalKWDCredit = filteredAndSortedEntries.reduce((sum, entry) => sum + entry.kwdCredit, 0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const clearFilters = () => {
    setDateRange(getCurrentMonthRange()); // Reset to current month
  };

  const setCurrentMonth = () => {
    setDateRange(getCurrentMonthRange());
  };

  const setLastMonth = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    setDateRange({
      start: firstDayLastMonth.toISOString().split('T')[0],
      end: lastDayLastMonth.toISOString().split('T')[0]
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading full ledger...</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Full Ledger</h1>
          <p className="text-lg text-gray-600">Complete transaction history across all accounts</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Filtered Transactions</p>
            <p className="text-3xl font-bold">{filteredAndSortedEntries.length}</p>
          </div>
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Opening Gold Balance</p>
            <p className="text-2xl font-bold">{openingBalance.gold.toFixed(3)} g</p>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Opening KWD Balance</p>
            <p className="text-2xl font-bold">{openingBalance.kwd.toFixed(3)} KWD</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-sm font-medium mb-2">Total Transactions</p>
            <p className="text-3xl font-bold">{ledgerEntries.length}</p>
          </div>
        </div>

        {/* Filters Section - Simplified */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Range Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Quick Date Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 lg:items-end">
              <div className="flex gap-2">
                <button
                  onClick={setCurrentMonth}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Current Month
                </button>
                <button
                  onClick={setLastMonth}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Last Month
                </button>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters Summary - Only show date range */}
          <div className="flex flex-wrap gap-2">
            {dateRange.start && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                From: {dateRange.start}
                <button
                  onClick={() => setDateRange(prev => ({ ...prev, start: "" }))}
                  className="ml-1 hover:text-green-900"
                >
                  ×
                </button>
              </span>
            )}
            {dateRange.end && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                To: {dateRange.end}
                <button
                  onClick={() => setDateRange(prev => ({ ...prev, end: "" }))}
                  className="ml-1 hover:text-green-900"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Showing {filteredAndSortedEntries.length} of {ledgerEntries.length} transactions
              </h3>
              <p className="text-sm text-gray-600">
                {dateRange.start || dateRange.end ? "Filtered by date range" : "All transactions"}
              </p>
            </div>
            <div className="flex gap-4 mt-4 sm:mt-0">
              <div className="text-center">
                <p className="text-sm text-gray-600">Period Gold Change</p>
                <p className={`text-lg font-semibold ${(closingBalance.gold - openingBalance.gold) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  {(closingBalance.gold - openingBalance.gold).toFixed(3)} g
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Period KWD Change</p>
                <p className={`text-lg font-semibold ${(closingBalance.kwd - openingBalance.kwd) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {(closingBalance.kwd - openingBalance.kwd).toFixed(3)} KWD
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date</span>
                      <SortIcon field="date" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("customer")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Customer</span>
                      <SortIcon field="customer" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Type</span>
                      <SortIcon field="type" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("goldDebit")}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Gold Debit (g)</span>
                      <SortIcon field="goldDebit" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("goldCredit")}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Gold Credit (g)</span>
                      <SortIcon field="goldCredit" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gold Balance (g)
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("kwdDebit")}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>KWD Debit</span>
                      <SortIcon field="kwdDebit" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("kwdCredit")}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>KWD Credit</span>
                      <SortIcon field="kwdCredit" />
                    </div>
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
                {entriesWithBalances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                      <p className="text-gray-500">
                        {dateRange.start || dateRange.end 
                          ? "Try adjusting your date range" 
                          : "No transactions in the system"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  entriesWithBalances.map((entry, index) => (
                    <tr 
                      key={entry.voucherId} 
                      className={`hover:bg-gray-50 transition-colors duration-150 ${
                        entry.isOpeningBalance ? 'bg-blue-50' : 
                        entry.isClosingBalance ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className={`text-sm font-semibold ${
                            entry.isOpeningBalance || entry.isClosingBalance ? 'text-gray-900 font-bold' : 'text-gray-900'
                          }`}>
                            {entry.customer.name}
                          </div>
                          {!entry.isOpeningBalance && !entry.isClosingBalance && (
                            <div className="text-sm text-gray-500">{entry.customer.accountNo}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!entry.isOpeningBalance && !entry.isClosingBalance ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.type === "INV" 
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}>
                            {entry.type}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            BAL
                          </span>
                        )}
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
                        entry.kwdBalance >= 0 ? "text-blue-600" : "text-orange-600"
                      }`}>
                        {entry.kwdBalance.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {entry.pdfUrl && !entry.isOpeningBalance && !entry.isClosingBalance && (
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
                  ))
                )}
              </tbody>
              {entriesWithBalances.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      Filtered Period Totals:
                    </td>
                    {/* Gold Totals */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalGoldDebit.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalGoldCredit.toFixed(3)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${
                      closingBalance.gold >= 0 ? "text-purple-600" : "text-red-600"
                    }`}>
                      {closingBalance.gold.toFixed(3)}
                    </td>
                    {/* KWD Totals */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalKWDDebit.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono font-bold">
                      {totalKWDCredit.toFixed(3)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${
                      closingBalance.kwd >= 0 ? "text-blue-600" : "text-orange-600"
                    }`}>
                      {closingBalance.kwd.toFixed(3)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/balances"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Balances
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