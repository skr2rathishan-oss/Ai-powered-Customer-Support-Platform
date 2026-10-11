import type { CompanyMeData } from "../types/company";
import { apiRequest } from "./apiClient";

interface CompanyMeResponse {
  success: boolean;
  data: CompanyMeData;
}

export async function getCompanyMe(): Promise<CompanyMeData> {
  const response = await apiRequest<CompanyMeResponse>("/api/company/me", {
    cache: "no-store",
  });
  return response.data;
}
