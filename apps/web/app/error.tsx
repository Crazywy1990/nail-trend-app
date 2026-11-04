"use client";

import { useEffect, useState } from "react";

/**
 * Shown when a page can't load its data, most often because the API is waking up
 * (Render free tier). Retries on its own instead of leaving a crash screen.
 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const [seconds, setSeconds] = useState(10);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (seconds <= 0) {
      setSeconds(15);
      reset();
      window.location.reload();
    }
  }, [seconds, reset]);

  return (
    <div className="shell">
      <main className="main">
        <div className="wordmark">AllTen</div>
        <h1 className="h1">Getting your looks ready</h1>
        <p className="why">
          The service is waking up. This can take up to a minute on the first visit. We&rsquo;ll try again in {Math.max(seconds, 0)}s.
        </p>
        <button type="button" className="btn btn-primary" style={{ flex: "none" }} onClick={() => window.location.reload()}>
          Try again now
        </button>
      </main>
    </div>
  );
}
