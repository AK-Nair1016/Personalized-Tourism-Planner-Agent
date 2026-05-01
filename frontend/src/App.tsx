// import { useState } from 'react';
// import { defaultUserProfile } from '@vibetrip/shared/types/userProfile';
// import type { UserProfile } from '@vibetrip/shared/types/userProfile';
// import type { Itinerary as ItineraryData } from '@vibetrip/shared/types/Itinerary';
// import { generateItinerary } from './services/api';
// import ProgressBar from './components/ui/ProgressBar';
// import VibePicker from './screens/VibePicker';
// import TripBasics from './screens/TripBasics';
// import Constraints from './screens/Constraints';
// import FineTune from './screens/FineTune';
// import Loading from './screens/Loading';
// import Itinerary from './screens/Itinerary';

// const TOTAL_SCREENS = 4;

// export default function App() {
//   const [currentScreen, setCurrentScreen] = useState(1);
//   const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);
//   const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const updateProfile = (fields: Partial<UserProfile>) => {
//     setUserProfile(prev => ({ ...prev, ...fields }));
//   };

//   const goNext = () => setCurrentScreen(prev => prev + 1);
//   const goBack = () => setCurrentScreen(prev => prev - 1);

//   const handleSubmit = async () => {
//     setCurrentScreen(5); // show loading
//     setError(null);
//     try {
//       const result = await generateItinerary(userProfile);
//       const daySummary = result.days.map((day) => ({
//         day: day.day,
//         date: day.date_label,
//         area: day.cluster_area,
//         slots: day.slots.length,
//         estimatedCost: day.day_cost_estimate,
//       }));

//       console.group('[planner] final iteration plan');
//       console.log('[planner] destination', result.city);
//       console.log('[planner] budget', `${result.total_cost_estimate} ${result.currency}`);
//       console.table(daySummary);
//       console.groupEnd();

//       setItinerary(result);
//       setCurrentScreen(6); // show itinerary
//     } catch (err: unknown) {
//       setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
//       setCurrentScreen(4); // go back to FineTune on error
//     }
//   };

//   const showProgress = currentScreen >= 1 && currentScreen <= TOTAL_SCREENS;

//   return (
//     <div>
//       {showProgress && (
//         <ProgressBar currentScreen={currentScreen} totalScreens={TOTAL_SCREENS} />
//       )}
//       {currentScreen === 1 && <VibePicker userProfile={userProfile} updateProfile={updateProfile} onNext={goNext} />}
//       {currentScreen === 2 && <TripBasics userProfile={userProfile} updateProfile={updateProfile} onNext={goNext} onBack={goBack} />}
//       {currentScreen === 3 && <Constraints userProfile={userProfile} updateProfile={updateProfile} onNext={goNext} onBack={goBack} />}
//       {currentScreen === 4 && (
//         <>
//           {error && <p style={{ color: 'red' }}>{error}</p>}
//           <FineTune userProfile={userProfile} updateProfile={updateProfile} onBack={goBack} onSubmit={handleSubmit} />
//         </>
//       )}
//       {currentScreen === 5 && <Loading />}
//       {currentScreen === 6 && itinerary && (
//         <Itinerary userProfile={userProfile} itinerary={itinerary} />
//       )}
//     </div>
//   );
// }
import { useState } from 'react';
import { defaultUserProfile } from '@vibetrip/shared/types/userProfile';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';
import type { Itinerary as ItineraryData, ItinerarySlot } from '@vibetrip/shared/types/Itinerary';
import { generateItinerary } from './services/api';
import ProgressBar from './components/ui/ProgressBar';
import VibePicker from './screens/VibePicker';
import TripBasics from './screens/TripBasics';
import Constraints from './screens/Constraints';
import FineTune from './screens/FineTune';
import Loading from './screens/Loading';
import Itinerary from './screens/Itinerary';
import ReplanModal from './components/ui/ReplanModal';

const TOTAL_SCREENS = 4;



// Type for API response meta (optional enhancement)
interface ApiResponseMeta {
  tokensUsed?: number;
  usedFallback?: boolean;
  vibeFallback?: boolean;
  reconcilerFallback?: boolean;
  vibeRetryCount?: number;
  reconcilerRetryCount?: number;
}

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
  // Store meta from API response to pass to Loading
  const [apiMeta, setApiMeta] = useState<ApiResponseMeta | undefined>(undefined);

  const updateProfile = (fields: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...fields }));
  };

  const goNext = () => setCurrentScreen(prev => prev + 1);
  const goBack = () => setCurrentScreen(prev => prev - 1);

  const handleSubmit = async () => {
    setCurrentScreen(5); // show loading
    setError(null);
    setApiMeta(undefined); // reset meta

    try {
      // Call API and capture full response (not just itinerary)
      const response = await generateItinerary(userProfile);
      const responseWithMeta = response as ItineraryData & {
        itinerary?: ItineraryData;
        tokensUsed?: number;
        meta?: ApiResponseMeta;
      };
      
      // Extract meta if backend returns it
      // Structure: { itinerary: {...}, tokensUsed: number, meta: {...} }
      // Or response itself has meta property
      const responseMeta: ApiResponseMeta = {
        tokensUsed: responseWithMeta.tokensUsed,
        usedFallback: responseWithMeta.meta?.usedFallback,
        vibeFallback: responseWithMeta.meta?.vibeFallback,
        reconcilerFallback: responseWithMeta.meta?.reconcilerFallback,
        vibeRetryCount: responseWithMeta.meta?.vibeRetryCount,
        reconcilerRetryCount: responseWithMeta.meta?.reconcilerRetryCount,
      };
      setApiMeta(responseMeta);

      // Extract itinerary data (handle both nested and flat response structures)
      const result: ItineraryData = responseWithMeta.itinerary ?? response;

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
      setCurrentScreen(6); // show itinerary
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
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
