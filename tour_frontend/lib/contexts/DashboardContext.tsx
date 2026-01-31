"use client";

import { createContext, useContext } from "react";

interface DashboardContextValue {
  userRole: string;
  isActive: boolean;
}

const DashboardContext = createContext<DashboardContextValue>({
  userRole: "editor",
  isActive: false,
});

export function DashboardProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: DashboardContextValue;
}) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}
