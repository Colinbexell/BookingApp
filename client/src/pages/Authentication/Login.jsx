import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { UserContext } from "../../../context/userContext";
import { useNavigate, Link } from "react-router-dom";
import Loader from "../../components/loader/Loader";
import "./Auth.css";

import { API_BASE_URL } from "../../../config";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

const Login = () => {
  const [loginData, setloginData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);

  const { user, setUser, loading } = useContext(UserContext);
  const navigate = useNavigate();

  // Redirect if already logged in OBS change these based off user roles and routes
  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") {
        navigate("/admin");
      } else if (user.role === "dev") {
        navigate("/developer");
      } else {
        navigate("/");
      }
    }
  }, [user, loading, navigate]);

  const loginUser = async (e) => {
    e.preventDefault();
    const { email, password } = loginData;

    // Basic validation
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await axios.post("/api/login", { email, password });

      if (data.error) {
        toast.error(data.message);
      } else {
        toast.success(data.message);
        // Update the context with user data
        setUser(data.user);

        // Navigate based on role OBS change these based off of roles and routes
        if (data.role === "admin") {
          navigate("/admin");
        } else if (data.role === "dev") {
          navigate("/developer");
        } else {
          navigate("/");
        }
      }
    } catch (error) {
      if (error.response?.status === 429) {
        // rate limit frǾn backend
        toast.error(
          error.response.data.error ||
            "Too many login attempts. Try again later."
        );
      } else {
        toast.error(error.response?.data?.message || "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div>
        <Loader />
      </div>
    );
  }

  return (
    <div className="main auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Login</h1>
        <form className="auth-form" onSubmit={loginUser}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={loginData.email}
              onChange={(e) =>
                setloginData({ ...loginData, email: e.target.value })
              }
              disabled={isLoading}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              placeholder="********"
              value={loginData.password}
              onChange={(e) =>
                setloginData({ ...loginData, password: e.target.value })
              }
              disabled={isLoading}
              required
              autoComplete="current-password"
            />
          </div>

          <button className="auth-button" type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="auth-alt">
          Don't have an account?{" "}
          <Link className="auth-link" to="/register">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
