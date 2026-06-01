"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin_login_jw904l20fk2_8_____2mdcy_cq");
  }, [router]);

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh", 
      background: "#07080f", 
      color: "#dde3f8" 
    }}>
      Redirecting...
    </div>
  );
}