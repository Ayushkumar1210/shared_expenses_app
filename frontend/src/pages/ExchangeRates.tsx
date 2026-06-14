import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRightLeft, Edit3, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  date: string;
}

const ExchangeRates: React.FC = () => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Update form state
  const [newRate, setNewRate] = useState('');
  const [updating, setUpdating] = useState(false);

  // Conversion tool state
  const [usdAmount, setUsdAmount] = useState('1');
  const [inrAmount, setInrAmount] = useState('');

  const fetchRates = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('/exchange-rates');
      setRates(res.data);
      const usdInr = res.data.find(
        (r: ExchangeRate) => r.fromCurrency === 'USD' && r.toCurrency === 'INR'
      );
      if (usdInr) {
        setNewRate(Number(usdInr.rate).toString());
        setInrAmount((1 * Number(usdInr.rate)).toFixed(2));
      }
    } catch (err) {
      setError('Failed to fetch exchange rates.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(newRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      setError('Please enter a valid positive exchange rate.');
      return;
    }
    setUpdating(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('/exchange-rates', {
        fromCurrency: 'USD',
        toCurrency: 'INR',
        rate: rateNum
      });
      setSuccess('Exchange rate updated successfully!');
      fetchRates();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update exchange rate.');
    } finally {
      setUpdating(false);
    }
  };

  const handleUsdChange = (val: string) => {
    setUsdAmount(val);
    const usdInr = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'INR');
    const rate = usdInr ? Number(usdInr.rate) : 83.0;
    const amount = parseFloat(val);
    if (!isNaN(amount)) {
      setInrAmount((amount * rate).toFixed(2));
    } else {
      setInrAmount('');
    }
  };

  const handleInrChange = (val: string) => {
    setInrAmount(val);
    const usdInr = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'INR');
    const rate = usdInr ? Number(usdInr.rate) : 83.0;
    const amount = parseFloat(val);
    if (!isNaN(amount)) {
      setUsdAmount((amount / rate).toFixed(2));
    } else {
      setUsdAmount('');
    }
  };

  const usdInrRate = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'INR');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Global Exchange Rates</h1>
        <p className="text-xs text-slate-500 mt-1">Configure conversion factors between USD and INR used dynamically for splitting transactions.</p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Update Exchange Rate Form Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6">
          <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-indigo-400" />
            <span>Update Conversion Rate</span>
          </h3>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                1 USD to INR Conversion Rate
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="e.g. 83.50"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 text-sm transition-all"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-start gap-1">
              <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
              <p>
                Changing this setting updates the global exchange rate used for all future USD splits. Existing splits will not be updated historically.
              </p>
            </div>

            <button
              type="submit"
              disabled={updating || loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20"
            >
              {updating ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin mr-2" />
                  <span>Updating Rate...</span>
                </>
              ) : (
                'Save Exchange Rate'
              )}
            </button>
          </form>

          {/* Current Rate Info */}
          {usdInrRate && (
            <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Current Rate:</span>
              <span className="text-slate-200">
                1 USD = ₹{Number(usdInrRate.rate).toFixed(4)} (Last Updated:{' '}
                {new Date(usdInrRate.date).toLocaleDateString()})
              </span>
            </div>
          )}
        </div>

        {/* Live Converter Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
              <span>Live Converter Tool</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  USD ($)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={usdAmount}
                    onChange={(e) => handleUsdChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowRightLeft className="h-5 w-5 text-slate-700 transform rotate-90" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  INR (₹)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={inrAmount}
                    onChange={(e) => handleInrChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeRates;
