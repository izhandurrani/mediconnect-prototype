import { useLocation, matchPath, Navigate, Routes, Route } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import LanguageScreen from './screens/LanguageScreen';
import HomeScreen from './screens/HomeScreen';
import EmergencyScreen from './screens/EmergencyScreen';
import CallingScreen from './screens/CallingScreen';
import HospitalsScreen from './screens/HospitalsScreen';
import HospitalDetailScreen from './screens/HospitalDetailScreen';
import DetailScreen from './screens/DetailScreen';
import AlertedScreen from './screens/AlertedScreen';
import SchemesScreen from './screens/SchemesScreen';
import Navigation from './components/Navigation';
import { AppProvider } from './context/AppContext';

/**
 * ScreenRouter — switch-based routing.
 * Only the matched screen component is instantiated; all others are unmounted.
 * HospitalDetailScreen is wrapped in <Routes>/<Route> because it uses useParams().
 */
function ScreenRouter() {
  const { pathname } = useLocation();
  const hospitalMatch = matchPath('/hospital/:id', pathname);

  switch (true) {
    case pathname === '/':
      return <LoginScreen />;
    case pathname === '/signup':
      return <SignUpScreen />;
    case pathname === '/language':
      return <LanguageScreen />;
    case pathname === '/home':
      return <HomeScreen />;
    case pathname === '/emergency':
      return <EmergencyScreen />;
    case pathname === '/calling':
      return <CallingScreen />;
    case pathname === '/hospitals':
      return <HospitalsScreen />;
    case pathname === '/detail':
      return <DetailScreen />;
    case pathname === '/alerted':
      return <AlertedScreen />;
    case pathname === '/schemes':
      return <SchemesScreen />;
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
