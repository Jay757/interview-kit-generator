import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { crawlCompanySite } from "../src/pipeline/retrieval/crawler.js";
import { fetchPage } from "../src/pipeline/retrieval/fetcher.js";
import { validateUrlForFetch } from "../src/pipeline/retrieval/ssrf.js";
import { parseRobotsTxt } from "../src/pipeline/retrieval/robots.js";

describe("Phase 4 Retrieval: Crawler, Page Fetcher & SSRF Barrier", () => {
  let server: http.Server;
  let serverPort: number;
  let serverBaseUrl: string;

  beforeAll(async () => {
    // Spin up local fixture server
    server = http.createServer((req, res) => {
      const url = req.url || "/";

      // 1. Robots.txt routes
      if (url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("User-agent: *\nDisallow: /disallowed-jobs/\n");
        return;
      }

      // 2. Homepage only fixture
      if (url === "/plain/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Plain Tech Corp</title></head>
            <body>
              <h1>Welcome to Plain Tech</h1>
              <p>We build specialized hardware components for marine electronics.</p>
            </body>
          </html>
        `);
        return;
      }

      // 3. Non-obvious hiring path fixture with relative link
      if (url === "/handbook-site/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Modern Cloud Systems</title></head>
            <body>
              <nav><a href="/ignore-nav">Nav</a></nav>
              <h1>Distributed Infrastructure</h1>
              <p>We build mission-critical systems.</p>
              <a href="handbook/culture/join-our-team">How We Hire &amp; Careers</a>
              <a href="company/story">Our Mission &amp; Story</a>
            </body>
          </html>
        `);
        return;
      }

      if (url === "/handbook-site/handbook/culture/join-our-team") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Hiring at Modern Cloud</title></head>
            <body>
              <h1>Our Interview Process</h1>
              <p>Our engineering interview process consists of a 45-minute technical screen, a take-home coding challenge, and a system-design architecture whiteboard session.</p>
            </body>
          </html>
        `);
        return;
      }

      if (url === "/handbook-site/company/story") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>About Modern Cloud</title></head>
            <body>
              <h1>Our Story and Mission</h1>
              <p>Founded in 2021 to redefine cloud-native resilience for enterprises.</p>
            </body>
          </html>
        `);
        return;
      }

      // 4. Robots test fixture
      if (url === "/robots-site/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Robots Compliant Inc</title></head>
            <body>
              <a href="/disallowed-jobs/engineering">Restricted Job Openings</a>
            </body>
          </html>
        `);
        return;
      }

      // 404 Default
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        serverBaseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("SSRF Validation Barrier", () => {
    it("rejects loopback and private IP addresses when allowLocal is false", () => {
      const privateUrls = [
        "http://127.0.0.1:8080/admin",
        "http://localhost:3000",
        "http://10.0.1.5/internal",
        "http://192.168.1.1/",
        "http://172.20.0.1/",
        "http://169.254.169.254/latest/meta-data",
        "http://0.0.0.0:8000",
      ];

      for (const target of privateUrls) {
        const check = validateUrlForFetch(target, false);
        expect(check.valid).toBe(false);
        expect(check.reason).toContain("SSRF Barrier");
      }
    });

    it("permits loopback URLs when allowLocal is true", () => {
      const check = validateUrlForFetch("http://127.0.0.1:8099/case/", true);
      expect(check.valid).toBe(true);
    });

    it("rejects unsupported protocols", () => {
      const check = validateUrlForFetch("file:///etc/passwd", true);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Unsupported protocol");
    });
  });

  describe("Robots.txt Parser", () => {
    it("correctly identifies allowed and disallowed paths", () => {
      const robots = parseRobotsTxt(`
        User-agent: *
        Disallow: /admin/
        Disallow: /careers/confidential/
        Allow: /admin/public
      `);

      expect(robots.isAllowed("/")).toBe(true);
      expect(robots.isAllowed("/about")).toBe(true);
      expect(robots.isAllowed("/admin/secret")).toBe(false);
      expect(robots.isAllowed("/admin/public")).toBe(true);
      expect(robots.isAllowed("/careers/confidential/roles")).toBe(false);
    });
  });

  describe("Single Page Fetcher (fetchPage)", () => {
    it("fetches page, strips nav/boilerplate, and resolves relative links", async () => {
      const page = await fetchPage(`${serverBaseUrl}/handbook-site/`, {
        allowLocal: true,
      });

      expect(page.title).toBe("Modern Cloud Systems");
      expect(page.text).toContain("Distributed Infrastructure");
      expect(page.text).not.toContain("Nav"); // Nav boilerplate stripped

      // Relative links resolved
      const hiringLink = page.links.find((l) =>
        l.href.includes("handbook/culture/join-our-team")
      );
      expect(hiringLink).toBeDefined();
      expect(hiringLink!.href).toBe(
        `${serverBaseUrl}/handbook-site/handbook/culture/join-our-team`
      );
    });
  });

  describe("Company Crawler (crawlCompanySite)", () => {
    it("handles homepage-only site cleanly returning hiringText: null without throwing", async () => {
      const result = await crawlCompanySite(`${serverBaseUrl}/plain/`, {
        allowLocal: true,
      });

      expect(result.pagesUsed.length).toBe(1);
      expect(result.hiringText).toBeNull();
      expect(result.aboutText).toContain("We build specialized hardware");
      expect(result.pagesSkipped.length).toBe(0);
    });

    it("discovers hiring page at non-obvious path and extracts hiring text", async () => {
      const result = await crawlCompanySite(`${serverBaseUrl}/handbook-site/`, {
        allowLocal: true,
      });

      expect(result.pagesUsed.length).toBeGreaterThanOrEqual(2);
      expect(result.hiringText).not.toBeNull();
      expect(result.hiringText).toContain("Our Interview Process");
      expect(result.hiringText).toContain("system-design architecture whiteboard");
      expect(result.aboutText).toContain("Our Story and Mission");
    });

    it("honors robots.txt disallow directives by recording in pagesSkipped", async () => {
      const result = await crawlCompanySite(`${serverBaseUrl}/robots-site/`, {
        allowLocal: true,
      });

      expect(result.pagesUsed.length).toBe(1); // Homepage only
      const skipped = result.pagesSkipped.find((s) => s.reason.includes("robots.txt"));
      expect(skipped).toBeDefined();
    });

    it("reports 404 company URL gracefully in pagesSkipped without throwing an unhandled error", async () => {
      const result = await crawlCompanySite(`${serverBaseUrl}/non-existent-company`, {
        allowLocal: true,
      });

      expect(result.pagesUsed.length).toBe(0);
      expect(result.hiringText).toBeNull();
      expect(result.pagesSkipped.length).toBe(1);
      expect(result.pagesSkipped[0].reason).toContain("404");
    });
  });
});
