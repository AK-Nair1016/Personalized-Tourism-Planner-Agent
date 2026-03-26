import type { UserProfile } from '../types/userProfile';
import NavigationButtons from '../components/ui/NavigationButtons';

type VibePickerProps = {
  userProfile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  onNext: () => void;
};

export default function VibePicker({
  userProfile,
  updateProfile,
  onNext,
}: VibePickerProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-blue-600">Step 1</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">
          Vibe Picker
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Placeholder screen for vibe selection. We will add the real inputs
          next.
        </p>

        <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          <p>Current vibe count: {userProfile.vibe.length}</p>
          <button
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() =>
              updateProfile({
                vibe: ['adventurer'],
                group: 'solo',
                firstVisit: true,
              })
            }
            type="button"
          >
            Fill sample step data
          </button>
        </div>

        <NavigationButtons onNext={onNext} />
      </div>
    </section>
  );
}
