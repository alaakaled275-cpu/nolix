import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${process.env.NODE_ENV === "production" ? "https://nolix.vercel.app" : "http://localhost:3000"}/login?error=GoogleAuthNotConfigured`);
  }

  const redirectUri = `${process.env.NODE_ENV === "production" ? "https://nolix.vercel.app" : "http://localhost:3000"}/api/auth/google/callback`;
  const scope = "openid email profile";
  
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", scope);
  googleAuthUrl.searchParams.set("access_type", "online");

  return NextResponse.redirect(googleAuthUrl.toString());
}
