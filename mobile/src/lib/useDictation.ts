import { useCallback, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

/**
 * Diktieren auf Deutsch. Hängt das Gesprochene an den vorhandenen Text an.
 * iOS liefert pro Sitzung einen wachsenden Gesamttext, Android liefert Abschnitte.
 * Beides wird hier zu einem Text zusammengeführt.
 */
export function useDictation(getText: () => string, setText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const base = useRef("");
  const committed = useRef("");

  const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(" ");

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (e) => {
    const t = e.results[0]?.transcript ?? "";
    if (e.isFinal) {
      // iOS: finaler Gesamttext ersetzt alles Bisherige der Sitzung. Android: neuer Abschnitt.
      committed.current = t.startsWith(committed.current) ? t : join(committed.current, t);
      setText(join(base.current, committed.current));
    } else {
      const sessionSoFar = t.startsWith(committed.current) ? t : join(committed.current, t);
      setText(join(base.current, sessionSoFar));
    }
  });
  useSpeechRecognitionEvent("error", (e) => {
    setListening(false);
    if (e.error === "not-allowed") {
      Alert.alert(
        "Mikrofon nicht erlaubt",
        "Erlaube Sanftwort in den Einstellungen Mikrofon und Spracherkennung, um zu diktieren.",
        [{ text: "Abbrechen", style: "cancel" }, { text: "Einstellungen", onPress: () => Linking.openSettings() }],
      );
    } else if (e.error !== "aborted" && e.error !== "no-speech") {
      Alert.alert("Diktieren hat nicht geklappt", "Versuch es nochmal oder tippe den Text ein.");
    }
  });

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Mikrofon nicht erlaubt",
        "Erlaube Sanftwort in den Einstellungen Mikrofon und Spracherkennung, um zu diktieren.",
        [{ text: "Abbrechen", style: "cancel" }, { text: "Einstellungen", onPress: () => Linking.openSettings() }],
      );
      return;
    }
    base.current = getText();
    committed.current = "";
    ExpoSpeechRecognitionModule.start({
      lang: "de-DE",
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
    });
  }, [getText]);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  return { listening, start, stop, toggle: () => (listening ? stop() : start()) };
}
