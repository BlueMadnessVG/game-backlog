interface GlobalErrorFallbackProps {
  error: unknown;
  resetErrorBoundary: () => void;
}

function GlobalErrorFallback({ error, resetErrorBoundary }: GlobalErrorFallbackProps) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred while loading the gaming library.';

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
      <div className="mb-6 rounded-full bg-red-500/10 p-4 inline-block">
        <span className="text-4xl" role="img" aria-label="warning">
          ⚠️
        </span>
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Something went wrong</h2>
      <p className="mt-4 max-w-md text-zinc-400">{errorMessage}</p>

      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white transition-all hover:bg-indigo-500 active:scale-95"
        >
          Try Again
        </button>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-zinc-800 px-6 py-2.5 font-medium text-zinc-300 transition-all hover:bg-zinc-700 active:scale-95"
        >
          Hard Refresh
        </button>
      </div>
    </div>
  );
}

export default GlobalErrorFallback;
