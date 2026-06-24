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

const TEAM_ABBR: Record<string, string> = {
  Argentina: 'ARG', Brazil: 'BRA', Uruguay: 'URU', Colombia: 'COL', Chile: 'CHI',
  Peru: 'PER', Ecuador: 'ECU', Paraguay: 'PAR', Venezuela: 'VEN', Bolivia: 'BOL',
  France: 'FRA', Germany: 'GER', Spain: 'ESP', Portugal: 'POR', Netherlands: 'NED',
  England: 'ENG', Italy: 'ITA', Croatia: 'CRO', Belgium: 'BEL', Switzerland: 'SUI',
  Denmark: 'DEN', Poland: 'POL', Serbia: 'SRB', Austria: 'AUT', Sweden: 'SWE',
  Norway: 'NOR', Scotland: 'SCO', Wales: 'WAL', Hungary: 'HUN',
  'Czech Republic': 'CZE', Czechia: 'CZE', Slovakia: 'SVK', Slovenia: 'SVN',
  Romania: 'ROU', Ukraine: 'UKR', Turkey: 'TUR', Greece: 'GRE', Russia: 'RUS',
  Albania: 'ALB', 'Bosnia-Herzegovina': 'BIH', 'Bosnia and Herzegovina': 'BIH', Bosnia: 'BIH',
  USA: 'USA', 'United States': 'USA', Mexico: 'MEX', Canada: 'CAN',
  'Costa Rica': 'CRC', Panama: 'PAN', Jamaica: 'JAM', Honduras: 'HON',
  'El Salvador': 'SLV', Haiti: 'HAI', 'Curaçao': 'CUW', Curacao: 'CUW',
  Morocco: 'MAR', Senegal: 'SEN', Nigeria: 'NGA', Ghana: 'GHA', Cameroon: 'CMR',
  Egypt: 'EGY', Tunisia: 'TUN', Algeria: 'ALG', 'South Africa': 'RSA',
  'Ivory Coast': 'CIV', Mali: 'MLI', 'Burkina Faso': 'BFA',
  'DR Congo': 'COD', 'Congo DR': 'COD', 'Democratic Republic of Congo': 'COD',
  'Cape Verde': 'CPV', 'Cape Verde Islands': 'CPV',
  Japan: 'JPN', 'South Korea': 'KOR', Australia: 'AUS', Iran: 'IRN',
  'Saudi Arabia': 'KSA', Qatar: 'QAT', China: 'CHN', Iraq: 'IRQ',
  'United Arab Emirates': 'UAE', Jordan: 'JOR', India: 'IND', Indonesia: 'IDN',
  Thailand: 'THA', Vietnam: 'VIE', 'New Zealand': 'NZL', Uzbekistan: 'UZB',
}

const TEAM_NAMES_PT: Record<string, string> = {
  Brazil: 'Brasil',
  France: 'França',
  Germany: 'Alemanha',
  Netherlands: 'Holanda',
  England: 'Inglaterra',
  Italy: 'Itália',
  Croatia: 'Croácia',
  Belgium: 'Bélgica',
  Switzerland: 'Suíça',
  Denmark: 'Dinamarca',
  Poland: 'Polônia',
  Serbia: 'Sérvia',
  Austria: 'Áustria',
  Sweden: 'Suécia',
  Norway: 'Noruega',
  Scotland: 'Escócia',
  Wales: 'País de Gales',
  Hungary: 'Hungria',
  'Czech Republic': 'República Tcheca',
  Czechia: 'República Tcheca',
  Slovakia: 'Eslováquia',
  Slovenia: 'Eslovênia',
  Romania: 'Romênia',
  Ukraine: 'Ucrânia',
  Turkey: 'Turquia',
  Greece: 'Grécia',
  Russia: 'Rússia',
  Albania: 'Albânia',
  'Bosnia-Herzegovina': 'Bósnia e Herzegovina',
  'Bosnia and Herzegovina': 'Bósnia e Herzegovina',
  Bosnia: 'Bósnia',
  USA: 'EUA',
  'United States': 'Estados Unidos',
  Canada: 'Canadá',
  Mexico: 'México',
  Jamaica: 'Jamaica',
  Honduras: 'Honduras',
  Morocco: 'Marrocos',
  Senegal: 'Senegal',
  Nigeria: 'Nigéria',
  Ghana: 'Gana',
  Cameroon: 'Camarões',
  Egypt: 'Egito',
  Tunisia: 'Tunísia',
  Algeria: 'Argélia',
  'South Africa': 'África do Sul',
  'Ivory Coast': 'Costa do Marfim',
  'Burkina Faso': 'Burkina Faso',
  'DR Congo': 'RD Congo',
  'Congo DR': 'RD Congo',
  'Democratic Republic of Congo': 'República Democrática do Congo',
  'Cape Verde': 'Cabo Verde',
  'Cape Verde Islands': 'Cabo Verde',
  Japan: 'Japão',
  'South Korea': 'Coreia do Sul',
  Australia: 'Austrália',
  Iran: 'Irã',
  'Saudi Arabia': 'Arábia Saudita',
  Qatar: 'Catar',
  Iraq: 'Iraque',
  'United Arab Emirates': 'Emirados Árabes Unidos',
  Jordan: 'Jordânia',
  India: 'Índia',
  Indonesia: 'Indonésia',
  Thailand: 'Tailândia',
  Vietnam: 'Vietnã',
  'New Zealand': 'Nova Zelândia',
  Uzbekistan: 'Uzbequistão',
  Uruguay: 'Uruguai',
  Paraguay: 'Paraguai',
  Panama: 'Panamá',
  Ecuador: 'Equador',
  Spain: 'Espanha',
  Colombia: 'Colômbia',
}

