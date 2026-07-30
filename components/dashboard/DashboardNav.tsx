"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton";

export function DashboardNav({ isFreePlan, isAdmin = false }: { isFreePlan: boolean; isAdmin?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  function links(onNavigate: () => void) {
    return (
      <>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900" onClick={onNavigate}>
          Dashboard
        </Link>
        <Link href="/applications" className="text-gray-600 hover:text-gray-900" onClick={onNavigate}>
          Applications
        </Link>
        <Link href="/profile" className="text-gray-600 hover:text-gray-900" onClick={onNavigate}>
          Profile
        </Link>
        {isAdmin && (
          <Link href="/admin" className="text-gray-600 hover:text-gray-900" onClick={onNavigate}>
            Admin
          </Link>
        )}
        {isFreePlan && (
          <Link
            href="/upgrade"
            className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700 hover:bg-brand-100"
            onClick={onNavigate}
          >
            Upgrade
          </Link>
        )}
        <LogoutButton />
      </>
    );
  }

  return (
    <>
      <nav className="hidden items-center gap-6 text-sm sm:flex">{links(() => {})}</nav>

      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 sm:hidden"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {isOpen && (
        <div className="absolute inset-x-0 top-full z-10 flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 text-sm shadow-sm sm:hidden">
          {links(() => setIsOpen(false))}
        </div>
      )}
    </>
  );
}
