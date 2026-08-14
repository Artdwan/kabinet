import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { Switch } from "../../components/Switch";

export function SettingsPage() {
  const { store, account, logout } = useStore();
  const actions = useActions();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <div className="card">
        <div className="card-title">{account?.name} {account?.lastName}</div>
        <div className="card-meta">{account?.extra}</div>
      </div>

      <div className="card">
        <div className="card-title" style={{ fontSize: 15 }}>Параметры</div>
        <Switch checked={store.settings.instantCheck} onChange={(v) => actions.updateSettings({ instantCheck: v })} label="Мгновенная проверка ответов" />
        <Switch checked={store.settings.reduceMotion} onChange={(v) => actions.updateSettings({ reduceMotion: v })} label="Уменьшить анимации" />
        <Switch checked={store.settings.compactCards} onChange={(v) => actions.updateSettings({ compactCards: v })} label="Компактные карточки" />
      </div>

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
