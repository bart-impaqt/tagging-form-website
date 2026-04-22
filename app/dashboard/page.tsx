"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Location } from "@/types";
import LocationCard from "@/components/LocationCard";
import Header from "@/components/Header";

export default function DashboardPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/locations");
        if (res.status === 401) {
          router.push("/");
          return;
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const message = typeof payload?.error === "string" ? payload.error : "Laden van locaties mislukt";
          throw new Error(message);
        }
        const data = await res.json();
        setLocations(data.locations);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Laden van locaties mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const filtered = locations.filter((loc) => {
    const q = search.toLowerCase();
    return (
      loc.code.toLowerCase().includes(q) ||
      loc.city.toLowerCase().includes(q) ||
      loc.area.toLowerCase().includes(q)
    );
  });

  // Group by prefix
  const grouped = filtered.reduce<Record<string, Location[]>>((acc, loc) => {
    if (!acc[loc.prefix]) acc[loc.prefix] = [];
    acc[loc.prefix].push(loc);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-neutral-900 mb-1">
            Locaties
          </h1>
          <p className="text-neutral-500 text-sm">
            Selecteer een locatie om tags voor de schermen te beheren.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">Wat je hier doet</h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            In dit overzicht zie je alle HEMA-filialen. Kies jouw locatie via de titel, ondertitel of locatiecode en
            open daarna de schermen van die locatie. Per scherm selecteer je tags die aangeven welke content daar
            standaard moet draaien. Dit is een eerste inventarisatie voor alle locaties.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-[#f5c6c5] bg-[#fff6f6] p-5">
          <h2 className="text-sm font-semibold text-[#b6221c] mb-2">Waarom dit belangrijk is</h2>
          <p className="text-sm text-[#7f2b28] leading-relaxed">
            Met deze eerste tagdata per scherm verbeteren we het narrowcastingplatform. Winkelteams krijgen een
            duidelijker overzicht van schermen en kunnen later eenvoudiger content-items maken, aan playlists koppelen
            en via tags de juiste players vinden.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-8 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10.5 10.5l3 3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Zoek op stad, gebied of code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#E92A23] focus:border-transparent"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-3 text-neutral-400 text-sm">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Locaties laden...
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-red-700 text-sm">
            <strong className="font-semibold">Fout bij laden van locaties:</strong> {error}
          </div>
        )}

        {/* Grouped locations */}
        {!loading && !error && (
          <>
            {Object.keys(grouped).length === 0 ? (
              <div className="text-center py-16 text-neutral-400 text-sm">
                Geen locaties gevonden.
              </div>
            ) : (
              <div className="space-y-10">
                {Object.entries(grouped).map(([prefix, locs]) => (
                  <section key={prefix}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#E92A23] text-white text-xs font-mono font-medium">
                        {prefix}
                      </span>
                      <span className="text-sm text-neutral-400">
                        {locs.length} locatie{locs.length !== 1 ? "s" : ""}
                      </span>
                      <div className="flex-1 h-px bg-neutral-200" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {locs.map((loc) => (
                        <LocationCard
                          key={loc.code}
                          location={loc}
                          onClick={() => router.push(`/location/${loc.code}`)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
