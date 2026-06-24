import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeiroAI — Premium AI Workspace",
  description:
    "NeiroAI is a modern, premium AI workspace: coding assistant, multi-model consensus, vision, file analysis and media tools — fast, clean, professional.",
  applicationName: "NeiroAI",
  authors: [{ name: "NeiroAI" }],
  keywords: [
    "NeiroAI",
    "AI workspace",
    "coding assistant",
    "multi-model",
    "NeiroPlus",
  ],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..700&display=swap"
          rel="stylesheet"
        />
        {/* Set the real viewport height as a CSS var (mobile URL-bar safe) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function h(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');}h();window.addEventListener('resize',h);})();`,
          }}
        />
      </head>
      <body className="bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
