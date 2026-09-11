import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { Coffee, Footprints, BookOpen, MessageCircle, Utensils, Dumbbell, Plus, X, RefreshCw, MapPin, Clock, Shield, Trash2, LogOut } from "lucide-react";

// Signing in with this email grants moderation powers (removing any post).
// Keep this in sync with is_owner_email() in supabase/schema.sql.
const OWNER_EMAIL = "cherryyyypieeee17@gmail.com";

const VIBES = [
  { id: "coffee", label: "Coffee", icon: Coffee, color: "var(--chart-1)" },
  { id: "walk", label: "Walk", icon: Footprints, color: "var(--chart-2)" },
  { id: "study", label: "Study break", icon: BookOpen, color: "var(--chart-3)" },
  { id: "talk", label: "Just talk", icon: MessageCircle, color: "var(--chart-4)" },
  { id: "lunch", label: "Lunch", icon: Utensils, color: "var(--chart-5)" },
  { id: "gym", label: "Gym sesh", icon: Dumbbell, color: "var(--chart-6)" }
];

const ZONES = ["Canteen", "Library", "Sadbhawna Bhawan", "Lawn", "Sports Complex", "Hostel", "Auditorium", "Somewhere else"];
const DURATIONS = [10, 15, 30, 45, 60, 90];

function vibeMeta(id) {
  return VIBES.find((v) => v.id === id) || VIBES[0];
}

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "ending";
  return `${Math.ceil(ms / 60000)}m left`;
}

