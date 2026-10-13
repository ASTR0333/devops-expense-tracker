import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChartPie,
  Download,
  X,
  Pencil,
  Trash2,
  Wallet,
  ShoppingBag,
  Coffee,
  Car,
  House,
  Heart,
  Clapperboard,
  ShoppingBasket,
  MoreHorizontal,
  Check,
  LoaderCircle,
  Target,
} from "lucide-react";
import "./style.css";

const cats = {
  Продукты: { icon: ShoppingBasket, color: "#343431", bg: "#efeee9" },
  Кафе: { icon: Coffee, color: "#76756e", bg: "#efeee9" },
  Транспорт: { icon: Car, color: "#a3a199", bg: "#efeee9" },
  Покупки: { icon: ShoppingBag, color: "#595951", bg: "#efeee9" },
  Дом: { icon: House, color: "#c2bfb5", bg: "#efeee9" },
  Здоровье: { icon: Heart, color: "#8d8b83", bg: "#efeee9" },
  Развлечения: { icon: Clapperboard, color: "#d3d0c7", bg: "#efeee9" },
  Другое: { icon: MoreHorizontal, color: "#b1afa7", bg: "#efeee9" },
  Зарплата: { icon: Wallet, color: "#343431", bg: "#efeee9" },
  Подработка: { icon: Wallet, color: "#76756e", bg: "#efeee9" },
};
const money = (n) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(n / 100);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthOf = (d) => d.slice(0, 7);
const monthLabel = (m) =>
  new Date(m + "-01T12:00:00")
    .toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    .replace(" г.", "");
