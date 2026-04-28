"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/presentation/shared/ui/button";

const PROVIDER_ID = "microsoft-entra-id" as const;

export function MicrosoftLoginButton() {
  return (
    <Button
      type="button"
      className="h-12 w-full text-base"
      onClick={() => {
        void signIn(PROVIDER_ID, { callbackUrl: "/" });
      }}
    >
      Entrar com Microsoft
    </Button>
  );
}
