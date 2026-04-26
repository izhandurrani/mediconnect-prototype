import React from 'react';

/* ── Status visual configuration ── */
const STATUS_STYLES = {
  nearby: {
    border: 'border-slate-100',
    bg: '',
    dot: 'bg-slate-200',
    dotAnim: '',
    label: '',
    labelColor: '',
    cardAnim: '',
  },
  calling: {
    border: 'border-amber-300',
    bg: 'bg-amber-50/50',
    dot: 'bg-amber-400',
    dotAnim: 'animate-pulse',
    label: 'Calling...',
    labelColor: 'text-amber-600',
    cardAnim: 'hospital-card-calling',
  },
  confirmed: {
    border: 'border-green-400',
    bg: 'bg-green-50/60',
    dot: 'bg-green-500',
    dotAnim: '',
    label: 'Confirmed ✓',
    labelColor: 'text-green-600',
    cardAnim: 'hospital-card-confirmed',
  },
  rejected: {
    border: 'border-red-300',
    bg: 'bg-red-50/40',
    dot: 'bg-red-400',
    dotAnim: '',
    label: 'Rejected ✕',
    labelColor: 'text-red-500',
    cardAnim: '',
  },
  no_response: {
    border: 'border-slate-200',
    bg: 'bg-slate-50/50',
    dot: 'bg-slate-300',
    dotAnim: '',
    label: 'No Response',
    labelColor: 'text-slate-400',
    cardAnim: '',
  },
};

/* ── Scheme label map ── */
const SCHEME_LABELS = {
  ab: { label: 'Ayushman Bharat', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  mj: { label: 'MJPJAY', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

/* ── Capability config ── */
const CAPABILITY_CONFIG = {
  icu: { label: 'ICU', color: 'bg-red-50 text-red-600' },
  cardiac: { label: 'Cardiac', color: 'bg-amber-50 text-amber-600' },
  nicu: { label: 'NICU', color: 'bg-blue-50 text-blue-600' },
  trauma: { label: 'Trauma', color: 'bg-purple-50 text-purple-600' },
  emergency24x7: { label: '24/7', color: 'bg-green-50 text-green-600' },
};

export default function HospitalCard({
  hospital,
  status = 'nearby',
  onClick,
  showDistance = true,
}) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.nearby;
  const isGovt =
    hospital.name?.toLowerCase().includes('govt') ||
    hospital.name?.toLowerCase().includes('government') ||
    hospital.name?.toLowerCase().includes('civil');

  const capabilities = hospital.capabilities || {};
  const schemes = hospital.schemes || [];
  const activeCapabilities = Object.entries(capabilities).filter(([, v]) => v);

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl border-2 p-4 transition-all duration-300
        ${style.border} ${style.bg} ${style.cardAnim}
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]' : ''}
      `}
    >
      {/* Row 1: Name + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 leading-snug">{hospital.name}</div>
          {showDistance && hospital.distanceKm != null && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#94A3B8">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span className="text-[11px] text-slate-400 font-medium">
                {hospital.distanceKm.toFixed(1)} km · ~{Math.max(2, Math.round(hospital.distanceKm * 2.5))} min
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status indicator (only during calling phase) */}
          {status !== 'nearby' && (
            <div className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${style.dot} ${style.dotAnim}`} />
              <span className={`text-[11px] font-bold ${style.labelColor}`}>{style.label}</span>
            </div>
          )}

          {/* Type badge (only in browse mode) */}
          {status === 'nearby' && (
            <span
              className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                isGovt ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
              }`}
            >
              {isGovt ? 'Govt.' : 'Private'}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Capabilities */}
      {activeCapabilities.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-3">
          {activeCapabilities.map(([key]) => {
            const cap = CAPABILITY_CONFIG[key];
            if (!cap) return null;
            return (
              <span
                key={key}
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cap.color}`}
              >
                {cap.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Row 3: Schemes */}
      {schemes.length > 0 && status === 'nearby' && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {schemes.map((s) => {
            const scheme = SCHEME_LABELS[s];
            if (!scheme) return null;
            return (
              <span
                key={s}
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${scheme.color}`}
              >
                {scheme.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
