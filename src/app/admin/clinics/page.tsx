"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, ArrowLeft, Search, X, Upload, Loader, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface Clinic {
  id: number;
  name: string;
  title?: string;
  contact_person?: string;
  email?: string;
  calling_code?: string;
  mobile?: string;
  latitude?: number;
  longitude?: number;
  building?: string;
  area?: string;
  street?: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  pincode?: string;
  logo?: string;
  doctors_count: number;
  status: "active" | "inactive";
}

export default function ClinicsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapPreviewRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    title: "Mr.",
    contactPerson: "",
    email: "",
    callingCode: "91",
    mobile: "",
    latitude: "",
    longitude: "",
    building: "",
    area: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    logo: null as any,
  });
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  /* ── Load Google Maps script ─────────────────────────────── */
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || (window as any).google?.maps) {
      if ((window as any).google?.maps) setMapReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  /* ── Init / update map preview when modal opens or lat/lng changes ── */
  useEffect(() => {
    if (!isModalOpen || !mapReady || !mapPreviewRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    const hasCoords = !isNaN(lat) && !isNaN(lng);
    const center = hasCoords ? { lat, lng } : { lat: 22.5726, lng: 88.3639 };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapPreviewRef.current, {
        center,
        zoom: hasCoords ? 15 : 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      markerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        visible: hasCoords,
        position: center,
      });
    } else {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(hasCoords ? 15 : 5);
      markerRef.current?.setPosition(center);
      markerRef.current?.setVisible(hasCoords);
    }
  }, [isModalOpen, mapReady, formData.latitude, formData.longitude]);

  /* ── Reverse geocode lat/lng → auto-fill address ─────────── */
  const reverseGeocode = useCallback(async (lat: string, lng: string) => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) return;

    const google = (window as any).google;
    if (!google?.maps) return;

    setReverseGeocoding(true);
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: latNum, lng: lngNum } }, (results: any, status: any) => {
        if (status === "OK" && results?.[0]) {
          const comps = results[0].address_components || [];
          const get = (type: string) => comps.find((c: any) => c.types.includes(type))?.long_name || "";
          setFormData(prev => ({
            ...prev,
            area: get("sublocality_level_1") || get("sublocality") || get("neighborhood") || prev.area,
            city: get("locality") || get("administrative_area_level_2") || prev.city,
            state: get("administrative_area_level_1") || prev.state,
            country: get("country") || prev.country,
            pincode: get("postal_code") || prev.pincode,
          }));
        }
        setReverseGeocoding(false);
      });
    } catch {
      setReverseGeocoding(false);
    }
  }, []);

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClinics(data || []);
    } catch (error) {
      console.error("❌ Error fetching clinics:", error);
      alert("Failed to load clinics");
    } finally {
      setLoading(false);
    }
  };

  const filteredClinics = clinics.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingClinic(null);
    setFormData({
      name: "",
      title: "Mr.",
      contactPerson: "",
      email: "",
      callingCode: "91",
      mobile: "",
      latitude: "",
      longitude: "",
      building: "",
      area: "",
      street: "",
      landmark: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
      logo: null,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (clinic: any) => {
    setEditingClinic(clinic);
    setFormData({
      name: clinic.name || "",
      title: clinic.title || "Mr.",
      contactPerson: clinic.contact_person || "",
      email: clinic.email || "",
      callingCode: clinic.calling_code || "91",
      mobile: clinic.mobile || "",
      latitude: clinic.latitude ? String(clinic.latitude) : "",
      longitude: clinic.longitude ? String(clinic.longitude) : "",
      building: clinic.building || "",
      area: clinic.area || "",
      street: clinic.street || "",
      landmark: clinic.landmark || "",
      city: clinic.city || "",
      state: clinic.state || "",
      country: clinic.country || "India",
      pincode: clinic.pincode || "",
      logo: null,
    });
    setLogoPreview(clinic.logo || "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClinic(null);
    setFormData({
      name: "",
      title: "Mr.",
      contactPerson: "",
      email: "",
      callingCode: "91",
      mobile: "",
      latitude: "",
      longitude: "",
      building: "",
      area: "",
      street: "",
      landmark: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
      logo: null,
    });
    setLogoPreview("");
    mapInstanceRef.current = null;
    markerRef.current = null;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData({ ...formData, logo: base64 });
        setLogoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter clinic name");
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingClinic) {
        // Update existing
        const { error } = await supabase
          .from("clinics")
          .update({
            name: formData.name,
            title: formData.title,
            contact_person: formData.contactPerson,
            email: formData.email,
            calling_code: formData.callingCode,
            mobile: formData.mobile,
            latitude: parseFloat(formData.latitude) || null,
            longitude: parseFloat(formData.longitude) || null,
            building: formData.building,
            area: formData.area,
            street: formData.street,
            landmark: formData.landmark,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            pincode: formData.pincode,
            logo: formData.logo || editingClinic.logo,
          })
          .eq("id", editingClinic.id);

        if (error) throw error;
        alert("✅ Clinic updated successfully");
        await fetchClinics();
      } else {
        // Add new
        const { error } = await supabase
          .from("clinics")
          .insert([{
            name: formData.name,
            title: formData.title,
            contact_person: formData.contactPerson,
            email: formData.email,
            calling_code: formData.callingCode,
            mobile: formData.mobile,
            latitude: parseFloat(formData.latitude) || null,
            longitude: parseFloat(formData.longitude) || null,
            building: formData.building,
            area: formData.area,
            street: formData.street,
            landmark: formData.landmark,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            pincode: formData.pincode,
            logo: formData.logo,
            doctors_count: 0,
            status: "active",
          }]);

        if (error) throw error;
        alert("✅ Clinic added successfully");
        await fetchClinics();
      }

      closeModal();
    } catch (error) {
      console.error("❌ Error submitting clinic:", error);
      alert("Failed to save clinic");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-purple-600" />
              Clinics
            </h1>
            <p className="text-muted-foreground mt-1">Manage clinic facilities</p>
          </div>
        </div>
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={openAddModal}>
          <Plus className="h-4 w-4" />
          Add Clinic
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clinics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Clinics List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-brand-600" />
            <p className="ml-2">Loading clinics...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Clinics ({clinics.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {clinics.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No clinics found. Click &quot;Add Clinic&quot; to create one.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredClinics.map((clinic) => (
                  <div
                    key={clinic.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div>
                      <h3 className="font-semibold">{clinic.name}</h3>
                      <p className="text-sm text-muted-foreground">{clinic.area}, {clinic.city}, {clinic.state}</p>
                      <p className="text-xs text-muted-foreground mt-1">{clinic.doctors_count} Doctors</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {clinic.status}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openEditModal(clinic)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Right Sidebar Modal */}
      {isModalOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-white dark:bg-gray-800 shadow-lg z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingClinic ? `Update - Clinic: ID#${editingClinic.id.toString().padStart(5, "0")}` : "Add New Clinic"}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Details */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-600 dark:text-gray-400">Basic Details:</h3>
                
                <div>
                  <label className="block text-xs font-semibold mb-2">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Clinic Name"
                    required
                  />
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-600 dark:text-gray-400">Contact Details:</h3>

                <div>
                  <label className="block text-xs font-semibold mb-2">Email address</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="info@clinic.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2">Calling Code</label>
                    <Select value={formData.callingCode} onValueChange={(val) => handleInputChange("callingCode", val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="91">91 - India</SelectItem>
                        <SelectItem value="1">1 - USA</SelectItem>
                        <SelectItem value="44">44 - UK</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2">Mobile Number</label>
                    <Input
                      value={formData.mobile}
                      onChange={(e) => handleInputChange("mobile", e.target.value)}
                      placeholder="9732082277"
                    />
                  </div>
                </div>
              </div>

              {/* Co-ordinates */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-600 dark:text-gray-400">Co-ordinates:</h3>
                <p className="text-xs text-muted-foreground">Enter latitude &amp; longitude, then click &quot;Fetch Location&quot; to auto-fill address from Google Maps.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2">Latitude</label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={formData.latitude}
                      onChange={(e) => handleInputChange("latitude", e.target.value)}
                      placeholder="24.99255"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2">Longitude</label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={formData.longitude}
                      onChange={(e) => handleInputChange("longitude", e.target.value)}
                      placeholder="88.14430"
                    />
                  </div>
                </div>

                {/* Fetch Location button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!formData.latitude || !formData.longitude || reverseGeocoding}
                  onClick={() => reverseGeocode(formData.latitude, formData.longitude)}
                >
                  {reverseGeocoding ? <Loader className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  {reverseGeocoding ? "Fetching..." : "Fetch Location from Coordinates"}
                </Button>

                {/* Map preview */}
                {GOOGLE_MAPS_API_KEY && formData.latitude && formData.longitude && (
                  <div className="rounded-lg overflow-hidden border border-gray-200 h-40" ref={mapPreviewRef} />
                )}
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-600 dark:text-gray-400">Address:</h3>
                
                <div>
                  <label className="block text-xs font-semibold mb-2">Building Name / Number</label>
                  <Input
                    value={formData.building}
                    onChange={(e) => handleInputChange("building", e.target.value)}
                    placeholder="Building Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2">Area / Locality</label>
                  <Input
                    value={formData.area}
                    onChange={(e) => handleInputChange("area", e.target.value)}
                    placeholder="Area Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2">Street</label>
                  <Input
                    value={formData.street}
                    onChange={(e) => handleInputChange("street", e.target.value)}
                    placeholder="Street Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2">Landmark</label>
                  <Input
                    value={formData.landmark}
                    onChange={(e) => handleInputChange("landmark", e.target.value)}
                    placeholder="Nearby Landmark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2">City</label>
                    <Input
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2">State</label>
                    <Input
                      value={formData.state}
                      onChange={(e) => handleInputChange("state", e.target.value)}
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2">Country</label>
                    <Input
                      value={formData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      placeholder="Country"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2">Pincode</label>
                    <Input
                      value={formData.pincode}
                      onChange={(e) => handleInputChange("pincode", e.target.value)}
                      placeholder="732101"
                    />
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-600 dark:text-gray-400">Logo:</h3>
                
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? (
                    <div className="space-y-2">
                      <img src={logoPreview} alt="Logo preview" className="h-20 w-20 mx-auto object-contain rounded" />
                      <p className="text-xs text-muted-foreground">Click to change</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Click to upload Logo</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={closeModal}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingClinic ? "Update Clinic" : "Add Clinic"}
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
