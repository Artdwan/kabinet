import { useState } from "react";
import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { useToast } from "../../services/ToastContext";
import { Switch } from "../../components/Switch";

export function SettingsPage() {
  const { store, account, logout } = useStore();
  const actions = useActions();
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  const parentLink = account ? `${window.location.origin}/auth?linkChild=${account.id}` : "";

  const copyId = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(parentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show("Не удалось скопировать — выделите ссылку вручную", "bad");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <div className="card">
        <div className="card-title">{account?.name} {account?.lastName}</div>
        <div className="card-meta">{account?.extra}</div>
      </div>

      {account?.role === "student" && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 15 }}>Ссылка для родителей</div>
          <p className="card-body" style={{ margin: 0 }}>
            Отправьте эту ссылку родителю — по ней его аккаунт автоматически привяжется к вашему при регистрации.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ padding: "6px 10px", background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", fontSize: 12.5, wordBreak: "break-all" }}>
              {parentLink}
            </code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyId}>
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        </div>
      )}

      {store.settings && account?.role === "student" && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 15 }}>Параметры</div>
          <Switch checked={store.settings.instantCheck} onChange={(v) => actions.updateSettings({ instantCheck: v })} label="Мгновенная проверка ответов" />
          <Switch checked={store.settings.reduceMotion} onChange={(v) => actions.updateSettings({ reduceMotion: v })} label="Уменьшить анимации" />
          <Switch checked={store.settings.compactCards} onChange={(v) => actions.updateSettings({ compactCards: v })} label="Компактные карточки" />
        </div>
      )}

      <p className="card-meta">
        Прогресс, ответы, черновики и результаты тестов хранятся на сервере и синхронизированы между
        устройствами.
      </p>

      <div>
        <button type="button" className="btn btn-danger" onClick={logout}>
          Выйти
        </button>
      </div>
    </div>
  );
}
