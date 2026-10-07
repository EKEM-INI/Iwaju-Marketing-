import { NextResponse } from "next/server";

export async function GET() {
  const apolloKey = process.env.APOLLO_API_KEY;
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;

  let apolloHealthy = false;
  let apolloMessage = "No key configured";

  if (apolloKey) {
    try {
      const res = await fetch("https://api.apollo.io/v1/auth/health", {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apolloKey,
        },
      });
      const data = await res.json();
      if (res.ok && data.healthy) {
        apolloHealthy = true;
        apolloMessage = "Connected & Authenticated";
      } else {
        apolloMessage = data.error || "Authentication failed";
      }
    } catch (e: any) {
      apolloMessage = e.message || "Connection error";
    }
  }

  return NextResponse.json({
    apollo: {
      configured: Boolean(apolloKey),
      healthy: apolloHealthy,
      message: apolloMessage,
      maskedKey: apolloKey ? `${apolloKey.slice(0, 4)}...${apolloKey.slice(-4)}` : null,
    },
    googleMaps: {
      configured: Boolean(googleMapsKey),
      maskedKey: googleMapsKey
        ? `${googleMapsKey.slice(0, 4)}...${googleMapsKey.slice(-4)}`
        : null,
    },
  });
}
