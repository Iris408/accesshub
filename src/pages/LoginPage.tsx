import { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();

  async function loginUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const API_URL = (
      import.meta.env.VITE_API_URL || "https://mini-user-api.onrender.com"
    ).replace(/\/+$/, "");

    try {
      setErrorMessage("");

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      console.log("Login response:", data);

      if (!response.ok) {
        setErrorMessage(data.detail || "Login failed");
        return;
      }

      if (!data.access_token) {
        setErrorMessage("No access token returned from backend");
        return;
      }

      localStorage.setItem("token", data.access_token);
      navigate("/dashboard");
    } catch (error) {
      console.error("Backend API connection failed:", error);
      setErrorMessage("Unable to connect to backend API");
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-brand">
          <div className="auth-badge">AH</div>

          <div>
            <p className="auth-eyebrow">Authentication & Access Management</p>
            <h1>AccessHub</h1>
          </div>
        </div>

        <p className="auth-subtitle">
          Secure authentication, protected routes, and role-based access
          powered by React, TypeScript, and FastAPI.
        </p> 

        <div className="auth-feature-grid">
          <div className="auth-feature-card">
            <span>01</span>
            <h3>JWT Login</h3>
            <p>Authenticate users and store access tokens securely in local storage.</p>
          </div>

          <div className="auth-feature-card">
            <span>02</span>
            <h3>Protected Routes</h3>
            <p>Block dashboard and admin access unless a valid token exists.</p>
          </div>

          <div className="auth-feature-card">
            <span>03</span>
            <h3>Admin Access</h3>
            <p>Load admin-only user data through authenticated API requests.</p>
          </div>
        </div>
      </section>

      <section className="auth-card-section">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo">AH</div>

            <div>
              <h2>Sign in</h2>
              <p>Use your demo credentials to access the dashboard.</p>
            </div>
          </div>

          {errorMessage && (
            <div className="auth-error">
              {errorMessage}
            </div>
          )}

          <form onSubmit={loginUser} className="auth-form">
            <label>
              Username
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <button type="submit" className="auth-submit-button">
              Login to Dashboard
            </button>
          </form>

          <div className="auth-demo-box">
            <p className="auth-demo-title">Demo account</p>
            <p>
              Username: <strong>testuser</strong>
            </p>
            <p>
              Password: <strong>password123</strong>
            </p>
          </div>

          <p className="auth-backend-note">
            Connected to Secure User API on Render.
          </p>
        </div>
      </section>
    </div>
  );
}

export default LoginPage;