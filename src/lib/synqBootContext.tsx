import React, { createContext, useContext } from "react";

export type SynqBootValue = {
  cachedSynqActive: boolean;
};

const SynqBootContext = createContext<SynqBootValue | undefined>(undefined);

export function SynqBootProvider({
  value,
  children,
}: {
  value: SynqBootValue;
  children: React.ReactNode;
}) {
  return (
    <SynqBootContext.Provider value={value}>{children}</SynqBootContext.Provider>
  );
}

export function useSynqBoot(): SynqBootValue | undefined {
  return useContext(SynqBootContext);
}
