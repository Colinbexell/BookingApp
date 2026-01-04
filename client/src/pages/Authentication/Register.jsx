import { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import "./Auth.css";

import { API_BASE_URL } from "../../../config";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

const Register = () => {
  const [data, setdata] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const registerUser = async (e) => {
    e.preventDefault();
    const { name, email, password, role } = data;
    try {
      const response = await axios.post("/api/register", {
        name,
        email,
        password,
        role,
      });
      setdata({ name: "", email: "", password: "", role: "user" });
      toast.success("Registration successful!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed");
    }
  };
  return (
    <div className="main auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Register</h1>
        <form className="auth-form" onSubmit={registerUser}>
          <div className="input-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              className="auth-input"
              type="text"
              placeholder="Your name"
              value={data.name}
              onChange={(e) => setdata({ ...data, name: e.target.value })}
              autoComplete="name"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={data.email}
              onChange={(e) => setdata({ ...data, email: e.target.value })}
              autoComplete="email"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={data.password}
              onChange={(e) => setdata({ ...data, password: e.target.value })}
              autoComplete="new-password"
              required
            />
          </div>

          <button className="auth-button" type="submit">
            Register
          </button>
        </form>
        <div className="auth-alt">
          Already have an account?{" "}
          <Link className="auth-link" to="/login">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
