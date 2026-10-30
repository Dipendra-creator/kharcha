// Package llm extracts transactions from redacted SMS/email text and writes
// the nightly Hinglish verdict, through any of several providers (Claude API,
// OpenAI API, the claude CLI, the codex CLI) tried in order.
package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
)

// Task tells a provider what kind of call it is, so it can pick effort/limits.
type Task int

const (
	TaskExtract Task = iota
	TaskRoast
)

// Provider returns JSON that matches `schema`.
type Provider interface {
	Name() string
	JSON(ctx context.Context, task Task, system, user string, schema map[string]any) (json.RawMessage, error)
}

// ErrNoProvider means no LLM is configured; callers fall back to rules.
var ErrNoProvider = errors.New("no LLM provider configured")

// Chain tries providers in order and returns the first success.
type Chain struct {
	Providers []Provider
	Log       *slog.Logger
}

func (c *Chain) Names() string {
	names := make([]string, len(c.Providers))
	for i, p := range c.Providers {
		names[i] = p.Name()
	}
	if len(names) == 0 {
		return "rules-only"
	}
	return strings.Join(names, ",")
}

func (c *Chain) JSON(ctx context.Context, task Task, system, user string, schema map[string]any) (json.RawMessage, error) {
	if len(c.Providers) == 0 {
		return nil, ErrNoProvider
	}
	var errs []error
	for _, p := range c.Providers {
		out, err := p.JSON(ctx, task, system, user, schema)
		if err == nil && json.Valid(out) {
			return out, nil
		}
		if err == nil {
			err = fmt.Errorf("invalid JSON")
		}
		c.Log.Warn("llm provider failed", "provider", p.Name(), "err", err)
		errs = append(errs, fmt.Errorf("%s: %w", p.Name(), err))
		if ctx.Err() != nil {
			break
		}
	}
	return nil, errors.Join(errs...)
}
