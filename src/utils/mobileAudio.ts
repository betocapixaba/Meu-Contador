// Mobile and Cross-Browser Audio Recording & Speech Synthesis Utilities

export function getSupportedAudioMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }

  const candidateMimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/wav"
  ];

  for (const mime of candidateMimeTypes) {
    if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return "";
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function unlockAudioPlayback(): void {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // Create empty utterance to unlock iOS audio context
      const unlockUtterance = new SpeechSynthesisUtterance("");
      unlockUtterance.volume = 0;
      window.speechSynthesis.speak(unlockUtterance);
    }
  } catch (e) {
    // Ignore unlock errors
  }
}

export function speakPortugueseText(text: string): void {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn("Speech synthesis unavailable:", e);
  }
}
