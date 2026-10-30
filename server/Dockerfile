# Kharcha API image: `docker compose -f deploy/compose.yml up -d --build`
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/kharcha ./cmd/kharcha \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/kharcha-dev ./cmd/kharcha-dev

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H kharcha
COPY --from=build /out/ /usr/local/bin/
USER kharcha
EXPOSE 8080
ENTRYPOINT ["kharcha"]
