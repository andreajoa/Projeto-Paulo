import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Trail,
  VideoLesson,
  addTrailVideo,
  completeVideo,
  getTrails,
  getTrailVideos
} from "../api";
import { useAuth } from "../auth";

type RouteParams = {
  trailId: string;
};

function getYouTubeEmbedUrl(url: string) {
  const idMatch = url.match(/v=([^&]+)/);
  if (!idMatch) {
    return url;
  }
  const id = idMatch[1];
  return `https://www.youtube.com/embed/${id}`;
}

function TrailVideosPage() {
  const { trailId } = useParams<RouteParams>();
  const { user, refresh } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [videos, setVideos] = useState<VideoLesson[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDuration, setNewDuration] = useState("10");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!trailId) {
      return;
    }
    let active = true;
    Promise.all([getTrails(), getTrailVideos(trailId)])
      .then(([trailsResponse, videosResponse]) => {
        if (!active) {
          return;
        }
        const foundTrail = trailsResponse.trails.find((t) => t.id === trailId);
        if (foundTrail) {
          setTrail(foundTrail);
        }
        setVideos(videosResponse.videos);
        if (videosResponse.videos.length > 0) {
          setSelectedVideo(videosResponse.videos[0]);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar as aulas em vídeo.");
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
  }, [trailId]);

  async function handleAddVideo(event: FormEvent) {
    event.preventDefault();
    if (!trailId) {
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const created = await addTrailVideo(trailId, {
        title: newTitle,
        url: newUrl,
        duration_minutes: Number(newDuration || 0)
      });
      setVideos((current) => [created, ...current]);
      setSelectedVideo((current) => current ?? created);
      setNewTitle("");
      setNewUrl("");
      setNewDuration("10");
    } catch {
      setSaveError("Não foi possível salvar. Confira o link e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteSelected() {
    if (!selectedVideo) {
      return;
    }
    setCompleting(true);
    try {
      await completeVideo(selectedVideo.id);
      setVideos((current) =>
        current.map((v) => (v.id === selectedVideo.id ? { ...v, completed: true } : v))
      );
      setSelectedVideo((current) => (current ? { ...current, completed: true } : current));
      await refresh();
    } catch {
      setError("Não foi possível marcar como concluído.");
    } finally {
      setCompleting(false);
    }
  }

  const embedUrl = useMemo(() => {
    if (!selectedVideo) {
      return null;
    }
    if (selectedVideo.provider === "youtube") {
      return getYouTubeEmbedUrl(selectedVideo.url);
    }
    return selectedVideo.url;
  }, [selectedVideo]);

  if (!trailId) {
    return (
      <section className="page center">
        <p>Trilha não encontrada.</p>
      </section>
    );
  }

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

  if (!trail) {
    return (
      <section className="page center">
        <p>Trilha não encontrada.</p>
      </section>
    );
  }

  return (
    <section className="page fade-in">
      <div className="trail-videos-header">
        <div>
          <p className="trail-breadcrumb">
            <Link to="/trilhas">Trilhas</Link> / {trail.title}
          </p>
          <h1>{trail.title}</h1>
          <p>{trail.format}</p>
        </div>
      </div>
      {user?.is_admin && (
        <div className="video-add-card">
          <h2>Adicionar aula em vídeo</h2>
          <form className="video-add-form" onSubmit={handleAddVideo}>
            <label>
              Título
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Comunicação com o Coração"
                required
              />
            </label>
            <label>
              Link do vídeo
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
            </label>
            <label>
              Duração (min)
              <input
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar vídeo"}
            </button>
            {saveError && <p className="form-error">{saveError}</p>}
          </form>
        </div>
      )}
      <div className="trail-videos-layout">
        <div className="trail-video-player">
          {selectedVideo && embedUrl && (
            <div className="player-stack">
              <iframe
                title={selectedVideo.title}
                src={embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              {user && (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={Boolean(selectedVideo.completed) || completing}
                  onClick={handleCompleteSelected}
                >
                  {selectedVideo.completed
                    ? "Concluído"
                    : completing
                      ? "Salvando..."
                      : "Marcar como concluído"}
                </button>
              )}
            </div>
          )}
          {!selectedVideo && (
            <p>Não há vídeos cadastrados para esta trilha ainda.</p>
          )}
        </div>
        <aside className="trail-video-list">
          <h2>Aulas em vídeo</h2>
          <ul>
            {videos.map((video) => (
              <li key={video.id}>
                <button
                  type="button"
                  className={
                    selectedVideo && selectedVideo.id === video.id
                      ? "video-item active"
                      : "video-item"
                  }
                  onClick={() => setSelectedVideo(video)}
                >
                  <span className="video-title">
                    {video.completed ? "✓ " : ""}
                    {video.title}
                  </span>
                  <span className="video-duration">
                    ⏱️ {video.duration_minutes} min
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export default TrailVideosPage;
