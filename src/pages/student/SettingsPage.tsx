import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { Switch } from "../../components/Switch";

export function SettingsPage() {
  const { store, mutate, reset } = useStore();
  const actions = useActions();
  const account = store.account;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <div className="card">
        <div className="card-title">{account.name} {account.lastName}</div>
        <div className="card-meta">{account.extra}</div>
      </div>

      <div className="card">
        <div className="card-title" style={{ fontSize: 15 }}>Параметры</div>
        <Switch checked={store.settings.instantCheck} onChange={(v) => actions.updateSettings({ instantCheck: v })} label="Мгновенная проверка ответов" />
        <Switch checked={store.settings.reduceMotion} onChange={(v) => actions.updateSettings({ reduceMotion: v })} label="Уменьшить анимации" />
        <Switch checked={store.settings.compactCards} onChange={(v) => actions.updateSettings({ compactCards: v })} label="Компактные карточки" />
      </div>

      <p className="card-meta">
        Прогресс, ответы, черновики и результаты тестов хранятся локально в браузере. В рабочем приложении
        это место занимает серверное хранилище и авторизация.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-secondary" onClick={reset}>
          Сбросить демо-данные
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() =>
            mutate((d) => {
              d.auth = false;
            })
          }
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
