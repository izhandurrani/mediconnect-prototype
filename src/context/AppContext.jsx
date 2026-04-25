import React, { createContext, useState, useContext, useEffect } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../lib/firebase';

const AppContext = createContext();

// Screens that don't require authentication
const AUTH_SCREENS = ['/', '/signup'];

export function AppProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedLanguage, setLanguage] = useState('en');
  const [activeScheme, setActiveScheme] = useState('mj');
  const [userLocation, setLocation] = useState(null);
  const [emergencyType, setEmergencyType] = useState(null);

  // Emergency flow shared state
  const [emergencyId, setEmergencyId] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [englishTranscript, setEnglishTranscript] = useState('');

  // User Profile
  const [userProfile, setUserProfile] = useState(null);
  const [activeSchemes, setActiveSchemes] = useState(['mj']);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Auth state listener with smart routing ────────────────────────────────
  useEffect(() => {
    let unsubscribeDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous doc listener
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        // User is logged in — fetch/listen to their Firestore profile
        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile({
              name: data.name || user.displayName || 'User',
              age: data.age || null,
              phone: data.phone || user.email || '',
              email: data.email || user.email || '',
              familyContact: data.familyContact || '',
              bloodGroup: data.bloodGroup || '',
              income: data.income || null,
              occupation: data.occupation || '',
            });
            if (data.language) setLanguage(data.language);
            if (data.scheme) setActiveScheme(data.scheme);
            if (data.activeSchemes) setActiveSchemes(data.activeSchemes);
            setProfileLoading(false);

            // Smart redirect: if on auth screens, go to the right place
            const currentPath = location.pathname;
            if (AUTH_SCREENS.includes(currentPath) || currentPath === '/language') {
              if (data.language) {
                navigate('/home', { replace: true });
              } else {
                navigate('/language', { replace: true });
              }
            }
          } else {
            // New user — doc doesn't exist yet (will be created by signUp or signInWithGoogle)
            setUserProfile({
              name: user.displayName || 'User',
              phone: '',
              email: user.email || '',
            });
            setProfileLoading(false);
          }
        }, (error) => {
          console.error("Firestore listener error:", error);
          setProfileLoading(false);
        });
      } else {
        // User is signed out
        setUserProfile(null);
        setProfileLoading(false);

        // Redirect to login if on a protected screen
        const currentPath = location.pathname;
        if (!AUTH_SCREENS.includes(currentPath)) {
          navigate('/', { replace: true });
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    selectedLanguage,
    setLanguage,
    activeScheme,
    setActiveScheme,
    location: userLocation,
    setLocation,
    emergencyType,
    setEmergencyType,
    userProfile,
    setUserProfile,
    activeSchemes,
    setActiveSchemes,
    profileLoading,
    // Emergency flow
    emergencyId,
    setEmergencyId,
    selectedHospital,
    setSelectedHospital,
    voiceTranscript,
    setVoiceTranscript,
    englishTranscript,
    setEnglishTranscript,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
