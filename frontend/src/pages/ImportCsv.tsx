import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { Upload, FileText, ArrowLeft, Loader, Info } from 'lucide-react';

export default function ImportCsv() {
  const [searchParams] = useSearchParams();
  const groupIdFromUrl = searchParams.get('groupId') || '';

  const navigate = useNavigate();
  const [selectedGroupId, setSelectedGroupId] = useState(groupIdFromUrl);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data;
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedGroupId) {
      setError('Please select a target group.');
      return;
    }
    if (!file) {
      setError('Please choose a CSV file to upload.');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', selectedGroupId);

    try {
      const response = await api.post('/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      navigate(`/import-report?jobId=${response.data.importJobId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload and validate CSV file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-grid-pattern pb-12 text-slate-200">
      <nav className="glass-panel sticky top-0 z-50 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Upload CSV Expenses</h1>
            <p className="text-xs text-slate-400">Validate and import historical data spreadsheets</p>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-10">
        <div className="glass-panel p-8 rounded-2xl space-y-6">
          <h2 className="text-lg font-bold text-slate-100 flex items-center">
            <Upload className="h-5 w-5 mr-2 text-indigo-400" />
            Staged Import System
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Select Target Group
              </label>
              {groupsLoading ? (
                <div className="flex items-center space-x-2 py-2 text-sm text-slate-400">
                  <Loader className="animate-spin h-4 w-4" />
                  <span>Loading groups...</span>
                </div>
              ) : (
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 block w-full px-3 py-2.5 rounded-lg text-slate-200 text-sm focus:outline-none"
                  required
                >
                  <option value="">-- Choose a group --</option>
                  {groups?.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Upload CSV File
              </label>
              <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl p-8 text-center bg-slate-900/10 hover:bg-slate-900/20 transition-all relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-3">
                  <FileText className="h-10 w-10 mx-auto text-indigo-400/80" />
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Click to select or drag and drop your CSV</p>
                      <p className="text-xs text-slate-500 mt-1">Accepts only standard .csv sheets</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || !file || !selectedGroupId}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Analyzing Sheet & Detecting Anomalies...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Upload and Analyze CSV
                </>
              )}
            </button>
          </form>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-850/80 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center">
              <Info className="h-4 w-4 mr-1 text-slate-400" />
              CSV Format Specifications
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your CSV file must include headers matching standard labels:
            </p>
            <code className="block bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] text-indigo-300 overflow-x-auto">
              date, description, payer, amount, currency, splitType, splits
            </code>
            <ul className="list-disc pl-5 text-[11px] text-slate-400 space-y-1 mt-2">
              <li><strong>date:</strong> ISO format YYYY-MM-DD or slashes e.g. 15/04/2026</li>
              <li><strong>payer:</strong> First name or user name matching group profiles</li>
              <li><strong>splitType:</strong> EQUAL, EXACT, PERCENTAGE, or WEIGHTED</li>
              <li><strong>splits:</strong> Participant details, e.g. <code>Aisha:50, Rohan:50</code></li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
