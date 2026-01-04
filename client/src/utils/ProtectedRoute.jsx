import { Navigate } from "react-router-dom";
import Loader from "../components/loader/Loader";
import { useState } from "react";

const ProtectedRoute = ({ children, roles }) => {
  const [user, setuser] = useState(
    JSON.parse(localStorage.getItem("userData"))
  );

  // Redirect if not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If roles are defined, check if user role is allowed
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
