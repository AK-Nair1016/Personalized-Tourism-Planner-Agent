import { useState } from 'react';
import { defaultUserProfile } from './types/userProfile';
import type { UserProfile } from './types/userProfile';
import ProgressBar from './components/ui/ProgressBar';
import VibePicker from './screens/VibePicker';
import TripBasics from './screens/TripBasics';
import Constraints from './screens/Constraints';
import FineTune from './screens/FineTune';
import Loading from './screens/Loading';
import Itinerary from './screens/Itinerary';
import { generateItinerary } from './services/api';

const TOTAL_SCREENS = 4;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);

  const updateProfile = (fields: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...fields }));
  };

  const goNext = () => setCurrentScreen(prev => prev + 1);
  const goBack = () => setCurrentScreen(prev => prev - 1);

  const handleSubmit = () => {
    generateItinerary(userProfile);
    setCurrentScreen(5); // loading screen
  };

  const showProgress = currentScreen >= 1 && currentScreen <= TOTAL_SCREENS;

  return (
    <div className="min-h-screen bg-gray-50">
      {showProgress && (
        <ProgressBar currentScreen={currentScreen} totalScreens={TOTAL_SCREENS} />
      )}

      {currentScreen === 1 && (
        <VibePicker
          userProfile={userProfile}
          updateProfile={updateProfile}
          onNext={goNext}
        />
      )}
      {currentScreen === 2 && (
        <TripBasics
          userProfile={userProfile}
          updateProfile={updateProfile}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {currentScreen === 3 && (
        <Constraints
          userProfile={userProfile}
          updateProfile={updateProfile}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {currentScreen === 4 && (
        <FineTune
          userProfile={userProfile}
          updateProfile={updateProfile}
          onBack={goBack}
          onSubmit={handleSubmit}
        />
      )}
      {currentScreen === 5 && (
        <Loading onDone={() => setCurrentScreen(6)} />
      )}
      {currentScreen === 6 && (
        <Itinerary userProfile={userProfile} />
      )}
    </div>
  );
}
