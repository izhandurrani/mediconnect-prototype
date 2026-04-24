import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function CallingScreen() {
  const navigate = useNavigate();
  const { activeScheme, emergencyType } = useAppContext();
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Mock countdown for the UI
  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/hospitals');
      return;
    }
    const timer = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, navigate]);

  // Mock data for UI visualization
  const displayHospitals = [
    { id: '1', name: 'Govt. Medical College Hospital', status: 'confirmed' },
    { id: '2', name: 'City Care Hospital', status: 'calling' },
    { id: '3', name: 'MGM Hospital', status: 'calling' },
    { id: '4', name: 'Kamalnayan Bajaj Hospital', status: 'waiting' },
  ];

  const getStatusString = (status) => {
    if (status === 'confirmed') return 'confirmed';
    if (status === 'calling') return 'calling';
    return 'waiting';
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="bg-red p-[14px_16px] flex items-center gap-[10px] shrink-0">
        <div className="text-white ml-[6px]">
          <div className="text-[15px] font-bold">Contacting hospitals</div>
          <div className="text-[11px] opacity-80 capitalize">
            {emergencyType || 'Cardiac'} emergency · {activeScheme === 'mj' ? 'MJPJAY' : 'Scheme'} · 10km radius
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start p-[24px_24px_0] gap-[16px]">
        
        {/* Pulse Animation */}
        <div className="w-[80px] h-[80px] relative flex items-center justify-center my-4">
          <div className="absolute w-[80px] h-[80px] rounded-full border-[2px] border-red/30 animate-[ping_1.5s_ease-out_infinite]"></div>
          <div className="absolute w-[60px] h-[60px] rounded-full border-[2px] border-red/50 animate-[ping_1.5s_ease-out_infinite_0.3s]"></div>
          <div className="absolute w-[40px] h-[40px] rounded-full border-[2px] border-red/70 animate-[ping_1.5s_ease-out_infinite_0.6s]"></div>
          <div className="w-[40px] h-[40px] rounded-full bg-red flex items-center justify-center relative z-10">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3h3l1.5 3.75-2.25 1.5c1.1 2.25 3 4.15 5.25 5.25l1.5-2.25L16 13v3a2 2 0 01-2 2C5.2 18 0 12.8 0 5a2 2 0 012-2h1z" fill="white" opacity=".9" />
            </svg>
          </div>
        </div>

        <div className="text-[16px] font-bold text-text">Calling hospitals simultaneously</div>
        <div className="text-[12px] text-text2 text-center leading-[1.5]">
          All nearby hospitals are being called right now.<br/>Waiting for real-time responses ({secondsLeft} sec)
        </div>

        <div className="w-full flex flex-col gap-[6px] mt-[4px]">
          {displayHospitals.map((h, i) => {
            const status = getStatusString(h.status);
            return (
              <div key={h.id || i} className="flex items-center gap-[10px] p-[8px_12px] bg-gray rounded-xl">
                <div className={`w-[8px] h-[8px] rounded-full shrink-0 ${
                  status === 'confirmed' ? 'bg-green' : 
                  status === 'calling' ? 'bg-amber animate-pulse' : 'bg-border'
                }`}></div>
                <div className="text-[12px] font-semibold text-text flex-1 truncate">{h.name}</div>
                <div className={`text-[10px] font-semibold ${
                  status === 'confirmed' ? 'text-green' : 
                  status === 'calling' ? 'text-amber' : 'text-text3'
                }`}>
                  {status === 'confirmed' ? 'Confirmed ✓' : 
                   status === 'calling' ? 'Calling...' : 'Waiting...'}
                </div>
              </div>
            );
          })}
        </div>

        <button 
          className="mt-[10px] w-full p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer"
          onClick={() => navigate('/hospitals')}
        >
          See results now →
        </button>
      </div>
    </div>
  );
}
