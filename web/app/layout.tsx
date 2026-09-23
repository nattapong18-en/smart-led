import type { ReactNode } from "react";
import { Toaster } from 'sonner';
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}<Toaster theme="dark" position="bottom-right" richColors closeButton /></body>
    </html>
  );
}
