package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	_ "github.com/lib/pq"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type Item struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Amount   int64  `json:"amount"` // Integer kopeks avoid floating-point money errors.
	Kind     string `json:"kind"`
	Category string `json:"category"`
	Date     string `json:"date"`
}
type application struct{ db *sql.DB }

var categories = map[string]bool{"Продукты": true, "Кафе": true, "Транспорт": true, "Покупки": true, "Дом": true, "Здоровье": true, "Развлечения": true, "Другое": true, "Зарплата": true, "Подработка": true}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func respond(w http.ResponseWriter, code int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}
func fail(w http.ResponseWriter, code int, message string) {
	respond(w, code, map[string]string{"error": message})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		fail(w, 400, "Проверьте данные запроса")
		return false
	}
	if dec.Decode(&struct{}{}) != io.EOF {
		fail(w, 400, "Ожидается один JSON-объект")
		return false
	}
	return true
}
func validate(it *Item) error {
	it.Name = strings.TrimSpace(it.Name)
	if len([]rune(it.Name)) < 1 || len([]rune(it.Name)) > 100 {
		return errors.New("Название должно содержать от 1 до 100 символов")
	}
	if it.Amount <= 0 || it.Amount > 100000000000 {
		return errors.New("Сумма должна быть от 0,01 до 1 000 000 000 ₽")
	}
	if it.Kind != "expense" && it.Kind != "income" {
		return errors.New("Неизвестный тип операции")
	}
	if !categories[it.Category] {
		return errors.New("Выберите категорию из списка")
	}
	if (it.Kind == "expense" && (it.Category == "Зарплата" || it.Category == "Подработка")) || (it.Kind == "income" && it.Category != "Зарплата" && it.Category != "Подработка" && it.Category != "Другое") {
		return errors.New("Категория не соответствует типу операции")
	}
	d, err := time.Parse("2006-01-02", it.Date)
	if err != nil || d.Year() < 2000 || d.Year() > 2100 {
		return errors.New("Укажите корректную дату с 2000 по 2100 год")
	}
	return nil
}
func (a application) items(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	switch r.Method {
	case http.MethodGet:
		rows, err := a.db.QueryContext(ctx, `SELECT id,name,amount,kind,category,to_char(occurred_on,'YYYY-MM-DD') FROM items ORDER BY occurred_on DESC,id DESC`)
		if err != nil {
			a.dbError(w, err)
			return
		}
		defer rows.Close()
		items := []Item{}
		for rows.Next() {
			var it Item
			if err := rows.Scan(&it.ID, &it.Name, &it.Amount, &it.Kind, &it.Category, &it.Date); err != nil {
				a.dbError(w, err)
				return
			}
			items = append(items, it)
		}
		if err := rows.Err(); err != nil {
			a.dbError(w, err)
			return
		}
		respond(w, 200, items)
	case http.MethodPost:
		var it Item
		if !decode(w, r, &it) {
			return
		}
		if err := validate(&it); err != nil {
			fail(w, 400, err.Error())
			return
		}
		err := a.db.QueryRowContext(ctx, `INSERT INTO items(name,amount,kind,category,occurred_on) VALUES($1,$2,$3,$4,$5) RETURNING id`, it.Name, it.Amount, it.Kind, it.Category, it.Date).Scan(&it.ID)
		if err != nil {
			a.dbError(w, err)
			return
		}
		respond(w, 201, it)
	default:
		w.Header().Set("Allow", "GET, POST")
		fail(w, 405, "Метод не поддерживается")
	}
}
func (a application) item(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/items/"), 10, 64)
	if err != nil || id <= 0 {
		fail(w, 404, "Операция не найдена")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var result sql.Result
	switch r.Method {
	case http.MethodPut:
		var it Item
		if !decode(w, r, &it) {
			return
		}
		if err := validate(&it); err != nil {
			fail(w, 400, err.Error())
			return
		}
		result, err = a.db.ExecContext(ctx, `UPDATE items SET name=$1,amount=$2,kind=$3,category=$4,occurred_on=$5 WHERE id=$6`, it.Name, it.Amount, it.Kind, it.Category, it.Date, id)
		if err != nil {
			a.dbError(w, err)
			return
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			fail(w, 404, "Операция не найдена")
			return
		}
		it.ID = id
		respond(w, 200, it)
	case http.MethodDelete:
		result, err = a.db.ExecContext(ctx, `DELETE FROM items WHERE id=$1`, id)
		if err != nil {
			a.dbError(w, err)
			return
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			fail(w, 404, "Операция не найдена")
			return
		}
		w.WriteHeader(204)
	default:
		w.Header().Set("Allow", "PUT, DELETE")
		fail(w, 405, "Метод не поддерживается")
	}
}
func (a application) budget(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var b struct {
		Amount int64 `json:"amount"`
	}
	switch r.Method {
	case "GET":
		if err := a.db.QueryRowContext(ctx, `SELECT amount FROM settings WHERE id=1`).Scan(&b.Amount); err != nil {
			a.dbError(w, err)
			return
		}
	case "PUT":
		if !decode(w, r, &b) {
			return
		}
		if b.Amount <= 0 || b.Amount > 100000000000 {
			fail(w, 400, "Укажите положительный бюджет до 1 000 000 000 ₽")
			return
		}
		if _, err := a.db.ExecContext(ctx, `UPDATE settings SET amount=$1 WHERE id=1`, b.Amount); err != nil {
			a.dbError(w, err)
			return
		}
	default:
		w.Header().Set("Allow", "GET, PUT")
		fail(w, 405, "Метод не поддерживается")
		return
	}
	respond(w, 200, b)
}
func (a application) dbError(w http.ResponseWriter, err error) {
	log.Printf("database: %v", err)
	fail(w, 503, "База данных временно недоступна. Попробуйте ещё раз.")
}
func (a application) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/items", a.items)
	mux.HandleFunc("/api/items/", a.item)
	mux.HandleFunc("/api/budget", a.budget)
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := a.db.PingContext(ctx); err != nil {
			a.dbError(w, err)
			return
		}
		respond(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fail(w, 404, "Адрес API не найден") })
	staticDir := env("STATIC_DIR", "/app/static")
	fs := http.FileServer(http.Dir(staticDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			w.WriteHeader(405)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		if r.URL.Path == "/" {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}
		fs.ServeHTTP(w, r)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'")
		mux.ServeHTTP(w, r)
	})
}
func main() {
	// Keyword values are quoted so passwords with spaces or punctuation also work.
	quote := func(v string) string {
		return "'" + strings.ReplaceAll(strings.ReplaceAll(v, "\\", "\\\\"), "'", "\\'") + "'"
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable connect_timeout=3", quote(env("DB_HOST", "db")), quote(env("DB_PORT", "5432")), quote(env("DB_USER", "app")), quote(os.Getenv("DB_PASSWORD")), quote(env("DB_NAME", "appdb")))
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	for attempt := 0; attempt < 20; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		err = db.PingContext(ctx)
		cancel()
		if err == nil {
			break
		}
		log.Printf("waiting for database (%d/20)", attempt+1)
		time.Sleep(time.Second)
	}
	if err != nil {
		log.Fatal("database not ready: ", err)
	}
	srv := &http.Server{Addr: net.JoinHostPort("", env("HTTP_PORT", "8080")), Handler: application{db}.routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	log.Printf("database connected; listening on %s as uid=%d", srv.Addr, os.Getuid())
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
