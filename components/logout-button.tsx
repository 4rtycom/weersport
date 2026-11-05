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
    <button className="button auth-button auth-button-soft" type="button" onClick={logout} disabled={pending}>
      Uitloggen
    </button>
  );
}
