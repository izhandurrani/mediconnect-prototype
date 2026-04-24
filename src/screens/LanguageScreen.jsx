import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const languages = [
  { id: 'hi', name: 'Hindi', native: 'हिंदी' },
  { id: 'en', name: 'English', native: 'English' },
];

export default function LanguageScreen() {
  const navigate = useNavigate();
  const { selectedLanguage, setLanguage } = useAppContext();

  return (
    <div className="flex-1 px-5 pt-12 pb-6 bg-white flex flex-col h-full min-h-[580px]">
      <div className="flex items-center gap-2 mb-5">
        <button 
          onClick={() => navigate('/')}
          className="w-[30px] h-[30px] rounded-full bg-gray text-text2 border-none flex items-center justify-center cursor-pointer shrink-0 text-[14px]"
        >
          ←
        </button>
        <div>
          <div className="text-[20px] font-extrabold text-text mb-1">Select language</div>
          <div className="text-[12px] text-text2">Choose your preferred language</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {languages.map((lang) => {
          const isSelected = selectedLanguage === lang.id;
          return (
            <div 
              key={lang.id}
              onClick={() => setLanguage(lang.id)}
              className={`border-[1.5px] rounded-xl p-[14px_12px] cursor-pointer text-center transition-all duration-150 active:scale-[0.97] ${
                isSelected 
                  ? 'border-brand bg-brand text-white' 
                  : 'border-border bg-white text-text'
              }`}
            >
              <div className="text-[15px] font-bold mb-0.5">{lang.name}</div>
              <div className={`text-[13px] ${isSelected ? 'text-white/80' : 'text-text2'}`}>
                {lang.native}
              </div>
              {isSelected && (
                <div className="w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center mx-auto mt-1.5">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="#1A3C6E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-5">
        <button 
          onClick={() => navigate('/home')}
          className="w-full p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer tracking-wide"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
