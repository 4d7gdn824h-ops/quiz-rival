"use client";

import { useEffect, useState } from "react";
import { fetchHomeworkStatus } from "@/lib/client/api";

export function AiStatusBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchHomeworkStatus()
      .then((status) => {
        if (!cancelled && !status.configured && status.message) setMessage(status.message);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("AI is not configured. Set XAI_API_KEY to use Grok (xAI).");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) return null;
  return (
    <p className="rounded-2xl bg-orange-400/15 px-4 py-3 text-sm text-orange-50" role="status">
      {message}
    </p>
  );
}
