import {
  AirVent,
  Armchair,
  Baby,
  Bluetooth,
  Camera,
  Compass,
  Flame,
  Gauge,
  KeyRound,
  Music4,
  Navigation,
  Power,
  Radar,
  Sparkles,
  Sun,
  Sunrise,
  Usb,
  Wifi,
  Zap,
} from "lucide-react";

// Icon per feature key from GET /api/meta's vehicle_features (key/label come from the
// backend - this file only owns the icon, so a new feature just needs a fallback here).
export const FEATURE_ICONS = {
  air_conditioning: AirVent,
  heated_seats: Flame,
  massage_seats: Sparkles,
  leather_seats: Armchair,
  sunroof: Sun,
  bluetooth: Bluetooth,
  usb_charging: Usb,
  gps_navigation: Navigation,
  cruise_control: Gauge,
  steering_wheel_controls: Compass,
  reverse_camera: Camera,
  parking_sensors: Radar,
  keyless_entry: KeyRound,
  push_start: Power,
  child_seat_compatible: Baby,
  wifi_hotspot: Wifi,
  premium_sound_system: Music4,
  four_wheel_drive: Zap,
  automatic_transmission: Gauge,
  panoramic_roof: Sunrise,
};

export function featureIcon(key) {
  return FEATURE_ICONS[key] || Sparkles;
}

// meta.vehicle_features is [{key, label}, ...] from GET /api/meta - turn it into a
// {key: label} lookup for display.
export function featureLabelMap(metaFeatures) {
  return Object.fromEntries((metaFeatures || []).map((f) => [f.key, f.label]));
}
