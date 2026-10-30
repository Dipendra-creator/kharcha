// Package config reads server settings from the environment.
package config

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	Addr        string
	DatabaseURL string
	// RedisURL is optional; without it jobs run on an in-process queue.
	RedisURL string

	JWTSecret []byte
	// EncryptionKey (32 bytes) encrypts Gmail refresh tokens at rest.
	EncryptionKey []byte
	DevLogin      bool
	// NoAuth (KHARCHA_AUTH_MODE=none) skips sign-in: every request acts as one
	// built-in owner account. Only for a private, single-user deployment.
	NoAuth bool

	// GoogleClientIDs are accepted audiences for Google ID tokens (web, Android, iOS clients).
	GoogleClientIDs []string
	// GoogleWebClientID/Secret exchange the app's server auth code for Gmail offline access.
	GoogleWebClientID     string
	GoogleWebClientSecret string

	// LLMProviders is tried in order: anthropic, openai, claude-cli, codex-cli.
	LLMProviders   []string
	AnthropicModel string
	OpenAIModel    string
	ClaudeCLIPath  string
	ClaudeCLIModel string
	CodexCLIPath   string
	CodexCLIModel  string
	LLMTimeout     time.Duration
	EmailSyncEvery time.Duration
	EmailLookback  time.Duration
	WorkerCount    int
}

func Load() (*Config, error) {
	c := &Config{
		Addr:                  env("KHARCHA_ADDR", ":8080"),
		DatabaseURL:           env("DATABASE_URL", "postgres://kharcha:kharcha@localhost:5432/kharcha?sslmode=disable"),
		RedisURL:              os.Getenv("REDIS_URL"),
		DevLogin:              env("KHARCHA_DEV_LOGIN", "false") == "true",
		NoAuth:                env("KHARCHA_AUTH_MODE", "token") == "none",
		GoogleClientIDs:       list(os.Getenv("GOOGLE_CLIENT_IDS")),
		GoogleWebClientID:     os.Getenv("GOOGLE_WEB_CLIENT_ID"),
		GoogleWebClientSecret: os.Getenv("GOOGLE_WEB_CLIENT_SECRET"),
		LLMProviders:          list(env("KHARCHA_LLM_PROVIDERS", "anthropic,openai")),
		AnthropicModel:        env("KHARCHA_ANTHROPIC_MODEL", "claude-opus-5-5"),
		OpenAIModel:           env("KHARCHA_OPENAI_MODEL", "gpt-5"),
		ClaudeCLIPath:         env("KHARCHA_CLAUDE_CLI", "claude"),
		ClaudeCLIModel:        os.Getenv("KHARCHA_CLAUDE_CLI_MODEL"),
		CodexCLIPath:          env("KHARCHA_CODEX_CLI", "codex"),
		CodexCLIModel:         os.Getenv("KHARCHA_CODEX_CLI_MODEL"),
		LLMTimeout:            duration("KHARCHA_LLM_TIMEOUT", 90*time.Second),
		EmailSyncEvery:        duration("KHARCHA_EMAIL_SYNC_EVERY", 3*time.Hour),
		EmailLookback:         duration("KHARCHA_EMAIL_LOOKBACK", 45*24*time.Hour),
		WorkerCount:           2,
	}
	if c.GoogleWebClientID != "" && !contains(c.GoogleClientIDs, c.GoogleWebClientID) {
		c.GoogleClientIDs = append(c.GoogleClientIDs, c.GoogleWebClientID)
	}

	secret := os.Getenv("KHARCHA_JWT_SECRET")
	if secret == "" {
		if !c.DevLogin {
			return nil, fmt.Errorf("KHARCHA_JWT_SECRET is required")
		}
		secret = "dev-only-insecure-secret"
	}
	c.JWTSecret = []byte(secret)

	key := os.Getenv("KHARCHA_ENCRYPTION_KEY")
	if key == "" {
		if !c.DevLogin {
			return nil, fmt.Errorf("KHARCHA_ENCRYPTION_KEY (32 bytes, base64) is required")
		}
		key = base64.StdEncoding.EncodeToString([]byte("dev-only-insecure-key-32-bytes!!"))
	}
	raw, err := base64.StdEncoding.DecodeString(key)
	if err != nil || len(raw) != 32 {
		return nil, fmt.Errorf("KHARCHA_ENCRYPTION_KEY must be 32 bytes, base64-encoded")
	}
	c.EncryptionKey = raw
	return c, nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func duration(key string, def time.Duration) time.Duration {
	if d, err := time.ParseDuration(os.Getenv(key)); err == nil && d > 0 {
		return d
	}
	return def
}

func list(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}
