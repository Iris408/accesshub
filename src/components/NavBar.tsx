function Navbar() {
  const path = window.location.pathname;

  return (
    <div className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">AH</span>
        <span>AccessHub</span>
      </div>

      <div className="navbar-links">
        <a className={path === "/" ? "active" : ""} href="/">
          Login
        </a>

        <a
          className={path === "/dashboard" ? "active" : ""}
          href="/dashboard"
        >
          Dashboard
        </a>

        <a
          className={path === "/admin" ? "active" : ""}
          href="/admin"
        >
          Admin
        </a>
      </div>
    </div>
  );
}

export default Navbar;