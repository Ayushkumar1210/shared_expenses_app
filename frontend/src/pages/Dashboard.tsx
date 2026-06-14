import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { LogOut, Plus, Users, LayoutDashboard, ArrowRight, Loader } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: groups, isLoading, error } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data;
    },
  });

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreateError(null);
    setCreating(true);

    try {
      const res = await api.post('/groups', {
        name: newGroupName,
        description: newGroupDesc,
      });
      setNewGroupName('');
      setNewGroupDesc('');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate(`/groups/${res.data.id}`);
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-grid-pattern pb-12">
      <nav className="glass-panel sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                💸 FairShare
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-300 mr-2">
                Hello, <span className="font-semibold text-slate-100">{user?.name}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-500/30 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all duration-200 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-extrabold text-slate-100 flex items-center">
                <LayoutDashboard className="mr-2 h-6 w-6 text-brand-500" />
                Your Expense Groups
              </h2>
            </div>

            {isLoading ? (
              <div className="glass-panel p-12 rounded-2xl flex flex-col justify-center items-center">
                <Loader className="animate-spin h-8 w-8 text-brand-500" />
                <span className="mt-2 text-slate-400 text-sm">Loading groups...</span>
              </div>
            ) : error ? (
              <div className="glass-panel p-8 rounded-2xl border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                Error loading groups. Please reload.
              </div>
            ) : groups.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl text-center space-y-4">
                <Users className="h-12 w-12 mx-auto text-slate-600" />
                <h3 className="text-lg font-bold text-slate-300">No Groups Found</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  You are not a member of any expense groups yet. Create one or ask a friend to invite you.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groups.map((group: any) => (
                  <Link
                    key={group.id}
                    to={`/groups/${group.id}`}
                    className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between h-48 block"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-slate-100 mb-2 truncate">
                        {group.name}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                        {group.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-slate-800/80">
                      <span className="text-slate-400 flex items-center">
                        <Users className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        {group.memberships.length} members
                      </span>
                      <span className="text-brand-400 flex items-center hover:translate-x-0.5 transition-transform">
                        Open Group <ArrowRight className="h-3 w-3 ml-1" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="glass-panel p-6 rounded-2xl border-indigo-500/20 bg-indigo-500/5">
              <h3 className="font-bold text-indigo-400 mb-2">💡 Database Seed & Flatmates Context</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                The database contains a pre-seeded group called <strong>"Cozy Flat"</strong>. 
                It includes the 6 flatmates with their historical memberships:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-400">
                <li><strong>Aisha, Rohan, Priya:</strong> Joined Jan 1, 2026 (Active)</li>
                <li><strong>Meera:</strong> Joined Jan 1, 2026. Moved out on March 31, 2026</li>
                <li><strong>Dev:</strong> Joined March 1, 2026. Left March 15, 2026 (Joined for a trip)</li>
                <li><strong>Sam:</strong> Joined April 15, 2026 (Active)</li>
              </ul>
              <p className="text-xs text-slate-400 mt-2">
                Click on the pre-seeded "Cozy Flat" group to see member logs, record expenses, view balance breakdowns, or test CSV imports.
              </p>
            </div>
          </div>

          <div>
            <div className="glass-panel p-6 rounded-2xl sticky top-24">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center">
                <Plus className="mr-1.5 h-5 w-5 text-brand-500" />
                Create New Group
              </h3>
              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg p-2.5 mb-4">
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label htmlFor="groupName" className="block text-xs font-semibold text-slate-400 mb-1">
                    GROUP NAME
                  </label>
                  <input
                    id="groupName"
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="bg-slate-900/50 border border-slate-700/60 block w-full px-3 py-2 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    placeholder="e.g. Cozy Flat"
                  />
                </div>
                <div>
                  <label htmlFor="groupDesc" className="block text-xs font-semibold text-slate-400 mb-1">
                    DESCRIPTION (OPTIONAL)
                  </label>
                  <textarea
                    id="groupDesc"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="bg-slate-900/50 border border-slate-700/60 block w-full px-3 py-2 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm h-20 resize-none"
                    placeholder="e.g. Shared bills and trip expenses"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {creating ? (
                    <Loader className="animate-spin h-4 w-4 mr-1.5" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1.5" />
                  )}
                  Create Group
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
