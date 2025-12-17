import axios from "axios";
import { createContext, useState, useEffect } from "react";

// Set axios defaults for consistency
axios.defaults.baseURL = "http://localhost:6969";
axios.defaults.withCredentials = true;

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get("/api/profile");
        setUser(data);
      } catch (error) {
        console.log(
          "Not authenticated or profile fetch failed:",
          error.response?.data?.error || error.message
        );
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}
