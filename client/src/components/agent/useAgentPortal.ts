import { useOutletContext } from "react-router";
import type { AgentPortalContext } from "../../types/agentPortal";

export function useAgentPortal(): AgentPortalContext {
  return useOutletContext<AgentPortalContext>();
}
