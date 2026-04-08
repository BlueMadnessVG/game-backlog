function GlobalLoadingFallback() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950">
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Animated pulse rings for a gaming feel */}
        <div className="absolute h-full w-full animate-ping rounded-full bg-indigo-500 opacity-20"></div>
        <div className="h-12 w-12 animate-pulse rounded-full bg-indigo-600"></div>
      </div>
      <p className="mt-4 text-sm font-medium tracking-widest text-zinc-500 uppercase">
        Loading Library...
      </p>
    </div>
  );
}

export default GlobalLoadingFallback;
