import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import axios from 'axios';
import { useAppContext } from '../context/AppContext';
import { translations } from '../constants/translations';
import ProfileDrawer from '../components/ProfileDrawer';

/* ── Haversine distance (km) ── */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Time-aware greeting ── */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Derive display name from auth or profile ── */
function getDisplayName(profile) {
  if (profile?.name && profile.name !== 'User') return profile.name;
  const user = auth.currentUser;
  if (user?.displayName) return user.displayName;
  if (user?.phoneNumber) return user.phoneNumber;
  return 'User';
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { activeScheme, selectedLanguage, location, setLocation, userProfile, activeSchemes, profileLoading } = useAppContext();
  const [locationName, setLocationName] = useState('Detecting location...');
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [showHospitalPreview, setShowHospitalPreview] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = getDisplayName(userProfile);
  const greeting = getGreeting();

  useEffect(() => {
    const applyFallbackLocation = () => {
      setLocation({ lat: 19.8762, lng: 75.3433 });
      setLocationName('Chhatrapati Sambhajinagar');
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          
          try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            if (res.data && res.data.address) {
              const city = res.data.address.city || res.data.address.town || res.data.address.county;
              setLocationName(city || 'Location Found');
            } else {
              applyFallbackLocation();
            }
          } catch (err) {
            applyFallbackLocation();
          }
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          applyFallbackLocation();
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    } else {
      applyFallbackLocation();
    }
  }, [setLocation]);

  useEffect(() => {
    if (!location?.lat || !location?.lng) return;

    async function fetchNearbyHospitals() {
      setHospitalsLoading(true);
      try {
        const snap = await getDocs(collection(db, 'hospitals'));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const withDist = docs.map(h => ({
          ...h,
          distanceKm: haversineDistance(location.lat, location.lng, h.lat, h.lng)
        }));
        
        withDist.sort((a, b) => a.distanceKm - b.distanceKm);
        setNearbyHospitals(withDist.slice(0, 3)); // Top 3 nearest
      } catch (err) {
        console.error('Error fetching nearby hospitals:', err);
      } finally {
        setHospitalsLoading(false);
      }
    }

    fetchNearbyHospitals();
  }, [location]);

  const getSchemeName = (id) => {
    switch(id) {
      case 'mj': return 'MJPJAY';
      case 'ab': return 'Ayushman Bharat';
      default: return 'No scheme';
    }
  };

  const getLanguageName = (id) => {
    switch(id) {
      case 'hi': return 'Hindi';
      case 'mr': return 'Marathi';
      case 'en': return 'English';
      case 'mix': return 'Hinglish';
      default: return 'Marathi';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 overflow-hidden">

      <ProfileDrawer isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      <div className="flex-1 p-4 md:p-8 flex flex-col overflow-y-auto pb-28 md:pb-8">

        {/* ── Greeting Header ── */}
        <div className="flex items-center justify-between pt-2 md:pt-4 mb-5">
          <div>
            <div className="text-sm text-slate-400 font-medium tracking-wide">{greeting},</div>
            {profileLoading ? (
              <div className="h-9 w-48 bg-slate-200 animate-pulse rounded-lg mt-1"></div>
            ) : (
              <div className="text-3xl font-black text-slate-800 tracking-tight leading-tight mt-1">{displayName}</div>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#2563EB">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span className="text-xs text-brand font-bold">{locationName}</span>
            </div>
          </div>
          {profileLoading ? (
            <div className="w-12 h-12 rounded-2xl bg-brand/5 animate-pulse shrink-0 mt-1"></div>
          ) : (
            <button 
              onClick={() => setProfileOpen(true)}
              className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-sm font-bold text-brand border-2 border-transparent hover:border-brand/30 transition-all active:scale-95 cursor-pointer shrink-0 mt-1"
            >
              {displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </button>
          )}
        </div>

        {/* ── SOS Button ── */}
        <div 
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 mb-8 flex flex-col items-center gap-3 cursor-pointer transition-all active:scale-[0.97] shadow-xl shadow-red-500/20 hover:shadow-2xl hover:-translate-y-0.5"
          onClick={() => navigate('/voice')}
        >
          <div className="w-20 h-20 rounded-full border-[3px] border-white/30 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <path d="M15 6v12M15 21v2" stroke="white" strokeWidth="3" strokeLinecap="round" />
                <circle cx="15" cy="15" r="12" stroke="white" strokeWidth="2" fill="none" opacity=".5" />
              </svg>
            </div>
          </div>
          <div className="text-white text-lg font-extrabold tracking-wider uppercase">{translations[selectedLanguage]?.sos_button || 'EMERGENCY'}</div>
          <div className="text-white/70 text-xs text-center leading-relaxed font-medium">
            Tap to find hospitals with live capacity confirmation
          </div>
        </div>

        {/* ── Active Schemes Badge ── */}
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-6 flex items-center gap-3 shadow-sm cursor-pointer active:bg-slate-50" onClick={() => navigate('/schemes')}>
          <div className="w-2 h-2 rounded-full bg-green shrink-0"></div>
          <div className="text-xs text-slate-700 flex-1">
            Active: <b>{activeSchemes.map(s => getSchemeName(s)).join(', ') || 'None'}</b> · {getLanguageName(selectedLanguage)}
          </div>
          <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green/10 text-green ml-auto shrink-0">
            {activeSchemes.length} Active
          </div>
        </div>


        {/* ── Quick Actions Grid ── */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div 
            className={`bg-white border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md active:bg-slate-50 ${showHospitalPreview ? 'border-brand shadow-md ring-2 ring-brand/10' : 'border-slate-100'}`}
            onClick={() => setShowHospitalPreview((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-brand/10">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="#2563EB">
                    <path d="M8 1C4.7 1 2 3.7 2 7s6 9 6 9 6-5.7 6-9-2.7-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </div>
                <div className="text-xs font-bold text-slate-800">Nearby hospitals</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Tap to preview</div>
              </div>
              <svg 
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-300 ${showHospitalPreview ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          
          <div 
            className="bg-white border border-slate-100 rounded-xl p-5 cursor-pointer transition-all hover:shadow-md active:bg-slate-50"
            onClick={() => navigate('/schemes')}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-green/10">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="#15803D" strokeWidth="1.2" />
                <path d="M8 5v6M5 8h6" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-xs font-bold text-slate-800">Govt. Schemes</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{activeSchemes.length} scheme{activeSchemes.length !== 1 ? 's' : ''} active</div>
          </div>
          
          <div className="bg-white border border-slate-100 rounded-xl p-5 cursor-pointer transition-all hover:shadow-md active:bg-slate-50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-purple-50">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#7C3AED" strokeWidth="1.2" />
                <path d="M8 5v3.5l2.5 1.5" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-xs font-bold text-slate-800">Emergency history</div>
            <div className="text-[10px] text-slate-400 mt-0.5">2 past alerts</div>
          </div>
          
          <div className="bg-white border border-slate-100 rounded-xl p-5 cursor-pointer transition-all hover:shadow-md active:bg-slate-50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-amber-50">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.1l-3.7 2.2.7-4.1-3-2.9 4.2-.7z" stroke="#B45309" strokeWidth="1.1" fill="none" />
              </svg>
            </div>
            <div className="text-xs font-bold text-slate-800">How it works</div>
            <div className="text-[10px] text-slate-400 mt-0.5">About MediConnect</div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            ── Collapsible Hospital Preview ──
            ═══════════════════════════════════════════ */}
        <div 
          className="transition-all duration-500 ease-in-out overflow-hidden"
          style={{ 
            maxHeight: showHospitalPreview ? '600px' : '0px',
            opacity: showHospitalPreview ? 1 : 0,
          }}
        >
          <div className="pt-1">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Top 3 Nearest</h3>
              <button 
                onClick={() => navigate('/hospitals')} 
                className="text-[10px] font-bold text-brand uppercase tracking-wider hover:underline bg-transparent border-none cursor-pointer"
              >
                View All →
              </button>
            </div>

            {hospitalsLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible scrollbar-hide">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="min-w-[220px] md:min-w-0 bg-white border border-slate-100 rounded-xl p-5 shadow-sm animate-pulse flex flex-col gap-3">
                    <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                    <div className="h-3 bg-slate-50 rounded-full w-1/2"></div>
                    <div className="h-3 bg-slate-50 rounded-full w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : nearbyHospitals.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <div className="text-sm text-slate-400 mt-3 font-medium">Detecting location...</div>
                <div className="text-[10px] text-slate-300 mt-1">Hospitals will appear once your location is confirmed</div>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible scrollbar-hide">
                {nearbyHospitals.map((hospital, i) => (
                  <div
                    key={hospital.id}
                    onClick={() => navigate(`/hospital/${hospital.id}`, { state: { hospital } })}
                    className="min-w-[220px] md:min-w-0 bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer flex flex-col gap-3 group"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="text-sm font-bold text-slate-800 truncate group-hover:text-brand transition-colors">
                      {hospital.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#94A3B8">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <span className="text-[11px] text-slate-400 font-medium">{hospital.distanceKm.toFixed(1)} km away</span>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse"></span>
                        <span className="text-[10px] font-bold text-green uppercase tracking-wider">Live Sync</span>
                      </div>
                      <span className="text-[10px] font-bold text-brand group-hover:underline uppercase tracking-wider">
                        Details →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* ── Info Card ── */}
        <div className="bg-white border border-slate-100 rounded-xl p-5 text-xs text-slate-500 leading-relaxed shadow-sm mt-2">
          <b className="text-slate-700">How MediConnect helps:</b><br />
          In an emergency, we call all nearby hospitals simultaneously. Only hospitals that confirm capacity are shown. You choose — then we alert them you're coming.
        </div>
      </div>
    </div>
  );
}
