import React, { useState, useEffect } from 'react';
import {
  X,
  Pencil,
  Lock,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { auctionApi } from '../api/auctionApi';

const CATEGORIES = [
  'Textbooks & Study Material',
  'Electronics & Gadgets',
  'Bicycles & Mobility',
  'Lab Equipment',
  'Hostel Essentials',
  'Sports & Fitness',
  'Other',
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];

// Convert date to local datetime-local ISO format
const toLocalISOString = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const EditListingModal = ({ isOpen, onClose, item, onUpdated }) => {
  if (!isOpen || !item) return null;

  const hasBids = (item.bidCount || 0) > 0;

  const [title, setTitle] = useState(item.title || '');
  const [category, setCategory] = useState(item.category || CATEGORIES[0]);
  const [condition, setCondition] = useState(item.condition || 'Good');
  const [description, setDescription] = useState(item.description || '');
  const [startingPrice, setStartingPrice] = useState(
    item.startingPrice ? String(item.startingPrice / 100) : ''
  );
  const [minimumIncrement, setMinimumIncrement] = useState(
    item.minimumIncrement ? String(item.minimumIncrement / 100) : ''
  );
  const [closingAt, setClosingAt] = useState(toLocalISOString(item.closingAt));

  const [existingPhotos, setExistingPhotos] = useState(
    Array.isArray(item.photos) ? [...item.photos] : []
  );
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset state when modal opens or item changes
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setCategory(item.category || CATEGORIES[0]);
      setCondition(item.condition || 'Good');
      setDescription(item.description || '');
      setStartingPrice(item.startingPrice ? String(item.startingPrice / 100) : '');
      setMinimumIncrement(item.minimumIncrement ? String(item.minimumIncrement / 100) : '');
      setClosingAt(toLocalISOString(item.closingAt));
      setExistingPhotos(Array.isArray(item.photos) ? [...item.photos] : []);
      setNewPhotoFiles([]);
      setNewPhotoPreviews([]);
      setError('');
      setSuccess('');
    }
  }, [item, isOpen]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newPhotoPreviews]);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = 5 - (existingPhotos.length + newPhotoFiles.length);
    if (remainingSlots <= 0) {
      setError('A listing can have at most 5 photos.');
      return;
    }

    const acceptedFiles = files.slice(0, remainingSlots);
    const validFiles = [];
    const validPreviews = [];

    for (const file of acceptedFiles) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 5MB size limit.`);
        return;
      }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    setNewPhotoFiles((prev) => [...prev, ...validFiles]);
    setNewPhotoPreviews((prev) => [...prev, ...validPreviews]);
    setError('');
  };

  const handleRemoveExistingPhoto = (indexToRemove) => {
    const totalPhotos = existingPhotos.length + newPhotoFiles.length;
    if (totalPhotos <= 1) {
      setError('A listing must have at least one photo.');
      return;
    }
    setExistingPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveNewPhoto = (indexToRemove) => {
    const totalPhotos = existingPhotos.length + newPhotoFiles.length;
    if (totalPhotos <= 1) {
      setError('A listing must have at least one photo.');
      return;
    }
    URL.revokeObjectURL(newPhotoPreviews[indexToRemove]);
    setNewPhotoFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setNewPhotoPreviews((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Form validations
    if (!title.trim()) {
      setError('Please provide an item title.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide an item description.');
      return;
    }

    const totalPhotos = existingPhotos.length + newPhotoFiles.length;
    if (totalPhotos === 0) {
      setError('Please provide at least one photo for the listing.');
      return;
    }

    if (!hasBids) {
      const priceNum = parseFloat(startingPrice);
      if (isNaN(priceNum) || priceNum < 1) {
        setError('Starting price must be at least ₹1.');
        return;
      }

      const incrementNum = parseFloat(minimumIncrement);
      if (isNaN(incrementNum) || incrementNum < 1) {
        setError('Minimum bid increment must be at least ₹1.');
        return;
      }

      if (!closingAt) {
        setError('Please choose a closing date and time.');
        return;
      }

      const closingDate = new Date(closingAt);
      const minFuture = new Date(Date.now() + 60 * 1000);
      if (isNaN(closingDate.getTime()) || closingDate <= minFuture) {
        setError('Auction closing time must be at least 1 minute in the future.');
        return;
      }
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category.trim());
      formData.append('condition', condition);
      formData.append('description', description.trim());
      formData.append('existingPhotos', JSON.stringify(existingPhotos));

      // Only include financial/timer changes if auction has 0 bids
      if (!hasBids) {
        formData.append('startingPrice', startingPrice);
        formData.append('minimumIncrement', minimumIncrement);
        formData.append('closingAt', new Date(closingAt).toISOString());
      }

      // Append new photo files
      newPhotoFiles.forEach((file) => {
        formData.append('photos', file);
      });

      const res = await auctionApi.updateAuction(item._id, formData);

      if (res.success) {
        setSuccess('Listing updated successfully!');
        if (onUpdated) {
          onUpdated(res.auction);
        }
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setError(res.message || 'Failed to update listing.');
      }
    } catch (err) {
      console.error('Update error:', err);
      setError(err.customMessage || err.message || 'Failed to update auction listing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full my-8 p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Edit Auction Listing
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm sm:max-w-md">
                {item.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error & Success Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* Informational Alert if Bids Exist */}
        {hasBids ? (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
            <div>
              <span className="font-bold block">
                Pricing & Closing Countdown Locked ({item.bidCount} active bid{item.bidCount > 1 ? 's' : ''})
              </span>
              <span className="text-amber-800/90 leading-relaxed block mt-0.5">
                Bids have already been placed on this auction. To protect bidder commitments, starting price, minimum increment, and closing time cannot be altered. You can still freely update title, description, category, condition, and photos.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/70 text-blue-900 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              Zero bids placed yet. All item details, pricing, and closing time are fully editable.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Item Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. TI-84 Plus CE Graphing Calculator"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium text-slate-900"
            />
          </div>

          {/* Category & Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white font-medium text-slate-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white font-medium text-slate-900"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Item Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include details about item condition, accessories, working state, etc."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-normal text-slate-900"
            />
          </div>

          {/* Pricing & Closing Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            {/* Starting Price */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Starting Price (₹)
                </label>
                {hasBids && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  disabled={hasBids}
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  className={`w-full pl-7 pr-3 py-2 rounded-xl border text-sm font-mono font-bold transition-all ${
                    hasBids
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                      : 'border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            {/* Minimum Increment */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Min Increment (₹)
                </label>
                {hasBids && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  disabled={hasBids}
                  value={minimumIncrement}
                  onChange={(e) => setMinimumIncrement(e.target.value)}
                  className={`w-full pl-7 pr-3 py-2 rounded-xl border text-sm font-mono font-bold transition-all ${
                    hasBids
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                      : 'border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            {/* Closing Time */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Closing Time
                </label>
                {hasBids && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              <input
                type="datetime-local"
                disabled={hasBids}
                value={closingAt}
                onChange={(e) => setClosingAt(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  hasBids
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                }`}
              />
            </div>
          </div>

          {/* Photos Management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Item Photos ({existingPhotos.length + newPhotoFiles.length}/5)
              </label>
              <span className="text-[11px] text-slate-400">JPG, PNG, WEBP (Max 5MB each)</span>
            </div>

            {/* Photos Preview Grid */}
            <div className="grid grid-cols-5 gap-2.5 mb-2.5">
              {/* Existing Photos */}
              {existingPhotos.map((photoUrl, idx) => (
                <div
                  key={`existing-${idx}`}
                  className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 bg-slate-50"
                >
                  <img
                    src={photoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder.svg';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingPhoto(idx)}
                    className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-4 h-4 text-rose-300 hover:text-rose-100" />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/60 text-[9px] text-white px-1 rounded">
                    Saved
                  </span>
                </div>
              ))}

              {/* Newly Selected Photos */}
              {newPhotoPreviews.map((previewUrl, idx) => (
                <div
                  key={`new-${idx}`}
                  className="relative group rounded-xl overflow-hidden aspect-square border-2 border-dashed border-blue-400 bg-blue-50/50"
                >
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveNewPhoto(idx)}
                    className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-4 h-4 text-rose-300 hover:text-rose-100" />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-blue-600 text-[9px] text-white px-1 rounded font-bold">
                    New
                  </span>
                </div>
              ))}

              {/* Upload Trigger Button if slots open */}
              {existingPhotos.length + newPhotoFiles.length < 5 && (
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 cursor-pointer aspect-square transition-all text-slate-400 hover:text-blue-600">
                  <UploadCloud className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-bold">Add</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditListingModal;

