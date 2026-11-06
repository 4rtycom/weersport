import Link from "next/link";
import type { ReturnTarget } from "@/lib/navigation/return-to";

export function ReturnLink({ href, label }: ReturnTarget) {
  return (
    <nav className="return-link" aria-label="Terug">
      <Link href={href}>{`Terug naar ${label}`}</Link>
    </nav>
  );
}
