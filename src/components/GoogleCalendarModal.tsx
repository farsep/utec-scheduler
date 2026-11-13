import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  LayoutGrid,
  Layers,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
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
  getScheduleGoogleColorMap,
  GOOGLE_CALENDAR_COLORS,
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

const ALARM_SEGMENTS = [
  { value: 0, label: 'Sin alarma' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min ★' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' }
];

const formatReminderPhrase = (minutes: number): string => {
  if (minutes === 60) return '1 hora antes';
  return `${minutes} minutos antes`;
};

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
  const [reminderMinutes, setReminderMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('utec_reminder_minutes');
    return saved !== null ? Number(saved) : 15;
  });
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
        colorMode,
        undefined,
        reminderMinutes
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

  const handleSelectReminder = (minutes: number) => {
    setReminderMinutes(minutes);
    localStorage.setItem('utec_reminder_minutes', String(minutes));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card grafton-gcal-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Conectar a Google Calendar"
        style={{
          maxWidth: '580px',
          width: '94%',
          backgroundColor: '#F2F0EC',
          color: '#141416',
          border: '2px solid #18181A',
          borderTop: '4px solid #18181A',
          borderRadius: '0px',
          boxShadow: '6px 6px 0px #18181A',
          padding: '20px',
          gap: '14px'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1.5px solid #18181A'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0px',
                backgroundColor: '#DCD9D2',
                border: '1.5px solid #18181A',
                color: '#141416',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              [31]
            </div>
            <div>
              <h3
                className="modal-title"
                style={{
                  fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#141416',
                  margin: 0
                }}
              >
                Conectar a Google Calendar
              </h3>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  color: '#4A4946',
                  marginTop: '2px'
                }}
              >
                {isConsolidado ? 'Sincronizar directamente las clases de tu Consolidado' : `Sincronizar opción (${optionName})`}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="grafton-gcal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Google Connection Status Card */}
        <div
          style={{
            backgroundColor: '#FAF9F5',
            border: '1.5px solid #18181A',
            borderLeft: '4px solid #00779E',
            borderRadius: '0px',
            padding: '14px 16px',
            boxShadow: '2px 2px 0px rgba(24, 24, 26, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {auth ? (
            <div className="export-card-row" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '0px',
                    backgroundColor: '#DCD9D2',
                    border: '1px solid #18181A',
                    color: '#00779E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontSize: '13.5px', fontWeight: 700, color: '#141416' }}>
                    Cuenta de Google Conectada
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#4A4946', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auth.userEmail || 'Permisos de Google Calendar otorgados'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#DCD9D2',
                  color: '#141416',
                  border: '1px solid #18181A',
                  borderRadius: '0px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0px #18181A',
                  flexShrink: 0
                }}
                title="Desconectar cuenta"
              >
                <LogOut size={13} />
                <span>Desconectar</span>
              </button>
            </div>
          ) : (
            <div className="export-card-row" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '0px',
                    backgroundColor: '#DCD9D2',
                    border: '1px solid #18181A',
                    color: '#00779E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontSize: '14px', fontWeight: 700, color: '#141416' }}>
                    Conexión Directa con Google
                  </div>
                  <div style={{ fontSize: '12px', color: '#4A4946', marginTop: '2px', lineHeight: 1.4 }}>
                    Agrega y edita tus clases directamente en tu Google Calendar sin archivos intermedios.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading}
                className="grafton-gcal-connect-btn"
              >
                {loading ? <RefreshCw size={14} className="spin-icon" /> : 'Conectar Google'}
              </button>
            </div>
          )}
        </div>

        {/* Error Alert & OAuth Guidance */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#FAF9F5',
              border: '1.5px solid #18181A',
              borderLeft: '4px solid #D9381E',
              borderRadius: '0px',
              padding: '12px 14px',
              fontSize: '12px',
              color: '#141416',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {/popup|closed|ventana/i.test(errorMessage) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8A1C0E', fontWeight: 600 }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>Cerraste la ventana emergente antes de conectar tu cuenta de Google.</span>
              </div>
            ) : /Google Calendar API|SERVICE_DISABLED/i.test(errorMessage) ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '12.5px', color: '#8A1C0E' }}>
                  <AlertCircle size={16} />
                  <span>La API de Google Calendar está deshabilitada en tu proyecto de Google Cloud</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px', color: '#4A4946', lineHeight: 1.45 }}>
                  <span>
                    Para que tu aplicación pueda crear el calendario y agregar tus clases, debes habilitar la <strong>Google Calendar API</strong> en Google Cloud Console (solo toma 1 clic).
                  </span>
                  <a
                    href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=787795729132"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: '#18181A',
                      color: '#F2F0EC',
                      border: '1px solid #18181A',
                      borderRadius: '0px',
                      padding: '8px 14px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '2px 2px 0px #00779E'
                    }}
                  >
                    <ExternalLink size={13} />
                    Habilitar Google Calendar API en Google Cloud
                  </a>
                  <span style={{ fontSize: '11px', color: '#5A5852' }}>
                    Una vez que hagas clic en <strong>"Habilitar"</strong> en Google Cloud, espera 1 minuto y vuelve a presionar <em>"Sincronizar Horario a Google Calendar"</em>.
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '11.5px', color: '#4A4946', lineHeight: 1.45 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '12.5px', color: '#8A1C0E', marginBottom: '4px' }}>
                  <AlertCircle size={16} />
                  <span>Error de Google Calendar</span>
                </div>
                <p style={{ margin: '0 0 6px 0', color: '#8A1C0E', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{errorMessage}</p>
                <strong>Nota técnica:</strong> Google requiere que la URL de origen de tu aplicación esté autorizada en Google Cloud.
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li><strong>Opción A:</strong> Usa tu propio <em>Google OAuth Client ID</em> en <em>Configuración avanzada</em> abajo.</li>
                  <li><strong>Opción B:</strong> Usa los enlaces de adición manual web individuales sin permisos OAuth.</li>
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
              backgroundColor: '#FAF9F5',
              border: '1.5px solid #18181A',
              borderLeft: '4px solid #00779E',
              borderRadius: '0px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#141416', fontWeight: 700 }}>
              <CheckCircle2 size={17} color="#00779E" />
              <span>{syncResult.message}</span>
            </div>
            {syncResult.calendarUrl && (
              <a
                href={syncResult.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  alignSelf: 'flex-start',
                  padding: '6px 14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#18181A',
                  color: '#F2F0EC',
                  border: '1px solid #18181A',
                  borderRadius: '0px',
                  boxShadow: '2px 2px 0px #00779E'
                }}
              >
                <ExternalLink size={13} />
                Abrir Google Calendar
              </a>
            )}
          </div>
        )}

        {/* Color Scheme Switcher & Orthogonal Course Color Chips */}
        <div
          style={{
            backgroundColor: '#EAE7E1',
            border: '1px solid #C6C3BB',
            borderLeft: '3px solid #18181A',
            borderRadius: '0px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <label
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10.5px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#141416'
            }}
          >
            Esquema de colores para los eventos de Google Calendar:
          </label>
          <div className="export-color-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setColorMode('prefix')}
              className={`grafton-gcal-mode-btn ${colorMode === 'prefix' ? 'is-active' : ''}`}
            >
              <LayoutGrid size={14} />
              <span>Por categoría de carrera (CS, CC...)</span>
            </button>
            <button
              type="button"
              onClick={() => setColorMode('course')}
              className={`grafton-gcal-mode-btn ${colorMode === 'course' ? 'is-active' : ''}`}
            >
              <Layers size={14} />
              <span>Un color único por cada curso</span>
            </button>
          </div>

          {/* Live Google Calendar Color Preview Chips (0px orthogonal tags) */}
          {selectedCoursesList.length > 0 && (() => {
            const courseCodes = selectedCoursesList.map(item => item.course!.code);
            const gcalColorMap = getScheduleGoogleColorMap(courseCodes, colorMode);

            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '8px', borderTop: '1px solid #C6C3BB' }}>
                {selectedCoursesList.map((item) => {
                  const c = item.course!;
                  const gColorId = gcalColorMap[c.code] || '7';
                  const colorInfo = GOOGLE_CALENDAR_COLORS[gColorId] || GOOGLE_CALENDAR_COLORS['7'];
                  const cleanColorName = colorInfo.name
                    .replace(/\s*\(([^)]+)\)/g, ' · $1')
                    .toUpperCase();

                  return (
                    <span
                      key={c.code}
                      style={{
                        borderRadius: '0px',
                        backgroundColor: '#F2F0EC',
                        border: '1px solid #18181A',
                        padding: '3px 8px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: '#141416',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title={`${c.name} - ${colorInfo.name}`}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '0px',
                          border: '1px solid #18181A',
                          backgroundColor: colorInfo.hex,
                          flexShrink: 0
                        }}
                      />
                      <span>{c.code} · {cleanColorName}</span>
                    </span>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Unified Grafton Swiss Alarm Control Block */}
        <div
          style={{
            backgroundColor: '#EAE7E1',
            border: '1px solid #C6C3BB',
            borderLeft: '3px solid #00779E',
            borderRadius: '0px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#141416'
              }}
            >
              <Clock size={13} color="#141416" />
              <span>TIEMPO DE RECORDATORIO (GOOGLE CALENDAR)</span>
            </div>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                backgroundColor: '#FAF9F5',
                border: '1px solid #18181A',
                color: '#141416'
              }}
            >
              {reminderMinutes === 0 ? 'DESACTIVADO' : `ACTIVO · -${reminderMinutes} MIN`}
            </span>
          </div>

          <div
            role="group"
            aria-label="Tiempo de recordatorio en Google Calendar"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '4px'
            }}
          >
            {ALARM_SEGMENTS.map((seg) => {
              const isSelected = reminderMinutes === seg.value;
              return (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => handleSelectReminder(seg.value)}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '0px',
                    border: isSelected ? '1px solid #18181A' : '1px solid #C6C3BB',
                    borderBottom: isSelected ? '3px solid #00779E' : '1px solid #C6C3BB',
                    backgroundColor: isSelected ? '#18181A' : '#F2F0EC',
                    color: isSelected ? '#F2F0EC' : '#4A4946',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    transition: 'all 120ms ease'
                  }}
                >
                  {seg.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              backgroundColor: '#F2F0EC',
              border: '1px solid #C6C3BB',
              borderRadius: '0px',
              padding: '6px 10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10.5px',
              color: '#4A4946',
              lineHeight: 1.4
            }}
          >
            {reminderMinutes === 0 ? (
              <span>Sin alarma previa: las sesiones se sincronizarán sin notificación automática en Google Calendar.</span>
            ) : (
              <span>
                Google Calendar enviará una notificación automática{' '}
                <strong style={{ color: '#141416' }}>{formatReminderPhrase(reminderMinutes)}</strong> de cada sesión.
              </span>
            )}
          </div>
        </div>

        {/* Primary CTA Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2px' }}>
          <button
            type="button"
            onClick={handleSync}
            disabled={loading || selectedCoursesList.length === 0}
            className="grafton-gcal-sync-btn"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="spin-icon" />
                <span>Sincronizando con Google Calendar...</span>
              </>
            ) : (
              <>
                <Calendar size={16} />
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
              type="button"
              onClick={handleClearEvents}
              disabled={clearing || loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#FAF9F5',
                border: '1px solid #18181A',
                borderLeft: '3px solid #D9381E',
                borderRadius: '0px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                fontWeight: 700,
                color: '#8A1C0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              {clearing ? <RefreshCw size={14} className="spin-icon" /> : <Trash2 size={14} />}
              <span>Limpiar / Eliminar clases sincronizadas previamente</span>
            </button>
          )}
        </div>

        {/* Web Intent Links Accordion / Fallback */}
        <div style={{ borderTop: '1px solid #C6C3BB', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={() => setShowWebIntents(!showWebIntents)}
            style={{
              width: '100%',
              backgroundColor: '#DCD9D2',
              border: '1px solid #18181A',
              borderRadius: '0px',
              padding: '8px 12px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#141416',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <span>
              {showWebIntents
                ? 'Ocultar enlaces de adición manual web'
                : '¿Prefieres agregar clases individualmente sin permisos OAuth?'}
            </span>
            {showWebIntents ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {showWebIntents && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#4A4946' }}>
                Haz clic en cualquier sesión para abrir la creación oficial en Google Calendar:
              </div>
              {selectedCoursesList.map(({ course, secNum, section }) => (
                <div
                  key={course!.code}
                  style={{
                    backgroundColor: '#FAF9F5',
                    border: '1px solid #18181A',
                    borderRadius: '0px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px' }}>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        backgroundColor: '#18181A',
                        color: '#F2F0EC',
                        padding: '2px 6px',
                        fontSize: '10px',
                        marginRight: '6px'
                      }}
                    >
                      {course!.code}
                    </span>
                    <span style={{ fontWeight: 700, color: '#141416' }}>{course!.name}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#5A5852', marginLeft: '6px' }}>
                      · Sección {secNum.replace(/\s*\(.*/, '')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {section!.sessions.map((sess, idx) => {
                      const url = generateGoogleCalendarWebIntentUrl(course!, secNum, sess);
                      const isLab = /LABORATORIO|LAB|TALLER|PR[ÁA]C/i.test(sess.sessionGroup);
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grafton-gcal-session-link"
                          style={{
                            borderLeft: `3px solid ${isLab ? '#0D7A4E' : '#00779E'}`
                          }}
                        >
                          <ExternalLink size={11} />
                          <span>{sess.sessionGroup}: {sess.day} {sess.startTime}-{sess.endTime}</span>
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
        <div style={{ borderTop: '1px solid #C6C3BB', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setShowClientIdInput(!showClientIdInput)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4A4946',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <SlidersHorizontal size={13} color="#4A4946" />
            <span>Configuración avanzada (Google OAuth Client ID)</span>
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
                  padding: '8px 10px',
                  fontSize: '11px',
                  borderRadius: '0px',
                  border: '1px solid #18181A',
                  backgroundColor: '#FFFFFF',
                  color: '#141416',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#5A5852' }}>
                Si utilizas tu propio proyecto de Google Cloud, asegúrate de autorizar el origen actual en tu consola.
              </span>
            </div>
          )}
        </div>

        {/* Legal & Policy Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', color: '#4A4946', paddingTop: '4px' }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#4A4946', textDecoration: 'none' }}>
            Política de Privacidad
          </a>
          <span>·</span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#4A4946', textDecoration: 'none' }}>
            Términos del Servicio
          </a>
        </div>
      </div>
    </div>
  );
};
