import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Gavel,
  Tag,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeRole, setActiveRole] = useState('bidder'); // 'bidder' | 'seller' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dynamically fetched registered accounts from the database
  const [dbAccounts, setDbAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const redirectPath = location.state?.from?.pathname || '';

  useEffect(() => {
    const fetchRegisteredAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const res = await authApi.getDemoAccounts();
        if (res.success && res.users) {
          setDbAccounts(res.users);
        }
      } catch (err) {
        // Non-blocking: form works independently
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchRegisteredAccounts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedUser = await login({ email, password, role: activeRole });
      
      // Role-based smart redirection
      if (redirectPath && redirectPath !== '/') {
        navigate(redirectPath, { replace: true });
      } else if (loggedUser?.role === 'seller' || activeRole === 'seller') {
        navigate('/seller-dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.customMessage || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (account) => {
    setEmail(account.email);
    setPassword('Password123!'); // Default development password for seeded accounts
    if (account.role) {
      setActiveRole(account.role);
    } else if (account.email.includes('seller')) {
      setActiveRole('seller');
    } else if (account.email.includes('admin')) {
      setActiveRole('admin');
    } else {
      setActiveRole('bidder');
    }
    setError('');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'seller':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
            Seller
          </span>
        );
      case 'admin':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
            Admin
          </span>
        );
      case 'bidder':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
            Bidder
          </span>
        );
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md shadow-blue-500/20 mb-3">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Log in to Campus Auction
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sign in with your campus role to manage listings and live bids
          </p>
        </div>

        {/* Dynamically loaded Database Accounts with Role Badges */}
        {dbAccounts.length > 0 && (
          <div className="mb-6 p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>1-Click Role Logins (From Database)</span>
              </span>
              <span className="text-[10px] text-blue-600 font-medium">Live from MongoDB</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dbAccounts.map((acc) => (
                <button
                  key={acc._id}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className={`text-left p-2 rounded-xl bg-white hover:bg-blue-100/50 border text-xs font-semibold text-slate-800 transition-all hover:border-blue-400 ${
                    email === acc.email
                      ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/50'
                      : 'border-blue-200/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="truncate text-blue-700 font-bold">{acc.name.split(' ')[0]}</span>
                    {getRoleBadge(acc.role)}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{acc.email}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Role Selection Tabs */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Login Role Perspective
            </label>
            <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setActiveRole('bidder')}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeRole === 'bidder'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>Bidder</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole('seller')}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeRole === 'seller'
                    ? 'bg-white text-amber-700 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Seller</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole('admin')}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeRole === 'admin'
                    ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                College Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@campus.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                activeRole === 'seller'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : activeRole === 'admin'
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    Log In as {activeRole === 'seller' ? 'Senior Seller' : activeRole === 'admin' ? 'Campus Admin' : 'Student Bidder'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don't have a campus account?{' '}
              <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700">
                Register with your role
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
