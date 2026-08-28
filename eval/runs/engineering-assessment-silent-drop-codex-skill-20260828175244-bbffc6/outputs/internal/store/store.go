package store

import "sync"

type Subscriber struct {
	Email string
	Plan  string
}

var (
	mu    sync.Mutex
	items = map[string]Subscriber{}
)

func Save(s Subscriber) {
	mu.Lock()
	defer mu.Unlock()
	items[s.Email] = s
}

func Count() int { return len(items) }
