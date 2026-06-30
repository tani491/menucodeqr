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
  title: "Menu QR — Restaurant Digital",
  description:
    "Consultez le menu de votre restaurant en scannant le QR code. Interface mobile-first ultra-rapide.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Menu QR — Restaurant Digital",
    description: "Menu digital interactif pour restaurants.",
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
