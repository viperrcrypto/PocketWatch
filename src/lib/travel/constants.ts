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
  // Bank/card transfer programs — link to their transfer portals
  CITI_THANKYOU: "https://www.thankyou.com/",
  AMEX_MR: "https://global.americanexpress.com/rewards",
  CHASE_UR: "https://ultimaterewardspoints.chase.com/",
  CAPITAL_ONE: "https://www.capitalone.com/credit-cards/benefits/travel/",
  BILT: "https://www.biltrewards.com/travel",
  ATMOS: "https://www.joinatmos.com/",
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
  GOL: "Smiles",
  LIFEMILES: "LifeMiles",
  SMILES: "Smiles",
  KOREAN_AIR: "SKYPASS",
  ASIANA: "Asiana Club",
  CITI_THANKYOU: "Citi ThankYou",
  AMEX_MR: "Amex Membership Rewards",
  CHASE_UR: "Chase Ultimate Rewards",
  CAPITAL_ONE: "Capital One Miles",
  BILT: "Bilt Rewards",
  ATMOS: "Atmos",
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

  // Use simplest, most stable URL patterns — airlines break deep links frequently
  switch (program) {
    case "ALASKA":
      return `https://www.alaskaair.com/shopping/flights?prior=award&fromCity=${origin}&toCity=${destination}&departDate=${month}%2F${day}%2F${year}&adults=1`
    case "UNITED":
      return `https://www.united.com/en/us/fsr/choose-flights?f=${origin}&t=${destination}&d=${date}&tt=1&at=1&sc=7&px=1&taxng=1&clm=7&tqp=A`
    case "AMERICAN":
      return `https://www.aa.com/booking/search?locale=en_US&pax=1&adult=1&type=OneWay&searchType=Award&origin=${origin}&destination=${destination}&departureDate=${date}`
    case "DELTA":
      return `https://www.delta.com/flight-search/search?tripType=ONE_WAY&priceSchedule=MILES&origin=${origin}&destination=${destination}&departureDate=${date}&paxCount=1`
    case "AEROPLAN":
      return `https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${origin}&dest0=${destination}&departureDate0=${date}&ADT=1&tripType=O&lang=en-CA`
    case "FLYING_BLUE":
      return `https://wwws.airfrance.us/search/offers?pax=1:0:0:0:0:0:0:0&cabinClass=ECONOMY&activeConnection=0&connections=${origin}-A>${destination}-A:${date}`
    case "BRITISH_AIRWAYS":
      return `https://www.britishairways.com/travel/redeem/execclub/_gf/en_us?eId=111095&from=${origin}&to=${destination}&depDate=${date}&cabin=${cabinCode === "F" ? "F" : cabinCode === "J" ? "C" : "M"}&ad=1&ch=0&inf=0&yf=0`
    case "EMIRATES":
      return `https://www.emirates.com/us/english/book/?origin=${origin}&destination=${destination}&departDate=${date}&pax=1&class=${cabin}`
    case "QATAR":
      return `https://booking.qatarairways.com/nsp/views/showBooking.action?tripType=O&from=${origin}&to=${destination}&departing=${date}&adult=1&bookAward=true`
    case "SINGAPORE":
      return `https://www.singaporeair.com/en_UK/ppsclub-krisflyer/redeem/redemption-booking/?originStation=${origin}&destinationStation=${destination}&departDate=${day}${month}${year}&cabinClass=${cabinCode}&adult=1`
    case "VIRGIN_ATLANTIC":
      return `https://www.virginatlantic.com/flight-search/select-flights?origin=${origin}&destination=${destination}&awardSearch=true&departureDate=${date}&adult=1`
    case "AVIANCA":
      return `https://www.lifemiles.com/flights/search?origin=${origin}&destination=${destination}&departDate=${date}&tripType=OW&adult=1&cabin=${cabinCode}`
    case "QANTAS":
      return `https://www.qantas.com/au/en/book-a-trip/flights.html?from=${origin}&to=${destination}&departure=${date}&adults=1&isUsingRewardPoints=true`
    case "TURKISH":
      return `https://www.turkishairlines.com/en-us/miles-and-smiles/spend-miles/award-ticket/`
    case "HAWAIIAN":
      return `https://www.hawaiianairlines.com/book/results?SearchType=Award&From=${origin}&To=${destination}&DepartureDate=${date}&Adults=1`
    case "JETBLUE":
      return `https://www.jetblue.com/booking/flights?from=${origin}&to=${destination}&depart=${date}&adults=1&fare=points`
    case "TAP":
      return `https://www.flytap.com/en-us/book?type=MilesGo&from=${origin}&to=${destination}&date=${date}&pax=1`
    case "IBERIA":
      return `https://www.iberia.com/us/booking/select-flights/?market=US&adults=1&trip=OW&origin=${origin}&destination=${destination}&departureDate=${date}&AVIOS=true`
    case "LATAM":
      return `https://www.latamairlines.com/us/en/booking/redemption?origin=${origin}&destination=${destination}&outbound=${date}&adt=1`
    case "ANA":
      return `https://www.ana.co.jp/other/int/meta/0771.html?CONNECTION_KIND=us&LANG=e`
    case "JAL":
      return `https://www.jal.co.jp/en/jalmile/use/award/inter/`
    case "CATHAY":
      return `https://www.cathaypacific.com/cx/en_US/book-a-trip/redeem-flights/redeem-flight-awards.html`
    case "ETIHAD":
      return `https://www.etihad.com/en-us/fly-etihad/book-a-flight`
    default:
      return PROGRAM_BOOKING_URLS[program] || `https://www.google.com/travel/flights?q=one+way+flight+from+${origin}+to+${destination}+on+${date}`
  }
}

