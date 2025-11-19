"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function BackButton({ fallback = "/projects", className = "", children }) {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);

  return (
    <button type="button" onClick={goBack} className={`btn ${className}`}>
      {children ?? "← Back"}
    </button>
  );
}
