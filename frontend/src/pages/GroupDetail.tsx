import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, DollarSign, ArrowLeft, 
  Calendar, Info, Plus, FileSpreadsheet, Loader, CheckCircle2 
} from 'lucide-react';
import confetti from 'canvas-confetti';

type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'WEIGHTED';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'balances' | 'members'>('expenses');

  // Modals state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedTraceUser, setSelectedTraceUser] = useState<any | null>(null);

  // Queries
  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const res = await api.get(`/groups/${id}`);
      return res.data;
    },
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', id],
    queryFn: async () => {
      const res = await api.get(`/expenses?groupId=${id}`);
      return res.data;
    },
  });

  const { data: settlements, isLoading: settlementsLoading } = useQuery({
    queryKey: ['settlements', id],
    queryFn: async () => {
      const res = await api.get(`/settlements?groupId=${id}`);
      return res.data;
    },
  });

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['balances', id],
    queryFn: async () => {
      const res = await api.get(`/groups/${id}/balances`);
      return res.data;
    },
  });

  // Exchange rates are calculated backend-side

  // Manual Expense Form State
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState<'INR' | 'USD'>('INR');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expPayer, setExpPayer] = useState('');
  const [expSplitType, setExpSplitType] = useState<SplitType>('EQUAL');
  const [expShares, setExpShares] = useState<Record<string, number>>({});
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Manual Settlement Form State
  const [setAmount, setSetAmount] = useState('');
  const [setCurrency, setSetCurrency] = useState<'INR' | 'USD'>('INR');
  const [setPayer, setSetPayer] = useState('');
  const [setReceiver, setSetReceiver] = useState('');
  const [setDate, setSetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  const getActiveMembersOnDate = (dateString: string) => {
    if (!group?.memberships) return [];
    const date = new Date(dateString);
    return group.memberships.filter((m: any) => {
      const joined = new Date(m.joinedAt);
      if (date < joined) return false;
      if (m.leftAt) {
        const left = new Date(m.leftAt);
        if (date > left) return false;
      }
      return true;
    });
  };

  const activeMembersForExpense = getActiveMembersOnDate(expDate);
  const activeMembersForSettlement = getActiveMembersOnDate(setDate);

  // Mutations
  const createExpenseMutation = useMutation({
    mutationFn: async (newExpense: any) => {
      return api.post('/expenses', newExpense);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['balances', id] });
      setShowExpenseModal(false);
      // Reset form
      setExpDesc('');
      setExpAmount('');
      setExpSplitType('EQUAL');
      setExpShares({});
      setExpenseError(null);
    },
    onError: (err: any) => {
      setExpenseError(err.response?.data?.error || 'Failed to create expense');
    },
  });

  const createSettlementMutation = useMutation({
    mutationFn: async (newSettlement: any) => {
      return api.post('/settlements', newSettlement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', id] });
      queryClient.invalidateQueries({ queryKey: ['balances', id] });
      setShowSettlementModal(false);
      // Reset form
      setSetAmount('');
      setSetPayer('');
      setSetReceiver('');
      setSettlementError(null);
      // Trigger fun animation
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });
    },
    onError: (err: any) => {
      setSettlementError(err.response?.data?.error || 'Failed to record settlement');
    },
  });

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);

    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      setExpenseError('Please enter a valid positive amount.');
      return;
    }

    if (!expPayer) {
      setExpenseError('Please select a payer.');
      return;
    }

    // Prepare shares array
    const shares: { userId: string; value: number }[] = [];
    if (expSplitType === 'EQUAL') {
      activeMembersForExpense.forEach((m: any) => {
        shares.push({ userId: m.userId, value: 1 });
      });
    } else {
      let sum = 0;
      activeMembersForExpense.forEach((m: any) => {
        const val = expShares[m.userId] || 0;
        sum += val;
        shares.push({ userId: m.userId, value: val });
      });

      if (shares.length === 0 || sum === 0) {
        setExpenseError('Please assign split values to members.');
        return;
      }

      if (expSplitType === 'PERCENTAGE' && Math.abs(sum - 100) > 0.01) {
        setExpenseError(`Total percentages must sum to 100%. Currently: ${sum}%`);
        return;
      }
      if (expSplitType === 'EXACT' && Math.abs(sum - amount) > 0.02) {
        setExpenseError(`Sum of splits (${sum}) must equal total amount (${amount}).`);
        return;
      }
    }

    createExpenseMutation.mutate({
      groupId: id,
      payerId: expPayer,
      amount,
      currency: expCurrency,
      description: expDesc,
      date: new Date(expDate).toISOString(),
      splitType: expSplitType,
      shares,
    });
  };

  const handleSettlementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettlementError(null);

    const amount = parseFloat(setAmount);
    if (isNaN(amount) || amount <= 0) {
      setSettlementError('Please enter a valid positive amount.');
      return;
    }

    if (!setPayer || !setReceiver) {
      setSettlementError('Please select both payer and receiver.');
      return;
    }

    if (setPayer === setReceiver) {
      setSettlementError('Payer and receiver cannot be the same person.');
      return;
    }

    createSettlementMutation.mutate({
      groupId: id,
      payerId: setPayer,
      receiverId: setReceiver,
      amount,
      currency: setCurrency,
      date: new Date(setDate).toISOString(),
    });
  };

  if (groupLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <Loader className="animate-spin h-10 w-10 text-brand-500" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-300">
        <h2 className="text-xl font-bold">Group not found</h2>
        <Link to="/dashboard" className="text-brand-400 mt-2 flex items-center hover:underline">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-grid-pattern pb-12 text-slate-200">
      {/* Navbar header */}
      <nav className="glass-panel sticky top-0 z-40 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <ArrowLeft className="h-4 w-4 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{group.name}</h1>
              <p className="text-xs text-slate-400 truncate max-w-md">{group.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/import?groupId=${id}`}
              className="flex items-center text-xs font-semibold px-3 py-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Import CSV
            </Link>
            <button
              onClick={() => {
                setExpPayer(activeMembersForExpense[0]?.userId || '');
                setShowExpenseModal(true);
              }}
              className="flex items-center text-xs font-semibold px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Expense
            </button>
            <button
              onClick={() => {
                setSetPayer(activeMembersForSettlement[0]?.userId || '');
                setSetReceiver(activeMembersForSettlement[1]?.userId || '');
                setShowSettlementModal(true);
              }}
              className="flex items-center text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Record Settlement
            </button>
          </div>
        </div>
      </nav>

      {/* Content wrapper */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-800 mb-8">
          <nav className="flex space-x-8">
            {(['expenses', 'settlements', 'balances', 'members'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab contents */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-100">Expenses Log</h2>
            {expensesLoading ? (
              <div className="flex justify-center p-12"><Loader className="animate-spin text-slate-500" /></div>
            ) : !expenses || expenses.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 text-sm">
                No expenses found. Click "Add Expense" or upload a CSV to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {expenses.map((expense: any) => (
                  <div key={expense.id} className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200">{expense.description}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                          <span>Paid by <strong>{expense.payer.name}</strong></span>
                          <span>•</span>
                          <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" /> {new Date(expense.date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] uppercase font-semibold text-slate-300">{expense.splitType}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                      <div className="text-right">
                        <div className="font-bold text-slate-100">
                          {expense.currency === 'USD' ? '$' : '₹'}
                          {parseFloat(expense.amount).toFixed(2)}
                        </div>
                        {expense.currency === 'USD' && (
                          <div className="text-[10px] text-slate-400">
                            ≈ ₹{parseFloat(expense.amountINR).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                        <div className="font-semibold text-slate-300 mb-1">Split shares:</div>
                        <ul className="space-y-0.5 max-h-20 overflow-y-auto pr-1">
                          {expense.shares.map((share: any) => (
                            <li key={share.id}>
                              {share.user.name}: <span className="font-semibold text-slate-300">₹{parseFloat(share.shareAmountINR).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settlements' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-100">Debt Settlements Log</h2>
            {settlementsLoading ? (
              <div className="flex justify-center p-12"><Loader className="animate-spin text-slate-500" /></div>
            ) : !settlements || settlements.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl text-center text-slate-400 text-sm">
                No settlements recorded yet. Use "Record Settlement" to clear balances.
              </div>
            ) : (
              <div className="space-y-4">
                {settlements.map((settlement: any) => (
                  <div key={settlement.id} className="glass-panel p-5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-200">
                          <strong>{settlement.payer.name}</strong> paid <strong>{settlement.receiver.name}</strong>
                        </div>
                        <div className="flex items-center text-xs text-slate-400 mt-1">
                          <Calendar className="h-3 w-3 mr-1" /> {new Date(settlement.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">
                        {settlement.currency === 'USD' ? '$' : '₹'}
                        {parseFloat(settlement.amount).toFixed(2)}
                      </div>
                      {settlement.currency === 'USD' && (
                        <div className="text-[10px] text-slate-400">
                          ≈ ₹{parseFloat(settlement.amountINR).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'balances' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User net balances */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-bold text-slate-100 flex items-center">
                Net Balances Breakdown
                <span title="Positive balance means they are owed money; negative means they owe money.">
                  <Info className="h-4 w-4 ml-1.5 text-slate-500" />
                </span>
              </h2>
              {balancesLoading ? (
                <div className="flex justify-center p-12"><Loader className="animate-spin text-slate-500" /></div>
              ) : !balances?.reports ? (
                <div className="glass-panel p-8 text-center text-slate-400">Failed to load balances.</div>
              ) : (
                <div className="space-y-4">
                  {balances.reports.map((r: any) => (
                    <div key={r.userId} className="glass-panel p-5 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-200 text-lg">{r.userName}</h4>
                        <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1.5">
                          <span>Paid: <strong className="text-slate-300">₹{r.totalPaidExpenses}</strong></span>
                          <span>Owed: <strong className="text-slate-300">₹{r.totalOwedShares}</strong></span>
                          <span>Settled: <strong className="text-slate-300">₹{r.totalPaidSettlements - r.totalReceivedSettlements}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className={`text-lg font-extrabold ${r.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.netBalance >= 0 ? '+' : ''}₹{parseFloat(r.netBalance).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {r.netBalance >= 0 ? 'Owed to them' : 'They owe overall'}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedTraceUser(r)}
                          className="flex items-center text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-600 bg-slate-900 text-brand-400 cursor-pointer"
                        >
                          Audit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Simplification recommendations */}
            <div>
              <div className="glass-panel p-6 rounded-2xl sticky top-24 space-y-4 border-indigo-500/10">
                <h3 className="text-lg font-bold text-indigo-400">Simplified Settlements</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  These optimized transactions resolve all outstanding balances in the minimal number of payments.
                </p>

                {balancesLoading ? (
                  <div className="flex justify-center"><Loader className="animate-spin text-slate-500" /></div>
                ) : !balances?.recommendations || balances.recommendations.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm font-medium">
                    All clear! No debts to settle.
                  </div>
                ) : (
                  <div className="space-y-3.5 pt-2">
                    {balances.recommendations.map((rec: any, idx: number) => (
                      <div key={idx} className="flex flex-col p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-sm">
                        <div className="flex items-center justify-between font-semibold text-slate-200">
                          <span>{rec.fromUserName}</span>
                          <span className="text-xs text-slate-400 font-normal px-2 py-0.5 rounded bg-slate-950">owes</span>
                          <span>{rec.toUserName}</span>
                        </div>
                        <div className="text-right mt-2 text-brand-400 font-bold text-base">
                          ₹{parseFloat(rec.amount).toFixed(2)}
                        </div>
                        <button
                          onClick={() => {
                            setSetPayer(rec.fromUserId);
                            setSetReceiver(rec.toUserId);
                            setSetAmount(String(rec.amount));
                            setSetCurrency('INR');
                            setShowSettlementModal(true);
                          }}
                          className="text-[10px] text-center uppercase tracking-wider font-bold text-emerald-400 hover:text-emerald-300 mt-2 bg-emerald-500/10 hover:bg-emerald-500/20 py-1.5 rounded border border-emerald-500/20 transition-all cursor-pointer"
                        >
                          Mark as Settled
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-100 flex items-center">
              <Users className="h-5 w-5 mr-2 text-brand-500" />
              Members Timeline Log
            </h2>
            <div className="glass-panel rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Joined Group</th>
                    <th className="p-4">Left Group</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {group.memberships.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-900/30">
                      <td className="p-4 font-bold text-slate-200">{m.user.name}</td>
                      <td className="p-4 text-slate-400">{m.user.email}</td>
                      <td className="p-4 flex items-center text-slate-300"><Calendar className="h-4 w-4 mr-1.5 text-slate-500" /> {new Date(m.joinedAt).toLocaleDateString()}</td>
                      <td className="p-4 text-slate-300">
                        {m.leftAt ? (
                          <span className="flex items-center text-red-400/90"><Calendar className="h-4 w-4 mr-1.5 text-red-500/40" /> {new Date(m.leftAt).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-xs">Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Manual Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 relative shadow-2xl border-slate-800">
            <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center">
              <Plus className="mr-1.5 h-5 w-5 text-brand-500" /> Add Manual Expense
            </h3>

            {expenseError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg p-3 mb-4 animate-pulse">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">DESCRIPTION</label>
                  <input
                    type="text"
                    required
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="e.g. Electricity bill"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">DATE</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">AMOUNT</label>
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="number"
                      step="any"
                      required
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      className="bg-slate-900 border border-slate-700 block w-full pl-3 pr-12 py-2 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none"
                      placeholder="0.00"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-xs font-bold">{expCurrency}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">CURRENCY</label>
                  <select
                    value={expCurrency}
                    onChange={(e) => setExpCurrency(e.target.value as 'INR' | 'USD')}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">PAID BY</label>
                  <select
                    value={expPayer}
                    onChange={(e) => setExpPayer(e.target.value)}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                  >
                    {activeMembersForExpense.map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">SPLIT TYPE</label>
                  <select
                    value={expSplitType}
                    onChange={(e) => setExpSplitType(e.target.value as SplitType)}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="EQUAL">Split Equally</option>
                    <option value="EXACT">Exact Splits</option>
                    <option value="PERCENTAGE">Percentage splits</option>
                    <option value="WEIGHTED">Weighted shares</option>
                  </select>
                </div>
              </div>

              {/* Individual splits inputs */}
              {expSplitType !== 'EQUAL' && (
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-850 space-y-3.5 max-h-48 overflow-y-auto">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configure Splits Share</h4>
                  {activeMembersForExpense.map((m: any) => (
                    <div key={m.userId} className="flex justify-between items-center text-sm gap-4">
                      <span className="font-semibold text-slate-300">{m.user.name}</span>
                      <div className="relative rounded-md w-32 shadow-sm">
                        <input
                          type="number"
                          step="any"
                          value={expShares[m.userId] || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setExpShares({ ...expShares, [m.userId]: isNaN(val) ? 0 : val });
                          }}
                          className="bg-slate-950 border border-slate-700 block w-full px-3 py-1.5 rounded text-slate-200 text-right text-xs focus:outline-none"
                          placeholder="0"
                        />
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[10px] text-slate-500 font-bold">
                          {expSplitType === 'PERCENTAGE' ? '%' : expSplitType === 'WEIGHTED' ? 'wt' : expCurrency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="px-4 py-2 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {createExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Settlement Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative shadow-2xl border-slate-800">
            <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center">
              <CheckCircle2 className="mr-1.5 h-5 w-5 text-emerald-500" /> Record Settlement
            </h3>

            {settlementError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg p-3 mb-4 animate-pulse">
                {settlementError}
              </div>
            )}

            <form onSubmit={handleSettlementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">DATE</label>
                <input
                  type="date"
                  required
                  value={setDate}
                  onChange={(e) => setSetDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">PAYER (WHO PAYS)</label>
                  <select
                    value={setPayer}
                    onChange={(e) => setSetPayer(e.target.value)}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                  >
                    {activeMembersForSettlement.map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">RECEIVER (WHO GETS PAID)</label>
                  <select
                    value={setReceiver}
                    onChange={(e) => setSetReceiver(e.target.value)}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                  >
                    {activeMembersForSettlement.map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">AMOUNT</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={setAmount}
                    onChange={(e) => setSetAmount(e.target.value)}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">CURRENCY</label>
                  <select
                    value={setCurrency}
                    onChange={(e) => setSetCurrency(e.target.value as 'INR' | 'USD')}
                    className="bg-slate-900 border border-slate-700 block w-full px-3 py-2 rounded-lg text-slate-200 text-sm focus:outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSettlementMutation.isPending}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {createSettlementMutation.isPending ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Explainability Modal */}
      {selectedTraceUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 relative shadow-2xl border-slate-800 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-100">{selectedTraceUser.userName}'s Audit Log</h3>
                <p className="text-xs text-slate-400 mt-0.5">Trace of calculations for outstanding net balance</p>
              </div>
              <div className="text-right">
                <div className={`text-xl font-extrabold ${selectedTraceUser.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTraceUser.netBalance >= 0 ? '+' : ''}₹{parseFloat(selectedTraceUser.netBalance).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">NET BALANCE</div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-3.5 my-4">
              {selectedTraceUser.trace.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No recorded transactions for this user.</div>
              ) : (
                selectedTraceUser.trace.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-850 hover:border-slate-800 transition-all">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg text-xs font-bold border mt-0.5 ${
                        item.type === 'paid'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : item.type === 'settlement_paid'
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                          : item.type === 'owed'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      }`}>
                        {item.type === 'paid' ? 'PAID' : item.type === 'settlement_paid' ? 'SETTLED' : item.type === 'owed' ? 'OWES' : 'RECVD'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{item.description}</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">{new Date(item.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className={`font-bold text-sm ${
                      item.type === 'paid' || item.type === 'settlement_paid' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {item.type === 'paid' || item.type === 'settlement_paid' ? '+' : '-'}₹{parseFloat(item.amount).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedTraceUser(null)}
                className="px-5 py-2 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
