import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../../context/userContext";
import Loader from "../components/loader/Loader";

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useContext(UserContext);

  // Loading state
  if (loading) {
    return (
      <div>
        <Loader />
      </div>
    );
  }

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
