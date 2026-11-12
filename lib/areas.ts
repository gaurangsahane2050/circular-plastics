// The five fictional areas of the demo, with a centre point. An address gets its area's
// point, which is what the 5 km collector search measures from. (No real geocoding service.)
export const AREAS: Record<string, { lat: number; lng: number }> = {
  "Sagar Nagar": { lat: 19.1, lng: 72.844 },
  "Palm Vihar": { lat: 19.07, lng: 72.88 },
  "Tekdi Colony": { lat: 19.131, lng: 72.91 },
  "Udyog Park": { lat: 19.041, lng: 72.862 },
  "Lakeview Campus": { lat: 19.17, lng: 72.953 },
};

// read the address fields of a form (see AddressFields) into a row for the addresses table
export function addressFrom(form: FormData) {
  const area = String(form.get("area"));
  return { label: String(form.get("label")), line: String(form.get("line")), area, ...AREAS[area] };
}

// read the personal fields of a form (see PersonalFields)
export function detailsFrom(form: FormData) {
  return {
    name: String(form.get("name")),
    phone: String(form.get("phone")),
    age: Number(form.get("age")) || null,
    gender: String(form.get("gender")) || null,
  };
}
