import { useOutletContext } from "react-router";
import type { CustomerPortalContext } from "../../types/customer";

export function useCustomerPortal(): CustomerPortalContext {
  return useOutletContext<CustomerPortalContext>();
}
