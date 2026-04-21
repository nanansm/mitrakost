import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const meta: Route.MetaFunction = () => [
  { title: "Mitra Kost Sumedang | Kos Premium untuk Profesional & Mahasiswa" },
  {
    name: "description",
    content:
      "Kos premium di Sumedang dengan fasilitas lengkap. Kamar Ekonomi, Standar, Suite & Deluxe di Budiasih dan Jatihurip. 1 menit ke Alun-Alun Sumedang. Cocok untuk dokter koas, mahasiswa, dan profesional muda.",
  },
  {
    name: "keywords",
    content:
      "kos sumedang, kost sumedang, kos kosan sumedang, kos murah sumedang, kos premium sumedang, kos dekat rumah sakit sumedang, kos dokter koas sumedang, kos mahasiswa sumedang, kos jatihurip sumedang, kos budiasih sumedang, sewa kamar sumedang, kos bulanan sumedang",
  },
  { property: "og:title", content: "Mitra Kost Sumedang | Kos Premium" },
  {
    property: "og:description",
    content:
      "Kos premium di Sumedang dengan fasilitas lengkap. Kamar Ekonomi, Standar, Suite & Deluxe.",
  },
  { property: "og:image", content: "/images/logo/logohorizontal.png" },
  { property: "og:type", content: "website" },
  { property: "og:locale", content: "id_ID" },
  { name: "robots", content: "index, follow" },
];

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/images/logo/logo.png", type: "image/png" },
  { rel: "apple-touch-icon", href: "/images/logo/logo.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  name: "Mitra Kost Sumedang",
  description:
    "Kos premium di Sumedang dengan fasilitas lengkap. Cocok untuk dokter koas, mahasiswa, dan profesional muda.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Sumedang",
    addressRegion: "Jawa Barat",
    addressCountry: "ID",
  },
  telephone: "+62822-3300-5808",
  email: "mitrakostsumedang@gmail.com",
  numberOfRooms: 57,
  amenityFeature: [
    { "@type": "LocationFeatureSpecification", name: "WiFi", value: true },
    { "@type": "LocationFeatureSpecification", name: "AC", value: true },
    { "@type": "LocationFeatureSpecification", name: "CCTV", value: true },
    { "@type": "LocationFeatureSpecification", name: "Parkir", value: true },
    { "@type": "LocationFeatureSpecification", name: "Water Heater", value: true },
  ],
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Cache-Control" content="public, max-age=0, must-revalidate" />
        <Meta />
        <Links />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
