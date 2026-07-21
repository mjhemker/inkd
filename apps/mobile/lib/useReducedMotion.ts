import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the OS "Reduce Motion" accessibility setting is on. Resolved once on
 * mount and kept in sync via the AccessibilityInfo change subscription, so
 * animated surfaces can fall back to instant state changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      if (mounted) setReduced(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
