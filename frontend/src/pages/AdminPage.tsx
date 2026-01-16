import { FormEvent, useEffect, useState } from "react";
import { Trail, adminCreateTrail, getTrails } from "../api";
import { useAuth } from "../auth";

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [trailId, setTrailId] = useState("");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📌");
  const [format, setFormat] = useState("");
  const [minWeeks, setMinWeeks] = useState("4");
  const [maxWeeks, setMaxWeeks] = useState("4");
  const [modules, setModules] = useState("");

  useEffect(() => {
    let active = true;
    getTrails()
      .then((res) => {
        if (active) {
          setTrails(res.trails);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar as trilhas.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreateTrail(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const modulesList = modules
        .split("\n")
        .map((m) => m.trim())
        .filter(Boolean);
      const response = await adminCreateTrail({
        id: trailId.trim(),
        title: title.trim(),
        icon: icon.trim(),
        format: format.trim(),
        duration_weeks_min: Number(minWeeks || 0),
        duration_weeks_max: Number(maxWeeks || 0),
        modules: modulesList
      });
      setTrails((current) => [response.trail, ...current]);
      setTrailId("");
      setTitle("");
      setFormat("");
      setModules("");
      setMinWeeks("4");
      setMaxWeeks("4");
    } catch {
      setFormError("Não foi possível criar a trilha.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <section className="page center">
        <div className="spinner" />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page center">
        <p>Faça login para acessar o painel.</p>
      </section>
    );
  }

  if (!user.is_admin) {
    return (
      <section className="page center">
        <p>Este painel é somente para administradores.</p>
      </section>
    );
  }

  return (
    <section className="page fade-in">
      <h1>Painel admin</h1>
      <div className="admin-grid">
        <div className="admin-card">
          <h2>Criar trilha</h2>
          <form className="admin-form" onSubmit={handleCreateTrail}>
            <label>
              ID
              <input value={trailId} onChange={(e) => setTrailId(e.target.value)} required />
            </label>
            <label>
              Título
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              Ícone
              <input value={icon} onChange={(e) => setIcon(e.target.value)} />
            </label>
            <label>
              Formato
              <input value={format} onChange={(e) => setFormat(e.target.value)} required />
            </label>
            <label>
              Semanas mín.
              <input value={minWeeks} onChange={(e) => setMinWeeks(e.target.value)} inputMode="numeric" />
            </label>
            <label>
              Semanas máx.
              <input value={maxWeeks} onChange={(e) => setMaxWeeks(e.target.value)} inputMode="numeric" />
            </label>
            <label className="admin-form-full">
              Módulos (1 por linha)
              <textarea value={modules} onChange={(e) => setModules(e.target.value)} rows={6} />
            </label>
            <button className="btn btn-primary admin-form-full" disabled={submitting} type="submit">
              {submitting ? "Criando..." : "Criar trilha"}
            </button>
            {formError && <p className="form-error admin-form-full">{formError}</p>}
          </form>
        </div>
        <div className="admin-card">
          <h2>Trilhas existentes</h2>
          {error && <p className="form-error">{error}</p>}
          <ul className="admin-list">
            {trails.map((trail) => (
              <li key={trail.id}>
                <span className="admin-list-title">
                  {trail.icon} {trail.title}
                </span>
                <span className="admin-list-sub">{trail.id}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default AdminPage;

