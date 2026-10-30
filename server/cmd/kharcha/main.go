// Command kharcha runs the Kharcha API, the Gmail sync workers and the sync scheduler.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"kharcha/server/internal/api"
	"kharcha/server/internal/auth"
	"kharcha/server/internal/config"
	"kharcha/server/internal/gmail"
	"kharcha/server/internal/ingest"
	"kharcha/server/internal/llm"
	"kharcha/server/internal/queue"
	"kharcha/server/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func providers(cfg *config.Config, log *slog.Logger) []llm.Provider {
	var out []llm.Provider
	for _, name := range cfg.LLMProviders {
		switch name {
		case "anthropic":
			if os.Getenv("ANTHROPIC_API_KEY") == "" && os.Getenv("ANTHROPIC_AUTH_TOKEN") == "" && os.Getenv("ANTHROPIC_PROFILE") == "" {
				log.Warn("anthropic provider skipped: no ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN/ANTHROPIC_PROFILE")
				continue
			}
			out = append(out, llm.NewAnthropic(cfg.AnthropicModel))
		case "openai":
			if os.Getenv("OPENAI_API_KEY") == "" {
				log.Warn("openai provider skipped: no OPENAI_API_KEY")
				continue
			}
			out = append(out, llm.NewOpenAI(cfg.OpenAIModel))
		case "claude-cli":
			out = append(out, &llm.ClaudeCLI{Bin: cfg.ClaudeCLIPath, Model: cfg.ClaudeCLIModel})
		case "codex-cli":
			out = append(out, &llm.CodexCLI{Bin: cfg.CodexCLIPath, Model: cfg.CodexCLIModel})
		default:
			log.Warn("unknown LLM provider", "name", name)
		}
	}
	return out
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	sealer, err := auth.NewSealer(cfg.EncryptionKey)
	if err != nil {
		return err
	}
	jobs, err := queue.New(cfg.RedisURL, log)
	if err != nil {
		return err
	}

	chain := &llm.Chain{Providers: providers(cfg, log), Log: log}
	svc := &llm.Service{Chain: chain, Cache: db, Timeout: cfg.LLMTimeout}
	ing := &ingest.Ingest{Store: db}
	syncer := &gmail.Syncer{
		Store: db, Sealer: sealer, LLM: svc, Ingest: ing,
		ClientID: cfg.GoogleWebClientID, Secret: cfg.GoogleWebClientSecret, Lookback: cfg.EmailLookback, Log: log,
	}

	var ownerID string
	if cfg.NoAuth {
		if ownerID, err = api.EnsureOwner(ctx, db); err != nil {
			return err
		}
		log.Warn("KHARCHA_AUTH_MODE=none: no sign-in, every request uses the owner account", "owner", ownerID)
	}

	go jobs.Run(ctx, cfg.WorkerCount, func(ctx context.Context, j queue.Job) error {
		if j.Kind != "gmail" {
			return nil
		}
		ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
		defer cancel()
		return syncer.Sync(ctx, j.UserID)
	})
	go schedule(ctx, cfg.EmailSyncEvery, db, jobs, log)

	srv := &http.Server{
		Addr: cfg.Addr,
		Handler: (&api.Server{
			Store: db, Tokens: auth.Tokens{Secret: cfg.JWTSecret}, LLM: svc, Gmail: syncer, Ingest: ing,
			Queue: jobs, Log: log, DevLogin: cfg.DevLogin, GoogleClientIDs: cfg.GoogleClientIDs, OwnerID: ownerID,
		}).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      3 * time.Minute,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	log.Info("kharcha api listening", "addr", cfg.Addr, "llm", chain.Names(), "gmail", syncer.Configured(), "devLogin", cfg.DevLogin, "noAuth", cfg.NoAuth)
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// schedule enqueues a Gmail sync for every connected account every `every`.
func schedule(ctx context.Context, every time.Duration, db *store.Store, jobs queue.Queue, log *slog.Logger) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			users, err := db.GmailUserIDs(ctx)
			if err != nil {
				log.Error("schedule gmail sync", "err", err)
				continue
			}
			for _, id := range users {
				_, _ = jobs.Enqueue(ctx, queue.Job{Kind: "gmail", UserID: id})
			}
		}
	}
}
