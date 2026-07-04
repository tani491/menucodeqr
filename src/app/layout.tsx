import type { Metadata, Viewport } from "next";
import AuthProvider from "@/components/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "MenuCodeQR",
  description: "Votre menu digital",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "MenuCodeQR",
    description: "Votre menu digital",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
