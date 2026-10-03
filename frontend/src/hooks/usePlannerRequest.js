import { useState, useEffect, useRef } from "react";
import { post } from "../services/api";

export function usePlannerRequest(key) {
  const [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => {
    controller.current?.abort();
    setResult(null);
    setBusy(false);
    setError("");
    return () => controller.current?.abort();
  }, [key]);
  async function run(path, body) {
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await post(path, body, requestController.signal);
      if (!requestController.signal.aborted) setResult(response);
    } catch (error) {
      if (!requestController.signal.aborted) setError(error.message);
    } finally {
      if (!requestController.signal.aborted) setBusy(false);
    }
  }
  return { result, busy, error, run };
}
