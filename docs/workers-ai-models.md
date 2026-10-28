# Workers AI Model Request Parameters and Availability Report

This report checks the request parameters for every Workers AI model in the catalog (Text to Image and Text Generation) against the [official model pages](https://developers.cloudflare.com/workers-ai/models/) and tests availability using the real REST API (`/client/v4/accounts/{account}/ai/run/{model}`).

- **Verification date:** 2026-09-06
- **Test method:** Tested using the request formats actually sent by the application. Chat requests used OpenAI-style `{messages, max_tokens, temperature, stream, ...}`; image requests used `{prompt}` or multipart form-data.
- **Test account:** After the main account exhausted its daily free-neuron quota (10k), an auxiliary test account on the Workers Free plan was used to complete chat-model tests. Image models were tested on the main account before its quota was exhausted.
- **Parameter source:** The Parameters tree on the official model pages, parsed from schema data embedded in the pages.

## Chat Models (Text Generation: 31 Total)

The application sends OpenAI-style requests through `workers-ai-provider`. In testing, all models accepted a `messages` array, including legacy-format models whose documentation marks `prompt` as required. Streaming responses use two line formats, both of which the provider can parse: the `response` field (legacy SSE) and `choices[].delta` (OpenAI-compatible SSE).

### Request Format Groups (Based on the Official Parameter Tree)

**OpenAI-compatible group** (`messages` required; most support a broad set of parameters, including `reasoning_effort`, `chat_template_kwargs.clear_thinking`, `tools`, `response_format`, and `web_search_options`):

- `@cf/zai-org/glm-5.3` / `glm-5.3-flash` / `glm-5.2` / `glm-4.7-flash`
- `@cf/deepseek-ai/deepseek-v4-flash-0731` / `deepseek-v4-pro-0813`
- `@cf/moonshotai/kimi-k2.6` / `kimi-k2.7-code`
- `@cf/qwen/qwen3.8-27b` (the content array also supports `video_url`)
- `@cf/nvidia/nemotron-3-120b-a12b`
- `@cf/google/gemma-4-26b-a4b-it` (also supports `skip_special_tokens`)

**Legacy `prompt` group** (documentation marks `prompt` as required, but REST testing also accepted `messages`; supports `max_tokens` with a default of 256, `temperature` with a default of 0.6, `top_p`, `top_k`, `seed`, `repetition_penalty`, `frequency_penalty`, `presence_penalty`, `stream`, `response_format`, and `lora`):

- `@cf/meta/llama-3.2-1b-instruct` / `3b-instruct` / `3.1-8b-instruct-fp8` / `3.3-70b-instruct-fp8-fast`
- `@cf/meta/llama-3.2-11b-vision-instruct` (vision model; also accepts image-array input)
- `@cf/meta-llama/llama-2-7b-chat-hf-lora`
- `@cf/mistral/mistral-7b-instruct-v0.2-lora`
- `@cf/mistralai/mistral-small-3.1-24b-instruct`
- `@cf/qwen/qwen2.5-coder-32b-instruct` / `qwen3-30b-a3b-fp8` / `qwq-32b`
- `@cf/google/gemma-2b-it-lora` / `gemma-7b-it-lora`
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` (streaming output includes `‹think›` tags, matching the application's `extractReasoningMiddleware(tagName: "think")`)
- `@cf/ibm-granite/granite-4.0-h-micro`
- `@cf/aisingapore/gemma-sea-lion-v4-27b-it`
- `@cf/openai/gpt-oss-20b` / `gpt-oss-120b` (supports `prompt`, `messages`, and `functions`; the provider has fallback-and-retry logic for streaming limitations on `/ai/run/` with gpt-oss)

**Special case:** `@cf/meta/llama-guard-3-8b` is a content-moderation classifier (requires `messages` and outputs safe/unsafe category JSON), not a conversational model. It has been **excluded from the Model Catalog** based on the `moderation` / `safety` / `content-filtering` / `guardrails` tags.

### Test Results

| Result | Count | Models |
| --- | ---: | --- |
| ✅ Available | 25 | All models in the legacy `prompt` group above, plus `glm-4.7-flash`, `gemma-4-26b-a4b-it`, `qwen3.8-27b`, and `nemotron-3-120b-a12b` from the OpenAI-compatible group, plus `llama-guard-3-8b` (described above and excluded from the catalog). |
| ⚠️ Paid plan required | 7 | `kimi-k2.6`, `kimi-k2.7-code`, `glm-5.2`, `glm-5.3`, `glm-5.3-flash`, `deepseek-v4-flash-0731`, and `deepseek-v4-pro-0813` (403/5035: not available on the Workers Free plan; these partner models can run on the main account, as expected, but were not tested). |
| ⚠️ One-time agreement required | 1 | `llama-3.2-11b-vision-instruct` (initial request returned 403/5016; it worked after POSTing `{"prompt":"agree"}`). |

Additional verification:

- Streaming (`stream: true`) was sampled on five models (`llama-3.2-1b`, `glm-4.7-flash`, `gpt-oss-20b`, `qwq-32b`, and `deepseek-r1-distill`); all worked normally.
- Vision image input (`image_url` plus a base64 data URL) was tested successfully with `llama-4-scout` and `llama-3.2-11b-vision`.
- Reasoning models (`glm-4.7-flash`, `qwen3-30b`, `gemma-4`, and others) put their reasoning in `reasoning_content`, which the provider parses natively. If `max_tokens` is too small, reasoning can consume the token budget and leave `content` empty; this is expected behavior.
- `qwq-32b` outputs its reasoning as plain text (without `reasoning_content` or think tags), so the frontend displays the reasoning process.

## Image Models (Text to Image: 10 in the Catalog)

### Request Format Groups

**FLUX.2 group** (requires `multipart/form-data`, with `prompt` as a form field; JSON requests return 400: `required properties at '/' are 'multipart'`. The official parameter tree only shows a `multipart` object and does not document the other parameters. In testing, extra form fields such as `seed` did not cause errors):

- `@cf/black-forest-labs/flux-2-klein-9b` (~4 seconds; JSON `result.image` base64)
- `@cf/black-forest-labs/flux-2-klein-4b` (~4 seconds; same response format)
- `@cf/black-forest-labs/flux-2-dev` (~52 seconds; same response format)
- **Application fix:** `app/api/image/route.ts` was updated to send the FLUX.2 series using `FormData`.

**JSON group** (`{prompt}`, with optional `negative_prompt`, `height`, `width`, `num_steps`, `guidance`, `seed`, and img2img fields such as `image`, `image_b64`, `mask`, and `strength`):

- `@cf/black-forest-labs/flux-1-schnell` (parameters: `prompt`, `steps` with a default of 4, and `seed`) — JSON response containing base64 image data
- `@cf/leonardo/lucid-origin` (`guidance` default 4.5; `height` / `width` default 1120, maximum 2500; `num_steps` maximum 40) — JSON response containing base64 image data
- `@cf/leonardo/phoenix-1.0` (`guidance` default 2; `height` / `width` default 1024; `num_steps` default 25; supports `negative_prompt`) — **returns binary JPEG directly**
- `@cf/bytedance/stable-diffusion-xl-lightning`, `@cf/stabilityai/stable-diffusion-xl-base-1.0`, and `@cf/lykon/dreamshaper-8-lcm` (`num_steps` default 20, `guidance` default 7.5, and other parameters) — **binary PNG responses**

**Special case:** `@cf/runwayml/stable-diffusion-v1-5-inpainting` is categorized as Text-to-Image in the catalog but requires `mask_image` (400: `missing required input mask_image`), so it cannot generate images from text alone. It has been **excluded from the Model Catalog** because its name contains `inpainting`.

### Test Results

| Model | Request format | Response format | Status |
| --- | --- | --- | --- |
| `flux-2-klein-9b` | multipart | JSON base64 | ✅ |
| `flux-2-klein-4b` | multipart | JSON base64 | ✅ |
| `flux-2-dev` | multipart | JSON base64 | ✅ |
| `flux-1-schnell` | JSON | JSON base64 | ✅ |
| `lucid-origin` | JSON (parameters verified in testing) | JSON base64 | ✅ |
| `phoenix-1.0` | JSON (parameters verified in testing) | Binary JPEG | ✅ |
| `sd-xl-lightning` | JSON | Binary PNG | ✅ |
| `sd-xl-base-1.0` | JSON | Binary PNG | ✅ |
| `dreamshaper-8-lcm` | JSON | Binary PNG | ✅ |
| `sd-v1-5-inpainting` | — | — | ❌ Excluded |

The AI Gateway path (`gateway.ai.cloudflare.com/v1/{account}/{gateway}/workers-ai/run/{model}`) correctly forwards multipart requests (authentication succeeded; the request returned a quota-related 429 on the test day).

## Operational Notes

- FLUX.2 models are relatively expensive (for example, `flux-2-dev` costs $0.00021 per input 512² tile/step plus $0.00041 per output tile/step). The free quota (10,000 neurons per day, reset at 00:00 UTC) can be exhausted quickly.
- Before using `llama-3.2-11b-vision-instruct` for the first time on a new account, accept the model agreement by POSTing `{"prompt":"agree"}`.
