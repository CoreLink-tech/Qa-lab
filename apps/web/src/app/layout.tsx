import type { Metadata } from "next";
import "./globals.css";
import { SkipLink } from "@/components/SkipLink";

export const metadata: Metadata = {
  title: "QA Lab",
  description: "Website quality assurance platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
