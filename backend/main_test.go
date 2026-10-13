package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateItem(t *testing.T) {
	valid := Item{Name: "  Кофе  ", Amount: 58050, Kind: "expense", Category: "Кафе", Date: "2026-10-12"}
	if err := validate(&valid); err != nil {
		t.Fatal(err)
	}
	if valid.Name != "Кофе" {
		t.Fatal("name must be trimmed")
	}
	cases := []struct {
		name   string
		change func(*Item)
	}{
		{"zero amount", func(i *Item) { i.Amount = 0 }},
		{"negative amount", func(i *Item) { i.Amount = -1 }},
		{"too large", func(i *Item) { i.Amount = 100000000001 }},
		{"impossible date", func(i *Item) { i.Date = "2026-02-30" }},
		{"unknown category", func(i *Item) { i.Category = "missing" }},
		{"mismatched category", func(i *Item) { i.Category = "Зарплата" }},
		{"blank name", func(i *Item) { i.Name = "   " }},
		{"too long name", func(i *Item) { i.Name = strings.Repeat("я", 101) }},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			it := valid
			tt.change(&it)
			if validate(&it) == nil {
				t.Fatal("invalid item accepted")
			}
		})
	}
}
func TestDecodeRejectsAmbiguousMoney(t *testing.T) {
	for _, body := range []string{`{"amount":1.5}`, `{"amount":2,"unexpected":true}`, `{"amount":2} {"amount":3}`, strings.Repeat(" ", 17000) + `{"amount":2}`} {
		r := httptest.NewRequest("POST", "/api/items", strings.NewReader(body))
		w := httptest.NewRecorder()
		var item Item
		if decode(w, r, &item) {
			t.Fatalf("accepted invalid request: %.40s", body)
		}
		if w.Code != 400 {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	}
}
