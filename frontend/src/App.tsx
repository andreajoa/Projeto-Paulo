import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import DashboardPage from "./pages/DashboardPage";
import TrailsPage from "./pages/TrailsPage";
import TrailVideosPage from "./pages/TrailVideosPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProgressPage from "./pages/ProgressPage";
import AdminPage from "./pages/AdminPage";

function App() {
  const { user, loading, logout } = useAuth();
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-icon">🚀</span>
            <span className="brand-title">Jornada do Herói</span>
          </div>
          <nav className="nav">
            <NavLink to="/" className="nav-link">
              Início
            </NavLink>
            <NavLink to="/dashboard" className="nav-link">
              Dashboard
            </NavLink>
            <NavLink to="/trilhas" className="nav-link">
              Trilhas
            </NavLink>
            <NavLink to="/progresso" className="nav-link">
              Progresso
            </NavLink>
            {user?.is_admin && (
              <NavLink to="/admin" className="nav-link">
                Admin
              </NavLink>
            )}
            {!loading && !user && (
              <NavLink to="/login" className="nav-link">
                Entrar
              </NavLink>
            )}
            {!loading && user && (
              <button type="button" className="nav-link nav-button" onClick={logout}>
                Sair
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/trilhas" element={<TrailsPage />} />
          <Route path="/trilhas/:trailId" element={<TrailVideosPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/progresso" element={<ProgressPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
