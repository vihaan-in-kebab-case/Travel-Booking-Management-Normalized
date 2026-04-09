import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value) {
  if (!value) {
    return "Not available";
  }

  if (String(value).includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }

  return String(value);
}

function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const nextProfile = await refreshProfile();
        if (isMounted) {
          setProfile(nextProfile);
        }
      } catch (profileError) {
        if (isMounted) {
          setError(profileError.message || "Unable to fetch profile details.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [refreshProfile]);

  const details = [
    { label: "Full Name", value: profile?.full_name || profile?.name },
    { label: "Display ID", value: profile?.display_user_id },
    { label: "User ID", value: profile?.user_id },
    { label: "Role", value: profile?.role ? formatLabel(profile.role) : "" },
    { label: "Email", value: profile?.email },
    { label: "Phone", value: profile?.phone },
    { label: "Status", value: profile?.status ? formatLabel(profile.status) : "" }
  ];

  return (
    <section className="page-shell profile-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Account Details</p>
          <h1>{profile?.full_name || profile?.name || "My Profile"}</h1>
          <p>View your account information for the current signed-in session.</p>
        </div>
      </div>

      <div className="panel profile-card">
        {loading && <p className="helper-text">Loading profile details...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <div className="profile-grid">
            {details.map((detail) => (
              <div key={detail.label} className="profile-item">
                <span>{detail.label}</span>
                <strong>{detail.value || "Not available"}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ProfilePage;


