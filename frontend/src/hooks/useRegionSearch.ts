"use client";

import { useState, useEffect, useRef } from "react";
import { GeoLocationDTO } from "@/types/api";
import { apiClient, ApiError } from "@/lib/api";

export type SearchStatus = "idle" | "loading" | "success" | "error";

export function useRegionSearch(debounceMs: number = 300) {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<GeoLocationDTO[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState<ApiError | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef<number>(0);

  const setQuery = (newQuery: string) => {
    setQueryState(newQuery);
    if (newQuery.trim().length < 2) {
      sequenceRef.current++;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setResults([]);
      setError(null);
      setStatus("idle");
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      // 1. Abort previous search in-flight
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 2. Increment sequence to protect against race conditions
      const currentSeq = ++sequenceRef.current;

      setStatus("loading");
      setError(null);

      try {
        const data = await apiClient.searchRegions(
          { q: trimmed, count: 7 },
          { signal: controller.signal }
        );

        // 3. Ignore if newer query has already executed
        if (currentSeq !== sequenceRef.current) {
          return;
        }

        setResults(data);
        setStatus("success");
      } catch (err: unknown) {
        if (currentSeq !== sequenceRef.current) {
          return;
        }

        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError({
                status: 0,
                errorCode: "SEARCH_FAILED",
                message: err instanceof Error ? err.message : "Geocoding search failed.",
              });

        if (apiErr.isCancelled) {
          return;
        }

        setError(apiErr);
        setStatus("error");
        setResults([]);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, debounceMs]);

  return {
    query,
    setQuery,
    results,
    status,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    error,
    clearResults: () => {
      sequenceRef.current++;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults([]);
      setError(null);
      setStatus("idle");
    },
  };
}
