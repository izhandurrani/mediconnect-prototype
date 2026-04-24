import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import schemesData from '../constants/schemesData';
import { ArrowLeft, Check, ChevronDown, ChevronUp, FileText, Phone as PhoneIcon, ExternalLink, Star } from 'lucide-react';

export default function SchemesScreen() {
  const navigate = useNavigate();
  const { userProfile, activeSchemes, setActiveSchemes } = useAppContext();
  const [expandedScheme, setExpandedScheme] = useState(null);

  // Smart matching: recommend schemes based on user profile
  function isRecommended(scheme) {
    const { age, income } = userProfile;
    const el = scheme.eligibility;
    return age >= el.minAge && age <= el.maxAge && income <= el.maxIncome;
  }

  function toggleScheme(schemeId) {
    setActiveSchemes((prev) =>
      prev.includes(schemeId) ? prev.filter((s) => s !== schemeId) : [...prev, schemeId]
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="text-lg font-bold text-slate-800 tracking-tight">Government Schemes</div>
          <div className="text-xs text-slate-400 font-medium">Find schemes you're eligible for</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
        {/* Profile Match Banner */}
        <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Star className="w-5 h-5 text-brand shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-slate-800">Smart Match Active</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Schemes are matched using your profile: Age {userProfile.age}, Income ₹{(userProfile.income / 1000).toFixed(0)}K/yr
            </div>
          </div>
        </div>

        {/* Scheme Cards */}
        <div className="flex flex-col gap-4">
          {schemesData.map((scheme) => {
            const recommended = isRecommended(scheme);
            const isActive = activeSchemes.includes(scheme.id);
            const isExpanded = expandedScheme === scheme.id;

            return (
              <div
                key={scheme.id}
                className={`bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isActive ? 'border-green shadow-lg shadow-green/10' : 'border-slate-100 shadow-sm'
                }`}
              >
                {/* Card Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: scheme.bgColor }}
                      >
                        {scheme.icon}
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-800 leading-tight">{scheme.name}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {recommended && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <Star className="w-3 h-3" /> Recommended
                            </span>
                          )}
                          {isActive && (
                            <span className="bg-green/10 text-green px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coverage Highlight */}
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-black tracking-tight" style={{ color: scheme.color }}>{scheme.coverage}</span>
                    <span className="text-xs text-slate-400 font-medium">{scheme.coveragePeriod}</span>
                  </div>

                  <div className="text-xs text-slate-500 leading-relaxed mb-4">{scheme.description}</div>

                  {/* Action Row */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleScheme(scheme.id)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-[0.97] ${
                        isActive
                          ? 'bg-green/10 text-green border border-green/20'
                          : 'bg-brand text-white shadow-lg shadow-brand/20'
                      }`}
                    >
                      {isActive ? '✓ Selected' : 'Select Scheme'}
                    </button>
                    <button
                      onClick={() => setExpandedScheme(isExpanded ? null : scheme.id)}
                      className="w-11 h-11 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Detail */}
                <div
                  className="transition-all duration-400 ease-in-out overflow-hidden"
                  style={{ maxHeight: isExpanded ? '800px' : '0px', opacity: isExpanded ? 1 : 0 }}
                >
                  <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                    {/* Benefits */}
                    <div className="mb-5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Key Benefits</div>
                      <div className="flex flex-col gap-2">
                        {scheme.benefits.map((benefit, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: scheme.color }} />
                            <span className="text-xs text-slate-600 font-medium">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Eligibility */}
                    <div className="mb-5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Eligibility</div>
                      <div className="text-xs text-slate-600 font-medium leading-relaxed bg-white rounded-xl p-3 border border-slate-100">
                        {scheme.eligibility.description}
                      </div>
                    </div>

                    {/* Document Checklist */}
                    <div className="mb-5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Required Documents</div>
                      <div className="flex flex-col gap-2">
                        {scheme.documents.map((doc, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-700 font-medium flex-1">{doc.name}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              doc.required ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'
                            }`}>
                              {doc.required ? 'Required' : 'Optional'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="flex gap-3">
                      <a href={`tel:${scheme.helpline}`} className="flex-1 bg-white border border-slate-100 rounded-xl p-3 flex items-center justify-center gap-2 no-underline hover:shadow-md transition-all">
                        <PhoneIcon className="w-4 h-4 text-brand" />
                        <span className="text-xs font-bold text-slate-700">{scheme.helpline}</span>
                      </a>
                      <a href={scheme.website} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border border-slate-100 rounded-xl p-3 flex items-center justify-center gap-2 no-underline hover:shadow-md transition-all">
                        <ExternalLink className="w-4 h-4 text-brand" />
                        <span className="text-xs font-bold text-slate-700">Website</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
