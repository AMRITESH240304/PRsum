import { useSyncExternalStore } from "react";
import { getState, subscribe } from "@/store/app-store";

export function useAppStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}
