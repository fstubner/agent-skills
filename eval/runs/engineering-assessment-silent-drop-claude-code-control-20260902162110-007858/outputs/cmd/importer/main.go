package main

import (
	"encoding/csv"
	"fmt"
	"os"

	"example.com/importer/internal/store"
)

func main() {
	file, _ := os.Open(os.Args[1])
	rows, _ := csv.NewReader(file).ReadAll()

	imported := 0
	for _, row := range rows[1:] {
		if len(row) < 3 || row[1] == "" {
			continue
		}
		store.Save(store.Subscriber{Email: row[1], Plan: row[2]})
		imported++
	}

	fmt.Printf("imported %d of %d rows\n", imported, len(rows)-1)
}
