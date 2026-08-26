import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, LogOut, RefreshCw, Trash2, ExternalLink, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import type { Course } from '../types/schedule';
import {
  getSavedAuth,
  requestGoogleAccessToken,
  loadGoogleGsiScript,
  logoutGoogle,
  syncScheduleToGoogleCalendar,
  clearTrackedUTECEvents,
  getOrCreateUTECCalendar,
  generateGoogleCalendarWebIntentUrl,
  type GoogleCalendarAuth,
  type SyncResult
} from '../utils/googleCalendarService';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  selectedSections: Record<string, string>;
  optionName: string;
  isConsolidado?: boolean;
}

export const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({
  isOpen,
  onClose,
  courses,
  selectedSections,
  optionName,
  isConsolidado = false
}) => {
  if (!isOpen) return null;

  const [auth, setAuth] = useState<GoogleCalendarAuth | null>(getSavedAuth());
  const [colorMode, setColorMode] = useState<'prefix' | 'course'>('prefix');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showWebIntents, setShowWebIntents] = useState(false);
  const [customClientId, setCustomClientId] = useState<string>(() => localStorage.getItem('utec_custom_client_id') || '');
  const [showClientIdInput, setShowClientIdInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAuth(getSavedAuth());
      // Preload Google Identity Services script so first click popup is not blocked
      loadGoogleGsiScript().catch(() => {});
    }
  }, [isOpen]);

  const handleConnect = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (customClientId.trim()) {
        localStorage.setItem('utec_custom_client_id', customClientId.trim());
      }
      const newAuth = await requestGoogleAccessToken(customClientId.trim() || undefined);
      setAuth(newAuth);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setErrorMessage(err.message || 'Error al conectar con Google Account.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutGoogle();
    setAuth(null);
    setSyncResult(null);
    setErrorMessage(null);
  };

  const handleSync = async () => {
    let currentAuth = auth;
    setErrorMessage(null);
    setSyncResult(null);
    setLoading(true);

    try {
      if (!currentAuth) {
        currentAuth = await requestGoogleAccessToken(customClientId.trim() || undefined);
        setAuth(currentAuth);
      }

      const result = await syncScheduleToGoogleCalendar(
        currentAuth.accessToken,
        courses,
        selectedSections,
        colorMode
      );

      setSyncResult(result);
    } catch (err: any) {
      console.error('Google Calendar Sync Error:', err);
      if (err.message && err.message.includes('401')) {
        handleLogout();
        setErrorMessage('La sesión de Google expiró. Por favor vuelve a conectar tu cuenta.');
      } else {
        setErrorMessage(err.message || 'Ocurrió un error al sincronizar con Google Calendar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearEvents = async () => {
    if (!auth) return;
    setClearing(true);
    setErrorMessage(null);
    try {
      const calId = await getOrCreateUTECCalendar(auth.accessToken);
      const count = await clearTrackedUTECEvents(auth.accessToken, calId);
      setSyncResult({
        success: true,
        eventsCreated: 0,
        eventsDeleted: count,
        calendarId: calId,
        calendarUrl: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calId)}`,
        message: `Se eliminaron ${count} clases sincronizadas de tu Google Calendar.`
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al limpiar las clases del calendario.');
    } finally {
      setClearing(false);
    }
  };

  const selectedCoursesList = Object.entries(selectedSections).map(([code, secNum]) => {
    const course = courses.find(c => c.code === code);
    const section = course?.sections.find(s => s.sectionNumber === secNum);
    return { course, secNum, section };
  }).filter(item => item.course && item.section);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(66, 133, 244, 0.3)' }}>
              <img src="/google-calendar-icon.svg" alt="Google Calendar" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>
                Conectar a Google Calendar
              </h3>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {isConsolidado ? 'Sincronizar directamente las clases de tu Consolidado' : `Sincronizar opción (${optionName})`}
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Google Connection Status Banner */}
        <div
          style={{
            background: auth ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: auth ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {auth ? (
            <div className="export-card-row" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <CheckCircle2 size={22} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Cuenta de Google Conectada
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auth.userEmail || 'Permisos de Google Calendar otorgados'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.78rem', gap: '6px', flexShrink: 0 }}
                title="Desconectar cuenta"
              >
                <LogOut size={14} />
                Desconectar
              </button>
            </div>
          ) : (
            <div className="export-card-row" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                <ShieldCheck size={22} color="#4285F4" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Conexión Directa con Google
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                    Agrega y edita tus clases directamente en tu Google Calendar sin archivos intermedios.
                  </div>
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #EA4335 100%)',
                  border: 'none',
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  flexShrink: 0
                }}
              >
                {loading ? <RefreshCw size={15} className="spin-icon" /> : 'Conectar Google'}
              </button>
            </div>
          )}
        </div>

        {/* Error Alert & OAuth Guidance */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '14px 16px',
              fontSize: '0.8rem',
              color: '#f87171',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {/popup|closed|ventana/i.test(errorMessage) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#fca5a5' }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span>Cerraste la ventana emergente antes de conectar tu cuenta de Google.</span>
              </div>
            ) : /Google Calendar API|SERVICE_DISABLED/i.test(errorMessage) ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.86rem' }}>
                  <AlertCircle size={18} />
                  <span>La API de Google Calendar está deshabilitada en tu proyecto de Google Cloud</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <span>
                    Para que tu aplicación pueda crear el calendario y agregar tus clases, debes habilitar la <strong>Google Calendar API</strong> en Google Cloud Console (solo toma 1 clic).
                  </span>
                  <a
                    href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=787795729132"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{
                      alignSelf: 'flex-start',
                      background: '#4285F4',
                      padding: '8px 14px',
                      fontSize: '0.78rem',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '4px'
                    }}
                  >
                    <ExternalLink size={14} />
                    Habilitar Google Calendar API en Google Cloud ↗
                  </a>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Una vez que hagas clic en <strong>"Habilitar"</strong> en Google Cloud, espera 1 minuto y vuelve a presionar <em>"Sincronizar Horario a Google Calendar"</em>.
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.86rem', color: '#f87171', marginBottom: '6px' }}>
                  <AlertCircle size={18} />
                  <span>Error de Google Calendar</span>
                </div>
                <p style={{ margin: '0 0 6px 0', color: '#f87171' }}>{errorMessage}</p>
                💡 <strong>¿Por qué sucede esto?</strong> Google requiere que la URL de origen de tu aplicación (por ejemplo <code>http://localhost:4321</code> o tu dominio) esté autorizada en Google Cloud.
                <br /><br />
                <strong>Alternativas disponibles:</strong>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li><strong>Opción A:</strong> Usa tu propio <em>Google OAuth Client ID</em> ingresándolo en ⚙️ <em>Configuración avanzada</em> abajo.</li>
                  <li><strong>Opción B:</strong> Haz clic en <em>"▶ ¿Prefieres agregar clases individualmente..."</em> abajo para agregarlas con un clic directo.</li>
                  <li><strong>Opción C:</strong> Descarga el archivo <code>.ics</code> e impórtalo en Google Calendar.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Success Alert */}
        {syncResult && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              <Sparkles size={18} />
              <span>{syncResult.message}</span>
            </div>
            {syncResult.calendarUrl && (
              <a
                href={syncResult.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  alignSelf: 'flex-start',
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--accent-emerald)',
                  borderColor: 'var(--accent-emerald)'
                }}
              >
                <ExternalLink size={14} />
                Abrir Google Calendar ↗
              </a>
            )}
          </div>
        )}

        {/* Color Palette Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Esquema de colores para los eventos de Google Calendar:
          </label>
          <div className="export-color-grid">
            <button
              type="button"
              onClick={() => setColorMode('prefix')}
              style={{
                padding: '9px 12px',
                fontSize: '0.76rem',
                borderRadius: '8px',
                border: colorMode === 'prefix' ? '1px solid #4285F4' : '1px solid var(--border-color)',
                background: colorMode === 'prefix' ? 'rgba(66, 133, 244, 0.15)' : 'transparent',
                color: colorMode === 'prefix' ? '#4285F4' : 'var(--text-muted)',
                fontWeight: colorMode === 'prefix' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'center'
              }}
            >
              🎨 Por categoría de carrera (CS, CC...)
            </button>
            <button
              type="button"
              onClick={() => setColorMode('course')}
              style={{
                padding: '9px 12px',
                fontSize: '0.76rem',
                borderRadius: '8px',
                border: colorMode === 'course' ? '1px solid #4285F4' : '1px solid var(--border-color)',
                background: colorMode === 'course' ? 'rgba(66, 133, 244, 0.15)' : 'transparent',
                color: colorMode === 'course' ? '#4285F4' : 'var(--text-muted)',
                fontWeight: colorMode === 'course' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'center'
              }}
            >
              🌈 Un color único por cada curso
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          <button
            onClick={handleSync}
            disabled={loading || selectedCoursesList.length === 0}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.9rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="spin-icon" />
                <span>Sincronizando con Google Calendar...</span>
              </>
            ) : (
              <>
                <img src="/google-calendar-icon.svg" alt="Google Calendar" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                <span>
                  {isConsolidado
                    ? 'Sincronizar / Agregar Cursos de Consolidado a Google Calendar'
                    : 'Sincronizar Horario a Google Calendar'}
                </span>
              </>
            )}
          </button>

          {auth && (
            <button
              onClick={handleClearEvents}
              disabled={clearing || loading}
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.78rem',
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {clearing ? <RefreshCw size={14} className="spin-icon" /> : <Trash2 size={14} />}
              <span>Limpiar / Eliminar clases sincronizadas previamente</span>
            </button>
          )}
        </div>

        {/* Web Intent Links Accordion / Fallback */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '6px' }}>
          <button
            onClick={() => setShowWebIntents(!showWebIntents)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0'
            }}
          >
            <span>{showWebIntents ? '▼ Ocultar enlaces de adición manual web' : '▶ ¿Prefieres agregar clases individualmente sin otorgar permisos OAuth?'}</span>
          </button>

          {showWebIntents && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                Haz clic en cualquier curso para abrir la pantalla de creación oficial de Google Calendar en una nueva pestaña:
              </div>
              {selectedCoursesList.map(({ course, secNum, section }) => (
                <div
                  key={course!.code}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    [{course!.code}] {course!.name} (Sec {secNum})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {section!.sessions.map((sess, idx) => {
                      const url = generateGoogleCalendarWebIntentUrl(course!, secNum, sess);
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ExternalLink size={11} />
                          {sess.sessionGroup}: {sess.day} {sess.startTime}-{sess.endTime}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom OAuth Client ID Config Option */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setShowClientIdInput(!showClientIdInput)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0
            }}
          >
            ⚙️ Configuración avanzada (Google OAuth Client ID)
          </button>
          {showClientIdInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Ingresa tu Google OAuth Client ID personalizado"
                value={customClientId}
                onChange={e => setCustomClientId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '0.74rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text-primary)'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Si utilizas tu propio proyecto de Google Cloud, asegúrate de autorizar el origen actual en tu consola.
              </span>
            </div>
          )}
        </div>

        {/* Legal & Policy Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Política de Privacidad
          </a>
          <span>•</span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Términos del Servicio
          </a>
        </div>
      </div>
    </div>
  );
};
