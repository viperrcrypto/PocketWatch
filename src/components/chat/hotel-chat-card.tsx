"use client"

import { useState } from "react"
import type { HotelItem } from "./result-payload"

function StarRating({ stars }: { stars: number }) {
  return (
    <span className="text-[11px] text-amber-400">{"★".repeat(Math.min(stars, 5))}</span>
  )
}

/**
 * Compact hotel card for the chat results carousel. Consumes the flat
 * `HotelItem` the hotel tool emits. Strings render as React text nodes; image
 * and booking URLs are https-sanitized upstream in result-payload.ts.
 */
export function HotelChatCard({ hotel }: { hotel: HotelItem }) {
  const [imgError, setImgError] = useState(false)
  const hasCash = hotel.cashPerNight != null && hotel.cashPerNight > 0
  const hasPoints = hotel.pointsPerNight != null && hotel.pointsPerNight > 0

  return (
    <div className="card overflow-hidden h-full flex flex-col">
      {/* Image */}
      {hotel.image && !imgError ? (
        <div className="h-32 w-full overflow-hidden bg-background">
          <img
            src={hotel.image}
            alt={hotel.name}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="h-32 w-full bg-background flex items-center justify-center">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 36 }}>
            hotel
          </span>
        </div>
      )}

      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground line-clamp-1">{hotel.name}</h3>
            {hotel.hotelClass > 0 && <StarRating stars={hotel.hotelClass} />}
          </div>
          {hotel.brand && (
            <p className="text-[10px] text-primary font-medium mt-0.5">
              {hotel.brand}
              {hotel.pointsProgram ? ` · ${hotel.pointsProgram}` : ""}
            </p>
          )}
          {hotel.description && (
            <p className="text-[11px] text-foreground-muted line-clamp-2 mt-0.5">
              {hotel.description}
            </p>
          )}
        </div>

        {hotel.rating > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-foreground bg-primary/10 px-1.5 py-0.5 rounded">
              {hotel.rating.toFixed(1)}
            </span>
            {hotel.reviews > 0 && (
              <span className="text-[11px] text-foreground-muted">
                ({hotel.reviews.toLocaleString()} reviews)
              </span>
            )}
          </div>
        )}

        {hotel.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hotel.amenities.slice(0, 3).map((amenity) => (
              <span
                key={amenity}
                className="text-[10px] text-foreground-muted bg-background px-1.5 py-0.5 rounded border border-card-border"
              >
                {amenity}
              </span>
            ))}
            {hotel.amenities.length > 3 && (
              <span className="text-[10px] text-foreground-muted">
                +{hotel.amenities.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Pricing */}
        <div className="pt-1 mt-auto border-t border-card-border space-y-1.5">
          {hasCash && (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">
                  ${hotel.cashPerNight!.toLocaleString()}
                  <span className="text-[11px] font-normal text-foreground-muted"> /night</span>
                </p>
                {hotel.cashTotal != null && hotel.cashTotal > 0 && (
                  <p className="text-[11px] text-foreground-muted">
                    ${hotel.cashTotal.toLocaleString()} total
                  </p>
                )}
              </div>
              {hotel.bookingUrl && (
                <a
                  href={hotel.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline"
                >
                  Book
                </a>
              )}
            </div>
          )}

          {hasPoints && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-amber-400" style={{ fontSize: 14 }}>
                star
              </span>
              <p className="text-sm font-bold text-amber-400">
                {hotel.pointsPerNight!.toLocaleString()}
                <span className="text-[11px] font-normal text-amber-400/70"> pts/night</span>
              </p>
              {hotel.pointsProgram && (
                <span className="text-[10px] text-foreground-muted ml-auto">
                  {hotel.pointsProgram}
                </span>
              )}
            </div>
          )}

          {!hasCash && !hasPoints && (
            <p className="text-[11px] text-foreground-muted">No pricing available</p>
          )}
        </div>
      </div>
    </div>
  )
}
