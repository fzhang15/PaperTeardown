---
description: Run a quick end-to-end pipeline test on a GitHub repo URL. Starts the backend if needed, submits an analysis job, streams progress, and prints a summary of detected modules and annotations.
---

# Command: analyze-repo

Quick end-to-end test of the full PaperTeardown pipeline on a given GitHub repo URL.

## Usage

```
/analyze-repo <github-url> [--detail overview|detailed] [--context "paper title"]
```

Example:
```
/analyze-repo https://github.com/karpathy/minGPT --detail detailed --context "minGPT language model"
```

## Steps

### 1. Validate inputs

- Confirm the URL looks like a GitHub repo URL
- Default `--detail` to `overview` if not specified

### 2. Check backend is running

```bash
curl -s http://localhost:8000/api/health
```

If not running, start it:
```bash
cd backend && uvicorn api.main:app --reload --port 8000 &
```

### 3. Submit analysis job

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "<url>", "detail_level": "<detail>", "context": "<context>"}'
```

Capture the `job_id` from the response.

### 4. Poll for completion

Poll `GET /api/status/<job_id>` every 2 seconds. Print each status update:
```
[cloning]  Cloning https://github.com/...
[parsing]  Found 12 .py files, 3 nn.Module classes
[analyzing] Analyzing GPT (1/3)...
[done]     Analysis complete
```

If status is `error`, print the error and stop.

### 5. Fetch and display results

```bash
curl http://localhost:8000/api/result/<job_id>
```

Print a summary:
```
=== Analysis Summary ===
Repo: karpathy/minGPT
Modules found: GPT, Block, CausalSelfAttention
Training loops: 1

=== GPT.forward() ===
Overview: [overview text]

=== First 3 annotations ===
L42-44: [explanation]
L45-47: [explanation]
L48-50: [explanation]
```

### 6. Cleanup (optional)

```bash
curl -X DELETE http://localhost:8000/api/job/<job_id>
```

### Troubleshooting

- If cloning fails: check internet access, confirm URL is public
- If parsing finds 0 modules: use `pytorch-expert` agent to debug
- If analysis errors: check `ANTHROPIC_API_KEY` is set in environment
