const crypto = require("node:crypto");
const defaultAgentModel = require("../models/agentModel");
const defaultCompanyPortalModel = require("../models/companyPortalModel");
const defaultUserModel = require("../models/userModel");
const defaultTokenModel = require("../models/tokenModel");
const AppError = require("../utils/AppError");
const { createStaticRuntimeSettings } = require("./runtimeSettings");
const { createCompanyContextResolver } = require("./companyContext");
const { sendAgentInviteEmail: defaultSendAgentInviteEmail } = require("./emailService");
const {
  validateInviteAgentPayload,
  validateAgentStatusPayload,
} = require("../validators/agentValidator");
const { parseTicketId } = require("../validators/ticketValidator");
const {
  AGENT_STATUS_ACTIVE,
  AGENT_STATUS_INACTIVE,
  INVITE_TTL_MS,
} = require("../constants/agentConstants");

function validationError(errors) {
  return new AppError("Validation failed", 422, "VALIDATION_ERROR", errors);
}

function agentNotFound() {
  return new AppError("Agent not found", 404, "AGENT_NOT_FOUND");
}

function emailInUse() {
  return new AppError("An account with this email already exists", 409, "EMAIL_IN_USE", [
    { field: "email", message: "An account with this email already exists" },
  ]);
}

function requireAgentId(rawId) {
  const agentId = parseTicketId(rawId);
  if (agentId === null) {
    throw new AppError("Invalid agent id", 400, "INVALID_AGENT_ID");
  }
  return agentId;
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function defaultGenerateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createAgentService(dependencies = {}) {
  const agentModel = dependencies.agentModel || defaultAgentModel;
  const portal = dependencies.companyPortalModel || defaultCompanyPortalModel;
  const users = dependencies.userModel || defaultUserModel;
  const tokens = dependencies.tokenModel || defaultTokenModel;
  const sendInvite =
    dependencies.sendAgentInviteEmail || defaultSendAgentInviteEmail;
  const runtimeSettings =
    dependencies.runtimeSettings || createStaticRuntimeSettings();
  const generateToken = dependencies.generateToken || defaultGenerateToken;
  const now = dependencies.now || (() => Date.now());
  const { requireActiveCompanyAdmin } = createCompanyContextResolver(portal);

  // Issues a fresh invite token and mails it. The link is never returned or
  // logged; a failure only reports `false`.
  async function issueInvite(admin, agent) {
    try {
      const rawToken = generateToken();
      const expiresAt = new Date(now() + INVITE_TTL_MS);
      await tokens.createPasswordResetToken(
        agent.agentId,
        hashToken(rawToken),
        expiresAt,
      );

      const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
      const link = `${origin}/reset-password?token=${rawToken}`;
      await sendInvite(
        agent.email,
        link,
        {
          companyName: admin.companyName,
          inviterName: [admin.firstName, admin.lastName].filter(Boolean).join(" "),
        },
        await runtimeSettings.getEmail(),
      );
      return true;
    } catch (error) {
      console.error("[AGENTS] Invite email could not be delivered:", {
        code: error?.code || "UNKNOWN",
      });
      return false;
    }
  }

  async function listAgents(auth) {
    const { companyId } = await requireActiveCompanyAdmin(auth);
    const agents = await agentModel.listAgents(companyId);

    const summary = {
      total: agents.length,
      active: agents.filter((a) => a.status === AGENT_STATUS_ACTIVE).length,
      inactive: agents.filter((a) => a.status !== AGENT_STATUS_ACTIVE).length,
      invitePending: agents.filter((a) => a.invitePending).length,
    };

    return { agents, summary };
  }

  async function inviteAgent(auth, body) {
    const admin = await requireActiveCompanyAdmin(auth);

    const { value, errors } = validateInviteAgentPayload(body);
    if (errors.length > 0) throw validationError(errors);

    if (await users.findByEmail(value.email)) throw emailInUse();

    let agent;
    try {
      agent = await agentModel.createAgent(admin.companyId, value);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") throw emailInUse();
      throw error;
    }

    const emailSent = await issueInvite(admin, agent);
    return { agent, emailSent };
  }

  async function resendInvite(auth, rawId) {
    const admin = await requireActiveCompanyAdmin(auth);
    const agentId = requireAgentId(rawId);

    const agent = await agentModel.findAgent(admin.companyId, agentId);
    if (!agent) throw agentNotFound();

    if (!agent.invitePending || agent.status !== AGENT_STATUS_ACTIVE) {
      throw new AppError(
        "This agent has no pending invite",
        409,
        "INVITE_NOT_PENDING",
      );
    }

    await tokens.invalidateUserTokens(agent.agentId);
    const emailSent = await issueInvite(admin, agent);
    return { emailSent };
  }

  async function setAgentStatus(auth, rawId, body) {
    const { companyId } = await requireActiveCompanyAdmin(auth);
    const agentId = requireAgentId(rawId);

    const { value, errors } = validateAgentStatusPayload(body);
    if (errors.length > 0) throw validationError(errors);

    const existing = await agentModel.findAgent(companyId, agentId);
    if (!existing) throw agentNotFound();

    if (existing.status === value.status) {
      return { agent: existing, unassignedTickets: 0 };
    }

    let unassignedTickets = 0;
    // Status first, so a concurrent assignment already fails the active check
    await agentModel.setAgentStatus(companyId, agentId, value.status);

    if (value.status === AGENT_STATUS_INACTIVE) {
      unassignedTickets = Number(
        (await agentModel.unassignOpenTickets(companyId, agentId)) || 0,
      );
      await tokens.invalidateUserTokens(agentId);
    }

    const agent = await agentModel.findAgent(companyId, agentId);
    if (!agent) throw agentNotFound();

    return { agent, unassignedTickets };
  }

  return { listAgents, inviteAgent, resendInvite, setAgentStatus };
}

module.exports = { createAgentService };
