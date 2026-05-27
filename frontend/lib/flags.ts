/**
 * Maps football team names (as returned by football-data.org or entered manually)
 * to ISO 3166-1 alpha-2 country codes used by flagcdn.com.
 */
const TEAM_FLAGS: Record<string, string> = {
  // South America
  Brazil: 'br',
  Argentina: 'ar',
  Uruguay: 'uy',
  Colombia: 'co',
  Chile: 'cl',
  Peru: 'pe',
  Ecuador: 'ec',
  Paraguay: 'py',
  Venezuela: 've',
  Bolivia: 'bo',

  // Europe
  France: 'fr',
  Germany: 'de',
  Spain: 'es',
  Portugal: 'pt',
  Netherlands: 'nl',
  England: 'gb-eng',
  Italy: 'it',
  Croatia: 'hr',
  Belgium: 'be',
  Switzerland: 'ch',
  Denmark: 'dk',
  Poland: 'pl',
  Serbia: 'rs',
  Austria: 'at',
  Sweden: 'se',
  Norway: 'no',
  Scotland: 'gb-sct',
  Wales: 'gb-wls',
  Hungary: 'hu',
  'Czech Republic': 'cz',
  Czechia: 'cz',
  Slovakia: 'sk',
  Slovenia: 'si',
  Romania: 'ro',
  Ukraine: 'ua',
  Turkey: 'tr',
  Greece: 'gr',
  Russia: 'ru',
  Albania: 'al',
  'Bosnia-Herzegovina': 'ba',
  'Bosnia and Herzegovina': 'ba',
  Bosnia: 'ba',

  // North/Central America & Caribbean
  USA: 'us',
  'United States': 'us',
  Mexico: 'mx',
  Canada: 'ca',
  'Costa Rica': 'cr',
  Panama: 'pa',
  Jamaica: 'jm',
  Honduras: 'hn',
  'El Salvador': 'sv',
  Haiti: 'ht',
  'Curaçao': 'cw',
  Curacao: 'cw',

  // Africa
  Morocco: 'ma',
  Senegal: 'sn',
  Nigeria: 'ng',
  Ghana: 'gh',
  Cameroon: 'cm',
  Egypt: 'eg',
  Tunisia: 'tn',
  Algeria: 'dz',
  'South Africa': 'za',
  'Ivory Coast': 'ci',
  Mali: 'ml',
  'Burkina Faso': 'bf',
  'DR Congo': 'cd',
  'Congo DR': 'cd',
  'Democratic Republic of Congo': 'cd',

  // Asia
  Japan: 'jp',
  'South Korea': 'kr',
  Australia: 'au',
  Iran: 'ir',
  'Saudi Arabia': 'sa',
  Qatar: 'qa',
  China: 'cn',
  Iraq: 'iq',
  'United Arab Emirates': 'ae',
  Jordan: 'jo',
  India: 'in',
  Indonesia: 'id',
  Thailand: 'th',
  Vietnam: 'vn',
  'New Zealand': 'nz',
  Uzbekistan: 'uz',

  // Africa (additional)
  'Cape Verde': 'cv',
  'Cape Verde Islands': 'cv',
}

/**
 * Returns the flagcdn.com country code for a team name, or null if not found.
 * Tries exact match, then case-insensitive partial match.
 */
export function getTeamFlagCode(teamName: string): string | null {
  if (!teamName) return null

  // Exact match
  if (TEAM_FLAGS[teamName]) return TEAM_FLAGS[teamName]

  // Case-insensitive exact
  const lower = teamName.toLowerCase()
  for (const [key, code] of Object.entries(TEAM_FLAGS)) {
    if (key.toLowerCase() === lower) return code
  }

  // Partial match (e.g. "Germany U21" → "Germany")
  for (const [key, code] of Object.entries(TEAM_FLAGS)) {
    if (lower.startsWith(key.toLowerCase()) || key.toLowerCase().startsWith(lower)) {
      return code
    }
  }

  return null
}

/**
 * Returns the flagcdn.com image URL for a country code.
 */
export function getFlagUrl(code: string, size: 20 | 40 | 80 | 160 = 40): string {
  return `https://flagcdn.com/w${size}/${code}.png`
}

/** All World Cup nations used for the landing page marquee. */
export const MARQUEE_NATIONS: Array<{ name: string; code: string }> = [
  { name: 'Brazil', code: 'br' },
  { name: 'Argentina', code: 'ar' },
  { name: 'France', code: 'fr' },
  { name: 'Germany', code: 'de' },
  { name: 'Spain', code: 'es' },
  { name: 'Portugal', code: 'pt' },
  { name: 'England', code: 'gb-eng' },
  { name: 'Italy', code: 'it' },
  { name: 'Netherlands', code: 'nl' },
  { name: 'Croatia', code: 'hr' },
  { name: 'Morocco', code: 'ma' },
  { name: 'Japan', code: 'jp' },
  { name: 'USA', code: 'us' },
  { name: 'Mexico', code: 'mx' },
  { name: 'Senegal', code: 'sn' },
  { name: 'Nigeria', code: 'ng' },
  { name: 'South Korea', code: 'kr' },
  { name: 'Australia', code: 'au' },
  { name: 'Belgium', code: 'be' },
  { name: 'Switzerland', code: 'ch' },
  { name: 'Uruguay', code: 'uy' },
  { name: 'Colombia', code: 'co' },
  { name: 'Denmark', code: 'dk' },
  { name: 'Poland', code: 'pl' },
  { name: 'Canada', code: 'ca' },
  { name: 'Ecuador', code: 'ec' },
  { name: 'Ghana', code: 'gh' },
  { name: 'Qatar', code: 'qa' },
  { name: 'Saudi Arabia', code: 'sa' },
  { name: 'Iran', code: 'ir' },
  { name: 'Serbia', code: 'rs' },
  { name: 'Cameroon', code: 'cm' },
]
