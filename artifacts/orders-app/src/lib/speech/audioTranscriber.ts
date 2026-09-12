import { getSavedProviderKeys } from '@/lib/parser/hybridParser';

export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    '',
  ];
  for (const candidate of candidates) {
    if (!candidate || MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

// Universal Audio Transcriber: Gemini 3.6 Flash primary, OpenAI Whisper secondary
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const keys = getSavedProviderKeys();
  const geminiKey = keys.gemini;
  const openAiKey = keys.openai || ((import.meta as any).env?.VITE_OPENAI_API_KEY as string) || '';

  // 1. Try Google Gemini 3.6 Flash
  if (geminiKey && audioBlob.size > 200) {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result ? result.split(',')[1] : '';
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      if (base64Audio) {
        const rawMime = (audioBlob.type ? audioBlob.type.split(';')[0] : '') || 'audio/webm';
        const cleanMime = rawMime.includes('mp4') ? 'audio/mp4' : rawMime.includes('ogg') ? 'audio/ogg' : 'audio/webm';

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: cleanMime,
                      data: base64Audio,
                    },
                  },
                  {
                    text: 'Transcribe this voice audio accurately. It contains spoken queries or order details in Indian English, Hindi, or Hinglish (e.g., "whats due today", "kiska paisa baki hai", "2 chocolate cake parso chahiye"). Return ONLY the exact transcribed words, with zero extra commentary or markdown formatting.',
                  },
                ],
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (text) return text;
        } else {
          console.warn('Gemini 3.6 Flash transcription error HTTP:', res.status);
        }
      }
    } catch (err) {
      console.warn('Gemini 3.6 Flash audio transcription exception:', err);
    }
  }

  // 2. Fallback: OpenAI Whisper
  if (openAiKey && audioBlob.size > 200) {
    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('file', audioBlob, `audio.${ext}`);
      formData.append('model', 'whisper-1');
      formData.append('prompt', 'Transcribe Hindi, Hinglish, or Indian English commerce orders and queries.');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.text?.trim() || '';
        if (text) return text;
      }
    } catch (err) {
      console.warn('OpenAI Whisper fallback failed:', err);
    }
  }

  return '';
}

// Live Web Audio volume analyzer for real-time soundwave animation in non-Chromium browsers
export function setupAudioAnalyser(
  stream: MediaStream,
  onAudioLevel: (hasSound: boolean, volume: number) => void
): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return () => {};

    const audioCtx = new AudioCtx();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animId = 0;

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      onAudioLevel(avg > 12, avg);
      animId = requestAnimationFrame(checkVolume);
    };

    animId = requestAnimationFrame(checkVolume);

    return () => {
      cancelAnimationFrame(animId);
      try {
        source.disconnect();
        analyser.disconnect();
        audioCtx.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}