export function translateTeamName(name: string, locale: string): string {
  if (locale !== 'pt') return name
  return TEAM_NAMES_PT[name] ?? name
}

/**
 * Translates a stored group name (backend format "Group A") to the active locale.
 * Falls back to the original string if it doesn't match the expected pattern.
 */
export function translateGroupName(group: string, locale: string): string {
  if (locale !== 'pt' || !group) return group
  const m = group.match(/^Group (.+)$/)
  return m ? `Grupo ${m[1]}` : group
}

/**
 * Translates backend-supplied bracket placeholder labels (e.g. "1st Group A",
 * "Winner M73", "Best 3rd (C/D/E/F)") to the active locale. Falls back to the
 * original string for any label that doesn't match a known pattern.
 */
export function translateBracketLabel(label: string, locale: string): string {
  if (locale !== 'pt' || !label) return label

  let m: RegExpMatchArray | null

  m = label.match(/^1st Group (.+)$/)
  if (m) return `1º Grupo ${m[1]}`

  m = label.match(/^2nd Group (.+)$/)
  if (m) return `2º Grupo ${m[1]}`

  m = label.match(/^Best 3rd \((.+)\)$/)
  if (m) return `Melhor 3º (${m[1]})`

  m = label.match(/^Winner (M\d+)$/)
  if (m) return `Vencedor ${m[1]}`

  m = label.match(/^Loser (M\d+)$/)
  if (m) return `Perdedor ${m[1]}`

  return label
}

/**
 * Dominant/iconic color for each nation's flag, used in data visualizations.
 * Chosen for immediate recognizability (e.g. Netherlands → orange, not red/blue).
 */
