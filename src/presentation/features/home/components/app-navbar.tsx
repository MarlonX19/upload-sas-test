"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { cn } from "@/lib/cn";
import { Button } from "@/presentation/shared/ui/button";

export function AppNavbar() {
  const { data: session, status } = useSession();

  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    null;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 shadow-surface-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-baseline gap-2 transition-[opacity] duration-200 ease-out hover:opacity-90"
        >
          <span className="text-xl font-semibold tracking-tight text-primary-600">Upload SAS</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Demo
          </span>
        </Link>
        <nav className="flex min-w-0 items-center justify-end gap-2 text-sm font-medium text-neutral-600 sm:gap-4">
          <Link href="/upload/pdfs" className="hidden text-sm text-primary-600 hover:underline sm:inline">
            Upload PDF
          </Link>
          {status === "loading" && (
            <span className="max-w-[12rem] truncate text-neutral-400" aria-hidden>
              …
            </span>
          )}
          {status === "authenticated" && displayName && (
            <span
              className="max-w-[10rem] truncate sm:max-w-[16rem] text-right text-neutral-800"
              title={displayName}
            >
              {displayName}
            </span>
          )}
          {status === "authenticated" && (
            <Link
              href="/admin/rooms/new"
              className="hidden text-sm text-primary-600 hover:underline sm:inline"
            >
              Novo registo
            </Link>
          )}
          {status === "authenticated" ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 px-3 py-0 text-sm"
              onClick={() => {
                void signOut({ callbackUrl: "/" });
              }}
            >
              Sair
            </Button>
          ) : (
            <Link
              href="/login"
              className={cn(
                "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold leading-none text-neutral-800 shadow-sm transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out motion-safe:hover:scale-[1.02] hover:border-primary-300 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
              )}
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
