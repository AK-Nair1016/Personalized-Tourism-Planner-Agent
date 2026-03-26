type ProgressBarProps = {
  currentScreen: number;
  totalScreens: number;
};

export default function ProgressBar({
  currentScreen,
  totalScreens,
}: ProgressBarProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
        {Array.from({ length: totalScreens }, (_, index) => {
          const step = index + 1;
          const isActive = step === currentScreen;
          const isComplete = step < currentScreen;

          return (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold',
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : isComplete
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 bg-white text-gray-500',
                ].join(' ')}
              >
                {step}
              </div>

              {step < totalScreens && (
                <div className="h-1 flex-1 rounded bg-gray-200">
                  <div
                    className={`h-1 rounded ${
                      isComplete ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
