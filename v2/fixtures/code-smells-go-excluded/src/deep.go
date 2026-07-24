package main

func outer(a, b, c, d, e bool) string {
	if a {
		if b {
			if c {
				if d {
					if e {
						return "too deep, but .go is excluded from S-deep-nesting"
					}
				}
			}
		}
	}
	return ""
}
