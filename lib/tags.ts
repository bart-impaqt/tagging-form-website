import { Tag } from "@/types";

export const PREDEFINED_TAGS: Tag[] = [
  { id: "broodjes", label: "Broodjes", color: "blue" },
  { id: "hotdog", label: "Hotdog", color: "orange" },
  { id: "ijskoffie", label: "IJskoffie", color: "cyan" },
  { id: "ijs", label: "IJs", color: "teal" },
  { id: "slush", label: "Slush", color: "purple" },
  { id: "warme_dranken", label: "Warme dranken", color: "red" },
  { id: "dealtjes_brood", label: "Dealtjes brood", color: "green" },
  { id: "dealtjes_gebak", label: "Dealtjes gebak", color: "pink" },
  { id: "dealtjes_warme_snack", label: "Dealtjes warme snack", color: "yellow" },
  { id: "ciabatta", label: "Ciabatta", color: "lime" },
  { id: "rookworst", label: "Rookworst", color: "indigo" },
  { id: "vier_uurtje", label: "4 uurtje", color: "gray" },
  { id: "twaalf_uurtje", label: "12 uurtje", color: "blue" },
  { id: "ontbijt", label: "Ontbijt", color: "orange" },
  { id: "mini_menu", label: "Mini menu", color: "green" },
  { id: "cafe_sfeerbeelden", label: "Cafe sfeerbeelden", color: "teal" },
];

export const TAG_COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200",
  orange: "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200",
  green: "bg-green-100 text-green-800 border-green-300 hover:bg-green-200",
  purple: "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-300 hover:bg-cyan-200",
  red: "bg-red-100 text-red-800 border-red-300 hover:bg-red-200",
  gray: "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200",
  lime: "bg-lime-100 text-lime-800 border-lime-300 hover:bg-lime-200",
  teal: "bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200",
  pink: "bg-pink-100 text-pink-800 border-pink-300 hover:bg-pink-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200",
};

export const TAG_SELECTED_COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500 text-white border-blue-500",
  orange: "bg-orange-500 text-white border-orange-500",
  green: "bg-green-500 text-white border-green-500",
  purple: "bg-purple-500 text-white border-purple-500",
  yellow: "bg-yellow-500 text-white border-yellow-500",
  cyan: "bg-cyan-500 text-white border-cyan-500",
  red: "bg-red-500 text-white border-red-500",
  gray: "bg-gray-500 text-white border-gray-500",
  lime: "bg-lime-500 text-white border-lime-500",
  teal: "bg-teal-500 text-white border-teal-500",
  pink: "bg-pink-500 text-white border-pink-500",
  indigo: "bg-indigo-500 text-white border-indigo-500",
};
