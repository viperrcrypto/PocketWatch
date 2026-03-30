"use client"

import { useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { formatCurrency } from "@/lib/utils"
import type { LocationPin } from "./where-ive-been-types"

// Custom pin icon — glowing dot with pulse ring
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.2);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite"></div>
    <div style="position:absolute;inset:4px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5)"></div>
  </div>
  <style>@keyframes ping{75%,100%{transform:scale(1.8);opacity:0}}</style>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
})

interface Props {
  locations: LocationPin[]
}

export function WhereIveBeenMap({ locations }: Props) {
  const bounds = useMemo(() => {
    if (locations.length === 0) return null
    const b = L.latLngBounds(locations.map((l) => [l.lat, l.lon] as [number, number]))
    return b.pad(0.15)
  }, [locations])

  if (locations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background-secondary/30">
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
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={40}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
      >
        {locations.map((loc) => (
          <Marker
            key={`${loc.city}-${loc.country}-${loc.lat}`}
            position={[loc.lat, loc.lon]}
            icon={pinIcon}
          >
            <Popup closeButton={false} className="custom-popup">
              <div style={{ minWidth: 160, fontFamily: "inherit" }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>{loc.city}</p>
                <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
                  {loc.region ? `${loc.region}, ` : ""}{loc.country}
                </p>
                <div style={{ borderTop: "1px solid #eee", paddingTop: 6, display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ fontSize: 11, color: "#666" }}>{loc.transactionCount} txn{loc.transactionCount !== 1 ? "s" : ""}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(loc.totalSpent)}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
