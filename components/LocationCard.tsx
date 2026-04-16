import { Location } from "@/types";

interface Props {
  location: Location;
  onClick: () => void;
}

export default function LocationCard({ location, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white rounded-2xl border border-neutral-200 p-5 hover:border-[#E92A23] hover:shadow-md transition-all duration-150 cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-xs font-mono font-medium">
          {location.code}
        </span>
        <svg
          className="w-4 h-4 text-neutral-300 group-hover:text-neutral-600 group-hover:translate-x-0.5 transition-all"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Location info */}
      <div className="mb-4">
        <h3 className="font-semibold text-neutral-900 text-base leading-snug">
          {location.city}
        </h3>
        <p className="text-sm text-neutral-400 mt-0.5">{location.area}</p>
      </div>

      {/* Player count */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path strokeLinecap="round" d="M8 21h8M12 17v4" />
        </svg>
        {location.players.length} scherm{location.players.length !== 1 ? "en" : ""}
      </div>
    </button>
  );
}
