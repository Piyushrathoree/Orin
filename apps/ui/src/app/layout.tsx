import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/provider/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orin",
  description: "Orin – Collaborative Coding Platform",
  icons: {
    icon: [{ url: "/Orin-logo.svg", type: "image/svg+xml" }],
    shortcut: "/Orin-logo.svg",
    apple: "/Orin-logo.svg",
  },
  openGraph: {
    title: "Orin",
    description: "Orin – Collaborative Coding Platform",
    images: [
      {
        url: "https://res.cloudinary.com/dz12pywzs/image/upload/v1770130073/Copy_of_Webinar_Keynote_Presentation_1_g0bs5i.png",
        width: 1200,
        height: 630,
        alt: "Orin Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orin",
    description: "Orin – Collaborative Coding Platform",
    images: [
      "https://res.cloudinary.com/dz12pywzs/image/upload/v1770130073/Copy_of_Webinar_Keynote_Presentation_1_g0bs5i.png",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/Orin-logo.svg" />
        <link rel="apple-touch-icon" href="/Orin-logo.svg" />
        <meta name="application-name" content="Orin" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dz12pywzs/image/upload/v1770130073/Copy_of_Webinar_Keynote_Presentation_1_g0bs5i.png"
        />
        <meta property="og:title" content="Orin" />
        <meta
          property="og:description"
          content="Orin – Collaborative Coding Platform"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Orin" />
        <meta
          name="twitter:description"
          content="Orin – Collaborative Coding Platform"
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dz12pywzs/image/upload/v1770130073/Copy_of_Webinar_Keynote_Presentation_1_g0bs5i.png"
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <Toaster />
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
