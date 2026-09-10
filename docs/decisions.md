# Architectural Decisions Log

This document tracks technical decisions, trade-offs, and heuristics chosen throughout the phases of the Trao AI Interview Prep Kit project.

---

## 2026-09-10: Phase 1 Decisions

### LLM Provider Selection
- **Decision**: Primary provider is Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`), with architectural design allowing provider abstraction (e.g., Groq fallback).
- **Reasoning**: Gemini provides a generous free tier with high quality structured output and fast inference latency.

### Scraping & Retrieval Strategy
- **Decision**: Use `cheerio` + `undici` / native `fetch` for content retrieval.
- **Reasoning**: Fast, lightweight, robust HTML parsing without the overhead and brittle dependencies of headless browser automation, perfectly fitting company site and hiring page extraction needs.
