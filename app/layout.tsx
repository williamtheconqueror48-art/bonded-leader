import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BONDED-LEADER — Electoral Bonds Network Intelligence",
  description:
    "Structured public presentation of India's Electoral Bonds disclosures (SBI/ECI via ADR/MyNeta), cross-referenced with MCA21 company data. Descriptive facts only; no allegations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
