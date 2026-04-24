import React, { createContext, useState, useContext, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [selectedLanguage, setLanguage] = useState('en');
  const [activeScheme, setActiveScheme] = useState('mj');
  const [location, setLocation] = useState(null);
  const [emergencyType, setEmergencyType] = useState(null);

  // User Profile
  const [userProfile, setUserProfile] = useState({
    name: 'Izhan Durrani',
    age: 22,
    phone: '+91 98765 43210',
    familyContact: '+91 91234 56789',
    bloodGroup: 'B+',
    income: 250000,
    occupation: 'Student',
  });

  const [activeSchemes, setActiveSchemes] = useState(['mj']);
  const [profileLoading, setProfileLoading] = useState(true);

  // Global Auth & Profile Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Listen to Firestore document for this user in real-time
        const unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile({
              name: data.name || user.displayName || 'User',
              age: data.age || 22,
              phone: data.phone || user.phoneNumber || '',
              familyContact: data.familyContact || '',
              bloodGroup: data.bloodGroup || 'B+',
              income: data.income || 250000,
              occupation: data.occupation || 'Student',
            });
            if (data.activeSchemes) {
              setActiveSchemes(data.activeSchemes);
            }
            setProfileLoading(false);
          } else {
            // New user, create default document
            const defaultProfile = {
              name: user.displayName || 'Izhan Durrani',
              age: 22,
              phone: user.phoneNumber || '+91 98765 43210',
              familyContact: '+91 91234 56789',
              bloodGroup: 'B+',
              income: 250000,
              occupation: 'Student',
              activeSchemes: ['mj']
            };
            setDoc(doc(db, 'users', user.uid), defaultProfile, { merge: true });
            setProfileLoading(false);
          }
        }, (error) => {
          console.error("Firestore listener error:", error);
          setProfileLoading(false);
        });

        return () => unsubscribeDoc();
      } else {
        setProfileLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  console.log('Current Profile:', userProfile);

  const value = {
    selectedLanguage,
    setLanguage,
    activeScheme,
    setActiveScheme,
    location,
    setLocation,
    emergencyType,
    setEmergencyType,
    userProfile,
    setUserProfile,
    activeSchemes,
    setActiveSchemes,
    profileLoading,
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
