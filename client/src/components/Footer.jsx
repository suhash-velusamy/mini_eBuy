import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ShieldCheck, MapPin } from 'lucide-react';
import { auctionApi } from '../api/auctionApi';

const Footer = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await auctionApi.getCategories();
        if (res.success && res.categories) {
          setCategories(res.categories.slice(0, 5));
        }
      } catch (err) {
        // non-blocking
      }
    };
    fetchCats();
  }, []);

  return (
    <footer className="bg-slate-900 text-slate-400 mt-20 border-t border-slate-800">
      {/* Campus Handover Safety Banner */}
      <div className="border-b border-slate-800/80 bg-slate-950/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Safe Campus Handovers</h4>
                <p className="text-xs text-slate-400">
                  Always meet in well-lit public campus locations: Student Center, Central Library, or Campus Cafeteria.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-4 h-4 text-rose-400" />
              <span>Verify item condition in person before confirming handover</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-lg text-white">
                Campus<span className="text-blue-400">Auction</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              The premier mini eBay marketplace tailored for college campuses. Helping graduating seniors pass down calculators, textbooks, lab equipment, bicycles, and electronics to juniors fairly and transparently.
            </p>
          </div>

          {/* Dynamic Categories */}
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Browse Categories
            </h5>
            <ul className="space-y-2 text-xs">
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <li key={cat}>
                    <Link
                      to={`/?category=${encodeURIComponent(cat)}`}
                      className="hover:text-white transition-colors"
                    >
                      {cat}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li><Link to="/?category=Textbooks" className="hover:text-white">Textbooks & Study Material</Link></li>
                  <li><Link to="/?category=Electronics" className="hover:text-white">Electronics & Gadgets</Link></li>
                  <li><Link to="/?category=Bicycles" className="hover:text-white">Bicycles & Mobility</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* Guidelines */}
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Bidding Rules
            </h5>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-white">Fair Bidding Policy</span></li>
              <li><span className="hover:text-white">Minimum Increments</span></li>
              <li><span className="hover:text-white">Seller Approval Step</span></li>
              <li><span className="hover:text-white">In-Person Campus Handover</span></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-6 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Campus Auction. Designed for College Campuses.</p>
          <div className="flex items-center gap-4">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Server Connected
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
