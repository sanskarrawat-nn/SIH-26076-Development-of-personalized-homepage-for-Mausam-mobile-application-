import React, { useEffect, useRef, useState } from "react";
import { answerQuestion, speak } from "../services/assistant";
import { getLanguage, t } from "../services/i18n";

export default function AskMausam({
  data,
  profile,
  onNavigate,
  voiceNavigation,
}) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const recognition = useRef(null);
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  useEffect(
    () => () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  // Clear answers whenever data/context changes; an old answer must not follow a new city.
  useEffect(() => {
    setAnswer("");
  }, [data, profile]);
  function ask(value) {
    const result = answerQuestion(value, data, profile);
    if (typeof result === "object") {
      if (voiceNavigation) onNavigate(result.action);
      setAnswer(
        result.text +
          (voiceNavigation
            ? ""
            : " " +
              t("Enable voice navigation in Accessibility to open sections.")),
      );
    } else setAnswer(result);
  }
  function listen() {
    if (!Recognition) return;
    recognition.current?.abort();
    const session = new Recognition();
    recognition.current = session;
    session.lang = getLanguage() === "hi" ? "hi-IN" : "en-IN";
    session.interimResults = false;
    session.onstart = () => setListening(true);
    session.onend = () => setListening(false);
    session.onerror = () => {
      setListening(false);
      setAnswer(
        t(
          "Microphone or speech service unavailable. Type your question instead.",
        ),
      );
    };
    session.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setQuery(text);
      ask(text);
    };
    try {
      session.start();
    } catch {
      setAnswer(t("Speech could not start. Type your question instead."));
    }
  }
  return (
    <section className="ask-mausam">
      <p>
        {t(
          "Answers use the selected location and loaded forecast. No invented weather.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(query);
        }}
      >
        <label>
          {t("Ask Mausam")}
          <input
            maxLength={300}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Kal baarish hogi?")}
            required
          />
        </label>
        <button className="btn primary" type="submit">
          {t("Ask")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={!Recognition || listening}
          onClick={listen}
        >
          {t(listening ? "Listening…" : "Use microphone")}
        </button>
      </form>
      <p className="small muted">
        {t(
          Recognition
            ? "Speech recognition may send audio to your browser's speech provider. Microphone starts only when you choose it."
            : "Speech recognition is unsupported here. You can type and read answers.",
        )}
      </p>
      <div role="status" className="voice-answer">
        {answer}
      </div>
      {answer && (
        <button
          className="btn"
          onClick={() => {
            if (!speak(answer))
              setAnswer(
                answer +
                  " " +
                  t("Speech output is unavailable in this browser."),
              );
          }}
        >
          {t("Read answer aloud")}
        </button>
      )}
      <button
        className="text-btn"
        onClick={() => {
          recognition.current?.abort();
          window.speechSynthesis?.cancel();
        }}
      >
        {t("Stop speech")}
      </button>
    </section>
  );
}
