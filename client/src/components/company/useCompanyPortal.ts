import { useOutletContext } from "react-router";
import type { CompanyPortalContext } from "../../types/company";

export function useCompanyPortal(): CompanyPortalContext {
  return useOutletContext<CompanyPortalContext>();
}
