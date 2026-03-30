---
description: Orchestrate the full spec→test→implement→verify cycle for a new PaperTeardown feature. Checks for a spec, runs spec-reviewer, writes failing tests, implements, and verifies.
---

# Command: new-feature

Orchestrates the full spec→test→implement→verify cycle for a new PaperTeardown feature.

## Usage

```
/new-feature <feature-name>
```

Example: `/new-feature repo-cloner`

## Steps

### 1. Check for existing spec

Look in `specs/` for a spec matching `<feature-name>`. If none exists:
- Ask the user to describe the feature
- Create a new spec from `specs/_template.md`
- Set status to `draft`
- Stop and ask for approval before proceeding

### 2. Review the spec

Invoke the `spec-reviewer` agent on the spec. If the review returns **NEEDS REVISION**:
- Show the issues to the user
- Do not proceed until spec is updated and re-reviewed

### 3. Identify affected files

Based on the spec's interface contract:
- List files that need to be created or modified
- Confirm the plan with the user before writing any code

### 4. Write tests first

Create test file(s) in `tests/` (backend) or co-located `*.test.ts` (frontend).
Tests should cover:
- All acceptance criteria from the spec
- Key error cases listed in the spec
- At minimum one happy-path integration test

Do not implement yet — write failing tests that define the contract.

### 5. Implement

Implement the feature against the spec. Follow:
- CLAUDE.md conventions (type hints, async/await, no `any` types)
- Interface contracts exactly as defined in the spec
- Do not add functionality not in the spec

### 6. Verify

Run the tests:
```bash
# Backend
cd backend && pytest tests/ -v -k <feature-name>

# Frontend
cd frontend && npm run test -- --testPathPattern=<feature-name>
```

Fix failures. If a test is wrong (not the implementation), flag it for review before changing.

### 7. Update spec status

Once all tests pass:
- Update the spec's `Status` field to `implemented`
- Note the implementation file paths in the spec if helpful

### 8. Summary

Report:
- What was implemented
- Test results
- Any deviations from spec (and why)
- Any new open questions discovered during implementation
