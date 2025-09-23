import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams, useNavigate } from "react-router-dom";

type ExpressionAgg = {
  happy: number;
  neutral: number;
  sad: number;
  angry: number;
};

const captureIntervalMs = 2000; // capture a frame every 2s for expression service (if running)
const maxQuestions = 5;
const answerSeconds = 25;

const defaultQuestions = [
  "Tell me about yourself.",
  "Walk me through a recent project you enjoyed.",
  "What’s a challenge you solved recently?",
  "Why are you interested in this role?",
  "Where do you want to grow in the next 12 months?",
];

function deriveQuestionsFromKeywords(
  name: string,
  jd: string | null,
  keywords: string[] | undefined
) {
  const q: string[] = [];
  if (keywords && keywords.length) {
    q.push(
      `You mentioned ${keywords[0]}. Can you share a concrete example using ${keywords[0]}?`
    );
    if (keywords[1])
      q.push(
        `Rate your proficiency in ${keywords[1]} and describe where you applied it.`
      );
    if (keywords[2])
      q.push(`What’s the hardest part of ${keywords[2]} in your experience?`);
  }
  if (jd) {
    const skills = jd.split(/\W+/).filter(Boolean).slice(0, 3);
    if (skills.length)
      q.push(`From this JD, how do you match: ${skills.join(", ")}?`);
  }
  q.push(`Anything else we should know, ${name}?`);
  return q.slice(0, maxQuestions);
}

