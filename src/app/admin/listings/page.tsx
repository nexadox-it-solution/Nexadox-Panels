"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, GraduationCap, Stethoscope, Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const listings = [
  {
    title: "Locations",
    icon: MapPin,
    href: "/admin/locations",
    description: "Manage clinic locations",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
    iconColor: "text-emerald-600",
    hoverColor: "hover:bg-emerald-100 dark:hover:bg-emerald-900",
  },
  {
    title: "Degrees",
    icon: GraduationCap,
    href: "/admin/degrees",
    description: "Manage medical degrees",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    iconColor: "text-orange-600",
    hoverColor: "hover:bg-orange-100 dark:hover:bg-orange-900",
  },
  {
    title: "Specialties",
    icon: Stethoscope,
    href: "/admin/specialties",
    description: "Manage medical specialties",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
    iconColor: "text-cyan-600",
    hoverColor: "hover:bg-cyan-100 dark:hover:bg-cyan-900",
  },
  {
    title: "Clinics",
    icon: Building2,
    href: "/admin/clinics",
    description: "Manage clinics",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    iconColor: "text-purple-600",
    hoverColor: "hover:bg-purple-100 dark:hover:bg-purple-900",
  },
];

export default function ListingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Listing</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage all listings from here ...
          </p>
        </div>
      </div>

      {/* Listing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {listings.map((listing) => {
          const Icon = listing.icon;
          return (
            <Link key={listing.title} href={listing.href}>
              <Card
                className={`${listing.bgColor} ${listing.hoverColor} border-0 transition-all duration-300 hover:shadow-lg cursor-pointer h-full`}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4">
                    <Icon className={`h-16 w-16 ${listing.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {listing.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {listing.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
