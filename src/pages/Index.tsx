import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import AuthModal from "@/components/auth/AuthModal";
import JobDescriptionInput from "@/components/dashboard/JobDescriptionInput";
import ResumeFolderInput from "@/components/dashboard/ResumeFolderInput";
import {
  Users,
  Video,
  Mail,
  Download,
  CheckCircle,
  Clock,
  Send,
  Brain,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [numbers, setNumbers] = useState<number[]>([]);

  // Thresholds for coloring
  const [qualifiedThreshold, setQualifiedThreshold] = useState(50);
  const [reviewThreshold, setReviewThreshold] = useState(40);
  const limit = 2;
  const userId = "user123";

  const [results, setResults] = useState([]);

  const handleLogin = () => {
    setAuthMode("login");
    setShowAuthModal(true);
  };

  const handleSignup = () => {
    setAuthMode("signup");
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (email?: string) => {
    setIsAuthenticated(true);
    setShowAuthModal(false);
    if (email) {
      setRecruiterEmail(email);
    }
  };

  const getTopKeywords = (text, count = 3) => {
    if (!text) return [];
    // Split by commas, spaces, or both
    const words = text
      .replace(/\n/g, " ") // remove newlines
      .split(/[, ]+/)
      .filter(Boolean); // remove empty strings
    return words.slice(0, count); // take first 'count' words
  };
  // ---------------- CANDIDATES ----------------
  const fetchCandidates = async (numbersArr: number[]) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found. Please login.");

      const res = await fetch("http://localhost:5000/api/v1/score/rank-cvs", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to fetch candidate data");
      const scoreData = await res.json();

      // Dynamic thresholds
      const qualifiedThresholdDynamic = numbersArr[1] || 50;
      const reviewThresholdDynamic = numbersArr[0] || 40;

      setQualifiedThreshold(qualifiedThresholdDynamic);
      setReviewThreshold(reviewThresholdDynamic);

      const formattedResults = scoreData.results.map((c: any, i: number) => {
        const atsScore = c?.Score ? Number(c.Score.toFixed(0)) : 0;
        let status = "Not Qualified";
        if (atsScore > qualifiedThresholdDynamic) status = "Qualified";
        else if (atsScore > reviewThresholdDynamic) status = "Review";

        return {
          id: i + 1,
          name: c?.Name || "Unknown",
          email: c?.Email || "Unknown",
          phone: c?.Phone || "Unknown",
          atsScore,
          status,
          KeyStrength: c?.["Matched Skills"] || "",
          considerations: c?.["Missing Skills"] || "",
          videoInterviewStatus: "Pending",
          videoAnalysis: "No Analysis",
          shortlisted: false,
        };
      });

      setResults(formattedResults);
      setShowResults(true);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitNumbers = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/v1/ats/ats-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, numbers }),
      });
      const data = await res.json();
      toast({ title: data.message });
      fetchCandidates(numbers);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error submitting numbers", description: err.message });
    }
  };

  // ---------------- NUMBERS ----------------
  const handleChangeNumber = (index: number, value: string) => {
    const updated = [...numbers];
    updated[index] = Number(value);
    setNumbers(updated);
  };

  const addInput = () => {
    if (numbers.length < limit) setNumbers([...numbers, 0]);
    else
      toast({
        title: "Limit reached",
        description: `Max ${limit} numbers allowed.`,
      });
  };

  const simulateProcessing = async (numbersArr: number[]) => {
    setIsProcessing(true);

    try {
      // Get token from local storage
      const token = localStorage.getItem("token"); // or "authToken" depending on your key
      if (!token) throw new Error("No token found. Please login.");

      const response = await fetch(
        "http://localhost:5000/api/v1/score/rank-cvs",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // include token here
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid/Expired token, please login again");
      }

      if (!response.ok) throw new Error("Failed to fetch data");

      const data = await response.json();

      // Dynamic thresholds
      const qualifiedThresholdDynamic = numbersArr[1] || 50;
      const reviewThresholdDynamic = numbersArr[0] || 40;

      console.log(data, "******");

      const formattedResults = data.results.map(
        (candidate: any, index: number) => {
          const atsScore = candidate?.Score
            ? Number(candidate.Score.toFixed(0))
            : 0;
          let status = "Not Qualified";
          if (atsScore > qualifiedThresholdDynamic) status = "Qualified";
          else if (atsScore > reviewThresholdDynamic) status = "Review";

          return {
            id: index + 1, // unique id
            name: candidate?.Name || "Unknown",
            email: candidate?.Email || "Unknown",
            phone: candidate?.Phone || "Unknown",
            atsScore,
            status,
            KeyStrength: candidate?.["Matched Skills"],
            keywords: (candidate?.["Matched Skills"] || "")
              .split(/[,|]/)
              .map((s: string) => s.trim())
              .filter(Boolean)
              .slice(0, 5),
            considerations: candidate?.["Missing Skills"],
            // considerations: "Solid Experience",
            videoInterviewStatus: "Pending",
            videoAnalysis: "No Analysis",
            exprHappy: 0,
            exprNeutral: 0,
            exprSad: 0,
            exprAngry: 0,
            interviewEmailSent: true,
            shortlisted: false,
          };
        }
      );

      setResults(formattedResults);
      try {
        localStorage.setItem("results", JSON.stringify(formattedResults));
        //   try {
        //     if (typeof jobDescription !== "undefined")
        //       localStorage.setItem("jobDescription", String(jobDescription));
        //   } catch {}
      } catch {}
      setShowResults(true);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExcelDownload = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Name,Email,Phone,ATS Score,Key Strength,Considerations,Status,Video Status,Video Analysis,Video Interview,Happy %,Neutral %,Sad %,Angry %,Shortlisted\n" +
      results
        .map(
          (r) =>
            `${r.name},${r.email},${r.phone},${
              r.atsScore
            }%,Relevant Experience,Cloud, ML Ops,${r.status},${
              r.videoInterviewStatus
            },${r.videoAnalysis},${r.shortlisted ? "Yes" : "No"}`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "candidates_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShortlist = (candidateId: number, checked: boolean) => {
    setResults((prev) =>
      prev.map((candidate) => {
        if (candidate.id === candidateId) {
          const updated = { ...candidate, shortlisted: checked };
          if (checked) {
            toast({
              title: "Candidate Shortlisted",
              description: `${candidate.name} has been shortlisted. Follow-up email will be sent from ${recruiterEmail}`,
            });
          }
          return updated;
        }
        return candidate;
      })
    );
  };

  const sendInterviewEmail = (candidate: any) => {
    if (candidate.atsScore >= 20) {
      toast({
        title: "Interview Email Sent",
        description: `Video interview invitation sent to ${candidate.name} from ${recruiterEmail}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                JobLens Agent
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                ai-powered recruitment platform
              </p>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="space-x-2">
              <Button variant="ghost" onClick={handleLogin}>
                Login
              </Button>
              <Button
                onClick={handleSignup}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Sign Up
              </Button>
            </div>
          )}

          {isAuthenticated && (
            <Button
              variant="outline"
              onClick={() => setIsAuthenticated(false)}
              className="border-purple-200 hover:bg-purple-50"
            >
              Logout
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 relative">
        {!isAuthenticated && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-30 flex items-center justify-center">
            <Card className="max-w-md w-full mx-4 shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Welcome to JobLens Agent
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Please sign in to access the AI recruitment platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleLogin}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  Login
                </Button>
                <Button
                  onClick={handleSignup}
                  variant="outline"
                  className="w-full border-purple-200 hover:bg-purple-50"
                >
                  Create Account
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isAuthenticated && (
          <>
            <div className="grid lg:grid-cols-2 gap-8 mb-4">
              <div className="h-[400px]">
                <JobDescriptionInput />
              </div>
              <div className="h-[400px]">
                <ResumeFolderInput />
                <div className="mt-4">
                  <h2 className="text-lg font-semibold mb-2">
                    Enter ATS Threshold
                  </h2>
                  <form onSubmit={handleSubmitNumbers}>
                    {numbers.map((num, idx) => (
                      <div key={idx} className="mb-2">
                        <p>{idx === 0 ? "Low" : "High"} Threshold</p>
                        <input
                          type="number"
                          value={num}
                          onChange={(e) =>
                            handleChangeNumber(idx, e.target.value)
                          }
                          placeholder={`Number ${idx + 1}`}
                          className="border p-2 rounded w-full"
                          required
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      {numbers.length != limit && (
                        <Button type="button" onClick={addInput}>
                          Add Number
                        </Button>
                      )}
                      <Button type="submit">Submit</Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <Button
                onClick={() => simulateProcessing(numbers)}
                disabled={isProcessing}
                size="lg"
                className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg text-white"
              >
                <Brain className="w-5 h-5 mr-2" />
                {isProcessing ? "Processing..." : "Run Agent"}
              </Button>
            </div>
          </>
        )}

        {isAuthenticated && (showResults || true) && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-purple-700">
                Sample Candidate Results
              </h2>
              <Button
                onClick={handleExcelDownload}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Excel
              </Button>
            </div>
            <div className="overflow-x-auto bg-white shadow-md rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-purple-100 text-purple-700 font-semibold">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>ATS Score</TableHead>
                    <TableHead>Key Strength</TableHead>
                    <TableHead>Considerations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Video Status</TableHead>
                    <TableHead>Video Analysis</TableHead>
                    <TableHead>Video Interview</TableHead>
                    <TableHead>Happy %</TableHead>
                    <TableHead>Neutral %</TableHead>
                    <TableHead>Sad %</TableHead>
                    <TableHead>Angry %</TableHead>
                    <TableHead>Shortlist</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((candidate) => (
                    <TableRow key={candidate.id} className="hover:bg-blue-50">
                      <TableCell>{candidate.name}</TableCell>
                      <TableCell>{candidate.email}</TableCell>
                      <TableCell>{candidate.phone}</TableCell>

                      <TableCell
                        className={
                          candidate.atsScore > qualifiedThreshold
                            ? "text-green-600 font-semibold"
                            : candidate.atsScore > reviewThreshold
                            ? "text-yellow-600 font-semibold"
                            : "text-red-600 font-semibold"
                        }
                      >
                        {candidate.atsScore}%
                      </TableCell>
                      <TableCell>
                        <ul className="list-disc pl-5">
                          {candidate.KeyStrength?.split(",") // split by comma
                            .slice(0, 5) // take first 5 items
                            .map((item, index) => (
                              <li key={index}>{item.trim()}</li>
                            ))}
                        </ul>
                      </TableCell>
                      {/* <TableCell>{candidate.considerations}</TableCell> */}
                      <TableCell>
                        <ul className="list-disc pl-5">
                          {candidate.considerations
                            ?.split(",") // split by comma
                            .slice(0, 5) // take first 5 items
                            .map((item, index) => (
                              <li key={index}>{item.trim()}</li>
                            ))}
                        </ul>
                      </TableCell>
                      <TableCell
                        className={
                          candidate.status === "Qualified"
                            ? "text-green-600 font-semibold"
                            : candidate.status === "Review"
                            ? "text-yellow-600 font-semibold"
                            : "text-red-600 font-semibold"
                        }
                      >
                        {candidate.status}
                      </TableCell>
                      <TableCell>{candidate.videoInterviewStatus}</TableCell>
                      <TableCell>{candidate.videoAnalysis}</TableCell>
                      <TableCell>
                        {candidate.atsScore > 30 ? (
                          <a
                            className="underline text-blue-600"
                            href={`/interview?email=${"${candidate.email}"}&name=${"${encodeURIComponent(candidate.name)"} }`}
                          >
                            Start
                          </a>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{candidate.exprHappy ?? 0}%</TableCell>
                      <TableCell>{candidate.exprNeutral ?? 0}%</TableCell>
                      <TableCell>{candidate.exprSad ?? 0}%</TableCell>
                      <TableCell>{candidate.exprAngry ?? 0}%</TableCell>
                      <TableCell>
                        <Checkbox
                          checked={candidate.shortlisted}
                          onCheckedChange={(checked) =>
                            handleShortlist(candidate.id, Boolean(checked))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default Index;