export default function Board({ session }) {
  const userId = session.user.id;
  const [name, setName] = useState(session.user.user_metadata?.name || null);
  const [nameDraft, setNameDraft] = useState("");
  const [feed, setFeed] = useState([]);
  const [myStatus, setMyStatus] = useState(null);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ vibe: "coffee", zone: ZONES[0], duration: 30, note: "" });
  const [error, setError] = useState(null);

  const isOwner = session.user.email === OWNER_EMAIL;

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    const { error: err } = await supabase.auth.updateUser({ data: { name: trimmed } });
    if (err) {
      setError("Couldn't save your name. Try again.");
    } else {
      setName(trimmed);
    }
  };

  const refreshFeed = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("statuses")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });
    if (err) {
      setError("Couldn't load the board.");
      return;
    }
    setFeed(data || []);
    setMyStatus((data || []).find((e) => e.id === userId) || null);
  }, [userId]);

  useEffect(() => {
    if (!name) return;
    refreshFeed();

    // Live updates: anyone posting/cancelling shows up without polling
    const channel = supabase
      .channel("statuses-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, () => {
        refreshFeed();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [name, refreshFeed]);

  const postStatus = async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + form.duration * 60000);
    const { error: err } = await supabase.from("statuses").upsert({
      id: userId,
      name,
      vibe: form.vibe,
      zone: form.zone,
      duration_min: form.duration,
      note: form.note.trim().slice(0, 80),
      posted_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    });
    if (err) {
      setError("Couldn't post your status.");
    } else {
      setComposing(false);
      setForm({ vibe: "coffee", zone: ZONES[0], duration: 30, note: "" });
      refreshFeed();
    }
  };

  const cancelStatus = async () => {
    const { error: err } = await supabase.from("statuses").delete().eq("id", userId);
    if (err) setError("Couldn't cancel.");
    else refreshFeed();
  };

  const removePost = async (statusId) => {
    const { error: err } = await supabase.from("statuses").delete().eq("id", statusId);
    if (err) setError("Couldn't remove that post.");
    else refreshFeed();
  };

  const others = feed.filter((e) => e.id !== userId);

  if (!name) {
    return (
      <div className="recess-root">
        <Header isOwner={isOwner} />
        <div className="name-gate">
          <p style={{ color: "var(--slate)", fontSize: 14, margin: 0 }}>
            First, what should people see when you're on the board?
          </p>
          <input
            placeholder="Your first name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            maxLength={20}
          />
          <button className="post-btn" style={{ width: "100%" }} disabled={!nameDraft.trim()} onClick={saveName}>
            Join the board
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recess-root">
      <Header isOwner={isOwner} />
      <div className="recess-body">
        {error && <div className="error-banner">{error}</div>}

        <div className="section-label">Your status</div>

        {myStatus ? (
          <div className="status-card">
            <div className="active-row">
              <div className="active-left">
                <div className="vibe-chip-icon" style={{ background: vibeMeta(myStatus.vibe).color }}>
                  {React.createElement(vibeMeta(myStatus.vibe).icon, { size: 17 })}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    You're marked free · {vibeMeta(myStatus.vibe).label}
                  </div>
                  <div className="active-meta">
                    {myStatus.zone} · {timeLeft(myStatus.expires_at)}
                  </div>
                </div>
              </div>
              <button className="cancel-btn" onClick={cancelStatus}>
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        ) : composing ? (
          <div className="compose-panel">
            <div className="field-label">What's the vibe?</div>
            <div className="chip-row">
              {VIBES.map((v) => (
                <button
                  key={v.id}
                  className={`chip ${form.vibe === v.id ? "selected" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, vibe: v.id }))}
                >
                  <v.icon size={14} /> {v.label}
                </button>
              ))}
            </div>

            <div className="field-label">Where are you?</div>
            <select className="zone-select" value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}>
              {ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>

            <div className="field-label">Free for how long?</div>
            <div className="chip-row">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  className={`chip ${form.duration === d ? "selected" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, duration: d }))}
                >
                  {d} min
                </button>
              ))}
            </div>

            <div className="field-label">Note (optional)</div>
            <input
              className="note-input"
              placeholder="need caffeine, first floor..."
              value={form.note}
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />

            <div className="compose-actions">
              <button className="ghost-btn" onClick={() => setComposing(false)}>Cancel</button>
              <button className="post-btn" onClick={postStatus}>Post to the board</button>
            </div>
          </div>
        ) : (
          <button className="status-idle-btn" onClick={() => setComposing(true)}>
            <Plus size={16} /> Mark yourself free
          </button>
        )}

        <div className="refresh-row">
          <div className="section-label" style={{ margin: 0 }}>
            <span className="feed-count">{others.length}</span> on break now
          </div>
          <button className="refresh-btn" onClick={refreshFeed}>
            <RefreshCw size={12} /> refresh
          </button>
        </div>

        {others.length === 0 ? (
          <div className="empty-state">
            Nobody's marked free right now.<br />Be the first — someone will probably join you.
          </div>
        ) : (
          <div>
            {others.map((e) => {
              const vm = vibeMeta(e.vibe);
              return (
                <div className="feed-row" key={e.id}>
                  <div className="stripe" style={{ background: vm.color }} />
                  <div className="feed-main">
                    <div className="feed-name-row">
                      <span className="feed-name">{e.name}</span>
                      <span className="feed-time">
                        <Clock size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
                        {timeLeft(e.expires_at)}
                      </span>
                    </div>
                    <div className="feed-details">
                      <vm.icon size={13} /> {vm.label}
                      <span style={{ color: "var(--line)" }}>·</span>
                      <MapPin size={13} /> {e.zone}
                    </div>
                    {e.note && <div className="feed-note">"{e.note}"</div>}
                  </div>
                  {isOwner && (
                    <button
                      className="remove-btn"
                      onClick={() => removePost(e.id)}
                      title="Remove this post"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="recess-footer">Made by Asin</div>
    </div>
  );
}

function Header({ isOwner }) {
  const signOut = () => supabase.auth.signOut();
  return (
    <div className="recess-header">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="recess-word"><span className="live-dot" /> Recess</div>
        <button className="signout-btn" onClick={signOut}>
          <LogOut size={11} /> Sign out
        </button>
      </div>
      <div className="recess-tag" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        who's free on campus, right now
        {isOwner && (
          <span className="owner-badge">
            <Shield size={10} /> Owner
          </span>
        )}
      </div>
    </div>
  );
}