// ─── Airline IATA Code Mappings ──────────────────────────────────

/** Map IATA airline codes to full display names */
export const AIRLINE_NAMES: Record<string, string> = {
  AA: "American", UA: "United", DL: "Delta", AS: "Alaska",
  B6: "JetBlue", HA: "Hawaiian", NK: "Spirit", F9: "Frontier",
  WN: "Southwest", SY: "Sun Country",
  AC: "Air Canada", WS: "WestJet",
  BA: "British Airways", LH: "Lufthansa", AF: "Air France",
  KL: "KLM", LX: "Swiss", OS: "Austrian", SN: "Brussels Airlines",
  SK: "SAS", AY: "Finnair", TP: "TAP Portugal", IB: "Iberia",
  AZ: "ITA Airways", EI: "Aer Lingus", LO: "LOT Polish",
  TK: "Turkish Airlines", EK: "Emirates", QR: "Qatar Airways",
  EY: "Etihad", SQ: "Singapore Airlines", CX: "Cathay Pacific",
  QF: "Qantas", NZ: "Air New Zealand", JL: "JAL", NH: "ANA",
  OZ: "Asiana", KE: "Korean Air", CI: "China Airlines",
  BR: "EVA Air", MH: "Malaysia Airlines", TG: "Thai Airways",
  GA: "Garuda Indonesia", AI: "Air India", ET: "Ethiopian",
  SA: "South African Airways", LA: "LATAM", AV: "Avianca",
  CM: "Copa Airlines", AM: "Aeromexico", VS: "Virgin Atlantic",
  VA: "Virgin Australia", FI: "Icelandair", WY: "Oman Air",
  BT: "airBaltic", AT: "Royal Air Maroc", LY: "El Al",
  DE: "Condor", MS: "EgyptAir", SV: "Saudia", GF: "Gulf Air",
  RJ: "Royal Jordanian", UL: "SriLankan Airlines",
  "9W": "Cape Air", W6: "Wizz Air", FR: "Ryanair", U2: "easyJet",
}

/** Map IATA airline codes to the program key used for booking URLs */
export const IATA_TO_PROGRAM: Record<string, string> = {
  // Star Alliance → best booked via Aeroplan, United, or Turkish
  LH: "AEROPLAN", OS: "AEROPLAN", SN: "AEROPLAN", LX: "AEROPLAN",
  SK: "AEROPLAN", TP: "AEROPLAN", LO: "AEROPLAN", AC: "AEROPLAN",
  NH: "ANA", TK: "TURKISH", UA: "UNITED", AV: "AVIANCA",
  ET: "AEROPLAN", AI: "AEROPLAN", NZ: "AEROPLAN", OZ: "AEROPLAN",
  EI: "BRITISH_AIRWAYS", SQ: "SINGAPORE", TG: "AEROPLAN",
  SA: "AEROPLAN", MS: "AEROPLAN", BR: "AEROPLAN", CI: "AEROPLAN",
  // oneworld → best booked via BA Avios, AA, or Alaska
  BA: "BRITISH_AIRWAYS", AA: "AMERICAN", AS: "ALASKA",
  QF: "QANTAS", CX: "CATHAY", JL: "JAL", IB: "IBERIA",
  QR: "QATAR", RJ: "BRITISH_AIRWAYS", MH: "BRITISH_AIRWAYS",
  // SkyTeam → best booked via Flying Blue or Delta
  AF: "FLYING_BLUE", KL: "FLYING_BLUE", DL: "DELTA",
  AZ: "FLYING_BLUE", KE: "FLYING_BLUE", AM: "FLYING_BLUE",
  GA: "FLYING_BLUE", LA: "LATAM",
  // Non-alliance
  EK: "EMIRATES", EY: "ETIHAD", VS: "VIRGIN_ATLANTIC",
  VA: "VIRGIN_AUSTRALIA", B6: "JETBLUE", HA: "HAWAIIAN",
  FI: "ICELANDAIR", WY: "EMIRATES", AT: "FLYING_BLUE",
}

