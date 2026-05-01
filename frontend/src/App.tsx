import { useState } from 'react';
import { defaultUserProfile } from '@vibetrip/shared/types/userProfile';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';
import type { Itinerary as ItineraryData, ItinerarySlot } from '@vibetrip/shared/types/Itinerary';
import { generateItinerary, type ApiResponseMeta } from './services/api';
import ProgressBar from './components/ui/ProgressBar';
import VibePicker from './screens/VibePicker';
import TripBasics from './screens/TripBasics';
import Constraints from './screens/Constraints';
import FineTune from './screens/FineTune';
import Loading from './screens/Loading';
import Itinerary from './screens/Itinerary';
import ReplanModal from './components/ui/ReplanModal';

const TOTAL_SCREENS = 4;

// Section: local UI state types
type SelectedSlot = {
  day: number;
  slot: ItinerarySlot['slot'];
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [isReplanning, setIsReplanning] = useState(false);
  const [apiMeta, setApiMeta] = useState<ApiResponseMeta | undefined>(undefined);

  // Section: screen navigation and profile updates
  const updateProfile = (fields: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...fields }));
  };

  const goNext = () => setCurrentScreen(prev => prev + 1);
  const goBack = () => setCurrentScreen(prev => prev - 1);

  const handleSubmit = async () => {
    setCurrentScreen(5);
    setError(null);
    setApiMeta(undefined);

    try {
      const response = await generateItinerary(userProfile);
      const responseMeta: ApiResponseMeta = {
        tokensUsed: response.tokensUsed,
        usedFallback: response.meta?.usedFallback,
        vibeFallback: response.meta?.vibeFallback,
        reconcilerFallback: response.meta?.reconcilerFallback,
        vibeRetryCount: response.meta?.vibeRetryCount,
        reconcilerRetryCount: response.meta?.reconcilerRetryCount,
      };
      setApiMeta(responseMeta);

      const result: ItineraryData = response.itinerary;

      const daySummary = result.days.map((day) => ({
        day: day.day,
        date: day.date_label,
        area: day.cluster_area,
        slots: day.slots.length,
        estimatedCost: day.day_cost_estimate,
      }));

      console.group('[planner] final iteration plan');
      console.log('[planner] destination', result.city);
      console.log('[planner] budget', `${result.total_cost_estimate} ${result.currency}`);
      console.log('[planner] tokens used', responseMeta.tokensUsed);
      console.log('[planner] fallback used', responseMeta.usedFallback);
      console.table(daySummary);
      console.groupEnd();

      setItinerary(result);
      setCurrentScreen(6);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
      setCurrentScreen(4);
    }
  };

  const showProgress = currentScreen >= 1 && currentScreen <= TOTAL_SCREENS;

  // Section: screen rendering
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
      {currentScreen === 5 && (
        <Loading
          onComplete={() => setCurrentScreen(6)}
          tokensUsed={apiMeta?.tokensUsed}
          usedFallback={apiMeta?.usedFallback}
          retryCount={(apiMeta?.vibeRetryCount ?? 0) + (apiMeta?.reconcilerRetryCount ?? 0)}
        />
      )}
      {currentScreen === 6 && itinerary && (
        <>
          <Itinerary
            userProfile={userProfile}
            itinerary={itinerary}
            onSelectSlot={(day, slot) => {
              setSelectedSlot({ day, slot });
            }}
          />
          {selectedSlot && itinerary.id && (
            <ReplanModal
              selectedSlot={selectedSlot}
              itineraryId={itinerary.id}
              isReplanning={isReplanning}
              setIsReplanning={setIsReplanning}
              onClose={() => {
                if (!isReplanning) {
                  setSelectedSlot(null);
                }
              }}
              onSuccess={(updated) => {
                setItinerary(updated);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
