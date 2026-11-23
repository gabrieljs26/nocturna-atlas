import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ObservationProvider } from "@/components/observations";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nocturna · Atlas de observación astronómica",
    template: "%s · Nocturna",
  },
  description: "Explora el catálogo Messier y guarda tus próximos objetivos de observación. Un atlas de cielo profundo en español.",
  applicationName: "Nocturna",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <ObservationProvider>
          <SiteHeader />
          <main id="contenido">{children}</main>
          <SiteFooter />
        </ObservationProvider>
      </body>
    </html>
  );
}
