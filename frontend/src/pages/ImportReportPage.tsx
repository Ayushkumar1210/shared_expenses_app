import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../utils/api';
import { 
  ArrowLeft, Check, AlertTriangle, AlertOctagon, Info, 
  Loader, CheckSquare, ListFilter 
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ImportReportPage() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') || '';
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: job, isLoading, error: queryError } = useQuery({
    queryKey: ['import-report', jobId],
    queryFn: async () => {
      const res = await api.get(`/import/imports/${jobId}/report`);
      return res.data;
    },
    enabled: !!jobId,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/import/imports/${jobId}/confirm`);
    },
    onSuccess: () => {
      // Confetti fire!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      navigate(`/groups/${job.groupId}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to confirm import.');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-400">
        <Loader className="animate-spin h-10 w-10 text-brand-500 mb-2" />
        <span>Loading report details...</span>
      </div>
    );
  }

  if (queryError || !job) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-300">
        <h2 className="text-xl font-bold">Import job not found</h2>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-brand-400 mt-2 flex items-center hover:underline bg-transparent border-0 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </button>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-slate-950 bg-grid-pattern pb-12 text-slate-200">
      <nav className="glass-panel sticky top-0 z-50 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Validation Report</h1>
              <p className="text-xs text-slate-400">File: {job.fileName}</p>
            </div>
          </div>
          <div>
            {job.status === 'IMPORTED' ? (
              <span className="flex items-center text-xs font-semibold px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Check className="h-4 w-4 mr-1.5" />
                Data Already Imported
              </span>
            ) : (
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || job.importedRows === 0}
                className="flex items-center text-xs font-semibold px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg transition-all cursor-pointer"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-1.5" />
                    Saving data...
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-1.5" />
                    Confirm and Import ({job.importedRows} Rows)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-10 space-y-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel p-5 rounded-2xl">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Rows parsed</div>
            <div className="text-3xl font-extrabold text-slate-100 mt-2">{job.totalRows}</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl border-emerald-500/10">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-emerald-400">Importable Rows</div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">{job.importedRows}</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl border-red-500/10">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-red-400">Skipped Rows (Errors)</div>
            <div className="text-3xl font-extrabold text-red-400 mt-2">{job.totalRows - job.importedRows}</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl border-orange-500/10">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-orange-400">Flagged Rows (Warnings)</div>
            <div className="text-3xl font-extrabold text-orange-400 mt-2">{job.flaggedRows}</div>
          </div>
        </div>

        {/* Report Overview Panel */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-slate-100 mb-3.5">Import Validation Overview</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every row in the spreadsheet has been verified against our 15 database validation rules. 
            Rows containing <strong className="text-red-400">ERROR</strong> severity (e.g. future dates, negative values, unregistered participants) cannot be imported.
            Rows with <strong className="text-orange-400">WARNING</strong> or <strong className="text-blue-400">INFO</strong> (e.g. potential duplicate records, name normalization adjustments, settlements classified as expenses) will be corrected inline and imported safely.
          </p>
        </div>

        {/* Anomalies List */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center">
            <ListFilter className="h-5 w-5 mr-2 text-indigo-400" />
            Detected Anomalies & Adjustments Log ({job.anomalies.length})
          </h3>

          {job.anomalies.length === 0 ? (
            <div className="glass-panel p-12 text-center text-slate-400 text-sm">
              ✨ Incredible! No anomalies detected in this CSV file. Ready to import!
            </div>
          ) : (
            <div className="space-y-3">
              {job.anomalies.map((anom: any) => (
                <div 
                  key={anom.id} 
                  className={`glass-panel p-4 rounded-xl border flex items-start space-x-3.5 ${
                    anom.severity === 'ERROR' 
                      ? 'border-red-500/25 bg-red-500/5' 
                      : anom.severity === 'WARNING' 
                      ? 'border-orange-500/25 bg-orange-500/5' 
                      : 'border-blue-500/25 bg-blue-500/5'
                  }`}
                >
                  <div className="mt-0.5">
                    {anom.severity === 'ERROR' ? (
                      <AlertOctagon className="h-5 w-5 text-red-400" />
                    ) : anom.severity === 'WARNING' ? (
                      <AlertTriangle className="h-5 w-5 text-orange-400" />
                    ) : (
                      <Info className="h-5 w-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-bold text-slate-200">
                        Row {anom.rowNumber}: <span className="uppercase tracking-wider text-xs ml-1 text-slate-400">{anom.anomalyType}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        anom.severity === 'ERROR' 
                          ? 'bg-red-500/20 text-red-300 border border-red-500/20' 
                          : anom.severity === 'WARNING' 
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/20' 
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                      }`}>
                        {anom.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      <span className="font-semibold text-slate-300">Reason:</span> {anom.detectedReason}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      <span className="font-semibold text-slate-300">Action Taken:</span> <span className="italic text-slate-300">{anom.actionTaken}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
