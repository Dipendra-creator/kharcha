.PHONY: run build test test-db deps

deps:
	docker compose up -d

run:
	set -a; [ -f .env ] && . ./.env; set +a; go run ./cmd/kharcha

build:
	go build -o bin/kharcha ./cmd/kharcha

test:
	go vet ./... && go test ./...

# Includes the Postgres integration test (needs a scratch database).
test-db:
	KHARCHA_TEST_DATABASE_URL=$${KHARCHA_TEST_DATABASE_URL:-postgres://kharcha:kharcha@localhost:5432/kharcha_test?sslmode=disable} go test ./...
