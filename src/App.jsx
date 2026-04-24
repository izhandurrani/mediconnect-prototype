import { Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import LanguageScreen from './screens/LanguageScreen';
import HomeScreen from './screens/HomeScreen';
import EmergencyScreen from './screens/EmergencyScreen';
import CallingScreen from './screens/CallingScreen';
import HospitalsScreen from './screens/HospitalsScreen';
import HospitalDetailScreen from './screens/HospitalDetailScreen';
import SchemesScreen from './screens/SchemesScreen';
import Navigation from './components/Navigation';
import { AppProvider } from './context/AppContext';

function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <h1 className="absolute w-[1px] h-[1px] overflow-hidden opacity-0">MediConnect App</h1>

        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<LoginScreen />} />
            <Route path="/language" element={<LanguageScreen />} />
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/emergency" element={<EmergencyScreen />} />
            <Route path="/calling" element={<CallingScreen />} />
            <Route path="/hospitals" element={<HospitalsScreen />} />
            <Route path="/hospital/:id" element={<HospitalDetailScreen />} />
            <Route path="/schemes" element={<SchemesScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {/* Bottom Navigation — only visible on app screens */}
        <Navigation />
      </div>
    </AppProvider>
  );
}

export default App;
