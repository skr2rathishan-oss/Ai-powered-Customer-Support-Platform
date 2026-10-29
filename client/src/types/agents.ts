export const AGENT_STATUSES = ["Active", "Inactive"] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

export interface Agent {
  agentId: number;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string;
  status: AgentStatus;
  onlineStatus: string | null;
  invitePending: boolean;
  openTickets: number;
}

export interface AgentSummary {
  total: number;
  active: number;
  inactive: number;
  invitePending: number;
}

export interface AgentListResult {
  agents: Agent[];
  summary: AgentSummary;
}

export interface InviteAgentInput {
  firstName: string;
  lastName: string;
  email: string;
}

export interface InviteAgentResult {
  agent: Agent;
  emailSent: boolean;
}

export interface AgentStatusResult {
  agent: Agent;
  unassignedTickets: number;
}

export interface AgentFieldError {
  field: string;
  message: string;
}
