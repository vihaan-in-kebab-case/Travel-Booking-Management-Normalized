import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AppShell() {
  const { user, isUser, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    const loginPath = isAdmin ? "/login/admin" : "/login/user";
    logout();
    navigate(loginPath, { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to={user ? (isAdmin ? "/admin/dashboard" : "/search") : "/login/user"} className="brand">
          TravelSphere
        </NavLink>

        <nav className="topnav">
          {isUser && <NavLink to="/search">Book</NavLink>}
          {isUser && <NavLink to="/history">My Bookings</NavLink>}
          {isAdmin && <NavLink to="/admin/dashboard">Admin Panel</NavLink>}
        </nav>

        <div className="auth-actions">
          {user ? (
            <>
              <NavLink to="/profile" className="user-pill user-pill--link">
                {user.name || user.full_name || user.display_user_id}
              </NavLink>
              <button type="button" className="ghost-button" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login/user" className="ghost-button">
                User Login
              </NavLink>
              <NavLink to="/login/admin" className="ghost-button">
                Admin Login
              </NavLink>
              <NavLink to="/register" className="primary-button">
                User Sign Up
              </NavLink>
            </>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