const dateLabel = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
const emptyItem = () => ({
  name: "",
  amount: "",
  kind: "expense",
  category: "Продукты",
  date: today(),
});
async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    let message = "Не удалось выполнить запрос";
    try {
      message = (await res.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}
function CategoryIcon({ category, size = 18 }) {
  const c = cats[category] || cats.Другое;
  const Icon = c.icon;
  return (
    <span
      className="category-icon"
      style={{ background: c.bg, color: c.color }}
    >
      <Icon size={size} />
    </span>
  );
}
function Modal({ title, subtitle, onClose, children }) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    (el.querySelector("input, select") || el.querySelector("button"))?.focus();
    const key = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const f = [
          ...el.querySelectorAll("button:not(:disabled),input,select"),
        ];
        const first = f[0],
          last = f.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          className="icon-button close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">ЛИЧНЫЕ ФИНАНСЫ</span>
        <h2 id="modal-title">{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}
function App() {
  const [items, setItems] = useState([]),
    [budget, setBudget] = useState(6000000),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [page, setPage] = useState("overview"),
    [month, setMonth] = useState(monthOf(today())),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [kind, setKind] = useState("all");
  const [form, setForm] = useState(null),
    [budgetForm, setBudgetForm] = useState(null),
    [deleting, setDeleting] = useState(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [toast, setToast] = useState("");
  const toastTimer = useRef();
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [i, b] = await Promise.all([api("/items"), api("/budget")]);
      setItems(i);
      setBudget(b.amount);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => clearTimeout(toastTimer.current);
  }, []);
  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }
  const current = useMemo(
    () => items.filter((i) => monthOf(i.date) === month),
    [items, month],
  );
  const income = current
      .filter((i) => i.kind === "income")
      .reduce((s, i) => s + i.amount, 0),
    expense = current
      .filter((i) => i.kind === "expense")
      .reduce((s, i) => s + i.amount, 0);
  const balance = items
    .filter((i) => monthOf(i.date) <= month)
    .reduce((s, i) => s + (i.kind === "income" ? i.amount : -i.amount), 0);
  const breakdown = Object.keys(cats)
    .map((name) => ({
      name,
      amount: current
        .filter((i) => i.kind === "expense" && i.category === name)
        .reduce((s, i) => s + i.amount, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const visible = current.filter(
    (i) =>
      (kind === "all" || i.kind === kind) &&
      (category === "all" || i.category === category) &&
      i.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")),
  );
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const daily = Array.from({ length: days }, (_, d) => ({
    day: d + 1,
    amount: current
      .filter((i) => i.kind === "expense" && Number(i.date.slice(-2)) === d + 1)
      .reduce((s, i) => s + i.amount, 0),
  }));
  const chartMax = Math.max(...daily.map((d) => d.amount), 10000);
  const pct = Math.round((expense / budget) * 100),
    remaining = budget - expense;
  function changeMonth(delta) {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + delta);
    if (d.getFullYear() < 2000 || d.getFullYear() > 2100) return;
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function openForm(it) {
    setFormError("");
    setForm(it ? { ...it, amount: String(it.amount / 100) } : emptyItem());
  }
  function navigate(next) {
    setPage(next);
    setQuery("");
    setKind("all");
    setCategory("all");
  }
  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function saveItem(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const { id, ...payload } = form;
      payload.amount = Math.round(
        Number(payload.amount.replace(",", ".")) * 100,
      );
      if (!Number.isSafeInteger(payload.amount) || payload.amount <= 0)
        throw new Error("Укажите корректную сумму");
      const result = await api(id ? `/items/${id}` : "/items", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setItems((old) =>
        [...old.filter((i) => i.id !== result.id), result].sort(
          (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
        ),
      );
      setMonth(monthOf(result.date));
      setForm(null);
      notify(id ? "Операция обновлена" : "Операция добавлена");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function deleteItem() {
    setSaving(true);
    setFormError("");
    try {
      await api(`/items/${deleting.id}`, { method: "DELETE" });
      setItems((i) => i.filter((x) => x.id !== deleting.id));
      setDeleting(null);
      notify("Операция удалена");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function saveBudget(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const amount = Math.round(Number(budgetForm.replace(",", ".")) * 100);
      if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new Error("Укажите корректный бюджет");
      const b = await api("/budget", {
        method: "PUT",
        body: JSON.stringify({ amount }),
      });
      setBudget(b.amount);
      setBudgetForm(null);
      notify("Бюджет обновлён");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }
  function exportCSV() {
    const escape = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const csv =
      "\ufeff" +
      [
        ["Дата", "Название", "Тип", "Категория", "Сумма, ₽"],
        ...visible.map((i) => [
          i.date,
          i.name,
          i.kind === "income" ? "Доход" : "Расход",
          i.category,
          (((i.kind === "income" ? 1 : -1) * i.amount) / 100)
            .toFixed(2)
            .replace(".", ","),
        ]),
      ]
        .map((r) =>
          r
            .map((v, j) =>
              escape(j === 1 && /^[=+\-@\t\r]/.test(String(v)) ? "'" + v : v),
            )
            .join(";"),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiho-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify("CSV сохранён");
  }
  const table = (full = false) => (
    <section className="panel transactions">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ИСТОРИЯ</span>
          <h2>{full ? "Все операции" : "Последние операции"}</h2>
        </div>
        {!full && (
          <button
            className="text-button"
            onClick={() => navigate("transactions")}
          >
            Все операции <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="filters">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Поиск операций"
            placeholder="Найти операцию…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Тип операции"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">Все операции</option>
          <option value="expense">Расходы</option>
          <option value="income">Доходы</option>
        </select>
        <select
          aria-label="Категория"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Все категории</option>
          {Object.keys(cats).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {full && (
          <button
            className="secondary-button export"
            onClick={exportCSV}
            disabled={!visible.length}
          >
            <Download size={16} /> CSV
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Операция</th>
              <th>Категория</th>
              <th>Дата</th>
              <th className="amount-cell">Сумма</th>
              <th>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(full ? visible : visible.slice(0, 5)).map((i) => (
              <tr key={i.id}>
                <td>
                  <div className="operation">
                    <CategoryIcon category={i.category} />
                    <div>
                      <strong>{i.name}</strong>
                      <span>
                        {i.kind === "income" ? "Пополнение" : "Расход"}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="category-tag">{i.category}</span>
                </td>
                <td className="date-cell">{dateLabel(i.date)}</td>
                <td
                  className={
                    "amount-cell " + (i.kind === "income" ? "income" : "")
                  }
                >
                  <strong>
                    {i.kind === "income" ? "+" : "−"}
                    {money(i.amount)}
                  </strong>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Редактировать: ${i.name}`}
                      onClick={() => openForm(i)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button delete"
                      aria-label={`Удалить: ${i.name}`}
                      onClick={() => {
                        setFormError("");
                        setDeleting(i);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="empty">
            <Search size={28} />
            <h3>{current.length ? "Ничего не найдено" : "Здесь пока тихо"}</h3>
            <p>
              {current.length
                ? "Попробуйте изменить поиск или фильтры."
                : "Добавьте первую операцию за этот месяц."}
            </p>
            {!current.length && (
              <button className="primary-button" onClick={() => openForm()}>
                <Plus size={16} /> Добавить операцию
              </button>
            )}
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {full ? visible.length : Math.min(visible.length, 5)} из{" "}
          {visible.length} операций
        </span>
        <span>Все суммы в рублях · ₽</span>
      </div>
    </section>
  );
  const budgetPanel = (large = false) => (
    <section className={"panel budget-panel " + (large ? "large-budget" : "")}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">МЕСЯЧНЫЙ ЛИМИТ</span>
          <h2>Бюджет месяца</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Изменить бюджет"
          onClick={() => {
            setFormError("");
            setBudgetForm(String(budget / 100));
          }}
        >
          <Pencil size={17} />
        </button>
      </div>
      <div className="budget-numbers">
        <strong>{money(expense)}</strong>
        <span>из {money(budget)}</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Использовано бюджета"
        aria-valuenow={Math.min(pct, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={pct > 100 ? "over" : ""}
          style={{ width: Math.min(pct, 100) + "%" }}
        />
      </div>
      <div className="budget-caption">
        <span>{pct}% использовано</span>
        <span>
          {remaining >= 0
            ? "Осталось " + money(remaining)
            : "Превышение " + money(-remaining)}
        </span>
      </div>
      <div className="budget-note">
        <span className="note-icon">
          <Target size={19} />
        </span>
        <p>
          {remaining >= 0
            ? "Маленькие привычки. Большие планы."
            : "Пора пересмотреть план."}
          <small>
            {remaining >= 0
              ? "Держите расходы в комфортных границах."
              : "Измените лимит или сократите расходы."}
          </small>
        </p>
      </div>
    </section>
  );
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Тихо — на главную" onClick={(e) => { e.preventDefault(); navigate("overview"); }}>ТИХО<span>.</span></a>
        <nav aria-label="Основная навигация">
          {[["overview", "Обзор"], ["transactions", "Операции"], ["budget", "Бюджет"]].map(([id, label]) => (
            <button key={id} className={"nav-item " + (page === id ? "active" : "")} aria-current={page === id ? "page" : undefined} onClick={() => navigate(id)}>{label}</button>
          ))}
        </nav>
        <span className="connection-status" role="status"><i className={error ? "offline" : ""} />{loading ? "Подключение" : error ? "Нет соединения" : "Личный кошелёк"}</span>
      </header>
      <main>
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">ЛИЧНЫЕ ФИНАНСЫ</span>
              <h1>
                {page === "overview"
                  ? "Деньги в равновесии."
                  : page === "transactions"
                    ? "История в деталях."
                    : "Место для ваших планов."}
              </h1>
              <p>
                {page === "overview"
                  ? "Понятная картина ваших доходов и расходов."
                  : page === "transactions"
                    ? "Все движения денег в одном спокойном месте."
                    : "Задайте комфортный лимит и следите за расходами."}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => openForm()}
              disabled={loading || !!error}
            >
              <Plus size={18} /> Добавить операцию
            </button>
          </div>
          <div className="period-row">
            <div className="period">
              <button
                className="icon-button"
                aria-label="Предыдущий месяц"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>{monthLabel(month)}</span>
              <button
                className="icon-button"
                aria-label="Следующий месяц"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <span className="period-hint">Ваш месяц в цифрах</span>
          </div>
          {error ? (
            <div className="error-state">
              <h2>Не удалось загрузить данные</h2>
              <p>{error}</p>
              <button className="primary-button" onClick={load}>
                Попробовать снова
              </button>
            </div>
          ) : loading ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              <p>Собираем вашу картину…</p>
            </div>
          ) : (
            <>
              <div className="stats-grid">
                <section className="balance-card">
                  <span className="stat-label">
                    Общий баланс
                  </span>
                  <strong>{money(balance)}</strong>
                  <div className="balance-bottom">
                    <span>На конец выбранного месяца</span>
                  </div>
                </section>
                <section className="stat-card income-stat">
                  <span className="stat-label">
                    Доходы{" "}
                    <span className="stat-icon green">
                      <ArrowDownLeft size={19} />
                    </span>
                  </span>
                  <strong>{money(income)}</strong>
                  <div className="stat-footer">
                    <span className="stat-dot green-dot" /> За выбранный месяц
                  </div>
                </section>
                <section className="stat-card expense-stat">
                  <span className="stat-label">
                    Расходы{" "}
                    <span className="stat-icon orange">
                      <ArrowUpRight size={19} />
                    </span>
                  </span>
                  <strong>{money(expense)}</strong>
                  <div className="stat-footer">
                    <span className="stat-dot orange-dot" />{" "}
                    {current.filter((i) => i.kind === "expense").length}{" "}
                    операций за месяц
                  </div>
                </section>
              </div>
              {page === "overview" && (
                <>
                  <div className="analytics-grid">
                    <section className="panel chart-panel">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">РИТМ МЕСЯЦА</span>
                          <h2>Расходы по дням</h2>
                        </div>
                        <span className="chart-legend">
                          <i /> Расходы
                        </span>
                      </div>
                      <div className="chart">
                        <div className="chart-y">
                          {[1, 0.75, 0.5, 0.25, 0].map((n) => (
                            <span key={n}>
                              {new Intl.NumberFormat("ru-RU", {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }).format((chartMax * n) / 100)}
                            </span>
                          ))}
                        </div>
                        <div className="plot">
                          <div className="gridlines">
                            {[0, 1, 2, 3, 4].map((n) => (
                              <i key={n} />
                            ))}
                          </div>
                          <div className="bars">
                            {daily.map((d) => (
                              <div className="bar-slot" key={d.day}>
                                <div
                                  className={
                                    "bar " +
                                    (d.day === Number(today().slice(-2)) &&
                                    month === monthOf(today())
                                      ? "today"
                                      : "")
                                  }
                                  style={{
                                    height:
                                      Math.max(
                                        (d.amount / chartMax) * 100,
                                        d.amount ? 1.5 : 0,
                                      ) + "%",
                                  }}
                                  tabIndex={d.amount ? 0 : undefined}
                                  aria-label={`${d.day}: ${money(d.amount)}`}
                                >
                                  <span className="chart-tooltip">
                                    {d.day}{" "}
                                    {new Date(month + "-01").toLocaleDateString(
                                      "ru-RU",
                                      { month: "short" },
                                    )}
                                    <b>{money(d.amount)}</b>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="chart-x">
                            {[1, 5, 10, 15, 20, 25, days].map((d, i) => (
                              <span
                                key={i}
                                style={{ left: ((d - 0.5) / days) * 100 + "%" }}
                              >
                                {String(d).padStart(2, "0")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="chart-footer">
                        <span>Средний расход в день</span>
                        <strong>{money(Math.round(expense / days))}</strong>
                      </div>
                    </section>
                    <section className="panel categories-panel">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">СТРУКТУРА РАСХОДОВ</span>
                          <h2>По категориям</h2>
                        </div>
                        <ChartPie size={19} className="muted" />
                      </div>
                      {breakdown.length ? (
                        <>
                          <div className="category-strip">
                            {breakdown.map((c) => (
                              <span
                                key={c.name}
                                title={`${c.name}: ${money(c.amount)}`}
                                style={{
                                  width: (c.amount / expense) * 100 + "%",
                                  background: cats[c.name].color,
                                }}
                              />
                            ))}
                          </div>
                          <div className="category-list">
                            {breakdown.slice(0, 4).map((c) => (
                              <button
                                className="category-row"
                                key={c.name}
                                onClick={() => {
                                  navigate("transactions");
                                  setCategory(c.name);
                                }}
                              >
                                <CategoryIcon category={c.name} size={17} />
                                <span>
                                  {c.name}
                                  <small>
                                    {Math.round((c.amount / expense) * 100)}%
                                    расходов
                                  </small>
                                </span>
                                <strong>{money(c.amount)}</strong>
                              </button>
                            ))}
                          </div>
                          <button
                            className="text-button category-more"
                            onClick={() => navigate("budget")}
                          >
                            Подробная статистика <ArrowRight size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="empty small">
                          <ChartPie size={30} />
                          <p>
                            Категории появятся
                            <br />
                            после первого расхода.
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                  {table()}
                  <div className="bottom-grid">
                    {budgetPanel()}
                    <section className="quiet-card">
                      <span className="eyebrow">ПРОСТОЙ ПОДХОД</span>
                      <h2>
                        Финансы — это
                        <br />
                        тоже забота о себе.
                      </h2>
                      <p>
                        Записывайте расходы, замечайте привычки
                        <br />и оставляйте место для приятного.
                      </p>
                      
                    </section>
                  </div>
                </>
              )}
              {page === "transactions" && table(true)}
              {page === "budget" && (
                <div className="budget-layout">
                  {budgetPanel(true)}
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">СТРУКТУРА РАСХОДОВ</span>
                        <h2>Каждой категории — своё место</h2>
                      </div>
                    </div>
                    {breakdown.length ? (
                      breakdown.map((c) => (
                        <button
                          key={c.name}
                          className="category-row detailed-category"
                          onClick={() => {
                            navigate("transactions");
                            setCategory(c.name);
                          }}
                        >
                          <CategoryIcon category={c.name} />
                          <span>
                            {c.name}
                            <div className="mini-progress">
                              <i
                                style={{
                                  width: (c.amount / expense) * 100 + "%",
                                  background: cats[c.name].color,
                                }}
                              />
                            </div>
                          </span>
                          <strong>
                            {money(c.amount)}
                            <small>
                              {Math.round((c.amount / expense) * 100)}%
                            </small>
                          </strong>
                        </button>
                      ))
                    ) : (
                      <div className="empty">
                        <p>За этот месяц расходов пока нет.</p>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="footer">
            <span className="footer-brand">тихо.</span>
            <span>Для жизни, в которой всё понятно.</span>
            <span>Учёт без суеты · {month.slice(0, 4)}</span>
          </footer>
        </div>
      </main>
      {form && (
        <Modal
          title={form.id ? "Изменить операцию" : "Новая операция"}
          subtitle="Запишите сейчас, чтобы не держать в голове."
          onClose={() => {
            if (!saving) setForm(null);
          }}
        >
          <form onSubmit={saveItem}>
            <div className="type-toggle">
              {[
                ["expense", "Расход", ArrowUpRight],
                ["income", "Доход", ArrowDownLeft],
              ].map(([v, label, Icon]) => (
                <button
                  type="button"
                  className={form.kind === v ? "selected" : ""}
                  key={v}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      kind: v,
                      category: v === "expense" ? "Продукты" : "Зарплата",
                    }))
                  }
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </div>
            <label>
              Название
              <input
                autoComplete="off"
                required
                maxLength={100}
                placeholder="Например, кофе по дороге домой"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Сумма, ₽
                <input
                  inputMode="decimal"
                  type="number"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  placeholder="0,00"
                  required
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                />
              </label>
              <label>
                Дата
                <input
                  type="date"
                  required
                  min="2000-01-01"
                  max="2100-12-31"
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                />
              </label>
            </div>
            <label>
              Категория
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                {Object.keys(cats)
                  .filter((c) =>
                    form.kind === "income"
                      ? ["Зарплата", "Подработка", "Другое"].includes(c)
                      : !["Зарплата", "Подработка"].includes(c),
                  )
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="primary-button full" disabled={saving}>
              {saving ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}{" "}
              {saving ? "Сохраняем…" : "Сохранить операцию"}
            </button>
          </form>
        </Modal>
      )}
      {budgetForm !== null && (
        <Modal
          title="Бюджет месяца"
          subtitle="Один комфортный лимит расходов для каждого месяца."
          onClose={() => {
            if (!saving) setBudgetForm(null);
          }}
        >
          <form onSubmit={saveBudget}>
            <label>
              Лимит расходов, ₽
              <input
                type="number"
                min="0.01"
                step="0.01"
                max="1000000000"
                required
                value={budgetForm}
                onChange={(e) => setBudgetForm(e.target.value)}
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="primary-button full" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить бюджет"}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Удалить операцию?"
          subtitle={`${deleting.name} · ${money(deleting.amount)}`}
          onClose={() => {
            if (!saving) setDeleting(null);
          }}
        >
          <p className="delete-note">
            Операция будет удалена из истории. Суммы и графики пересчитаются
            автоматически.
          </p>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => setDeleting(null)}
            >
              Отмена
            </button>
            <button
              className="danger-button"
              disabled={saving}
              onClick={deleteItem}
            >
              {saving ? "Удаляем…" : "Удалить"}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
