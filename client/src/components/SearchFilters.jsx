import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RotateCcw, ArrowUpDown, Bell, CheckCircle2 } from 'lucide-react';
import { auctionApi } from '../api/auctionApi';
import { watchApi } from '../api/watchApi';
import { useAuth } from '../context/AuthContext';

const CONDITIONS = ['All', 'New', 'Like New', 'Good', 'Fair', 'Poor'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest Listings' },
  { value: 'closing_soon', label: 'Closing Soonest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'bids_desc', label: 'Most Bids' },
];

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active Auctions' },
  { value: 'all', label: 'All Statuses' },
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'Reserved', label: 'Reserved' },
  { value: 'Sold', label: 'Sold' },
];

const SearchFilters = ({ filters, onFilterChange, onReset, dynamicCategories }) => {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [categories, setCategories] = useState(dynamicCategories || ['All']);
  const [saveAlertStatus, setSaveAlertStatus] = useState('');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleSaveSearchAlert = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const keywords = (filters.search || '').trim() ? [filters.search.trim()] : [];
    if (keywords.length === 0 && (!filters.category || filters.category === 'All')) {
      setSaveAlertStatus('Type keyword or select category');
      setTimeout(() => setSaveAlertStatus(''), 3000);
      return;
    }
    try {
      const res = await watchApi.createWatch({
        keywords: keywords.length > 0 ? keywords : [filters.category],
        category: filters.category && filters.category !== 'All' ? filters.category : undefined,
        condition: filters.condition && filters.condition !== 'All' ? filters.condition : undefined,
        maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
      });
      if (res.success) {
        setSaveAlertStatus('✓ Alert saved!');
        setTimeout(() => setSaveAlertStatus(''), 3500);
      }
    } catch (err) {
      setSaveAlertStatus(err.customMessage || err.message || 'Failed to save alert');
      setTimeout(() => setSaveAlertStatus(''), 4000);
    }
  };

  useEffect(() => {
    if (dynamicCategories && dynamicCategories.length > 0) {
      setCategories(['All', ...dynamicCategories.filter((c) => c !== 'All')]);
    } else {
      const fetchCats = async () => {
        try {
          const res = await auctionApi.getCategories();
          if (res.success && res.categories) {
            setCategories(['All', ...res.categories.filter((c) => c !== 'All')]);
          }
        } catch (err) {
          // fallback
        }
      };
      fetchCats();
    }
  }, [dynamicCategories]);

  const handleInputChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value, page: 1 });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 mb-8">
      {/* Top Search Bar & Sort Row */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bicycles, textbooks, calculators, laptops..."
            value={filters.search || ''}
            onChange={(e) => handleInputChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
          />
          {filters.search && (
            <button
              onClick={() => handleInputChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <select
              value={filters.sort || 'newest'}
              onChange={(e) => handleInputChange('sort', e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Toggle filter drawer button on mobile */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Row */}
      <div
        className={`mt-4 pt-4 border-t border-slate-100 flex-col md:flex md:flex-row md:items-center md:flex-wrap gap-3 ${
          showMobileFilters ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Dynamic Category Dropdown from DB */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Category
          </label>
          <select
            value={filters.category || 'All'}
            onChange={(e) => handleInputChange('category', e.target.value)}
            className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div className="w-full md:w-36">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Condition
          </label>
          <select
            value={filters.condition || 'All'}
            onChange={(e) => handleInputChange('condition', e.target.value)}
            className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="w-full md:w-40">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={filters.status || 'Active'}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Price Range (INR) */}
        <div className="w-full md:w-56">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Price Range (₹)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min ₹"
              value={filters.minPrice || ''}
              onChange={(e) => handleInputChange('minPrice', e.target.value)}
              className="w-1/2 text-xs py-2 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="number"
              placeholder="Max ₹"
              value={filters.maxPrice || ''}
              onChange={(e) => handleInputChange('maxPrice', e.target.value)}
              className="w-1/2 text-xs py-2 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Quick Checkbox: Ending Soon */}
        <div className="flex items-center md:pt-5">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
            <input
              type="checkbox"
              checked={filters.closingSoon === 'true'}
              onChange={(e) =>
                handleInputChange(
                  'closingSoon',
                  e.target.checked ? 'true' : 'false'
                )
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Closing in 24h</span>
          </label>
        </div>

        {/* Save Search Alert & Reset buttons */}
        <div className="flex items-center gap-2 md:pt-5 ml-auto">
          <button
            type="button"
            onClick={handleSaveSearchAlert}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition-all px-3 py-1.5 rounded-xl shadow-xs"
            title="Get alerted whenever matching items are listed"
          >
            <Bell className="w-3.5 h-3.5 text-blue-600" />
            <span>{saveAlertStatus || 'Save Search as Alert'}</span>
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchFilters;
