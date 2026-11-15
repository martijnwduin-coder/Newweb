import type { PinState } from "./marker-pin";
export interface MapMarker extends PinState {
  id: string;
  name: string;
  lat: number;
  lng: number;
}
