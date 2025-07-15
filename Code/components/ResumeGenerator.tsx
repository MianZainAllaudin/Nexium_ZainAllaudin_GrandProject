"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import {
  Loader2,
  Sparkles,
  CheckCircle,
  Brain,
  Copy,
  Download,
  Target,
  Zap,
  TrendingUp,
  FileText,
  Settings,
  Star,
  Check,
  AlertCircle,
  Save,
  LogOut,
} from "lucide-react";

interface AIResponse {
  tailoredResume: string;
  keywords: string[];
  improvements: string[];
  matchScore: number;
  timestamp?: string;
  service?: string;
}

interface FilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
}

export default function ResumeGenerator() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [useAlternative, setUseAlternative] = useState(false);

  // State for copy/download/save feedback
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
      }
      // The auth state change listener in page.tsx will handle the redirect
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleGenerate = async () => {
    // Enhanced validation
    if (!jobDescription.trim() || !resumeText.trim()) {
      setError("Please provide both job description and resume text");
      return;
    }

    if (jobDescription.length < 50) {
      setError(
        "Job description is too short. Please provide more details (minimum 50 characters)."
      );
      return;
    }

    if (resumeText.length < 100) {
      setError(
        "Resume text is too short. Please provide a complete resume (minimum 100 characters)."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false); // Reset save state

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          resumeText: resumeText.trim(),
          useAlternative,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Validate response structure
      if (!data || !data.tailoredResume) {
        throw new Error("Invalid response from server");
      }

      // Ensure all required fields exist with defaults
      const validatedResult: AIResponse = {
        tailoredResume: data.tailoredResume || "Resume optimization failed",
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
        improvements: Array.isArray(data.improvements) ? data.improvements : [],
        matchScore:
          typeof data.matchScore === "number"
            ? Math.max(0, Math.min(100, data.matchScore))
            : 0,
        timestamp: data.timestamp,
        service: data.service,
      };

      setResult(validatedResult);
    } catch (err) {
      console.error("Resume generation error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadResumeAsPDF = () => {
    if (!result?.tailoredResume) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margins = 20;
      const maxWidth = pageWidth - margins * 2;

      // Set font
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Optimized Resume", margins, 25);

      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, margins, 35);

      // Content
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(result.tailoredResume, maxWidth);
      let yPosition = 50;
      const lineHeight = 6;

      lines.forEach((line: string) => {
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margins, yPosition);
        yPosition += lineHeight;
      });

      // Create download with file picker
      const fileName = `optimized-resume-${
        new Date().toISOString().split("T")[0]
      }.pdf`;

      // For browsers that support the File System Access API
      if ("showSaveFilePicker" in window) {
        (async () => {
          try {
            const fileHandle = await (
              window as Window & {
                showSaveFilePicker: (
                  options: FilePickerOptions
                ) => Promise<FileSystemFileHandle>;
              }
            ).showSaveFilePicker({
              suggestedName: fileName,
              types: [
                {
                  description: "PDF files",
                  accept: {
                    "application/pdf": [".pdf"],
                  },
                },
              ],
            });

            const writable = await fileHandle.createWritable();
            const pdfBlob = doc.output("blob");
            await writable.write(pdfBlob);
            await writable.close();

            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 2000);
          } catch (err: unknown) {
            // Only fallback if NOT user cancellation
            if (
              err &&
              typeof err === "object" &&
              "name" in err &&
              (err as { name?: string }).name === "AbortError"
            ) {
              // User cancelled, do nothing
              return;
            }
            // Fallback to regular download for other errors
            doc.save(fileName);
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 2000);
          }
        })();
      } else {
        // Fallback for browsers without File System Access API
        doc.save(fileName);
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 2000);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
      setError("Failed to generate PDF. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!result) {
      setError("No resume data to save");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      // Save to API endpoint which handles both MongoDB and Supabase
      const response = await fetch("/api/save-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          jobDescription: jobDescription.trim(),
          sampleResume: resumeText.trim(), // Original resume as sample
          tailoredResume: result.tailoredResume,
          matchScore: result.matchScore,
          keywords: result.keywords,
          improvements: result.improvements,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save resume data");
      }

      const saveResult = await response.json();
      console.log("Save successful:", saveResult);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Save error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return "🚀 Excellent match! Ready to apply";
    if (score >= 80) return "✅ Great match! Strong candidate";
    if (score >= 70) return "💪 Good match! Competitive profile";
    if (score >= 60) return "📈 Fair match! Room for improvement";
    return "🔧 Needs work! Consider more tailoring";
  };

  const isFormValid = jobDescription.length >= 50 && resumeText.length >= 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header with Logout */}
      <div className="flex justify-between items-center p-6">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-800">
            AI Resume Optimizer
          </h1>
        </div>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
          size="sm"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <Brain className="h-10 w-10 text-indigo-600" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                <Sparkles className="h-2 w-2 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI Resume Optimizer
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your resume with AI-powered optimization. Match any job
            description with precision and boost your chances of landing
            interviews.
          </p>
        </div>

        {/* Input Section */}
        <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3">
              <Target className="h-6 w-6" />
              <span>Step 1: Input Your Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {/* Job Description Input */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <label className="text-lg font-semibold text-gray-800">
                  Job Description *
                </label>
              </div>
              <Textarea
                placeholder="Paste the complete job description here... The more detailed, the better the AI can optimize your resume!"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={6}
                className="resize-none border-2 border-gray-200 focus:border-indigo-500 transition-colors text-base"
                disabled={loading}
              />
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  {jobDescription.length}/50 characters minimum
                </p>
                {jobDescription.length >= 50 && (
                  <Badge className="bg-green-100 text-green-700 border-green-300">
                    <Check className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                )}
              </div>
            </div>

            {/* Resume Input */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <label className="text-lg font-semibold text-gray-800">
                  Your Current Resume *
                </label>
              </div>
              <Textarea
                placeholder="Paste your current resume text here... Include all sections: summary, experience, skills, education, etc."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={12}
                className="resize-none border-2 border-gray-200 focus:border-indigo-500 transition-colors text-base"
                disabled={loading}
              />
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  {resumeText.length}/100 characters minimum
                </p>
                {resumeText.length >= 100 && (
                  <Badge className="bg-green-100 text-green-700 border-green-300">
                    <Check className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                )}
              </div>
            </div>

            {/* Advanced Options */}
            {/* Uncomment if you want to include advanced options comment it due to Vercel incompatibility Server error: 405
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-700">
                  Advanced Options
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="alternative"
                  checked={useAlternative}
                  onChange={(e) => setUseAlternative(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  disabled={loading}
                />
                <label
                  htmlFor="alternative"
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Use alternative AI model (recommended if main model fails)
                </label>
              </div>
            </div>
            */}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={loading || !isFormValid}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 text-lg shadow-lg transform transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-50"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Analyzing & Optimizing with AI...
                </>
              ) : (
                <>
                  <Zap className="mr-3 h-6 w-6" />
                  Generate Optimized Resume
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tailored Resume */}
            <Card className="lg:col-span-2 border-0 shadow-xl bg-white/70 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6" />
                    <span>Your Optimized Resume</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(result.tailoredResume)}
                      disabled={copied}
                      className={`transition-all duration-300 ${
                        copied
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-white/20 text-white border-white/30 hover:bg-white/30"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadResumeAsPDF}
                      disabled={downloaded}
                      className={`transition-all duration-300 ${
                        downloaded
                          ? "bg-blue-100 text-blue-700 border-blue-300"
                          : "bg-white/20 text-white border-white/30 hover:bg-white/30"
                      }`}
                    >
                      {downloaded ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Downloaded!
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download as PDF
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={saving || saved}
                      className={`transition-all duration-300 ${
                        saved
                          ? "bg-purple-100 text-purple-700 border-purple-300"
                          : saving
                          ? "bg-gray-100 text-gray-500 border-gray-300"
                          : "bg-white/20 text-white border-white/30 hover:bg-white/30"
                      }`}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : saved ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save to Database
                        </>
                      )}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-200 max-h-[600px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 leading-relaxed">
                    {result.tailoredResume}
                  </pre>
                </div>
                {result.timestamp && (
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Generated: {new Date(result.timestamp).toLocaleString()}
                    </span>
                    {result.service && <span>Service: {result.service}</span>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analysis & Metrics */}
            <div className="space-y-6">
              {/* Match Score */}
              <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Match Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div
                      className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl font-bold border-2 ${getScoreColor(
                        result.matchScore
                      )}`}
                    >
                      {result.matchScore}%
                    </div>
                  </div>
                  <Progress value={result.matchScore} className="h-3" />
                  <p className="text-sm text-center font-medium text-gray-700">
                    {getScoreMessage(result.matchScore)}
                  </p>
                </CardContent>
              </Card>

              {/* Keywords */}
              <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Key Keywords Optimized
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.keywords.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {result.keywords.map((keyword, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs py-1 px-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                          >
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        {result.keywords.length} keywords optimized for ATS
                        systems
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No keywords identified from the job description
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Improvements */}
              <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    AI Enhancements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.improvements.length > 0 ? (
                    <ul className="space-y-3">
                      {result.improvements.map((improvement, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="mt-1">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          </div>
                          <span className="text-sm text-gray-700 leading-relaxed">
                            {improvement}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No specific improvements identified
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
