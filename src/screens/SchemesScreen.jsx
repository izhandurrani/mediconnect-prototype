import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ArrowLeft, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";

const schemesData = [
  {
    id: 'ab',
    name: 'Ayushman Bharat (PM-JAY)',
    shortName: 'PM-JAY',
    coverage: '₹5,00,000',
    description: 'Provides free health coverage for secondary and tertiary care hospitalization.',
    benefits: ['Up to ₹5 Lakh cashless treatment', 'Covers 1,929+ medical procedures', 'All pre-existing diseases covered'],
    eligibility: { maxIncome: 300000, minAge: 0, maxAge: 120, description: 'Families identified based on SECC 2011 data.' },
    apply: 'Visit nearest government hospital with required documents.',
  },
  {
    id: 'mj',
    name: 'MJPJAY (Maharashtra)',
    shortName: 'MJPJAY',
    coverage: '₹1,50,000',
    description: 'Cashless medical and surgical treatment to BPL/APL families in Maharashtra.',
    benefits: ['Covers 996 procedures', 'Follow-up treatment for 10 days', 'Critical illness coverage'],
    eligibility: { maxIncome: 100000, minAge: 0, maxAge: 120, description: 'Maharashtra residents with Yellow/Orange ration cards.' },
    apply: 'Apply at network hospitals in Maharashtra with Domicile certificate.',
  },
  {
    id: 'pmjjby',
    name: 'PM Jeevan Jyoti Bima Yojana',
    shortName: 'PMJJBY',
    coverage: '₹2,00,000',
    description: 'Life insurance offering ₹2 Lakh cover for a nominal annual premium.',
    benefits: ['Life cover on death due to any reason', 'Auto-debit from savings account', 'No medical exam required'],
    eligibility: { maxIncome: 9999999, minAge: 18, maxAge: 50, description: 'Indian citizens aged 18-50 with a bank account.' },
    apply: 'Contact your bank or post office to enable auto-debit.',
  },
];

const statesList = ["Maharashtra", "Karnataka", "Delhi", "Gujarat", "Tamil Nadu", "Uttar Pradesh", "Rajasthan"];
const issues = ["Accident", "Disease", "Pregnancy", "Disability"];
const rationCards = ["No Ration Card", "Yellow Card", "Orange Card", "White Card"];
const employmentTypes = ["None of these", "Central Gov Employee", "State Gov Employee", "Factory Worker"];

