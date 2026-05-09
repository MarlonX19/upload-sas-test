import Link from "next/link";

import { MicrosoftLoginButton } from "@/presentation/features/auth/components/microsoft-login-button";
import { AppNavbar } from "@/presentation/features/home/components/app-navbar";

export default function LoginPage() {
  return (
    <>
      <AppNavbar />
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-surface-sm">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-neutral-900">
            Entrar
          </h1>
          <p className="mt-2 text-center text-sm text-neutral-600">
            Usa a tua conta Microsoft (Entra ID) para continuar.
          </p>
          <div className="mt-8">
            <MicrosoftLoginButton />
          </div>
          <p className="mt-6 text-center text-sm text-neutral-500">
            <Link href="/" className="font-medium text-primary-600 hover:underline">
              Voltar à página inicial
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
