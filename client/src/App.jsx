import axios from "axios";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./utils/ProtectedRoute";

// Imported paths
import Home from "./pages/Home/Home";
import Book from "./pages/Book/Book";
import Login from "./pages/Authentication/Login";
import Register from "./pages/Authentication/Register";
import Admin from "./pages/Admin/Admin";

function App() {
  localStorage.setItem("selectedWorkshopId", "699987b90249daa5c2a43474");
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<Book />} />

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
