import { CONDITIONS_NOW, UV_INDEX } from '@/lib/shade-map'

/**
 * Live conditions for the alert widget. Anything route-specific is passed in
 * by the caller rather than restated here, so the widget can never disagree
 * with the route sheet behind it.
 */
export const CONDITIONS = {
  uvIndex: UV_INDEX,
  tempC: CONDITIONS_NOW.tempC,
}

/**
 * The single rule that decides whether the sponsored card is allowed to
 * render. Keeping it here — rather than inline in the sheet — is what makes
 * the "Business mode" panel honest: the panel reads this same threshold, so
 * the documented trigger and the shipped behaviour cannot drift apart.
 */
export const AD_TRIGGER = {
  uvThreshold: 6,
  tempThresholdC: 32,
}

export function adTriggered(
  { uvIndex, tempC } = CONDITIONS,
  { uvThreshold, tempThresholdC } = AD_TRIGGER,
) {
  return uvIndex > uvThreshold || tempC > tempThresholdC
}

export const SPONSOR = {
  brand: 'Anessa',
  product: 'Perfect UV Milk SPF 50+',
  headline: 'UV shield station ahead',
  offer:
    'Free sample or 20% off at Watsons, Sunway Pyramid LG — 40m off your route.',
  retailer: 'Watsons · Sunway Pyramid LG',
  detourMeters: 40,
  disclosure: 'Sponsored · Umbra monetization partner',
}

/** Shown only in the pitch-demo overlay, never to end users. */
export const BUSINESS_METRICS = [
  {
    label: 'Trigger',
    value: `Active when UV index > ${AD_TRIGGER.uvThreshold} or temp > ${AD_TRIGGER.tempThresholdC}°C`,
  },
  {
    label: 'Revenue model',
    value: 'Cost-per-click + foot-traffic attribution to partner pharmacy',
  },
  {
    label: 'Ad format',
    value: 'Contextual native supply drop',
  },
]
