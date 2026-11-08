export type BuildingEntry = {
  id: string
  name: string
  code: string | null
  indonesianName: string | null
  aliases: string[]
  faculty: string | null
  buildingType: string | null
  description: string | null
  mapsUrl: string | null
  latitude: number | null
  longitude: number | null
  verificationStatus: string
  sourceUrl: string | null
  isActive: boolean
}

export function normalizeBuildingSearch(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

export function searchBuildings(entries: BuildingEntry[], query: string) {
  const normalized = normalizeBuildingSearch(query)
  const words = normalized.split(/\s+/).filter(Boolean)
  return entries.filter(entry => {
    const haystack = normalizeBuildingSearch([entry.name, entry.code, entry.indonesianName, entry.faculty, entry.buildingType, ...entry.aliases].filter(Boolean).join(" "))
    return words.every(word => haystack.includes(word))
  }).sort((a, b) => {
    const exactA = normalized && normalizeBuildingSearch(a.code || "") === normalized ? 1 : 0
    const exactB = normalized && normalizeBuildingSearch(b.code || "") === normalized ? 1 : 0
    return exactB - exactA || a.name.localeCompare(b.name)
  })
}

// User-supplied initial directory, not an official facilities register.
// Keys are internal seed identifiers, never presented as campus building codes.
type SeedEntry = Pick<BuildingEntry, "name" | "indonesianName" | "aliases"> & {
  directoryKey: string; code?: string; faculty?: string; buildingType: string; description?: string
}
export const UMY_BUILDINGS: SeedEntry[] = [
  { directoryKey: "umy-fachruddin-a", name: "A.R. Fachruddin A", indonesianName: "Gedung A.R. Fachruddin A", aliases: ["AR Fachruddin A", "Fachruddin A"], buildingType: "Academic / administration" },
  { directoryKey: "umy-fachruddin-b", name: "A.R. Fachruddin B", indonesianName: "Gedung A.R. Fachruddin B", aliases: ["AR Fachruddin B", "Fachruddin B"], buildingType: "Academic / administration" },
  { directoryKey: "umy-admisi", name: "Admisi Building", indonesianName: "Gedung Admisi UMY", aliases: ["Admissions", "Admisi"], buildingType: "Administration" },
  { directoryKey: "umy-mas-mansyur", name: "KH. Mas Mansyur Building", indonesianName: "Gedung KH. Mas Mansyur", aliases: ["Mas Mansyur"], buildingType: "Academic / administration" },
  { directoryKey: "umy-ki-bagus", name: "Ki Bagus Hadikusumo Building", indonesianName: "Gedung Ki Bagus Hadikusumo", aliases: ["Ki Bagus Hadikusumo"], buildingType: "Academic / administration" },
  { directoryKey: "umy-ibrahim", name: "KH. Ibrahim Building", indonesianName: "Gedung KH. Ibrahim", aliases: ["Ibrahim"], buildingType: "Academic / administration" },
  { directoryKey: "umy-kasman", name: "Kasman Singodimedjo Building", indonesianName: "Gedung Kasman Singodimedjo", aliases: ["Kasman Singodimedjo"], buildingType: "Academic / administration" },
  { directoryKey: "umy-siti-walidah", name: "Siti Walidah Building", indonesianName: "Gedung Siti Walidah", aliases: ["Siti Walidah"], buildingType: "Academic / administration" },
  { directoryKey: "umy-djarnawi", name: "Djarnawi Hadikusuma Building", indonesianName: "Gedung Djarnawi Hadikusuma", aliases: ["Djarnawi Hadikusuma"], buildingType: "Academic / administration" },
  { directoryKey: "umy-dasron", name: "Dasron Hamid Research Center", indonesianName: "Pusat Riset Dasron Hamid", aliases: ["Dasron Hamid", "Research Center"], buildingType: "Research" },
  { directoryKey: "umy-fisipol", name: "Faculty of Social and Political Sciences", indonesianName: "Fakultas Ilmu Sosial dan Ilmu Politik UMY", aliases: ["FISIPOL", "FISIPOL UMY"], faculty: "Social and Political Sciences", buildingType: "Faculty" },
  { directoryKey: "umy-engineering", name: "Faculty of Engineering", indonesianName: "Fakultas Teknik UMY", aliases: ["Engineering", "Teknik", "FT UMY"], faculty: "Engineering / Fakultas Teknik", buildingType: "Faculty" },
  { directoryKey: "umy-business", name: "Faculty of Economics and Business", indonesianName: "Fakultas Ekonomi dan Bisnis UMY", aliases: ["FEB", "Economics", "Business"], faculty: "Economics and Business", buildingType: "Faculty" },
  { directoryKey: "umy-language", name: "Faculty of Language Education", indonesianName: "Fakultas Pendidikan Bahasa UMY", aliases: ["FPB", "Language Education"], faculty: "Language Education", buildingType: "Faculty" },
  { directoryKey: "umy-library", name: "UMY Library", indonesianName: "Perpustakaan UMY", code: "D", aliases: ["Library", "Perpustakaan", "Gedung D"], buildingType: "Library", description: "Supplied directory lists Gedung D, Lantai 3; exact location requires confirmation." },
  ...["F1", "F3", "F4", "F6"].map(code => ({ directoryKey: `umy-engineering-${code.toLowerCase()}`, name: `Engineering Building ${code}`, indonesianName: `Gedung Fakultas Teknik ${code}`, code, aliases: [code, "Engineering", "Fakultas Teknik", "FT UMY"], faculty: "Engineering / Fakultas Teknik", buildingType: "Faculty building", description: "Engineering building code from the supplied directory. Exact function and faculty subdivisions require official confirmation." })),
  { directoryKey: "umy-sportorium", name: "Sportorium UMY", indonesianName: "Sportorium UMY", aliases: ["Sportorium Muhammadiyah University of Yogyakarta"], buildingType: "Campus facility" },
  { directoryKey: "umy-student-center", name: "Student Center UMY", indonesianName: "Student Center UMY", aliases: ["Student Center"], buildingType: "Student facility" },
  { directoryKey: "umy-dormitory", name: "UMY Student Dormitory", indonesianName: "Asrama Mahasiswa UMY", aliases: ["Dormitory", "Asrama", "Student Dormitory"], buildingType: "Student accommodation" },
  { directoryKey: "umy-unires", name: "UNIRES", indonesianName: "UNIRES", aliases: ["UNIRES UMY"], buildingType: "Student facility" },
  { directoryKey: "umy-perdana", name: "Perdana UMY Hotel, Convention & Dormitory", indonesianName: "Perdana UMY Hotel, Convention & Dormitory", aliases: ["Perdana", "Hotel", "Convention", "Dormitory"], buildingType: "Accommodation / convention" },
  { directoryKey: "umy-mosque", name: "KH. Ahmad Dahlan Mosque", indonesianName: "Masjid KH. Ahmad Dahlan", aliases: ["Masjid", "Ahmad Dahlan", "Mosque"], buildingType: "Worship" },
  { directoryKey: "umy-boga", name: "UMY Boga", indonesianName: "Kantin UMY", aliases: ["Boga", "Kantin", "Canteen"], buildingType: "Dining" },
  { directoryKey: "umy-lapangan", name: "Lapangan Bintang", indonesianName: "Lapangan Bintang UMY", aliases: ["Lapangan Bintang"], buildingType: "Outdoor facility" },
]
