package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/anthropics/anthropic-sdk-go/v2/option"
	"github.com/anthropics/anthropic-sdk-go/v2/shared/constant"
)

// Anthropic calls Claude through the official Go SDK with structured outputs.
// Credentials resolve from the environment (ANTHROPIC_API_KEY, or an
// `ant auth login` profile).
type Anthropic struct {
	client anthropic.Client
	model  string
}

func NewAnthropic(model string, opts ...option.RequestOption) *Anthropic {
	return &Anthropic{client: anthropic.NewClient(opts...), model: model}
}

func (a *Anthropic) Name() string { return "anthropic:" + a.model }

func (a *Anthropic) JSON(ctx context.Context, task Task, system, user string, schema map[string]any) (json.RawMessage, error) {
	// Both tasks are short and well specified, so low effort keeps latency and
	// thinking spend down; extraction batches get more output room.
	maxTokens := int64(16000)
	if task == TaskRoast {
		maxTokens = 2000
	}
	resp, err := a.client.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     a.model,
		MaxTokens: maxTokens,
		// The system prompt is static, so it is cached across calls.
		System: []anthropic.BetaTextBlockParam{{Text: system, CacheControl: anthropic.NewBetaCacheControlEphemeralParam()}},
		Messages: []anthropic.BetaMessageParam{
			anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(user)),
		},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffortLow,
			Format: anthropic.BetaJSONOutputFormatParam{Schema: schema},
		},
		// If a safety classifier declines, the API re-runs the request on a
		// recommended fallback model inside the same call.
		Fallbacks: anthropic.BetaFallbacksParamUnion{OfDefault: constant.ValueOf[constant.Default]()},
		Betas:     []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
	})
	if err != nil {
		var apiErr *anthropic.Error
		if errors.As(err, &apiErr) {
			return nil, fmt.Errorf("claude API %d: %s", apiErr.StatusCode, apiErr.Error())
		}
		return nil, err
	}
	if resp.StopReason == anthropic.BetaStopReasonRefusal {
		return nil, fmt.Errorf("claude declined the request")
	}
	if resp.StopReason == anthropic.BetaStopReasonMaxTokens {
		return nil, fmt.Errorf("claude hit max_tokens")
	}
	for _, block := range resp.Content {
		if text, ok := block.AsAny().(anthropic.BetaTextBlock); ok {
			return json.RawMessage(text.Text), nil
		}
	}
	return nil, fmt.Errorf("claude returned no text block")
}
