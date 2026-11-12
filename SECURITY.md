# Security Policy

This package sits on the authentication path of MCP servers, so we take security reports seriously.

## Supported versions

Only the latest published minor version receives security fixes. While the package is `0.x`, please upgrade to the newest release before reporting.

## Reporting a vulnerability

**Please do not report security issues in public GitHub issues, discussions, or pull requests.**

Report privately via GitHub: [**Security → Report a vulnerability**](https://github.com/medallo-dev/vercel-mcp/security/advisories/new).

Include as much as you can:

- Affected version(s) and configuration
- Steps to reproduce or a proof of concept
- Impact (e.g. auth bypass, token leakage, privilege escalation)

Never include real access tokens, Supabase keys, or user data in a report.

## What to expect

- Acknowledgement within **3 business days**.
- An initial assessment within **10 business days**.
- We will coordinate a fix and disclosure timeline with you and credit you in the advisory unless you prefer otherwise.

## Scope

In scope: code in `src/`, `schema/mcp.sql`, and the reference `example/` app's auth flow.

Out of scope: vulnerabilities in Supabase, Vercel, or other upstream dependencies (report those upstream), and misconfiguration in your own deployment (e.g. exposing `SUPABASE_SERVICE_ROLE_KEY` to clients).