export default function Interview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(answerSeconds);
  const [qIndex, setQIndex] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);

  const [dynamicApplied, setDynamicApplied] = useState(false);
  const [dynError, setDynError] = useState<string | null>(null);
  const [agg, setAgg] = useState<ExpressionAgg>({
    happy: 0,
    neutral: 0,
    sad: 0,
    angry: 0,
  });
  const [samples, setSamples] = useState(0);
  const [status, setStatus] = useState("");

  const email = params.get("email") || "";
  const name = params.get("name") || "Candidate";

  // Fetch dynamic questions from backend using JD + matched skills stored in localStorage
  useEffect(() => {
    (async () => {
      try {
        const resultsRaw = localStorage.getItem("results");
        const jdText = localStorage.getItem("jobDescription") || "";
        let matchedSkills = [] as string[];
        let resumeText = "";
        if (resultsRaw) {
          try {
            const parsed = JSON.parse(resultsRaw) as any[];
            const person = parsed.find(
              (r) => (r.email || "").toLowerCase() === email.toLowerCase()
            );
            if (person?.keywords) matchedSkills = person.keywords;
            if (person?.KeyStrength) resumeText = String(person.KeyStrength);
          } catch {}
        }
        const token = localStorage.getItem("token");
        if (!token) throw new Error("No token found. Please login.");

        const resp = await fetch(
          "http://localhost:5000/api/v1//questions/generate-questions",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (resp.ok) {
          const out = await resp.json();
          if (out?.ok && Array.isArray(out.questions) && out.questions.length) {
            setQuestions(out.questions);
            return;
          }
        }
        // fallback to previous derive if backend unavailable
        const dyn = deriveQuestionsFromKeywords(name, jdText, matchedSkills);
        if (!dynamicApplied && !questions.length && dyn.length >= 3)
          setQuestions(dyn);
      } catch {
        // ignore
      }
    })();
  }, [email, name, dynamicApplied, questions.length]);

  useEffect(() => {
    // Build questions from localStorage results + JD if present
    const resultsRaw = localStorage.getItem("results");
    let jdText: string | null = localStorage.getItem("jobDescription");
    let keywords: string[] | undefined = undefined;
    if (resultsRaw) {
      try {
        const parsed = JSON.parse(resultsRaw) as any[];
        const person = parsed.find(
          (r) => (r.email || "").toLowerCase() === email.toLowerCase()
        );
        if (person?.keywords) keywords = person.keywords;
        if (!jdText && person?.jd) jdText = person.jd;
      } catch {}
    }
    if (dynamicApplied || questions.length) {
      return;
    }
    const dyn = deriveQuestionsFromKeywords(name, jdText, keywords);
    if (!dynamicApplied && !questions.length && dyn.length >= 3)
      setQuestions(dyn);
  }, [email, name, dynamicApplied, questions.length]);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        alert("Camera/Mic access denied: " + (err as any)?.message);
      }
    })();
    return () => {
      const tracks =
        (videoRef.current?.srcObject as MediaStream | null)?.getTracks?.() ||
        [];
      tracks.forEach((t) => t.stop());
    };
  }, []);

  // Periodically capture a frame and ask local Python expression service (optional)
  useEffect(() => {
    const id = setInterval(async () => {
      if (!isRecording) return;
      try {
        const canvas = document.createElement("canvas");
        const v = videoRef.current!;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(v, 0, 0);
        const blob: Blob = await new Promise(
          (res) => canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.8)!
        );
        const form = new FormData();
        form.append("image", blob, "frame.jpg");
        const resp = await fetch("http://localhost:5001/predict", {
          method: "POST",
          body: form,
        });
        if (resp.ok) {
          const data = await resp.json();
          // Expect {dominant: string, probabilities: {happy:0.1, neutral:0.5, sad:..., angry:..., fear:..., disgust:..., surprise:...}}
          const p = data.probabilities || {};
          const mapped = {
            happy: (p.happy || 0) + (p.surprise || 0) * 0.3,
            neutral: p.neutral || 0,
            sad: p.sad || 0,
            angry:
              (p.angry || 0) + (p.fear || 0) * 0.5 + (p.disgust || 0) * 0.5,
          };
          setAgg((prev) => ({
            happy: prev.happy + mapped.happy,
            neutral: prev.neutral + mapped.neutral,
            sad: prev.sad + mapped.sad,
            angry: prev.angry + mapped.angry,
          }));
          setSamples((s) => s + 1);
        }
      } catch {
        // Ignore if expression service not running
      }
    }, captureIntervalMs);
    return () => clearInterval(id);
  }, [isRecording]);

  // Timer per question
  useEffect(() => {
    if (!isRecording) return;
    if (timeLeft <= 0) {
      nextQuestion();
      return;
    }
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [isRecording, timeLeft]);

  const startRecording = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;
    const mr = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File(
        [blob],
        `${Date.now()}_${email}_answer_q${qIndex + 1}.webm`,
        { type: "video/webm" }
      );
      // Upload to backend (saves to Drive/local)
      const form = new FormData();
      form.append("file", file);
      form.append("name", name);
      form.append("email", email);
      try {
        const r = await fetch("http://localhost:5000/upload", {
          method: "POST",
          body: form,
        });
        const j = await r.json();
        console.log("Uploaded:", j);
      } catch (e) {
        console.error("Upload failed", e);
      }
    };
    mr.start();
    setIsRecording(true);
    setTimeLeft(answerSeconds);
    setStatus("Recording...");
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setStatus("Stopped");
  };

  const nextQuestion = () => {
    stopRecording();
    if (qIndex < questions.length - 1) {
      setTimeout(() => {
        setQIndex(qIndex + 1);
        startRecording();
      }, 600);
    } else {
      finishInterview();
    }
  };

  const finishInterview = async () => {
    stopRecording();
    // Compute normalized percentages
    const n = Math.max(1, samples);
    const result = {
      happy: Math.round((agg.happy / n) * 100),
      neutral: Math.round((agg.neutral / n) * 100),
      sad: Math.round((agg.sad / n) * 100),
      angry: Math.round((agg.angry / n) * 100),
    };
    try {
      await fetch("http://localhost:5000/api/v1/interview/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...result }),
      });
    } catch {}
    // Update localStorage 'results' for dashboard
    try {
      const raw = localStorage.getItem("results");
      if (raw) {
        const data = JSON.parse(raw);
        const idx = data.findIndex(
          (r: any) => (r.email || "").toLowerCase() === email.toLowerCase()
        );
        if (idx >= 0) {
          data[idx].exprHappy = result.happy;
          data[idx].exprNeutral = result.neutral;
          data[idx].exprSad = result.sad;
          data[idx].exprAngry = result.angry;
          data[idx].videoInterviewStatus = "Completed";
          data[idx].videoAnalysis = "Available";
          localStorage.setItem("results", JSON.stringify(data));
        }
      }
    } catch {}
    alert("Interview finished. Thanks!");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto">
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Video Interview – {name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <video
              ref={videoRef}
              className="w-full rounded-xl shadow"
              playsInline
              muted
            />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">
                  Question {qIndex + 1} / {questions.length}
                </div>
                <div className="text-lg font-semibold">
                  {questions.length
                    ? questions[qIndex]
                    : "Loading questions..."}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Time left</div>
                <div className="text-2xl font-bold">{timeLeft}s</div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isRecording ? (
                <Button onClick={startRecording}>Start Answer</Button>
              ) : (
                <Button variant="destructive" onClick={nextQuestion}>
                  Next / Stop
                </Button>
              )}
              <Button variant="secondary" onClick={finishInterview}>
                Finish Now
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-sm text-gray-500">Happy</div>
                <div className="text-xl font-bold">
                  {Math.round(samples ? (agg.happy / samples) * 100 : 0)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Neutral</div>
                <div className="text-xl font-bold">
                  {Math.round(samples ? (agg.neutral / samples) * 100 : 0)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Sad</div>
                <div className="text-xl font-bold">
                  {Math.round(samples ? (agg.sad / samples) * 100 : 0)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Angry</div>
                <div className="text-xl font-bold">
                  {Math.round(samples ? (agg.angry / samples) * 100 : 0)}%
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Tip: For best results, ensure good lighting and keep your face
              within the frame. If you want automatic expression analysis, run
              the optional Python service (instructions in the README).
              Otherwise, you can still record and upload your answers.
            </div>
            <div className="text-sm text-gray-600">{status}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
