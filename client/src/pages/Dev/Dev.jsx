import React, { useEffect, useState } from "react";
import "./Dev.css";
import { useContext } from "react";
import { UserContext } from "../../../context/userContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";

import { API_BASE_URL } from "../../../config";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

const Dev = () => {
  const { user, setUser, loading } = useContext(UserContext);
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await axios.post("/api/logout");
      setUser(null);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Logout failed");
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="main">
      <div className="dev_container">
        <div></div>
        <h1 className="dev_title">Dev Page</h1>

        <div className="dev_add_user">
          <h2>Add user</h2>
          <form className="dev_add_user" onSubmit={registerUser}>
            <input
              className="normal-input"
              type="text"
              placeholder="Name"
              required
              value={data.name}
              onChange={(e) => setdata({ ...data, name: e.target.value })}
            />
            <input
              className="normal-input"
              type="email"
              placeholder="Email"
              required
              value={data.email}
              onChange={(e) => setdata({ ...data, email: e.target.value })}
            />
            <input
              className="normal-input"
              type="password"
              placeholder="Password"
              required
              value={data.password}
              onChange={(e) => setdata({ ...data, password: e.target.value })}
            />
            <select
              className="normal-input"
              name="role"
              id="role"
              value={data.role}
              onChange={(e) => setdata({ ...data, role: e.target.value })}
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="dev">Developer</option>
            </select>
            <button type="submit">Add User</button>
          </form>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ff4757",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoggingOut ? "not-allowed" : "pointer",
            opacity: isLoggingOut ? 0.7 : 1,
          }}
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
};

export default Dev;
