export interface LocationPin {
  city: string
  region: string | null
  country: string
  lat: number
  lon: number
  transactionCount: number
  totalSpent: number
}

export interface LocationsResponse {
  locations: LocationPin[]
  stats: {
    countryCount: number
    cityCount: number
    transactionCount: number
    totalSpent: number
  }
}
