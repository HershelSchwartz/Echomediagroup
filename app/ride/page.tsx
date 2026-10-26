import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { defaultCity } from "@/lib/trips";
import { RiderApp } from "@/components/rider/RiderApp";

export const metadata: Metadata = { title: "Ride" };
export const dynamic = "force-dynamic";

export default async function RidePage() {
  const user = (await getUser())!;
  const city = await defaultCity();
  return <RiderApp userName={user.name ?? ""} city={{ name: city.name, center: { lat: city.center_lat, lng: city.center_lng } }} />;
}
