import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { X, Phone, User, Users, Droplets, Briefcase, IndianRupee, Check } from 'lucide-react';

const OCCUPATIONS = ['Student', 'Employed', 'Self-Employed', 'Farmer', 'Unemployed', 'Retired', 'Other'];

export default function ProfileDrawer({ isOpen, onClose }) {
  const { userProfile, setUserProfile } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ ...userProfile });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // Reset draft when drawer opens
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...userProfile });
      setIsEditing(false);
      setToast('');
    }
  }, [isOpen, userProfile]);

  function handleChange(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Update AppContext immediately (instant UI update everywhere)
      setUserProfile({ ...draft });

      // Sync to Firestore
      const uid = auth.currentUser?.uid;
      if (uid) {
        await setDoc(doc(db, 'users', uid), {
          ...draft,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      setToast('Saved successfully!');
      setTimeout(() => {
        setIsEditing(false);
        setToast('');
      }, 1500);
    } catch (err) {
      console.error('Profile save error:', err);
      setToast('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft({ ...userProfile });
    setIsEditing(false);
  }

  const initials = userProfile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 z-[60] h-full w-[340px] max-w-[90vw] bg-white shadow-2xl transform transition-transform duration-400 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-gradient-to-br from-brand to-blue-700 p-6 pb-8 relative shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors border-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-black text-white mb-4 border border-white/30">
              {initials}
            </div>

            {isEditing ? (
              <input
                type="text"
                value={draft.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="text-xl font-black text-white bg-white/10 border border-white/30 rounded-xl px-3 py-2 w-full outline-none placeholder-white/40"
              />
            ) : (
              <div className="text-xl font-black text-white tracking-tight">{userProfile?.name || 'User'}</div>
            )}
            <div className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">MediConnect Verified</div>
          </div>

          {/* Toast */}
          {toast && (
            <div className={`mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-fade-up ${
              toast.includes('failed') ? 'bg-red-50 text-red-600' : 'bg-green/10 text-green'
            }`}>
              <Check className="w-4 h-4" />
              {toast}
            </div>
          )}

          {/* Scrollable Body */}
          <div className="p-5 flex flex-col gap-3 flex-1 overflow-y-auto pb-32">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Personal Details</div>

            {/* Age */}
            <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Age</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={draft.age}
                    onChange={(e) => handleChange('age', parseInt(e.target.value) || 0)}
                    className="text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full outline-none focus:border-brand mt-1"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-800">{userProfile.age} years</div>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-green/10 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-green" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Phone</div>
                {isEditing ? (
                  <input
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full outline-none focus:border-brand mt-1"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-800">{userProfile.phone}</div>
                )}
              </div>
            </div>

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3 mb-1">Emergency Info</div>

            {/* Family Contact */}
            <div className="flex items-center gap-4 bg-red-50 rounded-xl p-4 border border-red-100">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">SOS Family Contact</div>
                {isEditing ? (
                  <input
                    type="tel"
                    value={draft.familyContact}
                    onChange={(e) => handleChange('familyContact', e.target.value)}
                    className="text-sm font-bold text-slate-800 bg-white border border-red-200 rounded-lg px-3 py-1.5 w-full outline-none focus:border-red-400 mt-1"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-800">{userProfile.familyContact}</div>
                )}
              </div>
            </div>

            {/* Blood Group */}
            <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Blood Group</div>
                {isEditing ? (
                  <select
                    value={draft.bloodGroup}
                    onChange={(e) => handleChange('bloodGroup', e.target.value)}
                    className="text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full outline-none focus:border-brand mt-1"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm font-bold text-slate-800">{userProfile.bloodGroup}</div>
                )}
              </div>
            </div>

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3 mb-1">Financial Info</div>

            {/* Annual Income */}
            <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <IndianRupee className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Annual Income</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={draft.income}
                    onChange={(e) => handleChange('income', parseInt(e.target.value) || 0)}
                    placeholder="e.g. 250000"
                    className="text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full outline-none focus:border-brand mt-1"
                  />
                ) : (
                  <div className="text-sm font-bold text-slate-800">₹{(userProfile.income / 1000).toFixed(0)}K / year</div>
                )}
              </div>
            </div>

            {/* Occupation */}
            <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Occupation</div>
                {isEditing ? (
                  <select
                    value={draft.occupation}
                    onChange={(e) => handleChange('occupation', e.target.value)}
                    className="text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full outline-none focus:border-brand mt-1"
                  >
                    {OCCUPATIONS.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm font-bold text-slate-800">{userProfile.occupation}</div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-5 border-t border-slate-100 shrink-0">
            {isEditing ? (
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-slate-50 text-slate-600 py-3.5 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors uppercase tracking-wider border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-green text-white py-3.5 rounded-xl text-sm font-bold hover:bg-green/90 transition-colors uppercase tracking-wider border-none cursor-pointer shadow-lg shadow-green/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full bg-slate-50 text-slate-600 py-3.5 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors uppercase tracking-wider border-none cursor-pointer"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
