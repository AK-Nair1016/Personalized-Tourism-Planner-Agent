import type { UserProfile } from '../types/userProfile';
import NavigationButtons from '../components/ui/NavigationButtons';

type TripBasicsProps = {
  userProfile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function TripBasics({
  userProfile,
  updateProfile,
  onNext,
  onBack,
}: TripBasicsProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-blue-600">Step 2</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">
          Trip Basics
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Placeholder screen for destination and travel dates.
        </p>

        <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          <p>Current city: {userProfile.city ?? 'Not set'}</p>
          <button
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() =>
              updateProfile({
                city: 'Dubai',
                arrivalDate: '2026-04-01',
                departureDate: '2026-04-05',
                arrivalTime: '10:00',
                departureTime: '18:30',
              })
            }
            type="button"
          >
            Fill sample step data
          </button>
        </div>

        <NavigationButtons onBack={onBack} onNext={onNext} />
      </div>
    </section>
  );
}
