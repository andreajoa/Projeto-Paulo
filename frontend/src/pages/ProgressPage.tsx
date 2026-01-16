import { useEffect, useState } from "react";
import { ProgressResponse, getProgress } from "../api";
import { useAuth } from "../auth";

function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    getProgress()
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar seu progresso.");
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
  }, [user, authLoading]);

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
        <p>Faça login para ver seu progresso.</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="page center">
        <p>{error ?? "Erro inesperado."}</p>
      </section>
    );
  }

  return (
    <section className="page fade-in">
      <h1>Seu progresso</h1>
      <div className="progress-grid">
        <div className="metric-card">
          <div className="metric-value">{data.user.xp}</div>
          <div className="metric-label">XP total</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{data.user.streak}</div>
          <div className="metric-label">Streak (dias)</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{data.completed_videos}</div>
          <div className="metric-label">Vídeos concluídos</div>
        </div>
      </div>
      <div className="progress-card">
        <h2>Por trilha</h2>
        {data.enrolled_trails.length === 0 && (
          <p>Você ainda não se inscreveu em nenhuma trilha.</p>
        )}
        {data.enrolled_trails.map((trailId) => {
          const stats = data.per_trail[trailId];
          const pct =
            stats && stats.total_videos > 0
              ? Math.round((stats.completed_videos / stats.total_videos) * 100)
              : 0;
          return (
            <div key={trailId} className="progress-row">
              <div className="progress-row-title">{trailId}</div>
              <div className="progress-row-bar">
                <div className="progress-row-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-row-value">
                {stats?.completed_videos ?? 0}/{stats?.total_videos ?? 0}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ProgressPage;

