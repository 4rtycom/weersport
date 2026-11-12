"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/uitloggen", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button className="button button-ghost" type="button" onClick={logout} disabled={pending}>
      {pending ? "Uitloggen…" : "Uitloggen"}
    </button>
  );
}
