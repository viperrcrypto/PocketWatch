/**
 * Constants for the travel module — booking URLs, program display names.
 */

export const PROGRAM_BOOKING_URLS: Record<string, string> = {
  ALASKA: "https://www.alaskaair.com/booking/flights",
  UNITED: "https://www.united.com/ual/en/us/flight-search/book-a-flight/results/awd",
  AMERICAN: "https://www.aa.com/booking/find-flights",
  DELTA: "https://www.delta.com/flight-search/search",
  AEROPLAN: "https://www.aeroplan.com/en/use-your-points/travel.html",
  FLYING_BLUE: "https://wwws.airfrance.us/search/open-dates",
  BRITISH_AIRWAYS: "https://www.britishairways.com/travel/redeem/execclub/",
  QANTAS: "https://www.qantas.com/au/en/book-a-trip/flights.html",
  EMIRATES: "https://www.emirates.com/us/english/",
  QATAR: "https://www.qatarairways.com/en-us/homepage.html",
  SINGAPORE: "https://www.singaporeair.com/en_UK/ppsclub-krisflyer/",
  VIRGIN_ATLANTIC: "https://www.virginatlantic.com/",
  VIRGIN_AUSTRALIA: "https://www.velocityfrequentflyer.com/",
  AVIANCA: "https://www.lifemiles.com/",
  CATHAY: "https://www.cathaypacific.com/",
  ETIHAD: "https://www.etihad.com/",
  ANA: "https://www.ana.co.jp/en/us/",
  JAL: "https://www.jal.co.jp/en/",
  HAWAIIAN: "https://www.hawaiianairlines.com/",
  JETBLUE: "https://trueblue.jetblue.com/",
  TAP: "https://www.flytap.com/",
  IBERIA: "https://www.iberia.com/",
  TURKISH: "https://www.turkishairlines.com/en-us/miles-and-smiles/",
  LATAM: "https://www.latamairlines.com/us/en/latam-pass",
  ICELANDAIR: "https://www.icelandair.com/",
  AER_LINGUS: "https://www.aerlingus.com/",
  EL_AL: "https://www.elal.com/",
  CONDOR: "https://www.condor.com/",
  CAPE_AIR: "https://www.capeair.com/",
}

export const PROGRAM_DISPLAY_NAMES: Record<string, string> = {
  ALASKA: "Alaska Mileage Plan",
  UNITED: "United MileagePlus",
  AMERICAN: "AA AAdvantage",
  DELTA: "Delta SkyMiles",
  AEROPLAN: "Aeroplan",
  FLYING_BLUE: "Flying Blue",
  BRITISH_AIRWAYS: "BA Avios",
  QANTAS: "Qantas Frequent Flyer",
  EMIRATES: "Emirates Skywards",
  QATAR: "Qatar Privilege Club",
  SINGAPORE: "Singapore KrisFlyer",
  VIRGIN_ATLANTIC: "Virgin Atlantic",
  VIRGIN_AUSTRALIA: "Velocity",
  AVIANCA: "LifeMiles",
  CATHAY: "Cathay Pacific Asia Miles",
  ETIHAD: "Etihad Guest",
  ANA: "ANA Mileage Club",
  JAL: "JAL Mileage Bank",
  HAWAIIAN: "HawaiianMiles",
  JETBLUE: "TrueBlue",
  TAP: "TAP Miles&Go",
  IBERIA: "Iberia Plus",
  TURKISH: "Miles & Smiles",
  LATAM: "LATAM Pass",
  ICELANDAIR: "Saga Club",
  AER_LINGUS: "AerClub",
  EL_AL: "Matmid Club",
  CONDOR: "Miles & More",
  CAPE_AIR: "Cape Air",
}

/**
 * Build deep booking URLs with origin/dest/date pre-filled for each program.
 */
