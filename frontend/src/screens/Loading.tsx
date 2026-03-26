import { useEffect } from 'react';

type LoadingProps = {
  onDone?: () => void;
};

export default function Loading({ onDone }: LoadingProps) {
  useEffect(() => {
    if (!onDone) {
      return;
    }

    const timer = window.setTimeout(() => {
      onDone();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-blue-600">Loading</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">
          Preparing placeholder itinerary
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          This is a shell loading screen for now.
        </p>
      </div>
    </section>
  );
}
