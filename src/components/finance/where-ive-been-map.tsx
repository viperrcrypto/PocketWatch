"use client"

import { useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { formatCurrency } from "@/lib/utils"
import type { LocationPin } from "./where-ive-been-types"

// Fix Leaflet default marker icons in Next.js bundling
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface Props {
  locations: LocationPin[]
}

export function WhereIveBeenMap({ locations }: Props) {
  const bounds = useMemo(() => {
    if (locations.length === 0) return null
    return L.latLngBounds(
      locations.map((l) => [l.lat, l.lon] as [number, number])
    )
  }, [locations])

  if (locations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-secondary/30 rounded-xl">
        <div className="text-center">
          <span className="material-symbols-rounded text-foreground-muted/30 block mb-2" style={{ fontSize: 48 }}>map</span>
          <p className="text-sm text-foreground-muted">No location data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 rounded-xl overflow-hidden border border-card-border">
      <MapContainer
        bounds={bounds ?? undefined}
        boundsOptions={{ padding: [40, 40] }}
        center={bounds ? undefined : [20, 0]}
        zoom={bounds ? undefined : 2}
        className="h-full w-full"
        style={{ minHeight: "400px" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {locations.map((loc) => (
            <Marker
              key={`${loc.city}-${loc.country}`}
              position={[loc.lat, loc.lon]}
              icon={defaultIcon}
            >
              <Popup>
                <div className="text-xs space-y-1 min-w-[140px]">
                  <p className="font-bold text-sm">{loc.city}</p>
                  <p className="text-foreground-muted">{loc.region ? `${loc.region}, ` : ""}{loc.country}</p>
                  <div className="border-t pt-1 mt-1 space-y-0.5">
                    <p>{loc.transactionCount} transaction{loc.transactionCount !== 1 ? "s" : ""}</p>
                    <p className="font-semibold">{formatCurrency(loc.totalSpent)} spent</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  )
}
