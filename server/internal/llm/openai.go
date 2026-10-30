package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/shared"
)

// OpenAI calls the ChatGPT models through the official Go SDK with a strict
// JSON schema. Credentials come from OPENAI_API_KEY.
type OpenAI struct {
	client openai.Client
	model  string
}

func NewOpenAI(model string) *OpenAI {
	return &OpenAI{client: openai.NewClient(), model: model}
}

func (o *OpenAI) Name() string { return "openai:" + o.model }

func (o *OpenAI) JSON(ctx context.Context, task Task, system, user string, schema map[string]any) (json.RawMessage, error) {
	name := "extraction"
	if task == TaskRoast {
		name = "verdict"
	}
	resp, err := o.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: o.model,
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(system),
			openai.UserMessage(user),
		},
		ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{
			OfJSONSchema: &shared.ResponseFormatJSONSchemaParam{
				JSONSchema: shared.ResponseFormatJSONSchemaJSONSchemaParam{
					Name:   name,
					Schema: schema,
					Strict: openai.Bool(true),
				},
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("openai returned no choices")
	}
	msg := resp.Choices[0].Message
	if msg.Refusal != "" {
		return nil, fmt.Errorf("openai refused: %s", msg.Refusal)
	}
	return json.RawMessage(msg.Content), nil
}
