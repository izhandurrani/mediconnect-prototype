import { useLocation, matchPath, Navigate, Routes, Route } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import LanguageScreen from './screens/LanguageScreen';
import HomeScreen from './screens/HomeScreen';
import HospitalDetailScreen from './screens/HospitalDetailScreen';
import SchemesScreen from './screens/SchemesScreen';

/* ── New 4-step emergency flow ── */
import VoiceInputScreen from './pages/VoiceInputScreen';
import NearbyHospitalsScreen from './pages/NearbyHospitalsScreen';
import CallingScreen from './pages/CallingScreen';
import ResultsScreen from './pages/ResultsScreen';
import SuccessScreen from './pages/SuccessScreen';

import Navigation from './components/Navigation';
import { AppProvider } from './context/AppContext';

/**
 * ScreenRouter — switch-based routing.
 *
 * NEW EMERGENCY FLOW:
 *   /voice → /nearby → /calling → /results → /success
 *
 * Each step passes state via React Router navigation state.
 */
function ScreenRouter() {
  const { pathname } = useLocation();
  const hospitalMatch = matchPath('/hospital/:id', pathname);

  switch (true) {
    /* ── Auth ── */
    case pathname === '/':
      return <LoginScreen />;
    case pathname === '/signup':
      return <SignUpScreen />;
    case pathname === '/language':
      return <LanguageScreen />;

    /* ── App ── */
    case pathname === '/home':
      return <HomeScreen />;
    case pathname === '/schemes':
      return <SchemesScreen />;

    /* ── New emergency flow ── */
    case pathname === '/voice':
      return <VoiceInputScreen />;
    case pathname === '/nearby':
      return <NearbyHospitalsScreen />;
    case pathname === '/calling':
      return <CallingScreen />;
    case pathname === '/results':
      return <ResultsScreen />;
    case pathname === '/success':
      return <SuccessScreen />;

    /* ── Hospital detail (uses useParams) ── */
    case !!hospitalMatch:
      return (
        <Routes>
          <Route path="/hospital/:id" element={<HospitalDetailScreen />} />
        </Routes>
      );

    default:
      return <Navigate to="/" replace />;
  }
}

function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <h1 className="absolute w-[1px] h-[1px] overflow-hidden opacity-0">MediConnect App</h1>

        <div className="flex-1 flex flex-col">
          <ScreenRouter />
        </div>

        {/* Bottom Navigation — only visible on app screens */}
        <Navigation />
      </div>
    </AppProvider>
  );
}

export default App;
