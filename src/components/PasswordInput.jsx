import React, { useState } from 'react';

/**
 * Password input with show/hide toggle eye icon.
 * Accepts same props as a standard <input /> plus label and error.
 */
export default function PasswordInput({ label, error, className = '', ...inputProps }) {
  const [show, setShow] = useState(false);

  return (
    <div className="mb-[14px]">
      {label && (
        <div className="text-[12px] font-semibold text-text2 mb-[5px]">{label}</div>
      )}
      <div className="relative">
        <input
          {...inputProps}
          type={show ? 'text' : 'password'}
          className={`w-full p-[11px_12px] pr-10 border border-border rounded-xl text-[13px] text-text bg-gray outline-none focus:border-brand2 focus:bg-white ${
            error ? 'border-red-400' : ''
          } ${className}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 p-0"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            /* EyeOff icon */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            /* Eye icon */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error && (
        <div className="text-[11px] text-red-500 mt-1 font-medium">{error}</div>
      )}
    </div>
  );
}
