import axios from "axios";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./utils/ProtectedRoute";

// Imported paths
import Home from "./pages/Home/Home";
import Dev from "./pages/Dev/Dev";
import Login from "./pages/Authentication/Login";
import Register from "./pages/Authentication/Register";
import Admin from "./pages/Admin";

axios.defaults.baseURL = "http://localhost:6969";
axios.defaults.withCredentials = true;

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/developer"
          element={
            <ProtectedRoute roles={["dev"]}>
              <Dev />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
