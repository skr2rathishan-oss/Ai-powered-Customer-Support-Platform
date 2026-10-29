import { Link } from "react-router";
import { useSessionHome } from "../../router/useSessionHome";
import { ROUTES } from "../../router/routes";

interface WorkspaceLinkProps {
  /** Home path of the area showing this link; hidden when it matches the session home. */
  areaHome?: string;
}

/** Primary "Go to my workspace" link for signed-in accounts in the wrong area. */
export function WorkspaceLink({ areaHome }: WorkspaceLinkProps) {
  const { home } = useSessionHome();

  if (!home || home === ROUTES.HOME || home === areaHome) return null;

  return (
    <Link
      to={home}
      className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center no-underline shadow-sm"
    >
      Go to my workspace
    </Link>
  );
}
