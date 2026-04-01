"use client"

import { useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { UnifiedHotelResult } from "@/types/travel"

/** Create a price-label marker icon instead of the default blue pin */
function priceIcon(hotel: UnifiedHotelResult): L.DivIcon {
  const hasPoints = hotel.pointsPerNight != null && hotel.pointsPerNight > 0
  const hasCash = hotel.cashPerNight != null && hotel.cashPerNight > 0

  const label = hasPoints
    ? `${(hotel.pointsPerNight! / 1000).toFixed(0)}k`
    : hasCash
      ? `$${hotel.cashPerNight!}`
      : "?"

  const bg = hasPoints
    ? "background:#7c3aed;border-color:#6d28d9"  // purple for points
    : "background:#111;border-color:#333"         // dark for cash

  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [30, 15],
    popupAnchor: [0, -18],
    html: `<div style="
      ${bg};color:#fff;font-size:11px;font-weight:700;
      padding:3px 8px;border-radius:6px;border:1.5px solid;
      white-space:nowrap;font-family:system-ui;
      box-shadow:0 2px 6px rgba(0,0,0,.4);
      cursor:pointer;
    ">${label}</div>`,
  })
}

interface HotelMapViewProps {
  hotels: UnifiedHotelResult[]
}

export function HotelMapView({ hotels }: HotelMapViewProps) {
  const mappable = useMemo(
    () => hotels.filter((h) => h.latitude != null && h.longitude != null),
    [hotels],
  )

  const bounds = useMemo(() => {
    if (mappable.length === 0) return null
    return L.latLngBounds(
      mappable.map((h) => [h.latitude!, h.longitude!] as [number, number]),
    )
  }, [mappable])

  if (mappable.length === 0) {
    return (
      <div className="card p-8 text-center">
        <span className="material-symbols-rounded text-foreground-muted/30 mb-2 block" style={{ fontSize: 36 }}>
          map
        </span>
        <p className="text-sm text-foreground-muted">No hotels have location data for the map view.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden border border-card-border" style={{ height: 500 }}>
      <MapContainer
        bounds={bounds!}
        boundsOptions={{ padding: [40, 40] }}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {mappable.map((hotel) => (
          <Marker
            key={hotel.id}
            position={[hotel.latitude!, hotel.longitude!]}
            icon={priceIcon(hotel)}
          >
            <Popup>
              <MarkerPopup hotel={hotel} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

function MarkerPopup({ hotel }: { hotel: UnifiedHotelResult }) {
  const hasCash = hotel.cashPerNight != null && hotel.cashPerNight > 0
  const hasPoints = hotel.pointsPerNight != null && hotel.pointsPerNight > 0
  const bookingLink = hotel.bookingLinks[0]

  return (
    <div className="min-w-[200px] text-xs">
      {hotel.images[0] && (
        <img
          src={hotel.images[0]}
          alt={hotel.name}
          className="w-full h-24 object-cover rounded mb-2"
        />
      )}
      <p className="font-bold text-sm mb-0.5">{hotel.name}</p>
      {hotel.brand && (
        <p className="text-gray-500 text-[10px] mb-1">{hotel.brand}</p>
      )}
      {hotel.overallRating > 0 && (
        <p className="text-gray-600 mb-1">
          {"★".repeat(Math.round(hotel.overallRating))} {hotel.overallRating.toFixed(1)}
          {hotel.reviews > 0 && ` (${hotel.reviews.toLocaleString()})`}
        </p>
      )}
      <div className="flex items-center gap-3 mt-1">
        {hasCash && (
          <span className="font-bold text-sm">${hotel.cashPerNight!.toLocaleString()}<span className="text-[10px] font-normal text-gray-500">/night</span></span>
        )}
        {hasPoints && (
          <span className="font-bold text-sm text-purple-600">
            {hotel.pointsPerNight!.toLocaleString()} pts
            {hotel.pointsProgram && <span className="text-[10px] font-normal text-gray-500"> {hotel.pointsProgram}</span>}
          </span>
        )}
      </div>
      {bookingLink && (
        <a
          href={bookingLink.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline mt-2 inline-block text-[11px]"
        >
          Book on {bookingLink.source} →
        </a>
      )}
    </div>
  )
}
