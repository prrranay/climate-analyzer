import { describe, it, expect, vi } from "vitest";

describe("Stale Request & Race Condition Protection", () => {
  it("supersedes older requests when a newer request is launched", async () => {
    let sequenceCounter = 0;
    let activeData: string | null = null;
    let activeStatus: "idle" | "loading" | "success" = "idle";

    async function runAnalysisWithSequenceGuard(
      queryName: string,
      delayMs: number
    ): Promise<void> {
      const currentSeq = ++sequenceCounter;

      // Immediately clear previous data and enter loading
      activeStatus = "loading";
      activeData = null;

      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Guard check: ignore if request was superseded
      if (currentSeq !== sequenceCounter) {
        return; // Discard stale response
      }

      activeData = `Data for ${queryName}`;
      activeStatus = "success";
    }

    // Launch Request 1 (takes 60ms)
    const req1 = runAnalysisWithSequenceGuard("Location A", 60);

    // After 10ms, user selects Location B, launching Request 2 (takes 20ms)
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(activeStatus).toBe("loading");
    expect(activeData).toBeNull(); // Prior data immediately cleared!

    const req2 = runAnalysisWithSequenceGuard("Location B", 20);

    // Wait for both to finish
    await Promise.all([req1, req2]);

    // Request 2 finished at ~30ms and set data.
    // Request 1 finished at ~60ms but was discarded because currentSeq (1) !== sequenceCounter (2).
    expect(activeStatus).toBe("success");
    expect(activeData).toBe("Data for Location B");
  });

  it("aborts prior in-flight request when a new analysis is initiated", async () => {
    let activeAbortController: AbortController | null = null;
    const abortSpy = vi.fn();

    function startRequest() {
      if (activeAbortController) {
        activeAbortController.abort();
      }
      const controller = new AbortController();
      controller.signal.addEventListener("abort", abortSpy);
      activeAbortController = controller;
      return controller;
    }

    // First request begins
    startRequest();
    expect(abortSpy).not.toHaveBeenCalled();

    // Second request begins before first completes
    startRequest();
    expect(abortSpy).toHaveBeenCalledTimes(1);

    // Third request begins
    startRequest();
    expect(abortSpy).toHaveBeenCalledTimes(2);
  });
});
