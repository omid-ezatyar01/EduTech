import { useCallback, useEffect, useMemo, useRef } from "react";

export const useLatestRequest = () => {
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const runLatest = useCallback(async (requestFn, handlers = {}) => {
    const requestId = ++requestIdRef.current;

    try {
      const result = await requestFn();
      const isLatest = isMountedRef.current && requestId === requestIdRef.current;
      if (isLatest) {
        handlers.onSuccess?.(result);
        handlers.onFinally?.();
      }
      return { isLatest, result };
    } catch (error) {
      const isLatest = isMountedRef.current && requestId === requestIdRef.current;
      if (isLatest) {
        handlers.onError?.(error);
        handlers.onFinally?.();
      }
      return { isLatest, error };
    }
  }, []);

  return useMemo(() => ({ runLatest }), [runLatest]);
};

export default useLatestRequest;
