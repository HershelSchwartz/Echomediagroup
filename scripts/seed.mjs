// Seed data for dev and tests: one city, three ride options, public landmarks for the
// fallback address search, an admin, a demo rider and five approved demo drivers.
// All people are fictional; all phone numbers are in the 555 fictional range.
import postgres from "postgres";

const url = process.env.DATABASE_URL || "postgres://ride:ride@localhost:5432/ride";
const sql = postgres(url, { onnotice: () => {} });

const city = {
  name: "New York City",
  currency: "usd",
  timezone: "America/New_York",
  min_lat: 40.57, max_lat: 40.88, min_lng: -74.05, max_lng: -73.85,
  center_lat: 40.7359, center_lng: -73.9911,
};

const products = [
  { code: "standard", name: "Standard", description: "Everyday rides for up to 4", seats: 4, min_vehicle_year: 2012,
    base_cents: 250, per_km_cents: 110, per_min_cents: 32, min_fare_cents: 900, booking_fee_cents: 250,
    wait_grace_min: 2, wait_per_min_cents: 40, cancel_free_min: 2, cancel_fee_cents: 500, no_show_min: 5, sort: 1 },
  { code: "xl", name: "XL", description: "Bigger cars for up to 6", seats: 6, min_vehicle_year: 2014,
    base_cents: 400, per_km_cents: 175, per_min_cents: 45, min_fare_cents: 1400, booking_fee_cents: 250,
    wait_grace_min: 2, wait_per_min_cents: 60, cancel_free_min: 2, cancel_fee_cents: 700, no_show_min: 5, sort: 2 },
  { code: "premium", name: "Premium", description: "Newer, top-rated cars", seats: 4, min_vehicle_year: 2019,
    base_cents: 800, per_km_cents: 260, per_min_cents: 60, min_fare_cents: 2500, booking_fee_cents: 0,
    wait_grace_min: 5, wait_per_min_cents: 90, cancel_free_min: 5, cancel_fee_cents: 1500, no_show_min: 10, sort: 3 },
];

// Public landmarks, approximate coordinates.
const places = [
  ["Union Square", "Union Square, Manhattan, NY", 40.7359, -73.9911],
  ["Grand Central Terminal", "89 E 42nd St, Manhattan, NY", 40.7527, -73.9772],
  ["Penn Station", "W 33rd St & 7th Ave, Manhattan, NY", 40.7506, -73.9935],
  ["Times Square", "Times Square, Manhattan, NY", 40.758, -73.9855],
  ["Central Park South", "Central Park S & 6th Ave, Manhattan, NY", 40.7651, -73.9762],
  ["Metropolitan Museum of Art", "1000 5th Ave, Manhattan, NY", 40.7794, -73.9632],
  ["Columbus Circle", "Columbus Circle, Manhattan, NY", 40.7681, -73.9819],
  ["Washington Square Park", "Washington Square, Manhattan, NY", 40.7308, -73.9973],
  ["World Trade Center", "185 Greenwich St, Manhattan, NY", 40.7127, -74.0134],
  ["Brooklyn Bridge Park", "334 Furman St, Brooklyn, NY", 40.7003, -73.9967],
  ["Barclays Center", "620 Atlantic Ave, Brooklyn, NY", 40.6826, -73.9754],
  ["Prospect Park", "Grand Army Plaza, Brooklyn, NY", 40.6743, -73.9702],
  ["Williamsburg Bridge", "Williamsburg, Brooklyn, NY", 40.7135, -73.9725],
  ["Long Island City", "Court Square, Queens, NY", 40.7471, -73.9456],
  ["Astoria Park", "Astoria Park, Queens, NY", 40.7795, -73.9229],
  ["Hudson Yards", "20 Hudson Yards, Manhattan, NY", 40.7539, -74.0007],
  ["Chelsea Market", "75 9th Ave, Manhattan, NY", 40.7424, -74.0061],
  ["Lincoln Center", "10 Lincoln Center Plaza, Manhattan, NY", 40.7725, -73.9835],
  ["Rockefeller Center", "45 Rockefeller Plaza, Manhattan, NY", 40.7587, -73.9787],
  ["East Village", "Tompkins Square Park, Manhattan, NY", 40.7265, -73.9817],
];

const drivers = [
  { phone: "+15550000201", name: "Dana Reyes", lat: 40.7381, lng: -73.9897, car: ["Toyota", "Camry", "Grey", "DEV1201", 2020, 4] },
  { phone: "+15550000202", name: "Sam Okafor", lat: 40.7449, lng: -73.9876, car: ["Honda", "Odyssey", "Black", "DEV1202", 2019, 6] },
  { phone: "+15550000203", name: "Priya Nair", lat: 40.7302, lng: -73.9952, car: ["Tesla", "Model 3", "White", "DEV1203", 2022, 4] },
  { phone: "+15550000204", name: "Leo Martins", lat: 40.7505, lng: -73.9934, car: ["Hyundai", "Sonata", "Blue", "DEV1204", 2017, 4] },
  { phone: "+15550000205", name: "Mia Kowalski", lat: 40.7214, lng: -73.9874, car: ["Ford", "Explorer", "Silver", "DEV1205", 2021, 6] },
];

try {
  await sql.begin(async (tx) => {
    await tx`truncate cities, users, outbox, webhook_events restart identity cascade`;
    const [c] = await tx`insert into cities ${tx(city)} returning id`;
    for (const p of products) await tx`insert into products ${tx({ ...p, city_id: c.id })}`;
    for (const [name, address, lat, lng] of places) await tx`insert into places ${tx({ city_id: c.id, name, address, lat, lng })}`;

    await tx`insert into users (phone, name, email, role) values ('+15550000001', 'Ops Admin', 'admin@example.com', 'admin')`;
    const [rider] = await tx`insert into users (phone, name, email, role, rating_sum, rating_count)
      values ('+15550000100', 'Alex Rider', 'alex@example.com', 'rider', 48, 10) returning id`;
    await tx`insert into payment_methods (user_id, kind, provider, brand, last4, exp_month, exp_year, is_default)
      values (${rider.id}, 'card', 'dev', 'visa', '4242', 12, 2030, true)`;
    await tx`insert into saved_places (user_id, label, address, lat, lng) values
      (${rider.id}, 'Home', 'Washington Square, Manhattan, NY', 40.7308, -73.9973),
      (${rider.id}, 'Work', '45 Rockefeller Plaza, Manhattan, NY', 40.7587, -73.9787)`;

    for (const d of drivers) {
      const [u] = await tx`insert into users (phone, name, role, rating_sum, rating_count)
        values (${d.phone}, ${d.name}, 'driver', 245, 50) returning id`;
      await tx`insert into driver_profiles (user_id, city_id, licence_no, licence_expiry, status, online, last_lat, last_lng, last_seen_at)
        values (${u.id}, ${c.id}, ${"DL-" + d.phone.slice(-4)}, '2029-06-30', 'approved', false, ${d.lat}, ${d.lng}, now())`;
      const [make, model, colour, plate, year, seats] = d.car;
      await tx`insert into vehicles (driver_id, make, model, colour, plate, year, seats) values (${u.id}, ${make}, ${model}, ${colour}, ${plate}, ${year}, ${seats})`;
    }
  });
  console.log("seed: city, 3 products, 20 places, admin +15550000001, rider +15550000100, drivers +15550000201..205");
} finally {
  await sql.end();
}
