"use client";

import { useState, useCallback, useRef } from "react";
import {
  HeatwaveAnalysisQuery,
  HeatwaveAnalysisResponse,
  BoundingBoxAnalysisQuery,
  BoundingBoxHeatwaveAnalysisResponse,
} from "@/types/api";
import { apiClient, ApiError } from "@/lib/api";

export type AnalysisResult =
  | HeatwaveAnalysisResponse
  | BoundingBoxHeatwaveAnalysisResponse;

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

export function isBoundingBoxResult(
  result: AnalysisResult
): result is BoundingBoxHeatwaveAnalysisResponse {
  return "bounding_box" in result;
}

export function useHeatwaveAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef<number>(0);

  const runPointAnalysis = useCallback(
    async (params: HeatwaveAnalysisQuery): Promise<HeatwaveAnalysisResponse | null> => {
      // 1. Invalidate and abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 2. Increment request sequence ID to guard against out-of-order stale responses
      const currentSeq = ++sequenceRef.current;

      // 3. Immediately clear prior results so they are not displayed for new parameters
      setStatus("loading");
      setData(null);
      setError(null);

      try {
        const response = await apiClient.analyzeHeatwave(params, {
          signal: controller.signal,
        });

        // 4. Verify request was not superseded
        if (currentSeq !== sequenceRef.current) {
          return null;
        }

        setData(response);
        setStatus("success");
        return response;
      } catch (err: unknown) {
        // Ignore errors from superseded requests
        if (currentSeq !== sequenceRef.current) {
          return null;
        }

        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError({
                status: 0,
                errorCode: "UNKNOWN_ERROR",
                message: err instanceof Error ? err.message : "Analysis request failed.",
              });

        // Do not flag intentional user cancellations as failed status
        if (apiErr.isCancelled) {
          return null;
        }

        setError(apiErr);
        setStatus("error");
        return null;
      }
    },
    []
  );

  const runBboxAnalysis = useCallback(
    async (
      params: BoundingBoxAnalysisQuery
    ): Promise<BoundingBoxHeatwaveAnalysisResponse | null> => {
      // 1. Invalidate and abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 2. Increment request sequence ID
      const currentSeq = ++sequenceRef.current;

      // 3. Immediately clear prior results
      setStatus("loading");
      setData(null);
      setError(null);

      try {
        const response = await apiClient.analyzeHeatwaveBbox(params, {
          signal: controller.signal,
        });

        // 4. Verify request was not superseded
        if (currentSeq !== sequenceRef.current) {
          return null;
        }

        setData(response);
        setStatus("success");
        return response;
      } catch (err: unknown) {
        if (currentSeq !== sequenceRef.current) {
          return null;
        }

        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError({
                status: 0,
                errorCode: "UNKNOWN_ERROR",
                message: err instanceof Error ? err.message : "Analysis request failed.",
              });

        if (apiErr.isCancelled) {
          return null;
        }

        setError(apiErr);
        setStatus("error");
        return null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    sequenceRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
  }, []);

  const clear = useCallback(() => {
    cancel();
    setData(null);
    setError(null);
    setStatus("idle");
  }, [cancel]);

  return {
    status,
    data,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    error,
    runPointAnalysis,
    runBboxAnalysis,
    cancel,
    clear,
  };
}