export function buildProgramBookingUrl(
  program: string,
  origin: string,
  destination: string,
  date: string,
  cabin: string = "economy",
): string {
  const [year, month, day] = date.split("-")
  const cabinCode = cabin === "first" ? "F" : cabin === "business" ? "J" : "Y"

  switch (program) {
    case "ALASKA":
      return `https://www.alaskaair.com/booking/choose-flights?prior=award&orig=${origin}&dest=${destination}&date=${year}${month}${day}&ADT=1`
    case "UNITED":
      return `https://www.united.com/ual/en/us/flight-search/book-a-flight/results/awd?f=${origin}&t=${destination}&d=${date}&tt=1&at=1&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&tqp=A`
    case "AMERICAN":
      return `https://www.aa.com/booking/search?locale=en_US&pax=1&adult=1&type=OneWay&searchType=Award&origin=${origin}&destination=${destination}&departureDate=${date}`
    case "DELTA":
      return `https://www.delta.com/flight-search/search?cacheKeySuffix=a&action=findFlights&tripType=ONE_WAY&priceSchedule=MILES&origin=${origin}&destination=${destination}&departureDate=${date}&paxCount=1`
    case "AEROPLAN":
      return `https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${origin}&dest0=${destination}&departureDate0=${date}&ADT=1&YTH=0&CHD=0&INF=0&INS=0&lang=en-CA&tripType=O`
    case "FLYING_BLUE":
      return `https://wwws.airfrance.us/search/offers?pax=1:0:0:0:0:0:0:0&cabinClass=ECONOMY&activeConnection=0&connections=${origin}-A>${destination}-A:${date}`
    case "BRITISH_AIRWAYS": {
      const baCabin = cabinCode === "F" ? "F" : cabinCode === "J" ? "C" : "M"
      return `https://www.britishairways.com/travel/redeem/execclub/_gf/en_us?eId=111095&from=${origin}&to=${destination}&depDate=${date}&cabin=${baCabin}&ad=1&ch=0&inf=0&yf=0`
    }
    case "EMIRATES":
      return `https://www.emirates.com/us/english/book/?origin=${origin}&destination=${destination}&departDate=${date}&pax=1&class=${cabin}&award=true`
    case "QATAR": {
      const qrClass = cabinCode === "F" ? "F" : cabinCode === "J" ? "C" : "E"
      return `https://booking.qatarairways.com/nsp/views/showBooking.action?widget=QR&searchType=F&bookingClass=${qrClass}&tripType=O&from=${origin}&to=${destination}&departing=${date}&adult=1&child=0&infant=0&bookAward=true`
    }
    case "SINGAPORE":
      return `https://www.singaporeair.com/en_UK/ppsclub-krisflyer/redeem/redemption-booking/?originStation=${origin}&destinationStation=${destination}&departDate=${day}${month}${year}&cabinClass=${cabinCode}&adult=1`
    case "VIRGIN_ATLANTIC":
      return `https://www.virginatlantic.com/flight-search/select-flights?origin=${origin}&destination=${destination}&awardSearch=true&departureDate=${date}&adult=1`
    case "AVIANCA":
      return `https://www.lifemiles.com/flights/search?origin=${origin}&destination=${destination}&departDate=${date}&tripType=OW&adult=1&cabin=${cabinCode}`
    case "QANTAS":
      return `https://www.qantas.com/au/en/book-a-trip/flights.html?from=${origin}&to=${destination}&departure=${date}&adults=1&children=0&infants=0&isUsingRewardPoints=true`
    default:
      return PROGRAM_BOOKING_URLS[program] || `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}+on+${date}`
  }
}

/** Guess cabin class from Roame's cabinClasses array */
export function guessCabinFromClasses(cabinClasses: string[]): string {
  const joined = cabinClasses.join(" ").toLowerCase()
  if (joined.includes("first") || joined.includes("suites")) return "first"
  if (joined.includes("business") || joined.includes("polaris") || joined.includes("qsuites") || joined.includes("flagship")) return "business"
  if (joined.includes("premium")) return "premium_economy"
  return "economy"
}

/** Cabin cash price estimates (fallback when no Google Flights data) */
export const CABIN_CASH_ESTIMATES: Record<string, number> = {
  economy: 800,
  premium_economy: 1500,
  business: 4000,
  first: 8000,
}
