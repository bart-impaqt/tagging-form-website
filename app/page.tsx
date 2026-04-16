"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError("Ongeldige toegangscode. Probeer het opnieuw.");
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <Image
            src="/hema_logo.svg"
            alt="HEMA logo"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
            Locatieportaal
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
            Welkom terug
          </h1>
          <p className="text-sm text-neutral-500 mb-8">
            Voer je toegangscode in om verder te gaan
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2"
              >
                Toegangscode
              </label>
              <input
                id="code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Vul je code in"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono text-sm placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#E92A23] focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code}
              className="w-full py-3 px-4 bg-[#E92A23] text-white text-sm font-medium rounded-xl hover:bg-[#c7221c] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Controleren...
                </>
              ) : (
                "Doorgaan"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Geen toegangscode? Neem contact op met je accountmanager.
        </p>
      </div>
    </div>
  );
}
