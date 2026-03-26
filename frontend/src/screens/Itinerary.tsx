import type { UserProfile } from '../types/userProfile';

type ItineraryProps = {
  userProfile: UserProfile;
};

export default function Itinerary({ userProfile }: ItineraryProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-blue-600">Itinerary</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">
          Placeholder itinerary screen
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          We will replace this with the real trip plan output next.
        </p>

        <pre className="mt-6 overflow-x-auto rounded-xl bg-gray-50 p-4 text-xs text-gray-700">
          {JSON.stringify(userProfile, null, 2)}
        </pre>
      </div>
    </section>
  );
}
