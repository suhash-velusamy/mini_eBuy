import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  Gavel,
  Tag,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeRole, setActiveRole] = useState('bidder'); // 'bidder' | 'seller' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectPath = location.state?.from?.pathname || '';

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
