"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Location, PlayerTagSelection } from "@/types";
import { PREDEFINED_TAGS, TAG_COLOR_MAP, TAG_SELECTED_COLOR_MAP } from "@/lib/tags";
import Header from "@/components/Header";

interface Props {
  params: Promise<{ code: string }>;
}

export default function LocationDetailPage({ params }: Props) {
  const { code } = use(params);
  const router = useRouter();

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // selections: playerId -> Set of tag ids
  const [selections, setSelections] = useState<Record<number, Set<string>>>({});
  // remarks: playerId -> free text
  const [remarks, setRemarks] = useState<Record<number, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/locations?code=${encodeURIComponent(code)}&includePlaylistPreview=1`
        );
        if (res.status === 401) { router.push("/"); return; }
        if (res.status === 404) { router.push("/dashboard"); return; }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const message = typeof payload?.error === "string" ? payload.error : "Locatie laden mislukt";
          throw new Error(message);
        }
        const data = await res.json();
        const found: Location | null = data.location ?? null;
        if (!found) { router.push("/dashboard"); return; }
        setLocation(found);

        // Init empty selections
        const init: Record<number, Set<string>> = {};
        const initRemarks: Record<number, string> = {};
        found.players.forEach((p: { id: number }) => { init[p.id] = new Set(); });
        found.players.forEach((p: { id: number }) => { initRemarks[p.id] = ""; });
        setSelections(init);
        setRemarks(initRemarks);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Locatie laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [code, router]);

  function toggleTag(playerId: number, tagId: string) {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(prev[playerId]);
      if (set.has(tagId)) set.delete(tagId);
      else set.add(tagId);
      next[playerId] = set;
      return next;
    });
  }

  async function handleSubmit() {
    if (!location) return;
    setSubmitting(true);
    setError("");

    const playerSelections: PlayerTagSelection[] = location.players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      tags: Array.from(selections[p.id] || []),
      comment: remarks[p.id] || "",
    }));

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationCode: location.code,
          locationName: location.displayName,
          playerSelections,
        }),
      });

      if (!res.ok) throw new Error("Opslaan mislukt");
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt");
    } finally {
      setSubmitting(false);
    }
  }

  // Count total tags selected
  const totalSelected = Object.values(selections).reduce(
    (sum, s) => sum + s.size,
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 text-neutral-400 text-sm gap-3 px-4 text-center">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p>Locatiegegevens laden...</p>
          <p className="max-w-md">
            Dit kan iets langer duren omdat we per scherm de juiste playlist-koppeling zoeken.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Opgeslagen!</h2>
          <p className="text-neutral-500 text-sm mb-8">
            Je tagselecties voor <strong>{location?.displayName}</strong> zijn succesvol opgeslagen.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-5 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Terug naar overzicht
            </button>
            <button
              onClick={() => setSubmitted(false)}
              className="px-5 py-2.5 rounded-xl bg-[#E92A23] text-white text-sm font-medium hover:bg-[#c7221c] transition-colors"
            >
              Selecties bewerken
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-10 pb-32">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-neutral-400 mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="hover:text-neutral-700 transition-colors"
          >
            Locaties
          </button>
          <span>/</span>
          <span className="text-neutral-900 font-medium">{location?.displayName}</span>
        </nav>

        {/* Location header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#E92A23] text-white text-xs font-mono font-medium">
              {location?.code}
            </span>
            <span className="text-xs text-neutral-400">{location?.players.length} scherm{location?.players.length !== 1 ? "en" : ""}</span>
          </div>
          <h1 className="text-3xl font-semibold text-neutral-900">
            {location?.city}
            <span className="text-neutral-400 font-normal"> - {location?.area}</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Selecteer de relevante tags voor elk scherm op deze locatie.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Players */}
        <div className="space-y-4">
          {location?.players.map((player) => {
            const playerSelections = selections[player.id] || new Set();
            const parts = player.name.split("_");
            // Last meaningful part is the screen label
            const screenLabel = parts.slice(4).join(" ").replace(/-/g, " ") || parts[parts.length - 1].replace(/-/g, " ");

            return (
              <div
                key={player.id}
                className="bg-white rounded-2xl border border-neutral-200 p-6 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-mono text-neutral-400">ID {player.id}</span>
                    </div>
                    <h3 className="font-semibold text-neutral-900">
                      {screenLabel || player.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5 font-mono">{player.name}</p>

                    {Array.isArray(player.playlistPreviews) && player.playlistPreviews.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {player.playlistPreviews.map((preview) => (
                          <div
                            key={`${player.id}-${preview.displayId}`}
                            className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                          >
                            <div className="text-xs font-medium text-neutral-700">
                              {preview.displayName}
                              {preview.screenCounter !== null ? ` (Scherm ${preview.screenCounter})` : ""}
                              {preview.playlistName ? ` - ${preview.playlistName}` : ""}
                            </div>
                            {preview.itemNames.length > 0 ? (
                              <div className="mt-1 text-xs text-neutral-600">
                                {preview.itemNames.join(" | ")}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-neutral-400">
                                Geen playlist-items gevonden
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {playerSelections.size > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E92A23] text-white text-xs font-medium shrink-0">
                      {playerSelections.size} tag{playerSelections.size !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map((tag) => {
                    const selected = playerSelections.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(player.id, tag.id)}
                        className={`
                          px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-100 cursor-pointer
                          ${selected
                            ? TAG_SELECTED_COLOR_MAP[tag.color]
                            : TAG_COLOR_MAP[tag.color]
                          }
                        `}
                      >
                        {selected && (
                          <span className="mr-1">OK</span>
                        )}
                        {tag.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <label
                    htmlFor={`remark-${player.id}`}
                    className="block text-xs font-medium text-neutral-500 mb-1"
                  >
                    Opmerking
                  </label>
                  <textarea
                    id={`remark-${player.id}`}
                    value={remarks[player.id] || ""}
                    onChange={(e) =>
                      setRemarks((prev) => ({ ...prev, [player.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Voeg een specifieke opmerking toe voor dit scherm..."
                    className="w-full resize-y min-h-[56px] px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#E92A23] focus:border-transparent"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-4 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            {totalSelected > 0 ? (
              <span>
                <strong className="text-neutral-900">{totalSelected}</strong> tag{totalSelected !== 1 ? "s" : ""} geselecteerd over {location?.players.length} scherm{(location?.players.length ?? 0) !== 1 ? "en" : ""}
              </span>
            ) : (
              <span>Nog geen tags geselecteerd</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-[#E92A23] text-white text-sm font-medium hover:bg-[#c7221c] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Opslaan...
                </>
              ) : (
                "Opslaan en verzenden"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
