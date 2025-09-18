import React, { useEffect, useState } from "react";
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
import { Users, Download, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const [numbers, setNumbers] = useState<number[]>([]);
  const limit = 3;
  const userId = "user123";

  // Thresholds for coloring
  const [qualifiedThreshold, setQualifiedThreshold] = useState(50);
  const [reviewThreshold, setReviewThreshold] = useState(40);

  // ---------------- AUTH ----------------
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
    if (email) setRecruiterEmail(email);
    fetchCandidates(numbers);
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

  const fetchNumbers = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/v1/ats/ats-number/${userId}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.numbers) setNumbers(data.numbers);
      }
    } catch (err) {
      console.error("Error fetching numbers:", err);
    }
  };

  useEffect(() => {
    fetchNumbers();
  }, []);

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
          considerations: c?.["Missing Skills"] || "Solid Experience",
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

  // ---------------- CSV DOWNLOAD ----------------
  const handleExcelDownload = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Name,Email,Phone,ATS Score,Key Strength,Considerations,Status,Video Status,Video Analysis,Shortlisted",
      ]
        .concat(
          results.map(
            (r) =>
              `${r.name},${r.email},${r.phone},${r.atsScore},${r.KeyStrength},${
                r.considerations
              },${r.status},${r.videoInterviewStatus},${r.videoAnalysis},${
                r.shortlisted ? "Yes" : "No"
              }`
          )
        )
        .join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "candidate_results.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------------- SHORTLIST ----------------
  const handleShortlist = (candidateId: number, checked: boolean) => {
    setResults((prev) =>
      prev.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, shortlisted: checked }
          : candidate
      )
    );
    if (checked) {
      const candidate = results.find((r) => r.id === candidateId);
      if (candidate) {
        toast({
          title: "Candidate Shortlisted",
          description: `${candidate.name} has been shortlisted. Follow-up email will be sent from ${recruiterEmail}`,
        });
      }
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
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
                AI-powered recruitment platform
              </p>
            </div>
          </div>

          {!isAuthenticated ? (
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
          ) : (
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

      {/* Main */}
      <main className="container mx-auto px-4 py-6 relative">
        {!isAuthenticated && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-30 flex items-center justify-center">
            <Card className="max-w-md w-full shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
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
            {/* Inputs */}
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
                      <Button type="button" onClick={addInput}>
                        Add Number
                      </Button>
                      <Button type="submit">Submit</Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Run Agent */}
            <div className="text-center mb-6">
              <Button
                onClick={() => fetchCandidates(numbers)}
                disabled={isProcessing}
                size="lg"
                className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg text-white"
              >
                <Brain className="w-5 h-5 mr-2" />
                {isProcessing ? "Processing..." : "Run Agent"}
              </Button>
            </div>

            {/* Candidate Results */}
            {showResults && results.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-purple-700">
                    Candidate Results
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
                        <TableHead>Shortlist</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((c) => (
                        <TableRow key={c.id} className="hover:bg-blue-50">
                          <TableCell>{c.name}</TableCell>
                          <TableCell>{c.email}</TableCell>
                          <TableCell>{c.phone}</TableCell>
                          <TableCell
                            className={
                              c.atsScore > qualifiedThreshold
                                ? "text-green-600 font-semibold"
                                : c.atsScore > reviewThreshold
                                ? "text-yellow-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            {c.atsScore}%
                          </TableCell>
                          <TableCell>{c.KeyStrength}</TableCell>
                          <TableCell>{c.considerations}</TableCell>
                          <TableCell
                            className={
                              c.status === "Qualified"
                                ? "text-green-600 font-semibold"
                                : c.status === "Review"
                                ? "text-yellow-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            {c.status}
                          </TableCell>
                          <TableCell>{c.videoInterviewStatus}</TableCell>
                          <TableCell>{c.videoAnalysis}</TableCell>
                          <TableCell>
                            <Checkbox
                              checked={c.shortlisted}
                              onCheckedChange={(checked) =>
                                handleShortlist(c.id, Boolean(checked))
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
          </>
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
