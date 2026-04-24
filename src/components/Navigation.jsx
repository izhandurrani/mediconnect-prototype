import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/home', label: 'Home', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
    )},
    { path: '/emergency', label: 'SOS', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
    )},
    { path: '/hospitals', label: 'Hospitals', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
    )},
  ];

  const isActive = (path) => location.pathname === path;

  // Only show bottom nav on main app screens (not login/language)
  const showNav = ['/home', '/emergency', '/hospitals', '/schemes'].some(p => location.pathname.startsWith(p)) || location.pathname.startsWith('/hospital');

  if (!showNav) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-100 flex items-center justify-around py-2.5 px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 transition-all border-none bg-transparent cursor-pointer px-4 py-1 rounded-xl ${
            isActive(item.path) 
              ? 'text-brand' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className={`transition-transform ${isActive(item.path) ? 'scale-110' : ''}`}>{item.icon}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive(item.path) ? 'text-brand' : ''}`}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