const TEAM_COLORS: Record<string, string> = {
  // South America
  Brazil: '#009C3B',
  Argentina: '#74ACDF',
  Uruguay: '#001489',
  Colombia: '#FCD116',
  Chile: '#D52B1E',
  Peru: '#D91023',
  Ecuador: '#FFD100',
  Paraguay: '#D52B1E',
  Venezuela: '#CF142B',
  Bolivia: '#D52B1E',

  // Europe
  France: '#003189',
  Germany: '#DD0000',
  Spain: '#C60B1E',
  Portugal: '#006600',
  Netherlands: '#FF6200',
  England: '#CF091E',
  Italy: '#0066CC',
  Croatia: '#FF3D00',
  Belgium: '#ED2939',
  Switzerland: '#FF0000',
  Denmark: '#C60C30',
  Poland: '#DC143C',
  Serbia: '#C6363C',
  Austria: '#ED2939',
  Sweden: '#006AA7',
  Norway: '#EF2B2D',
  Scotland: '#003399',
  Wales: '#C8102E',
  Hungary: '#CE2939',
  'Czech Republic': '#D7141A',
  Czechia: '#D7141A',
  Slovakia: '#0B4EA2',
  Slovenia: '#003DA5',
  Romania: '#FFD700',
  Ukraine: '#FFD700',
  Turkey: '#E30A17',
  Greece: '#0D5EAF',
  Russia: '#003DA5',
  Albania: '#E41E20',
  'Bosnia-Herzegovina': '#002395',
  'Bosnia and Herzegovina': '#002395',
  Bosnia: '#002395',

  // CONCACAF
  USA: '#3C3B6E',
  'United States': '#3C3B6E',
  Mexico: '#006847',
  Canada: '#FF0000',
  'Costa Rica': '#002B7F',
  Panama: '#DA121A',
  Jamaica: '#009B3A',
  Honduras: '#0073CF',
  'El Salvador': '#0F47AF',
  Haiti: '#00209F',
  'Curaçao': '#002B7F',
  Curacao: '#002B7F',

  // Africa
  Morocco: '#C1272D',
  Senegal: '#00853F',
  Nigeria: '#008751',
  Ghana: '#EF3340',
  Cameroon: '#007A5E',
  Egypt: '#CE1126',
  Tunisia: '#E70013',
  Algeria: '#006233',
  'South Africa': '#007A4D',
  'Ivory Coast': '#F77F00',
  Mali: '#14B53A',
  'Burkina Faso': '#EF2B2D',
  'DR Congo': '#007FFF',
  'Congo DR': '#007FFF',
  'Democratic Republic of Congo': '#007FFF',
  'Cape Verde': '#003893',
  'Cape Verde Islands': '#003893',

  // Asia
  Japan: '#BC002D',
  'South Korea': '#CD2E3A',
  Australia: '#00008B',
  Iran: '#239F40',
  'Saudi Arabia': '#006C35',
  Qatar: '#8D1B3D',
  China: '#DE2910',
  Iraq: '#007A3D',
  'United Arab Emirates': '#00732F',
  Jordan: '#007A3D',
  India: '#FF9933',
  Indonesia: '#CE1126',
  Thailand: '#A51931',
  Vietnam: '#DA251D',
  'New Zealand': '#00247D',
  Uzbekistan: '#1EB53A',
}

/**
 * Returns the dominant/iconic flag color for a team, or a neutral fallback.
 */
export function getTeamColor(teamName: string): string {
  if (!teamName) return '#334155'
  if (TEAM_COLORS[teamName]) return TEAM_COLORS[teamName]
  const lower = teamName.toLowerCase()
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (key.toLowerCase() === lower) return color
    if (lower.startsWith(key.toLowerCase()) || key.toLowerCase().startsWith(lower)) return color
  }
  return '#334155'
}

export function getTeamAbbr(teamName: string): string {
  if (!teamName) return '???'
  if (TEAM_ABBR[teamName]) return TEAM_ABBR[teamName]
  const lower = teamName.toLowerCase()
  for (const [key, abbr] of Object.entries(TEAM_ABBR)) {
    if (key.toLowerCase() === lower) return abbr
    if (lower.startsWith(key.toLowerCase())) return abbr
  }
  return teamName.slice(0, 3).toUpperCase()
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
  { name: 'Turkey', code: 'tr' },
  { name: 'Netherlands', code: 'nl' },
  { name: 'Croatia', code: 'hr' },
  { name: 'Morocco', code: 'ma' },
  { name: 'Japan', code: 'jp' },
  { name: 'USA', code: 'us' },
  { name: 'Mexico', code: 'mx' },
  { name: 'Senegal', code: 'sn' },
  { name: 'Algeria', code: 'dz' },
  { name: 'South Korea', code: 'kr' },
  { name: 'Australia', code: 'au' },
  { name: 'Belgium', code: 'be' },
  { name: 'Switzerland', code: 'ch' },
  { name: 'Uruguay', code: 'uy' },
  { name: 'Colombia', code: 'co' },
  { name: 'Norway', code: 'no' },
  { name: 'Czechia', code: 'cz' },
  { name: 'Canada', code: 'ca' },
  { name: 'Ecuador', code: 'ec' },
  { name: 'Ghana', code: 'gh' },
  { name: 'Qatar', code: 'qa' },
  { name: 'Saudi Arabia', code: 'sa' },
  { name: 'Iran', code: 'ir' },
  { name: 'Scotland', code: 'gb-sct' },
  { name: 'Ivory Coast', code: 'ci' },
]
