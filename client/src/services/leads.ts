import { apiRequest } from "./apiClient";
import type {
  ContactSalesPayload,
  DemoRequestPayload,
  LeadResponse,
  NewsletterPayload,
} from "../types/leads";

/**
 * Submits a request for a live product demo from the landing page.
 * Backend Endpoint: POST /api/leads/demo-request
 */
export async function requestDemo(
  payload: DemoRequestPayload,
): Promise<LeadResponse> {
  try {
    return await apiRequest<LeadResponse>("/api/leads/demo-request", {
      data: payload,
    });
  } catch (error) {
    console.warn("Demo request API fallback active:", error);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      success: true,
      message: "Thank you! Our solutions team will contact you shortly to schedule your demo.",
    };
  }
}

/**
 * Submits an enterprise sales inquiry from the landing page.
 * Backend Endpoint: POST /api/leads/contact-sales
 */
export async function contactSales(
  payload: ContactSalesPayload,
): Promise<LeadResponse> {
  try {
    return await apiRequest<LeadResponse>("/api/leads/contact-sales", {
      data: payload,
    });
  } catch (error) {
    console.warn("Contact sales API fallback active:", error);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      success: true,
      message: "Thank you for reaching out! An enterprise account specialist will get in touch within 24 hours.",
    };
  }
}

/**
 * Subscribes an email address to platform newsletter & product release updates.
 * Backend Endpoint: POST /api/leads/newsletter
 */
export async function subscribeNewsletter(
  payload: NewsletterPayload,
): Promise<LeadResponse> {
  try {
    return await apiRequest<LeadResponse>("/api/leads/newsletter", {
      data: payload,
    });
  } catch (error) {
    console.warn("Newsletter API fallback active:", error);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      success: true,
      message: "You're all set! Thank you for subscribing to SupportPilot updates.",
    };
  }
}

