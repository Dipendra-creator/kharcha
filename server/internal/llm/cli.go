package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ClaudeCLI runs the locally installed `claude` CLI in print mode. Handy for
// development on a machine already logged in to Claude Code; each call
// starts a full CLI session, so it is slower and costlier than the API.
type ClaudeCLI struct {
	Bin   string
	Model string
}

func (c *ClaudeCLI) Name() string { return "claude-cli" }

func (c *ClaudeCLI) JSON(ctx context.Context, _ Task, system, user string, schema map[string]any) (json.RawMessage, error) {
	schemaJSON, err := json.Marshal(schema)
	if err != nil {
		return nil, err
	}
	args := []string{
		"-p", user,
		// Replace the default agent prompt and disable tools: this is a pure text task.
		"--system-prompt", system,
		"--tools", "",
		"--output-format", "json",
		"--json-schema", string(schemaJSON),
		"--max-turns", "3",
	}
	if c.Model != "" {
		args = append(args, "--model", c.Model)
	}
	out, err := run(ctx, c.Bin, args, os.TempDir())
	if err != nil {
		return nil, err
	}
	var res struct {
		IsError          bool            `json:"is_error"`
		Result           string          `json:"result"`
		StructuredOutput json.RawMessage `json:"structured_output"`
	}
	if err := json.Unmarshal(out, &res); err != nil {
		return nil, fmt.Errorf("claude CLI output: %w", err)
	}
	if res.IsError {
		return nil, fmt.Errorf("claude CLI: %s", res.Result)
	}
	if len(res.StructuredOutput) > 0 && string(res.StructuredOutput) != "null" {
		return res.StructuredOutput, nil
	}
	return json.RawMessage(res.Result), nil
}

// CodexCLI runs OpenAI's `codex exec` non-interactively with an output schema.
type CodexCLI struct {
	Bin   string
	Model string
}

func (c *CodexCLI) Name() string { return "codex-cli" }

func (c *CodexCLI) JSON(ctx context.Context, _ Task, system, user string, schema map[string]any) (json.RawMessage, error) {
	dir, err := os.MkdirTemp("", "kharcha-codex-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	schemaFile := filepath.Join(dir, "schema.json")
	outFile := filepath.Join(dir, "out.json")
	schemaJSON, _ := json.Marshal(schema)
	if err := os.WriteFile(schemaFile, schemaJSON, 0o600); err != nil {
		return nil, err
	}
	args := []string{"exec", "--skip-git-repo-check", "--sandbox", "read-only", "--output-schema", schemaFile, "--output-last-message", outFile}
	if c.Model != "" {
		args = append(args, "--model", c.Model)
	}
	args = append(args, system+"\n\n"+user)
	if _, err := run(ctx, c.Bin, args, dir); err != nil {
		return nil, err
	}
	out, err := os.ReadFile(outFile)
	if err != nil {
		return nil, fmt.Errorf("codex CLI wrote no answer: %w", err)
	}
	return json.RawMessage(bytes.TrimSpace(out)), nil
}

func run(ctx context.Context, bin string, args []string, dir string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if len(msg) > 300 {
			msg = msg[:300]
		}
		return nil, fmt.Errorf("%s: %w: %s", filepath.Base(bin), err, msg)
	}
	return stdout.Bytes(), nil
}
