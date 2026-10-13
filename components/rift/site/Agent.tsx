"use client";

import { createContext, useContext } from "react";
import { publicAgentLine } from "@/lib/core/profile";

/** The agent as a stranger may see him: lib/db/service.ts `currentAgentPublic`. */
export interface PublicAgentView { name: string; license: string | null; brokerage: string | null }

/**
 * Who the public pages are from, read once in the public layout from
 * Operations, Settings (audit 12 Oct §3 #5, D40), and available to every
 * component under it, server-rendered or not, without each page reading the
 * database. Null when it could not be read: no database, a slow read, or no
 * agent yet.
 */
const AgentContext = createContext<PublicAgentView | null>(null);

export function AgentProvider({ agent, children }: { agent: PublicAgentView | null; children: React.ReactNode }) {
  return <AgentContext.Provider value={agent}>{children}</AgentContext.Provider>;
}

export const useAgent = () => useContext(AgentContext);

/** "Name, Georgia licence N, Brokerage.", from Settings (lib/core/profile.ts). */
export function AgentLine() {
  return <>{publicAgentLine(useAgent())}</>;
}

/**
 * The agent's first name for the public pages' own sentences ("Ask Kaleb to
 * review"), from Settings, and "Kaleb" when Settings could not be read. Pages
 * still spell it in their text in many places; each one moved to this is one
 * fewer to change by hand (audit 12 Oct §3 #5).
 */
export function useAgentFirstName(): string {
  return useAgent()?.name.trim().split(/\s+/)[0] || "Kaleb";
}
