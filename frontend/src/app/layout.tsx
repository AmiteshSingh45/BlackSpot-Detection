import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { ThemeProvider } from "@/context/ThemeContext";
import { AlertProvider } from "@/context/AlertContext";
import QueryProvider from "@/components/providers/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BlackSpot AI | Road Safety Intelligence Platform",
  description: "Advanced AI-powered road accident blackspot detection and analytics dashboard",
  keywords: ["blackspot", "road safety", "accident analytics", "AI detection"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-theme="dark" style={{ height: "100%" }} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          rel="stylesheet"
        />
        {/* Prevent theme flash: set data-theme from localStorage before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('bs-theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
        {/* leaflet.heat CDN — used by map heatmap toggle */}
        <script
          src="https://leaflet.github.io/Leaflet.heat/dist/leaflet-heat.js"
          async
        />
      </head>
      <body className="flex h-screen overflow-hidden">
        <QueryProvider>
          <ThemeProvider>
            <AlertProvider>
              <Sidebar />
              <div className="flex flex-col flex-1 h-screen overflow-hidden">
                <TopBar />
                <main
                  className="flex-1 overflow-y-auto p-6"
                  style={{ scrollBehavior: "smooth", background: "var(--bg-primary)" }}
                >
                  {children}
                </main>
              </div>
            </AlertProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
