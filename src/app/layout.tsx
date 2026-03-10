import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata = {
  title: "Nexadox - Modern Doctor Booking & Clinic Management",
  description: "Professional SaaS platform for clinic management and doctor appointments",
  icons: {
    icon: "/Nexadox.png",
    apple: "/Nexadox.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.variable}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
