# fillthehole.ca Project Agents

Project-specific Claude Code agents tailored for the fillthehole.ca civic pothole tracking platform.

## Overview

These agents are specialized helpers that understand the unique requirements of this civic tech project:
- Public pothole reporting and tracking
- Security-first approach (untrusted public input)
- SvelteKit + Svelte 5 runes architecture
- Supabase with Row Level Security
- Mobile-first, accessible design
- Ward accountability and civic engagement

## Available Agents

### 1. Civic Feature Builder (`civic-feature-builder`)
**Use when:** Building new features or modifying existing functionality

**Specializes in:**
- Security-first feature development
- Svelte 5 runes syntax (not Svelte 4)
- API validation with zod
- IP hashing and rate limiting
- XSS prevention and input sanitization
- Supabase RLS-aware development

**Example prompts:**
- "Add a feature to let users mark a pothole as 'still not fixed'"
- "Create an API endpoint for exporting ward statistics"
- "Build a notification system for pothole status changes"

---

### 2. Supabase Schema Designer (`supabase-schema-designer`)
**Use when:** Designing new database tables or modifying schema

**Specializes in:**
- RLS policy design (secure by default)
- Migration file creation
- Index optimization
- Foreign key relationships
- pg_cron job configuration
- Data integrity constraints

**Example prompts:**
- "Design a table to track user feedback on filled potholes"
- "Create a schema for ward councillor response times"
- "Add an index to speed up queries by ward and status"

---

### 3. Civic UX Reviewer (`civic-ux-reviewer`)
**Use when:** Reviewing user experience, accessibility, or design

**Specializes in:**
- WCAG 2.1 AA accessibility compliance
- Mobile-first responsive design
- Touch target sizing and keyboard navigation
- Civic engagement UX patterns
- Inclusive design for diverse users
- Progressive disclosure and empty states

**Example prompts:**
- "Review the report form for accessibility issues"
- "Check if the map interface is mobile-friendly"
- "Ensure the stats page is screen-reader accessible"

---

### 4. Migration Runner (`migration-runner`)
**Use when:** Applying database migrations to Supabase

**Specializes in:**
- Safe migration execution
- Pre-migration validation
- Rollback planning
- RLS policy verification
- pg_cron job management
- Data integrity checks

**Example prompts:**
- "Apply the schema_push.sql migration safely"
- "Verify all RLS policies are working after migration"
- "Create a rollback plan for the latest schema change"

---

### 5. Civic Deployment Manager (`civic-deployment-manager`)
**Use when:** Deploying to production or troubleshooting deploy issues

**Specializes in:**
- Pre-deployment checklists
- Build and test validation
- Environment variable management
- Post-deployment smoke tests
- Rollback procedures
- Error monitoring (Sentry, Netlify logs)

**Example prompts:**
- "Run pre-deployment checks before pushing to main"
- "Deploy to production and verify all systems are working"
- "Roll back the last deploy and identify the issue"

---

## How to Use These Agents

### In Claude Code Desktop

1. **Direct invocation** - Use the Task tool:
   ```
   Ask "civic-feature-builder" to add a new API endpoint for...
   ```

2. **Natural language** - Claude will suggest the right agent:
   ```
   I need to add a new table to track ward response metrics
   # Claude may suggest: "Should I invoke supabase-schema-designer?"
   ```

3. **Agent chaining** - Combine multiple agents:
   ```
   1. Ask "supabase-schema-designer" to design the schema
   2. Ask "migration-runner" to apply it safely
   3. Ask "civic-feature-builder" to build the API
   4. Ask "civic-ux-reviewer" to check accessibility
   5. Ask "civic-deployment-manager" to deploy
   ```

### Best Practices

1. **Start with the right agent** - Choose based on the task:
   - Adding features → Civic Feature Builder
   - Database changes → Supabase Schema Designer → Migration Runner
   - UX concerns → Civic UX Reviewer
   - Deploying → Civic Deployment Manager

2. **Read the agent's output** - Each agent provides:
   - Security analysis
   - Code examples
   - Testing instructions
   - Documentation updates

3. **Follow the process** - Agents follow structured workflows:
   - Phase 1: Analysis/Planning
   - Phase 2: Implementation
   - Phase 3: Testing/Validation
   - Phase 4: Documentation

4. **Update docs** - Agents will remind you to update:
   - `README.md` for user-facing changes
   - `CLAUDE.md` for architecture changes
   - `.env.example` for new env vars
   - Schema migration files

## Agent vs Manual Work

**Use agents when:**
- You want security best practices enforced automatically
- You need structured guidance through complex processes
- You're working on an unfamiliar part of the codebase
- You want consistent code quality and patterns

**Work manually when:**
- You need fine-grained control over every line
- The task is simpler than agent setup
- You're experimenting and learning

## Combining User-Level and Project-Level Agents

You have both sets of agents:

**User-level agents** (`.github/instructions/`):
- `debug` - General debugging
- `se-security-reviewer` - Security review
- `playwright-tester` - E2E testing
- `devops-expert` - CI/CD and infrastructure

**Project-level agents** (`.github/agents/`):
- `civic-feature-builder` - fillthehole.ca features
- `supabase-schema-designer` - fillthehole.ca schema
- `civic-ux-reviewer` - fillthehole.ca UX
- `migration-runner` - fillthehole.ca migrations
- `civic-deployment-manager` - fillthehole.ca deployments

**Use project agents** for fillthehole.ca-specific work.
**Use user agents** for general software engineering tasks.

## Example Workflows

### Adding a New Feature End-to-End

```
1. "civic-feature-builder" - Design and implement the feature
2. "supabase-schema-designer" - Add any needed tables
3. "migration-runner" - Apply schema changes safely
4. "civic-ux-reviewer" - Check accessibility and mobile UX
5. "se-security-reviewer" - Security audit (user-level agent)
6. "playwright-tester" - Add E2E tests (user-level agent)
7. "civic-deployment-manager" - Deploy to production
```

### Debugging a Production Issue

```
1. "debug" (user-level) - Reproduce and identify root cause
2. "civic-feature-builder" - Implement the fix
3. "civic-deployment-manager" - Hot-deploy the fix
```

### Database Schema Evolution

```
1. "supabase-schema-designer" - Design new schema
2. "se-security-reviewer" - Review RLS policies
3. "migration-runner" - Apply migration with rollback plan
4. "civic-feature-builder" - Update API to use new schema
```

## Maintenance

These agents are project-specific and should be updated when:
- Major stack changes (e.g., SvelteKit 3.0)
- New security patterns emerge
- Business rules change (e.g., confirmation threshold)
- New critical dependencies added

Keep them in sync with `CLAUDE.md` and `README.md`.

## Questions?

If an agent doesn't understand your request:
1. Check you're using the right agent for the task
2. Provide more context about what you're trying to achieve
3. Reference specific files or features by name
4. Fall back to manual work or user-level agents

## License

These agents are part of the fillthehole.ca project and follow the same AGPL-3.0 license.
