"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Location, PlayerTagSelection } from "@/types";
import {
  TAG_COLOR_MAP,
  TAG_GROUP_LABELS,
  TAG_SELECTED_COLOR_MAP,
  TagGroupId,
  getVisibleTagsForGroup,
  inferTagGroupFromPlayerName,
} from "@/lib/tags";
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
  // group selection: playerId -> restaurant/takeaway
  const [tagGroups, setTagGroups] = useState<Record<number, TagGroupId>>({});

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
        const initGroups: Record<number, TagGroupId> = {};
        found.players.forEach((p: { id: number }) => { init[p.id] = new Set(); });
        found.players.forEach((p: { id: number }) => { initRemarks[p.id] = ""; });
        found.players.forEach((p: { id: number; name: string }) => {
          initGroups[p.id] = inferTagGroupFromPlayerName(p.name);
        });
        setSelections(init);
        setRemarks(initRemarks);
        setTagGroups(initGroups);
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

  function setPlayerTagGroup(playerId: number, nextGroup: TagGroupId) {
    setTagGroups((prev) => ({ ...prev, [playerId]: nextGroup }));

    setSelections((prev) => {
      const allowed = new Set(getVisibleTagsForGroup(nextGroup).map((tag) => tag.id));
      const current = prev[playerId] || new Set<string>();
      const filtered = new Set(Array.from(current).filter((tagId) => allowed.has(tagId)));
      return { ...prev, [playerId]: filtered };
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

        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">Wat verwachten we van je</h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Selecteer per scherm de tags die bij de plek van dat scherm passen. Met een tag geef je aan welke content
            daar in de toekomst standaard moet draaien. Staat een scherm bijvoorbeeld bij de broodjes, kies dan tags
            zoals broodjes en dealtjes brood.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-[#f5c6c5] bg-[#fff6f6] p-5">
          <h2 className="text-sm font-semibold text-[#b6221c] mb-2">Waarom dit belangrijk is</h2>
          <p className="text-sm text-[#7f2b28] leading-relaxed">
            Met deze eerste tagdata per scherm verbeteren we het narrowcastingplatform. Winkelteams krijgen straks een
            duidelijker overzicht van schermen en kunnen eenvoudiger content-items maken, aan playlists koppelen en via
            tags de juiste players vinden. Je kunt tags later altijd aanpassen als de situatie verandert.
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
            const playerTagGroup = tagGroups[player.id] ?? inferTagGroupFromPlayerName(player.name);
            const visibleTags = getVisibleTagsForGroup(playerTagGroup);
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

                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                      <div className="text-xs font-semibold text-blue-900">Preview playlist</div>
                      <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                        Gebruik deze preview om dit scherm in de winkel te herkennen. We hebben vooral technische
                        playernamen, daarom helpt de preview je te controleren dat je het juiste scherm selecteert.
                      </p>
                    </div>

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

                    {(!Array.isArray(player.playlistPreviews) || player.playlistPreviews.length === 0) && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Geen preview playlist beschikbaar voor dit scherm. Controleer extra goed of je de juiste player
                        te pakken hebt.
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
                <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  Kies alle tags die op dit scherm van toepassing zijn. Klaar met alle schermen? Klik onderaan op
                  Opslaan en verzenden.
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <label
                    htmlFor={`tag-group-${player.id}`}
                    className="text-xs font-medium text-neutral-600"
                  >
                    Taggroep
                  </label>
                  <select
                    id={`tag-group-${player.id}`}
                    value={playerTagGroup}
                    onChange={(e) => setPlayerTagGroup(player.id, e.target.value as TagGroupId)}
                    className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#E92A23] focus:border-transparent"
                  >
                    {Object.entries(TAG_GROUP_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  {visibleTags.map((tag) => {
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
                    Opmerking (optioneel)
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
                  <p className="mt-1 text-xs text-neutral-400">
                    Alleen invullen als je extra toelichting wilt geven.
                  </p>
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
