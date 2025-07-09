"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export default function ResumeTailor() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [tailoredResume, setTailoredResume] = useState("");
  const router = useRouter();

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/login");
    });
  }, [router]);

  const handleSubmit = async () => {
    try {
      // 1. Verify user is logged in
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // 2. Call AI API
      const res = await fetch("/api/generate-resume", {
        method: "POST",
        body: JSON.stringify({ jobDescription, resumeText }),
      });
      const { tailoredResume } = await res.json();
      setTailoredResume(tailoredResume);

      // 3. Save to Supabase (with user_id)
      const { error: supabaseError } = await supabase.from("resumes").insert({
        user_id: user.id, // Critical: Link to authenticated user
        job_description: jobDescription,
        generated_resume: tailoredResume,
      });
      if (supabaseError) throw supabaseError;

      // 4. Save to MongoDB
      await saveToMongo({ jobDescription, resume: tailoredResume });
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to save. Check console for details.");
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">✍️ Resume Tailor</h1>
      <div className="max-w-2xl space-y-4">
        <Textarea
          placeholder="Paste job description..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
        <Textarea
          placeholder="Paste your current resume..."
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
        />
        <Button onClick={handleSubmit}>Generate Tailored Resume</Button>

        {tailoredResume && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-bold mb-2">Your Tailored Resume:</h2>
              <pre>{tailoredResume}</pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// MongoDB save function
async function saveToMongo({
  jobDescription,
  resume,
}: {
  jobDescription: string;
  resume: unknown;
}) {
  await fetch("/api/save-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobDescription, resume }),
  });
}
