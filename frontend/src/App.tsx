import { useState } from 'react';
import { UserProfile, defaultUserProfile } from '@vibetrip/shared/types/userProfile';
import { generateItinerary } from './services/api';
import ProgressBar from './components/ui/ProgressBar';
import VibePicker from './screens/VibePicker';
import TripBasics from './screens/TripBasics';
import Constraints from './screens/Constraints';
import FineTune from './screens/FineTune';
import Loading from './screens/Loading';
import Itinerary from './screens/Itinerary';

const TOTAL_SCREENS = 4;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);
  const [itinerary, setItinerary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = (fields: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...fields }));
  };

  const goNext = () => setCurrentScreen(prev => prev + 1);
  const goBack = () => setCurrentScreen(prev => prev - 1);

  const handleSubmit = async () => {
    setCurrentScreen(5); // show loading
    setError(null);
    try {
      const result = await generateItinerary(userProfile);
      setItinerary(result);
      setCurrentScreen(6); // show itinerary
    } catch (err: any) {
      setError(err.message);
      setCurrentScreen(4); // go back to FineTune on error
    }
  };

  const showProgress = currentScreen >= 1 && currentScreen <= TOTAL_SCREENS;

  return (
    <div>
      {showProgress && (
        <ProgressBar currentScreen={currentScreen} totalScreens={TOTAL_SCREENS} />
      )}
      {currentScreen === 1 && <VibePicker userProfile={userProfile} updateProfile={updateProfile} onNext={goNext} />}
      {currentScreen === 2 && <TripBasics userProfile={userProfile} updateProfile={updateProfile} onNext={goNext} onBack={goBack} />}
      {currentScreen === 3 && <Constraints userProfile={userProfile} updateProfile={updateProfile} onNext={goNext} onBack={goBack} />}
      {currentScreen === 4 && (
        <>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <FineTune userProfile={userProfile} updateProfile={updateProfile} onBack={goBack} onSubmit={handleSubmit} />
        </>
      )}
      {currentScreen === 5 && <Loading />}
      {currentScreen === 6 && <Itinerary userProfile={userProfile} itinerary={itinerary} />}
    </div>
  );
}