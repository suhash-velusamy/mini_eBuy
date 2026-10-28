import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Plus,
  Trash2,
  Tag,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Search,
} from 'lucide-react';
import { watchApi } from '../api/watchApi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const MyWants = () => {
  const { isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [watches, setWatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New Want Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWatches = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await watchApi.getWatches();
      if (res.success) {
        setWatches(res.watches || []);
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to load saved wants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchWatches();
  }, [isAuthenticated]);

  // Real-time listener for watch matches
  useEffect(() => {
    if (!socket) return;
    const handleWatchMatch = (data) => {
      setSuccess(`🎯 New match for your alert! "${data.item?.title}" was just listed.`);
      fetchWatches();
    };
    socket.on('watch:match', handleWatchMatch);
    return () => {
      socket.off('watch:match', handleWatchMatch);
    };
  }, [socket]);

  const handleCreateWatch = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (keywords.length === 0) {
      setError('Please provide at least one keyword (e.g. calculator, cycle, book).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await watchApi.createWatch({
        keywords,
        category: categoryInput || undefined,
        condition: conditionInput || undefined,
        maxPrice: maxPriceInput ? parseFloat(maxPriceInput) : undefined,
      });

      if (res.success) {
        setSuccess('🎉 Search alert saved! You will be notified whenever matching items appear.');
        setShowAddForm(false);
        setKeywordsInput('');
        setCategoryInput('');
        setConditionInput('');
        setMaxPriceInput('');
        fetchWatches();
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to create search alert.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (watch) => {
    try {
      setError('');
      const res = await watchApi.updateWatch(watch._id, { active: !watch.active });
      if (res.success) {
        setWatches((prev) =>
          prev.map((w) => (w._id === watch._id ? { ...w, active: !watch.active } : w))
        );
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to toggle alert status.');
    }
  };

  const handleDeleteWatch = async (id) => {
    try {
      setError('');
      const res = await watchApi.deleteWatch(id);
      if (res.success) {
        setWatches((prev) => prev.filter((w) => w._id !== id));
        setSuccess('Search alert removed.');
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Failed to remove search alert.');
    }
  };

  const activeCount = watches.filter((w) => w.active).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Bell className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Saved Wants & Search Alerts
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xl">
            Never miss campus essentials. Specify what you are looking for; the system alerts you
            the instant a peer lists a matching item.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Alerts
            </span>
            <span className="font-mono font-bold text-sm text-slate-800">
              {activeCount} / 10 limit
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={activeCount >= 10 && !showAddForm}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Cancel' : 'New Want Alert'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add New Want Form Card */}
      {showAddForm && (
        <form
          onSubmit={handleCreateWatch}
          className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl shadow-slate-200/50 space-y-4 animate-fadeIn"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Set Up New Standing Alert
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Keywords (Comma-separated) *
              </label>
              <input
                type="text"
                required
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="e.g. Casio fx-991EX, scientific calculator, engineering"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                All keywords must appear in either the item title or description.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category (Optional)
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="">Any Category</option>
                  <option value="Electronics & Gadgets">Electronics & Gadgets</option>
                  <option value="Textbooks & Study Material">Textbooks & Study Material</option>
                  <option value="Bicycles & Mobility">Bicycles & Mobility</option>
                  <option value="Lab Equipment">Lab Equipment</option>
                  <option value="Hostel Essentials">Hostel Essentials</option>
                  <option value="Sports & Fitness">Sports & Fitness</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Condition (Optional)
                </label>
                <select
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="">Any Condition</option>
                  <option value="New">New</option>
                  <option value="Like New">Like New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Max Price Ceiling (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Want Alert'}
            </button>
          </div>
        </form>
      )}

      {/* List of Watches */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : watches.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No Saved Wants Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Save alerts for textbooks, cycles, or calculators. You will receive an instant notification
              when someone posts an item matching your criteria.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Want</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {watches.map((w) => (
            <div
              key={w._id}
              className={`bg-white rounded-3xl border p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                w.active ? 'border-slate-200 shadow-xs' : 'border-slate-200/60 opacity-60 bg-slate-50/50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {w.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-800 text-xs font-bold"
                    >
                      {kw}
                    </span>
                  ))}

                  {w.unreadMatches > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold animate-pulse">
                      {w.unreadMatches} New Match{w.unreadMatches > 1 ? 'es' : ''}!
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {w.category && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      <span>{w.category}</span>
                    </span>
                  )}
                  {w.condition && (
                    <span>Condition: <strong className="text-slate-700">{w.condition}</strong></span>
                  )}
                  {w.maxPrice && (
                    <span>
                      Max Price:{' '}
                      <strong className="text-slate-900 font-mono">
                        ₹{(w.maxPrice / 100).toLocaleString('en-IN')}
                      </strong>
                    </span>
                  )}
                  {w.lastMatchedAt && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Last match {new Date(w.lastMatchedAt).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <button
                  type="button"
                  onClick={() => handleToggleActive(w)}
                  title={w.active ? 'Mute Alert' : 'Activate Alert'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {w.active ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-emerald-600" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-slate-400" />
                      <span>Paused</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteWatch(w._id)}
                  title="Delete Alert"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyWants;
