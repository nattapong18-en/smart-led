import type { ReactNode } from "react";
import { Toaster } from 'sonner';
import "./globals.css";

export const metadata = { title: "Lumen Home — Smart Light Control" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&display=swap" />
      </head>
      <body>{children}<Toaster theme="dark" position="bottom-right" richColors closeButton /></body>
    </html>
  );
}
