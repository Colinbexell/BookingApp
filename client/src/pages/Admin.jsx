import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { UserContext } from "../../context/userContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";

import { API_BASE_URL } from "../../config";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

const Admin = () => {
  const { user, setUser, loading } = useContext(UserContext);
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px",
        }}
      >
        <h1>Admin Page</h1>
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

      <div style={{ padding: "20px" }}>
        <p>
          Welcome, <strong>{user.name}</strong>! You're logged in as a{" "}
          <strong>{user.role}</strong>.
        </p>

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f8f9fa",
            borderRadius: "5px",
          }}
        >
          <h3>User Information:</h3>
          <p>
            <strong>ID:</strong> {user.id}
          </p>
          <p>
            <strong>Name:</strong> {user.name}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Role:</strong> {user.role}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Admin;
