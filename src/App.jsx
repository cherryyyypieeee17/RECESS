import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Board from "./Board.jsx";
import "./index.css";

// Restrict sign-ins to your college email domain. Set to null to allow any email.
const ALLOWED_EMAIL_DOMAIN = null; // e.g. "college.edu"

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setError(null);
    if (ALLOWED_EMAIL_DOMAIN && !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      setError(`Please use your @${ALLOWED_EMAIL_DOMAIN} email.`);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (signInError) {
      setError(signInError.message);
    } else {
      setSent(true);
    }
  };

  if (loading) return null;

  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-word">Recess</div>
          <p className="auth-sub">who's free on campus, right now</p>
          {sent ? (
            <p className="auth-sent">
              Check <strong>{email}</strong> for a sign-in link.
            </p>
          ) : (
            <form onSubmit={sendMagicLink}>
              <input
                type="email"
                required
                placeholder={
                  ALLOWED_EMAIL_DOMAIN ? `you@${ALLOWED_EMAIL_DOMAIN}` : "you@example.com"
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit">Send sign-in link</button>
              {error && <p className="auth-error">{error}</p>}
            </form>
          )}
        </div>
      </div>
    );
  }

  return <Board session={session} />;
}
