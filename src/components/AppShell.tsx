import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useStore } from "../services/StoreContext";
import { useActions } from "../services/actions";
import { navForRole } from "./nav";
import { HOMEWORKS } from "../data/content";
import { fmtDate, homeworkProgress } from "../services/mockApi";
import { usePageTitle } from "./usePageTitle";
import { api } from "../services/apiClient";

export function AppShell() {
  const { store, account, logout } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (account?.role !== "teacher") return;
    api
      .get<unknown[]>("/teacher/review-queue")
      .then((q) => setReviewCount(q.length))
      .catch(() => setReviewCount(0));
  }, [account?.role]);

  const homeworkBadge = useMemo(() => {
    if (account?.role !== "student") return 0;
    return HOMEWORKS.filter((hw) => {
      const st = store.homework[hw.id];
      const p = homeworkProgress(hw, st);
      const submitted = Boolean(st?.submittedAt);
      if (submitted) return false;
      return p.done < p.total;
    }).length;
  }, [account?.role, store.homework]);

  const items = navForRole(account?.role ?? "student", { homework: homeworkBadge, review: reviewCount });
  const { title, crumbs } = usePageTitle();

  const unread = store.notifications.filter((n) => !n.read);

  const markAllRead = () => {
    actions.markNotificationsRead(store.notifications.map((n) => n.id));
  };

  const openNotification = (kind: string, homeworkId?: string | null) => {
    setNotifOpen(false);
    if ((kind === "feedback" || kind === "assign") && homeworkId) navigate(`/homework/${homeworkId}`);
    else navigate("/homework");
  };

  const initials = `${account?.name?.[0] || ""}${account?.lastName?.[0] || ""}`;

  return (
    <div data-shell>
      <aside
        data-sidebar
        style={{
          borderRight: "1px solid var(--color-line)",
          flexDirection: "column",
          gap: 4,
          padding: "18px 10px",
        }}
      >
        <Link to="/" style={{ textDecoration: "none", padding: "0 10px 18px", display: "block" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19, color: "var(--color-text)" }}>
            Кабинет
          </div>
          <div data-sidelabel style={{ fontSize: 11, color: "var(--color-text-3)" }}>
            подготовка к ЦТ
          </div>
        </Link>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 10px",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              color: isActive ? "var(--color-accent)" : "var(--color-text-2)",
              background: isActive ? "var(--color-accent-100)" : "transparent",
              fontSize: 13.5,
              position: "relative",
            })}
          >
            <item.icon size={18} style={{ flex: "none" }} />
            <span data-sidelabel style={{ flex: 1 }}>{item.label}</span>
            {!!item.badge && (
              <span
                data-sidelabel
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: "var(--color-accent)",
                  color: "#1a140c",
                  borderRadius: 999,
                  minWidth: 18,
                  height: 18,
                  display: "grid",
                  placeItems: "center",
                  padding: "0 5px",
                }}
              >
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 24px",
            height: "var(--header-h)",
            borderBottom: "1px solid var(--color-line)",
            position: "sticky",
            top: 0,
            background: "var(--color-bg)",
            zIndex: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {crumbs.length > 0 && (
              <div className="card-meta" style={{ marginBottom: 2 }}>
                {crumbs.join(" / ")}
              </div>
            )}
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </div>
          </div>

          {account?.role === "student" && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="btn btn-icon btn-secondary"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                aria-label="Уведомления"
                style={{ position: "relative" }}
              >
                <Bell size={17} />
                {unread.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--color-bad)",
                    }}
                  />
                )}
              </button>
              {notifOpen && (
                <div
                  className="card elev-lg"
                  style={{ position: "absolute", right: 0, top: 44, width: 320, zIndex: 20, padding: 8, gap: 0 }}
                >
                  <div style={{ padding: "6px 8px", fontSize: 12.5, fontWeight: 600 }}>Уведомления</div>
                  {store.notifications.length === 0 && <div className="card-meta" style={{ padding: "8px" }}>Пока нет уведомлений</div>}
                  {store.notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openNotification(n.kind, n.homeworkId)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 8px",
                        borderRadius: 8,
                        borderLeft: !n.read ? "2px solid var(--color-accent)" : "2px solid transparent",
                        background: "transparent",
                        fontSize: 12.5,
                        color: "var(--color-text-2)",
                      }}
                    >
                      <div style={{ color: "var(--color-text)" }}>{n.text}</div>
                      <div className="card-meta" style={{ marginTop: 3 }}>{fmtDate(n.date)}</div>
                    </button>
                  ))}
                  {store.notifications.length > 0 && (
                    <>
                      <div className="hr" style={{ margin: "6px 0" }} />
                      <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={markAllRead}>
                        Отметить всё прочитанным
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, cursor: "pointer", padding: 4 }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--color-accent-200)",
                  color: "var(--color-accent-800)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                {initials}
              </span>
              <span data-hidemobile style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, color: "var(--color-text)" }}>{account?.name}</div>
                <div className="card-meta">{roleLabel(account?.role)}</div>
              </span>
              <ChevronDown size={14} style={{ color: "var(--color-text-3)" }} />
            </button>
            {profileOpen && (
              <div className="card elev-lg" style={{ position: "absolute", right: 0, top: 44, width: 200, zIndex: 20, padding: 6, gap: 2 }}>
                {account?.role === "student" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-block"
                    style={{ justifyContent: "flex-start" }}
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/settings");
                    }}
                  >
                    <SettingsIcon size={15} /> Настройки
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm btn-block"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={15} /> Выйти
                </button>
              </div>
            )}
          </div>
        </header>

        <main data-pad data-page style={{ flex: 1, width: "100%" }}>
          <Outlet />
        </main>
      </div>

      <nav
        data-mobilenav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-line)",
          justifyContent: "space-around",
          padding: "6px 4px",
          zIndex: 30,
        }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              textDecoration: "none",
              color: isActive ? "var(--color-accent)" : "var(--color-text-3)",
              fontSize: 10,
              padding: "4px 6px",
              flex: 1,
            })}
          >
            <item.icon size={18} />
            {item.shortLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function roleLabel(role: string | undefined): string {
  if (role === "teacher") return "Преподаватель";
  if (role === "parent") return "Родитель";
  return "Ученик";
}
