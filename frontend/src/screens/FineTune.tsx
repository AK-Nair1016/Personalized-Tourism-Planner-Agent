import type { UserProfile } from '../types/userProfile';
import NavigationButtons from '../components/ui/NavigationButtons';

type FineTuneProps = {
  userProfile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  onBack: () => void;
  onSubmit: () => void;
};

export default function FineTune({
  userProfile,
  updateProfile,
  onBack,
  onSubmit,
}: FineTuneProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-blue-600">Step 4</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">
          Fine Tune
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Placeholder screen for optional preferences before submit.
        </p>

        <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          <p>Hotel area: {userProfile.hotelArea ?? 'Not set'}</p>
          <button
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() =>
              updateProfile({
                hotelArea: 'Downtown',
              })
            }
            type="button"
          >
            Fill sample optional data
          </button>
        </div>

        <NavigationButtons
          nextLabel="Submit"
          onBack={onBack}
          onNext={onSubmit}
        />
      </div>
    </section>
  );
}
