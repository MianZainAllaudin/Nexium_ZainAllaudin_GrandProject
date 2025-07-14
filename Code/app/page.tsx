"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ResumeGenerator from "@/components/ResumeGenerator";
import Login from "./login/page";
import type { Session } from "@supabase/supabase-js";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  // If authenticated, show main app; otherwise, show Login
  return <main>{session ? <ResumeGenerator /> : <Login />}</main>;
}
