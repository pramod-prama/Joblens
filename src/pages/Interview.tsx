import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import avatar from "../../public/images/avatar.jpg";

// ---------------- MorphCast loader + globals ----------------
declare global {
  interface Window {
    CY?: any;
    MphTools?: any;
  }
}

async function loadMorphcastScripts(): Promise<void> {
  function load(src: string, dataConfig?: string) {
    return new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      if (dataConfig) s.setAttribute("data-config", dataConfig);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
  await load(
    "https://sdk.morphcast.com/mphtools/v1.1/mphtools.js",
    "cameraPrivacyPopup, compatibilityUI, compatibilityAutoCheck"
  );
  await load("https://ai-sdk.morphcast.com/v1.16/ai-sdk.js");
}

// ---------------- Types & constants ----------------
type EmotionAgg = {
  angry: number;
  disgust: number;
  fear: number;
  happy: number;
  sad: number;
  surprise: number;
  neutral: number;
};

const answerSeconds = 25;
const MORPHCAST_LICENSE = "sk6abf680451ae1d1a7e6abc1e7c183f056e4270c87769";

async function askForMedia(videoEl: HTMLVideoElement | null): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });
    if (videoEl) {
      videoEl.srcObject = stream;
      await videoEl.play();
    }
    return true;
  } catch (err: any) {
    const msg = String(err?.name || err?.message || err);
    alert(
      "Camera/Mic is blocked. Please:\n" +
        "1) Click the padlock (address bar) and set Camera/Mic to Allow\n" +
        "2) Windows Settings > Privacy & security > Camera/Microphone: enable for desktop apps\n" +
        "3) Close Zoom/Teams/OBS if using the camera\n\n" +
        "Error: " +
        msg
    );
    return false;
  }
}

