/**
 * Approximate coordinates for major world cities.
 * Used as fallback when Plaid location data has city/country but no lat/lon.
 */

const CITIES: Record<string, [number, number]> = {
  // US cities
  "New York|US": [40.7128, -74.006], "Los Angeles|US": [34.0522, -118.2437],
  "Chicago|US": [41.8781, -87.6298], "Houston|US": [29.7604, -95.3698],
  "Phoenix|US": [33.4484, -112.074], "San Francisco|US": [37.7749, -122.4194],
  "San Diego|US": [32.7157, -117.1611], "Dallas|US": [32.7767, -96.797],
  "Austin|US": [30.2672, -97.7431], "Miami|US": [25.7617, -80.1918],
  "Atlanta|US": [33.749, -84.388], "Boston|US": [42.3601, -71.0589],
  "Seattle|US": [47.6062, -122.3321], "Denver|US": [39.7392, -104.9903],
  "Nashville|US": [36.1627, -86.7816], "Portland|US": [45.5152, -122.6784],
  "Las Vegas|US": [36.1699, -115.1398], "Washington|US": [38.9072, -77.0369],
  "Philadelphia|US": [39.9526, -75.1652], "Minneapolis|US": [44.9778, -93.265],
  "Detroit|US": [42.3314, -83.0458], "Orlando|US": [28.5383, -81.3792],
  "Berkeley|US": [37.8716, -122.2727], "Albany|US": [37.887, -122.298],
  "Oakland|US": [37.8044, -122.2712], "Sacramento|US": [38.5816, -121.4944],
  "San Ramon|US": [37.7799, -121.978], "Fremont|US": [37.5485, -121.9886],
  "San Jose|US": [37.3382, -121.8863], "Concord|US": [37.978, -122.031],
  "Walnut Creek|US": [37.9101, -122.0652], "Dublin|US": [37.7022, -121.9358],
  "Tracy|US": [37.7397, -121.4252], "Emeryville|US": [37.8313, -122.2853],
  "Davis|US": [38.5449, -121.7405], "Pleasanton|US": [37.6604, -121.8758],
  "Fairfield|US": [38.2494, -122.04], "Novato|US": [38.1074, -122.5697],
  "Sausalito|US": [37.8591, -122.4853], "Lafayette|US": [37.8858, -122.1178],
  "Morristown|US": [40.7968, -74.4815], "Jericho|US": [40.7926, -73.5396],
  "Brooklyn|US": [40.6782, -73.9442], "Temple|US": [31.0982, -97.3428],
  "Daytona Beach|US": [29.2108, -81.0228], "Vail|US": [39.6403, -106.3742],
  "Miami Beach|US": [25.7907, -80.13], "Newport Beach|US": [33.6189, -117.9298],
  "Long Beach|US": [33.77, -118.1937], "Santa Rosa|US": [38.4404, -122.7141],
  "King City|US": [36.2128, -121.1258], "Fairfax|US": [37.9871, -122.5889],
  "Harrison|US": [36.2298, -93.1077], "Commerce|US": [34.0007, -118.1599],
  "Rogers|US": [36.332, -94.1185], "Roseville|US": [38.7521, -121.288],
  "San Antonio|US": [29.4241, -98.4936], "Charlotte|US": [35.2271, -80.8431],
  "Tampa|US": [27.9506, -82.4572], "Honolulu|US": [21.3069, -157.8583],
  // International cities
  "London|GB": [51.5074, -0.1278], "Paris|FR": [48.8566, 2.3522],
  "Cannes|FR": [43.5528, 7.0174], "Nice|FR": [43.7102, 7.262],
  "Berlin|DE": [52.52, 13.405], "Munich|DE": [48.1351, 11.582],
  "Frankfurt|DE": [50.1109, 8.6821], "Amsterdam|NL": [52.3676, 4.9041],
  "Rome|IT": [41.9028, 12.4964], "Milan|IT": [45.4642, 9.19],
  "Florence|IT": [43.7696, 11.2558], "Venice|IT": [45.4408, 12.3155],
  "Madrid|ES": [40.4168, -3.7038], "Barcelona|ES": [41.3874, 2.1686],
  "Ibiza|ES": [38.9067, 1.4206], "Lisbon|PT": [38.7223, -9.1393],
  "Dublin|IE": [53.3498, -6.2603], "Edinburgh|GB": [55.9533, -3.1883],
  "Zurich|CH": [47.3769, 8.5417], "Geneva|CH": [46.2044, 6.1432],
  "Vienna|AT": [48.2082, 16.3738], "Prague|CZ": [50.0755, 14.4378],
  "Budapest|HU": [47.4979, 19.0402], "Copenhagen|DK": [55.6761, 12.5683],
  "Stockholm|SE": [59.3293, 18.0686], "Oslo|NO": [59.9139, 10.7522],
  "Helsinki|FI": [60.1699, 24.9384], "Brussels|BE": [50.8503, 4.3517],
  "Athens|GR": [37.9838, 23.7275], "Istanbul|TR": [41.0082, 28.9784],
  "Dubai|AE": [25.2048, 55.2708], "Abu Dhabi|AE": [24.4539, 54.3773],
  "Tokyo|JP": [35.6762, 139.6503], "Osaka|JP": [34.6937, 135.5023],
  "Kyoto|JP": [35.0116, 135.7681], "Seoul|KR": [37.5665, 126.978],
  "Singapore|SG": [1.3521, 103.8198], "Hong Kong|HK": [22.3193, 114.1694],
  "Bangkok|TH": [13.7563, 100.5018], "Bali|ID": [-8.3405, 115.092],
  "Sydney|AU": [-33.8688, 151.2093], "Melbourne|AU": [-37.8136, 144.9631],
  "Auckland|NZ": [-36.8485, 174.7633], "Vancouver|CA": [49.2827, -123.1207],
  "Toronto|CA": [43.6532, -79.3832], "Montreal|CA": [45.5017, -73.5673],
  "Mexico City|MX": [19.4326, -99.1332], "Cancun|MX": [21.1619, -86.8515],
  "Cabo San Lucas|MX": [22.8905, -109.9167], "São Paulo|BR": [-23.5505, -46.6333],
  "Rio de Janeiro|BR": [-22.9068, -43.1729], "Buenos Aires|AR": [-34.6037, -58.3816],
  "Lima|PE": [-12.0464, -77.0428], "Bogota|CO": [4.711, -74.0721],
  "Cairo|EG": [30.0444, 31.2357], "Cape Town|ZA": [-33.9249, 18.4241],
  "Nairobi|KE": [-1.2921, 36.8219], "Marrakech|MA": [31.6295, -7.9811],
  "Mumbai|IN": [19.076, 72.8777], "New Delhi|IN": [28.6139, 77.209],
  "Beijing|CN": [39.9042, 116.4074], "Shanghai|CN": [31.2304, 121.4737],
  "Taipei|TW": [25.033, 121.5654], "Manila|PH": [14.5995, 120.9842],
  "Doha|QA": [25.2854, 51.531], "Tel Aviv|IL": [32.0853, 34.7818],
}

export function lookupCityCoordinates(city: string, country: string): [number, number] | null {
  // Try exact match
  const key = `${city}|${country}`
  if (CITIES[key]) return CITIES[key]

  // Try without country (first match)
  for (const [k, coords] of Object.entries(CITIES)) {
    if (k.startsWith(`${city}|`)) return coords
  }

  return null
}
