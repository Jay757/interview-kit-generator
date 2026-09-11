import { SimulatorPreset } from "./types";

export const SIMULATOR_PRESETS: SimulatorPreset[] = [
  {
    id: "stripe",
    company: "Stripe",
    badge: "Staff Distributed Systems",
    role: "Staff Infrastructure Engineer",
    domain: "stripe.com",
    crawledPages: [
      { url: "https://stripe.com/jobs", status: "200 OK", bytes: "142 KB", time: "180ms" },
      { url: "https://stripe.com/blog/engineering", status: "200 OK", bytes: "84 KB", time: "210ms" },
      { url: "https://stripe.com/culture-handbook", status: "200 OK", bytes: "62 KB", time: "140ms" },
    ],
    intelligenceFound:
      "Stripe uses Ruby/Sorbet & Go microservices on multi-region AWS. Highly values API idempotency, ACID ledger guarantees, and bar-raiser architectural reviews with written design memos.",
    requirements: [
      { id: "r1", text: "Distributed consensus (Raft/Paxos) & high availability", kind: "technical", priority: "must", coverage: "100%" },
      { id: "r2", text: "Financial ledger idempotency & sub-50ms transaction SLAs", kind: "technical", priority: "must", coverage: "100%" },
      { id: "r3", text: "Multi-region active-active database failover & disaster recovery", kind: "technical", priority: "must", coverage: "100%" },
      { id: "r4", text: "Cross-organizational technical leadership & mentoring staff engineers", kind: "behavioural", priority: "must", coverage: "100%" },
      { id: "r5", text: "High-throughput Kafka / Flink streaming pipelines", kind: "domain", priority: "nice", coverage: "100%" },
    ],
    sampleQuestion: {
      id: "q1",
      category: "System Design",
      difficulty: 3,
      reqBadge: "r1, r2",
      prompt:
        "Design a globally distributed payment ingestion gateway that guarantees idempotency even if clients experience regional TCP timeouts and retry repeatedly.",
      starMethod: {
        situation: "Client requests time out at the load balancer after debit was queued but before response returned.",
        task: "Ensure exactly-once processing with zero duplicate debits and sub-50ms latency.",
        action:
          "Implement distributed lock leases on unique Idempotency-Key headers using Redis/Raft. Utilize the Outbox Pattern with write-ahead logs to safely persist state before external PSP handoff.",
        result: "Eliminated double charges entirely across 10M peak req/sec with guaranteed fallback to cached idempotency payload.",
      },
    },
    flashcard: {
      front: "How does Stripe enforce payment idempotency under client timeout retries?",
      back: "Clients supply an 'Idempotency-Key' header. Stripe writes the key and a SHA-256 payload hash to a consensus-backed atomic lock store. If a retry arrives while processing, it yields/polls; once processed, the original cached response is immediately returned without re-executing business logic.",
    },
    schedule: [
      { day: 1, title: "Distributed Consensus & Consistency Models", mins: 75, focus: "Raft leader election, quorum reads, CAP tradeoffs" },
      { day: 2, title: "Idempotency Architecture & Financial Ledgers", mins: 60, focus: "Two-phase commit, Outbox pattern, idempotency keys" },
      { day: 3, title: "Multi-Region DB Failover & Replication", mins: 60, focus: "Cross-datacenter replication lag, split-brain mitigation" },
      { day: 4, title: "Staff Leadership & Influence Without Authority", mins: 45, focus: "STAR behavioral stories for cross-team RFC navigation" },
      { day: 5, title: "Full System Architecture Mock Simulation", mins: 90, focus: "Timed 45-min whiteboard run-through + flashcard review" },
    ],
  },
  {
    id: "gitlab",
    company: "GitLab",
    badge: "Senior Fullstack (Remote)",
    role: "Senior Fullstack Engineer",
    domain: "gitlab.com",
    crawledPages: [
      { url: "https://about.gitlab.com/handbook/engineering", status: "200 OK", bytes: "198 KB", time: "195ms" },
      { url: "https://about.gitlab.com/handbook/values", status: "200 OK", bytes: "74 KB", time: "130ms" },
    ],
    intelligenceFound:
      "GitLab operates 100% remote with a public handbook culture. Interviews emphasize asynchronous RFC authoring, dogfooding, and deep Ruby on Rails + Vue/Next optimization under heavy PostgreSQL load.",
    requirements: [
      { id: "r1", text: "Asynchronous-first collaboration & comprehensive handbook RFC documentation", kind: "behavioural", priority: "must", coverage: "100%" },
      { id: "r2", text: "PostgreSQL query profiling, index optimization & connection pooling", kind: "technical", priority: "must", coverage: "100%" },
      { id: "r3", text: "Modern component architecture & responsive SPA design (Vue/React)", kind: "technical", priority: "must", coverage: "100%" },
      { id: "r4", text: "Open source contribution guidelines & public issue triage", kind: "domain", priority: "nice", coverage: "100%" },
    ],
    sampleQuestion: {
      id: "q2",
      category: "Technical & Architecture",
      difficulty: 2,
      reqBadge: "r2, r3",
      prompt:
        "Walk us through how you would isolate and fix an N+1 query regression occurring on GitLab's repository tree view serving 250k daily active developers.",
      starMethod: {
        situation: "The repository file browser page latency spiked to 4.2s due to lazy-loaded commit author avatars and branch status checks.",
        task: "Reduce p95 response times below 200ms without breaking caching layers.",
        action:
          "Utilized pg_stat_statements and Bullet to trace the N+1 loop. Refactored the Rails ActiveRecord query with eager loading via `.includes(:last_commit, :author)` and indexed composite foreign keys.",
        result: "Reduced database roundtrips from 148 queries down to 2 constant queries, slashing page load time from 4.2s to 135ms.",
      },
    },
    flashcard: {
      front: "What is GitLab's core tenet regarding handbook-first documentation vs meetings?",
      back: "Handbook-First communication: All decisions, architectural RFCs, and policies must be documented publicly in the handbook first before holding synchronous meetings. Meetings are strictly reserved for unblocking unresolved async debates.",
    },
    schedule: [
      { day: 1, title: "PostgreSQL Profiling & ActiveRecord Tuning", mins: 60, focus: "Eager loading, composite indexes, query planner execution plans" },
      { day: 2, title: "Handbook-First RFC Writing & Async Collaboration", mins: 50, focus: "Formulating crisp proposals and handling public review feedback" },
      { day: 3, title: "Frontend Performance & Modern State Management", mins: 60, focus: "Virtual scrolling for large trees, bundle footprint minimization" },
      { day: 4, title: "GitLab Values (CREDIT) Behavioral Prep", mins: 45, focus: "Transparency, Collaboration, Diversity & Results stories" },
      { day: 5, title: "Comprehensive Flashcards & Code Review Drill", mins: 60, focus: "Rapid-fire spaced repetition on database & architecture traps" },
    ],
  },
  {
    id: "anthropic",
    company: "Anthropic",
    badge: "AI Platform & Infra",
    role: "AI Platform & Systems Engineer",
    domain: "anthropic.com",
    crawledPages: [
      { url: "https://www.anthropic.com/research", status: "200 OK", bytes: "112 KB", time: "160ms" },
      { url: "https://www.anthropic.com/careers", status: "200 OK", bytes: "86 KB", time: "175ms" },
    ],
    intelligenceFound:
      "Anthropic builds frontier AI systems with strict safety evaluation (Constitutional AI). Interviewers look for low-level GPU cluster orchestrations (Kubernetes/Slurm), KV-cache memory optimization, and safety harness design.",
    requirements: [
      { id: "r1", text: "Large-scale GPU cluster fault tolerance & checkpointing (Kubernetes/Ray)", kind: "technical", priority: "must", coverage: "100%" },
      { id: "r2", text: "KV cache management & low-latency LLM inference optimizations (vLLM/PagedAttention)", kind: "technical", priority: "must", coverage: "100%" },
      { id: "r3", text: "Automated model evaluation pipelines & safety test harnesses", kind: "domain", priority: "must", coverage: "100%" },
      { id: "r4", text: "High-performance InfiniBand / RoCE networking topologies", kind: "technical", priority: "nice", coverage: "100%" },
    ],
    sampleQuestion: {
      id: "q3",
      category: "AI Systems Engineering",
      difficulty: 3,
      reqBadge: "r1, r2",
      prompt:
        "Design a high-throughput multi-tenant LLM serving system that maximizes GPU memory utilization while maintaining strict per-token latency guarantees under variable prompt lengths.",
      starMethod: {
        situation: "Static memory pre-allocation caused 60% GPU VRAM waste due to KV-cache fragmentation during conversational streaming.",
        task: "Increase concurrent request concurrency 3x without increasing GPU hardware footprint.",
        action:
          "Implemented PagedAttention virtual memory abstraction dividing KV-caches into non-contiguous physical blocks. Built dynamic continuous batching with preemption priority tiers for streaming requests.",
        result: "Boosted effective VRAM utilization from 38% to 94%, quadrupling serving throughput at identical p99 token latencies.",
      },
    },
    flashcard: {
      front: "Why does PagedAttention drastically improve LLM serving throughput?",
      back: "Traditional inference allocates contiguous memory based on maximum sequence length, wasting up to 60-80% VRAM (internal & external fragmentation). PagedAttention manages KV cache in non-contiguous virtual pages, allowing near 100% memory utilization and sharing prompts across parallel beams.",
    },
    schedule: [
      { day: 1, title: "LLM Inference Memory (PagedAttention & KV-Cache)", mins: 75, focus: "Continuous batching, flash attention, quantization tradeoffs" },
      { day: 2, title: "Distributed GPU Checkpointing & Fault Tolerance", mins: 60, focus: "Asynchronous checkpointing, NCCL ring all-reduce recovery" },
      { day: 3, title: "Safety Evaluation & Benchmark Test Sandboxes", mins: 50, focus: "Automated model evaluation architectures and adversarial jailbreak testing" },
      { day: 4, title: "Cluster Scheduling (Kubernetes & Ray Architecture)", mins: 60, focus: "Topology-aware scheduling and network bandwidth contention" },
      { day: 5, title: "End-to-End Simulation & Flashcard Mastery", mins: 75, focus: "Comprehensive mock session and confidence rating verification" },
    ],
  },
];