export default function SchemesScreen() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ 
    dob: "", income: "", state: "", issue: "", 
    ration: "", employment: "", isMahCitizen: "" 
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [nonEligible, setNonEligible] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [hospitalsByScheme, setHospitalsByScheme] = useState({});

  const getAge = (dob) => {
    if (!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  };

  async function loadHospitalsByScheme() {
    const snap = await getDocs(collection(db, 'hospitals'));
    const grouped = {};

    snap.docs.forEach((docSnap) => {
      const hospital = { id: docSnap.id, ...docSnap.data() };
      const schemes = hospital.schemes || [];

      schemes.forEach((schemeId) => {
        if (!grouped[schemeId]) grouped[schemeId] = [];
        grouped[schemeId].push(hospital);
      });
    });

    Object.keys(grouped).forEach((schemeId) => {
      grouped[schemeId].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return grouped;
  }

  const handleSearch = async () => {
    const { dob, income, state, issue } = formData;
    if (!dob || !income || !state || !issue) {
      setError("Please fill all required fields to check eligibility.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const age = getAge(dob);
      const userIncome = Number(income);
      let matched = [];
      let unmatched = [];

      // Global income cap logic
      if (userIncome > 800000) {
        unmatched = schemesData.map(s => ({
          ...s,
          failureReasons: ["Ineligible due to High Annual Income (Exceeds ₹8,00,000 limit)"]
        }));
      } else {
        schemesData.forEach((s) => {
          const e = s.eligibility;
          const reasons = [];

          if (!(age >= e.minAge && age <= e.maxAge)) 
            reasons.push(`Age requirement: ${e.minAge}-${e.maxAge} years`);
          
          if (userIncome > e.maxIncome) 
            reasons.push(`Income limit: ₹${e.maxIncome.toLocaleString()}`);
          
          if (s.id === 'mj' && state !== "Maharashtra") 
            reasons.push(`Location: Exclusive to Maharashtra residents.`);

          if (s.id === 'pmjjby' && (issue === "Pregnancy" || issue === "Accident")) {
            reasons.push(`This is life insurance, not medical coverage.`);
          }

          if (reasons.length === 0) matched.push(s);
          else unmatched.push({ ...s, failureReasons: reasons });
        });
      }

      const groupedHospitals = await loadHospitalsByScheme();
      setHospitalsByScheme(groupedHospitals);
      setResults(matched);
      setNonEligible(unmatched);
      setShowResults(true);
    } catch (err) {
      console.error('Hospital scheme lookup failed:', err);
      setError("Could not load scheme hospitals. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <h2 className="text-xl font-bold text-slate-800">Fetching Eligible Schemes</h2>
        <p className="text-slate-500 mt-2">Analyzing your profile against government criteria...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white p-4 flex items-center gap-4 border-b sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft /></button>
        <h2 className="font-bold text-blue-700 text-lg">Scheme Eligibility</h2>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {!showResults ? (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-5">
            <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Profile Details</h3>
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex gap-2"><AlertCircle size={18}/>{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400">DATE OF BIRTH *</label>
                <input type="date" className="p-3 border rounded-xl" onChange={(e) => setFormData({...formData, dob: e.target.value})} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400">ANNUAL INCOME (₹) *</label>
                <input type="number" placeholder="e.g. 80000" className="p-3 border rounded-xl" onChange={(e) => setFormData({...formData, income: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 mb-2 block">YOUR STATE *</label>
              <div className="flex flex-wrap gap-2">
                {statesList.map(s => (
                  <button key={s} onClick={() => setFormData({...formData, state: s})} 
                    className={`px-4 py-2 rounded-xl border text-sm transition ${formData.state === s ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 mb-2">REASON FOR APPLYING *</label>
              <select className="p-3 border rounded-xl bg-white" onChange={(e) => setFormData({...formData, issue: e.target.value})}>
                <option value="">Select an option</option>
                {issues.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex flex-col gap-1">
                 <label className="text-xs font-bold text-slate-400 mb-2">RATION CARD TYPE</label>
                 <select className="p-3 border rounded-xl bg-white" onChange={(e) => setFormData({...formData, ration: e.target.value})}>
                   {rationCards.map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
               </div>
               <div className="flex flex-col gap-1">
                 <label className="text-xs font-bold text-slate-400 mb-2">EMPLOYMENT TYPE</label>
                 <select className="p-3 border rounded-xl bg-white" onChange={(e) => setFormData({...formData, employment: e.target.value})}>
                   {employmentTypes.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                 </select>
               </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 mb-2">CITIZEN OF MAHARASHTRA?</label>
              <div className="flex gap-4">
                {["Yes", "No"].map(choice => (
                  <label key={choice} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mahCitizen" className="w-4 h-4" onChange={() => setFormData({...formData, isMahCitizen: choice})} />
                    <span className="text-sm text-slate-600">{choice}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleSearch} className="bg-blue-600 text-white py-4 rounded-2xl font-bold mt-4 shadow-lg active:scale-95 transition-all">
              Find Eligible Schemes
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-slate-800">
                  {results.length > 0 ? "Recommended Schemes" : "No Matches Found"}
                </h3>
                <button onClick={() => setShowResults(false)} className="text-blue-600 text-sm font-bold">Edit Details</button>
            </div>

            {results.length > 0 ? (
              <div className="space-y-3">
                {results.map(s => (
                  <SchemeCard
                    key={s.id}
                    scheme={s}
                    isEligible={true}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    hospitals={hospitalsByScheme[s.id] || []}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl mb-4">
                    <p className="text-red-700 font-bold text-sm">Not Eligible for Any Schemes</p>
                    <p className="text-red-600 text-xs">Your current profile does not meet the minimum requirements for the listed government benefits.</p>
                </div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Failure Details:</h4>
                <div className="space-y-3">
                  {nonEligible.map(s => (
                    <SchemeCard
                      key={s.id}
                      scheme={s}
                      isEligible={false}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      hospitals={[]}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SchemeCard({ scheme, isEligible, expanded, setExpanded, hospitals = [] }) {
  const isOpen = expanded === scheme.id;
  const visibleHospitals = hospitals.slice(0, 6);

  return (
    <div className={`bg-white rounded-2xl border transition-all ${isEligible ? "border-green-200 shadow-sm" : "border-slate-200"}`}>
      <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(isOpen ? null : scheme.id)}>
        <div className="flex gap-3 items-center">
            <div className={`p-2 rounded-lg ${isEligible ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400"}`}>
                {isEligible ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
            </div>
            <div>
                <h4 className={`font-bold ${isEligible ? "text-slate-800" : "text-slate-500"}`}>{scheme.name}</h4>
                <p className="text-xs text-slate-400">Coverage: {scheme.coverage}</p>
            </div>
        </div>
        {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
      </div>
      
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t bg-slate-50/50 rounded-b-2xl">
          {!isEligible && (
            <div className="mb-3 p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-[10px] font-bold text-red-700 uppercase mb-1">Ineligible Due To:</p>
              {scheme.failureReasons.map((r, i) => (
                <p key={i} className="text-xs text-red-600 flex gap-1 font-medium">● {r}</p>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-600 mb-3">{scheme.description}</p>
          <div className="space-y-2">
            <p className="font-bold text-xs text-slate-700">Key Benefits:</p>
            {scheme.benefits.map((b, i) => <p key={i} className="text-xs text-slate-500 flex gap-2"><span>•</span> {b}</p>)}
          </div>
          <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Process:</p>
            <p className="text-xs text-slate-700 font-medium">{scheme.apply}</p>
          </div>
          {isEligible && (
            <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Hospitals accepting this scheme</p>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  {hospitals.length}
                </span>
              </div>

              {hospitals.length > 0 ? (
                <div className="space-y-2">
                  {visibleHospitals.map((hospital) => (
                    <div key={hospital.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{hospital.name || 'Hospital'}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {hospital.city || 'Maharashtra'}
                          {hospital.phone ? ` · ${hospital.phone}` : ''}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full shrink-0">
                        Accepted
                      </span>
                    </div>
                  ))}

                  {hospitals.length > visibleHospitals.length && (
                    <p className="text-[10px] font-bold text-slate-400 px-1">
                      +{hospitals.length - visibleHospitals.length} more hospitals accept this scheme
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-medium">
                  No hospitals are currently listed for this scheme in the app database.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
