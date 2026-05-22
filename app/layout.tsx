import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Online Image Converter",
  description: "Convert, crop, resize, and compress images with backend processing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