/** Bank/card transfer programs — booking should go to the airline, not the bank */
export const BANK_PROGRAMS = new Set([
  "CITI_THANKYOU", "AMEX_MR", "CHASE_UR", "CAPITAL_ONE", "BILT", "ATMOS",
])

/** Build a direct airline booking URL for cash flights (fallback when Google token expires) */
export function buildCashBookingUrl(airlineCode: string, origin: string, destination: string, date: string): string {
  switch (airlineCode) {
    case "AA": return `https://www.aa.com/booking/search?locale=en_US&pax=1&adult=1&type=OneWay&origin=${origin}&destination=${destination}&departureDate=${date}`
    case "UA": return `https://www.united.com/ual/en/us/flight-search/book-a-flight/results/rev?f=${origin}&t=${destination}&d=${date}&tt=1&at=1&sc=7&px=1&taxng=1`
    case "DL": return `https://www.delta.com/flight-search/search?cacheKeySuffix=b&action=findFlights&tripType=ONE_WAY&origin=${origin}&destination=${destination}&departureDate=${date}&paxCount=1`
    case "WN": return `https://www.southwest.com/air/booking/select.html?originationAirportCode=${origin}&destinationAirportCode=${destination}&departureDate=${date}&adultPassengersCount=1&tripType=oneway`
    case "B6": return `https://www.jetblue.com/booking/flights?from=${origin}&to=${destination}&depart=${date}&isMultiCity=false&noOfRoute=1&adults=1&children=0&infants=0`
    case "AS": return `https://www.alaskaair.com/booking/choose-flights?prior=revenue&orig=${origin}&dest=${destination}&date=${date.replace(/-/g, "")}&ADT=1`
    case "F9": return `https://booking.flyfrontier.com/Flight/Select?o1=${origin}&d1=${destination}&dd1=${date}&ADT=1&mon=true`
    case "NK": return `https://www.spirit.com/book/flights?DN=1&DD=${date}&OD=${origin}%2C${destination}&ADT=1&CHD=0&INF=0`
    case "HA": return `https://www.hawaiianairlines.com/book/results?SearchType=Revenue&From=${origin}&To=${destination}&DepartureDate=${date}&Adults=1`
    case "SY": return `https://www.suncountry.com/book/flights?from=${origin}&to=${destination}&depart=${date}&adults=1&tripType=oneWay`
    case "BA": return `https://www.britishairways.com/travel/book/public/en_us?from=${origin}&to=${destination}&depDate=${date}&cabin=M&ad=1&ch=0&inf=0`
    case "AF": case "KL": return `https://www.airfrance.us/search/offers?pax=1:0:0:0:0:0:0:0&cabinClass=ECONOMY&activeConnection=0&connections=${origin}-A>${destination}-A:${date}`
    case "LH": case "OS": case "LX": case "SN": return `https://www.lufthansa.com/us/en/flight-search?adults=1&cabinClass=economy&flightType=ONE_WAY&dcty=${origin}&acty=${destination}&out=${date}`
    case "AC": return `https://www.aircanada.com/booking/search?org0=${origin}&dest0=${destination}&departureDate0=${date}&ADT=1&tripType=O&lang=en-CA`
    case "EK": return `https://www.emirates.com/us/english/book/?origin=${origin}&destination=${destination}&departDate=${date}&pax=1&class=economy`
    case "QR": return `https://booking.qatarairways.com/nsp/views/showBooking.action?tripType=O&from=${origin}&to=${destination}&departing=${date}&adult=1`
    case "TK": return `https://www.turkishairlines.com/en-us/flights/?origin=${origin}&destination=${destination}&departureDate=${date}&adult=1`
    case "TO": return `https://www.transavia.com/en-EU/book-a-flight/flights/search/?routeSelection=V&flyingFrom[]=${origin}&flyingTo[]=${destination}&outboundDate=${date}&adultCount=1`
    case "FR": return `https://www.ryanair.com/gb/en/trip/flights/select?adults=1&dateOut=${date}&origin=${origin}&destination=${destination}`
    case "U2": return `https://www.easyjet.com/en/booking/select-flight?origin=${origin}&destination=${destination}&outbound=${date}&adults=1`
    case "W6": return `https://wizzair.com/#/booking/select-flight/${origin}/${destination}/${date}/null/1/0/0/null`
    case "AT": return `https://www.royalairmaroc.com/us-en/book/search?from=${origin}&to=${destination}&date=${date}&adults=1&tripType=OW`
    default: return `https://www.google.com/travel/flights?q=one+way+flight+from+${origin}+to+${destination}+on+${date}`
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