export default function Interview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);

  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const name = params.get("name") || "Candidate";

  const [questions, setQuestions] = useState<string[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(answerSeconds);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);

  const [mcReady, setMcReady] = useState(false);
  const [mcStatus, setMcStatus] = useState<string>("");
  const [agg, setAgg] = useState<EmotionAgg>({
    angry: 0,
    disgust: 0,
    fear: 0,
    happy: 0,
    sad: 0,
    surprise: 0,
    neutral: 0,
  });
  const [avgAgg, setAvgAgg] = useState<EmotionAgg>({ ...agg });
  const [samples, setSamples] = useState(0);
  const [dominantEmotion, setDominantEmotion] = useState("Neutral");

  const [isSpeaking, setIsSpeaking] = useState(false);

  // --------- Fetch questions ---------
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("No token found. Please login.");

        const resp = await fetch(
          "http://localhost:5000/api/v1/questions/generate-questions",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (resp.status === 401 || resp.status === 403) {
          throw new Error("Invalid/Expired token, please login again");
        }
        if (!resp.ok) throw new Error("Failed to fetch questions");

        const data = await resp.json();
        setQuestions(data.questions || []);
        setApiLoaded(true);
      } catch (err: any) {
        alert("Failed to load questions: " + (err?.message || err));
      }
    })();
  }, []);

  // --------- Camera ---------
  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await askForMedia(videoRef.current);
    })();
    return () => {
      active = false;
      const tracks =
        (videoRef.current?.srcObject as MediaStream | null)?.getTracks?.() ||
        [];
      tracks.forEach((t) => t.stop());
    };
  }, []);

  // --------- MorphCast init ---------
  useEffect(() => {
    let cancelled = false;
    let engine: any = null;

    function handleEmotionEvent(evt: any) {
      if (cancelled || !isRecording || isPaused) return;
      const detail = evt?.detail || evt;
      const out =
        detail?.output ||
        detail?.data ||
        (detail?.result ? detail.result : undefined) ||
        undefined;
      const emo =
        out?.face?.emotion || out?.face0?.emotion || out?.emotion || null;
      if (!emo) return;

      const vals = {
        angry: Number(emo.angry ?? emo.Angry ?? 0),
        disgust: Number(emo.disgust ?? emo.Disgust ?? 0),
        fear: Number(emo.fear ?? emo.Fear ?? 0),
        happy: Number(emo.happy ?? emo.Happy ?? 0),
        sad: Number(emo.sad ?? emo.Sad ?? 0),
        surprise: Number(emo.surprise ?? emo.Surprise ?? 0),
        neutral: Number(emo.neutral ?? emo.Neutral ?? 0),
      };

      const [dominantKey] = Object.entries(vals).reduce(
        (max, curr) => (curr[1] > max[1] ? curr : max),
        ["neutral", 0]
      );

      setAgg((prev) => {
        const updated = { ...prev, [dominantKey]: prev[dominantKey] + 1 };
        const total = Object.values(updated).reduce((a, b) => a + b, 1);
        setAvgAgg({
          angry: Math.round((updated.angry / total) * 100),
          disgust: Math.round((updated.disgust / total) * 100),
          fear: Math.round((updated.fear / total) * 100),
          happy: Math.round((updated.happy / total) * 100),
          sad: Math.round((updated.sad / total) * 100),
          surprise: Math.round((updated.surprise / total) * 100),
          neutral: Math.round((updated.neutral / total) * 100),
        });

        const domEmotion = Object.entries(updated).reduce(
          (a, b) => (b[1] > a[1] ? b : a),
          ["neutral", 0]
        )[0];
        setDominantEmotion(
          domEmotion.charAt(0).toUpperCase() + domEmotion.slice(1)
        );

        setSamples(total);
        return updated;
      });
    }

    (async () => {
      try {
        await loadMorphcastScripts();
        if (window.MphTools?.CompatibilityAutoCheck) {
          window.MphTools.CompatibilityAutoCheck.run?.();
        }

        if (!videoRef.current?.srcObject) {
          const ok = await askForMedia(videoRef.current);
          if (!ok) {
            setMcStatus("Camera/Mic permission blocked.");
            return;
          }
        }

        const CY = (window as any).CY;
        if (!CY) throw new Error("MorphCast CY not available");

        const source = CY.createSource.fromVideoElement(videoRef.current);
        let loader = CY.loader()
          .addModule(CY.modules().FACE_DETECTOR.name)
          .addModule(CY.modules().FACE_EMOTION.name)
          .source(source);

        if (MORPHCAST_LICENSE) {
          loader = loader.licenseKey(MORPHCAST_LICENSE);
        }

        engine = await loader.load();

        window.addEventListener("CY_FACE_EMOTION", handleEmotionEvent as any);
        window.addEventListener(
          "CY_FACE_EMOTION_RESULT",
          handleEmotionEvent as any
        );
        window.addEventListener("cy.face.emotion", handleEmotionEvent as any);

        await engine.start();
        if (!cancelled) {
          setMcReady(true);
          setMcStatus("Emotion AI ready. Will record only when answering.");
        }
      } catch (e: any) {
        setMcStatus("MorphCast init error: " + (e?.message || String(e)));
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("CY_FACE_EMOTION", handleEmotionEvent as any);
      window.removeEventListener(
        "CY_FACE_EMOTION_RESULT",
        handleEmotionEvent as any
      );
      window.removeEventListener("cy.face.emotion", handleEmotionEvent as any);
      (async () => {
        try {
          await engine?.stop?.();
          await engine?.destroy?.();
        } catch {}
      })();
    };
  }, [isRecording, isPaused]);

  // --------- Timer per question ---------
  useEffect(() => {
    if (!isRecording || isPaused || isSpeaking) return;
    if (timeLeft <= 0) {
      nextQuestion();
      return;
    }
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [isRecording, timeLeft, isPaused, isSpeaking]);

  // --------- Recording ---------
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
    };

    mr.start();
    setIsRecording(true);
    setIsPaused(false);
    setTimeLeft(answerSeconds);
  };

  // --------- Speak with volume-based mouth animation ---------
  const speakQuestion = (q: string) => {
    if (!q) return;

    setTimeLeft(answerSeconds); // Reset timer at start
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(q);
    utterance.rate = 0.85;
    utterance.pitch = 1.1;
    utterance.lang = "en-US";

    const mouthEl = document.querySelector(".animate-mouth") as HTMLDivElement;
    if (!mouthEl) return;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(
      videoRef.current!.srcObject as MediaStream
    );
    source.connect(analyser);
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animateMouth = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const height = Math.min(10, 2 + avg / 25);
      mouthEl.style.height = `${height}px`;
      animationRef.current = requestAnimationFrame(animateMouth);
    };

    animationRef.current = requestAnimationFrame(animateMouth);

    utterance.onend = () => {
      setIsSpeaking(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      mouthEl.style.height = "2px";
      startRecording();
      audioCtx.close();
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const nextQuestion = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();

    setTimeLeft(answerSeconds);

    if (qIndex + 1 < questions.length) {
      const nextIndex = qIndex + 1;
      setQIndex(nextIndex);
      speakQuestion(questions[nextIndex]);
    } else {
      setIsRecording(false);
      persistMorphcastSummary();
    }
  };

  const persistMorphcastSummary = () => {
    if (!email) return;
    const total = samples || 1;
    const summary = {
      email,
      name,
      timestamp: Date.now(),
      happy: Math.round((agg.happy / total) * 100),
      neutral: Math.round((agg.neutral / total) * 100),
      sad: Math.round((agg.sad / total) * 100),
      angry: Math.round((agg.angry / total) * 100),
      source: "MorphCast",
    };
    try {
      localStorage.setItem(
        "morphcastEmotion:" + email.toLowerCase(),
        JSON.stringify(summary)
      );
    } catch {}
  };

  const finishInterview = async () => {
    persistMorphcastSummary();
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);

    const emotions = {
      angry: avgAgg.angry,
      disgust: avgAgg.disgust,
      fear: avgAgg.fear,
      happy: avgAgg.happy,
      sad: avgAgg.sad,
      surprise: avgAgg.surprise,
      neutral: avgAgg.neutral,
      dominant: dominantEmotion,
    };

    try {
      const token = localStorage.getItem("token");
      await fetch("http://localhost:5000/api/v1/interview/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          name,
          emotions,
        }),
      });
      alert("Interview saved successfully!");
      window.location.href = "http://localhost:8080/";
    } catch (err) {
      console.error(err);
      alert("Failed to save interview");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-7xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Video Interview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 justify-center">
            <video
              ref={videoRef}
              className="w-1/2 rounded-lg border"
              autoPlay
              playsInline
              muted
            />
            <div className="mb-4 mt-10 flex flex-col items-center">
              {isRecording && (
                <div
                  className="font-bold text-xl mb-2"
                  style={{
                    color:
                      timeLeft > 15
                        ? "black"
                        : `rgb(${Math.min(
                            255,
                            ((15 - timeLeft) / 15) * 255
                          )}, 0, 0)`,
                    transition: "color 0.5s linear",
                  }}
                >
                  Time Left: {timeLeft}s
                </div>
              )}
              <div>
                <div className="relative w-full max-w-xs mx-auto aspect-[3/4]">
                  <img
                    src={avatar}
                    alt="Avatar"
                    className="w-full h-full object-cover rounded-lg shadow-lg"
                  />
                  <div
                    className="absolute left-1/2 bottom-20 w-8 h-2 bg-red-500 rounded-full animate-mouth"
                    style={{ transform: "translateX(-50%)" }}
                  ></div>
                </div>
                <div className="bg-white p-4 text-lg font-medium text-gray-800 min-h-[100px] min-w-[500px] flex items-center justify-center text-center">
                  {questions.length
                    ? questions[qIndex]
                    : "Loading questions..."}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 min-w-[599px]">
                <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  Q{qIndex + 1}/{questions.length}
                </div>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${((qIndex + 1) / questions.length) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4 justify-center">
            {!isRecording ? (
              <Button
                onClick={() => speakQuestion(questions[qIndex])}
                disabled={!apiLoaded || !questions.length}
              >
                {apiLoaded ? "Start Answer" : "Loading..."}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={togglePause}>
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button variant="secondary" onClick={nextQuestion}>
                  Next
                </Button>
              </>
            )}

            <Button variant="destructive" onClick={finishInterview}>
              Finish
            </Button>
          </div>

          <div className="mt-4 text-center text-gray-500">{mcStatus}</div>
        </CardContent>
      </Card>
    </div>
  );
}
