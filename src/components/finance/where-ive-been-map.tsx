"use client"

import { useMemo } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { formatCurrency } from "@/lib/utils"
import type { LocationPin } from "./where-ive-been-types"

interface Props {
  locations: LocationPin[]
}

export function WhereIveBeenMap({ locations }: Props) {
  const bounds = useMemo(() => {
    if (locations.length === 0) return null
    return L.latLngBounds(locations.map((l) => [l.lat, l.lon] as [number, number])).pad(0.15)
  }, [locations])

  // Scale radius by spend (min 6, max 18)
  const maxSpend = useMemo(() => Math.max(...locations.map((l) => l.totalSpent), 1), [locations])

  if (locations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background-secondary/20">
        <div className="text-center">
          <span className="material-symbols-rounded text-foreground-muted/20 block mb-2" style={{ fontSize: 48 }}>map</span>
          <p className="text-sm text-foreground-muted">No location data yet</p>
        </div>
      </div>
    )
  }

  return (
    <MapContainer
      bounds={bounds ?? undefined}
      boundsOptions={{ padding: [50, 50] }}
      center={bounds ? undefined : [30, -20]}
      zoom={bounds ? undefined : 3}
      className="h-full w-full"
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png"
      />
      {locations.map((loc) => {
        const r = 6 + (loc.totalSpent / maxSpend) * 12
        return (
          <CircleMarker
            key={`${loc.city}-${loc.country}-${loc.lat}`}
            center={[loc.lat, loc.lon]}
            radius={r}
            pathOptions={{
              fillColor: "#3b82f6",
              fillOpacity: 0.7,
              color: "#1d4ed8",
              weight: 2,
              opacity: 0.9,
            }}
          >
            <Popup closeButton={false}>
              <div style={{ minWidth: 150, fontFamily: "system-ui, sans-serif" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{loc.city}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                  {loc.region ? `${loc.region}, ` : ""}{loc.country}
                </div>
                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{loc.transactionCount} txn{loc.transactionCount !== 1 ? "s" : ""}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6" }}>{formatCurrency(loc.totalSpent)}</span>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
