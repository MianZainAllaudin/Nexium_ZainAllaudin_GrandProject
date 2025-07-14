import { NextRequest, NextResponse } from "next/server";
import { saveResumeData } from "@/lib/mongodb";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      jobDescription,
      sampleResume,
      tailoredResume,
      matchScore,
      keywords,
      improvements,
    } = body;

    // Validation
    if (!userId || !jobDescription || !sampleResume || !tailoredResume) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Save to MongoDB
    const mongoResult = await saveResumeData({
      userId,
      jobDescription,
      sampleResume,
      tailoredResume,
      matchScore,
      keywords,
      improvements,
    });

    // Extract job title and company name for metadata
    const extractJobTitle = (jobDesc: string): string => {
      const lines = jobDesc.split("\n").filter((line) => line.trim());
      const titleLine = lines.find(
        (line) =>
          line.toLowerCase().includes("title:") ||
          line.toLowerCase().includes("position:") ||
          line.toLowerCase().includes("role:")
      );

      if (titleLine) {
        return (
          titleLine.split(":")[1]?.trim() ||
          lines[0]?.trim() ||
          "Unknown Position"
        );
      }

      return lines[0]?.trim() || "Unknown Position";
    };

    const extractCompanyName = (jobDesc: string): string => {
      const lines = jobDesc.split("\n").filter((line) => line.trim());
      const companyLine = lines.find(
        (line) =>
          line.toLowerCase().includes("company:") ||
          line.toLowerCase().includes("organization:")
      );

      if (companyLine) {
        return companyLine.split(":")[1]?.trim() || "Unknown Company";
      }

      // Look for common company indicators
      const possibleCompany = lines.find(
        (line) =>
          line.toLowerCase().includes("inc.") ||
          line.toLowerCase().includes("corp.") ||
          line.toLowerCase().includes("ltd.") ||
          line.toLowerCase().includes("llc")
      );

      return possibleCompany?.trim() || "Unknown Company";
    };

    // Save metadata to Supabase
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        mongo_job_description_id: mongoResult.jobDescriptionId.toString(),
        job_title: extractJobTitle(jobDescription),
        company_name: extractCompanyName(jobDescription),
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError) {
      console.error("Supabase job insert error:", jobError);
      throw new Error(`Failed to save job metadata: ${jobError.message}`);
    }

    const { error: resumeError } = await supabase
      .from("resume_generations")
      .insert({
        user_id: userId,
        job_id: jobData.id,
        mongo_sample_resume_id: mongoResult.sampleResumeId.toString(),
        mongo_tailored_resume_id: mongoResult.tailoredResumeId.toString(),
        match_score: matchScore || 0,
        generation_status: "completed",
        created_at: new Date().toISOString(),
      });

    if (resumeError) {
      console.error("Supabase resume insert error:", resumeError);
      throw new Error(`Failed to save resume metadata: ${resumeError.message}`);
    }

    return NextResponse.json({
      success: true,
      mongoIds: mongoResult,
      supabaseJobId: jobData.id,
      message: "Resume data saved successfully",
    });
  } catch (error) {
    console.error("Save resume API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save resume data",
      },
      { status: 500 }
    );
  }
}
