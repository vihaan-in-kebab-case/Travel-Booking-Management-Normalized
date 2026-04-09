import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login/admin", { replace: true });
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <p className="eyebrow">Operations</p>
        <h2>Admin Panel</h2>
        {user && (
          <NavLink to="/admin/profile" className="user-pill user-pill--link">
            {user.name || user.full_name || user.display_user_id}
          </NavLink>
        )}
        <nav>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/operators">Operators</NavLink>
          <NavLink to="/admin/locations">Locations</NavLink>
          <NavLink to="/admin/vehicles">Vehicles</NavLink>
          <NavLink to="/admin/routes">Routes</NavLink>
          <NavLink to="/admin/bookings">Bookings</NavLink>
          <NavLink to="/admin/payments">Payments</NavLink>
          <NavLink to="/admin/cancellations">Cancellations</NavLink>
        </nav>
        <button type="button" className="ghost-button" onClick={handleLogout}>
          Logout
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
