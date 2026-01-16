import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trail, TrailListResponse, enrollTrail, getTrails } from "../api";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";

function TrailsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTrails()
      .then((response: TrailListResponse) => {
        if (active) {
          setTrails(response.trails);
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

  if (loading) {
    return (
      <section className="page center">
        <div className="spinner" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="page center">
        <p>{error}</p>
      </section>
    );
  }

  return (
    <section className="page fade-in">
      <h1>Trilhas de desenvolvimento</h1>
      <div className="trails-grid">
        {trails.map((trail) => (
          <Link
            key={trail.id}
            to={`/trilhas/${trail.id}`}
            className="trail-card"
          >
            <div className="trail-icon">{trail.icon}</div>
            <h2>{trail.title}</h2>
            <p>{trail.format}</p>
            <p className="trail-duration">
              {trail.duration_weeks_min === trail.duration_weeks_max
                ? `${trail.duration_weeks_min} semanas`
                : `${trail.duration_weeks_min}–${trail.duration_weeks_max} semanas`}
            </p>
            <div className="trail-actions">
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!user) {
                    navigate("/login");
                    return;
                  }
                  try {
                    await enrollTrail(trail.id);
                    setTrails((current) =>
                      current.map((t) =>
                        t.id === trail.id ? { ...t, enrolled: true } : t
                      )
                    );
                  } catch {
                    setError("Não foi possível se inscrever nesta trilha.");
                  }
                }}
                disabled={trail.enrolled}
              >
                {trail.enrolled ? "Inscrito" : "Inscrever-se"}
              </button>
            </div>
            <ul className="trail-modules">
              {trail.modules.map((module) => (
                <li key={module}>{module}</li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default TrailsPage;
