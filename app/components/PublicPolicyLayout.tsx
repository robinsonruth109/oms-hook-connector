import type {
  CSSProperties,
  ReactNode,
} from "react";

type PublicPolicyLayoutProps = {
  title: string;
  description: string;
  lastUpdated: string;
  children: ReactNode;
};

type PolicySectionProps = {
  title: string;
  children: ReactNode;
};

type PolicyListProps = {
  items: ReactNode[];
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  background:
    "linear-gradient(180deg, #f4f7fb 0%, #ffffff 420px)",
  color: "#1f2937",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
};

const containerStyle: CSSProperties = {
  width: "min(960px, calc(100% - 32px))",
  margin: "0 auto",
};

const navLinkStyle: CSSProperties = {
  color: "#334155",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 600,
};

const sectionStyle: CSSProperties = {
  marginTop: "28px",
  paddingTop: "4px",
};

const paragraphStyle: CSSProperties = {
  margin: "10px 0 0",
  lineHeight: 1.75,
  color: "#475569",
};

export function PublicPolicyLayout({
  title,
  description,
  lastUpdated,
  children,
}: PublicPolicyLayoutProps) {
  return (
    <div style={pageStyle}>
      <header
        style={{
          borderBottom: "1px solid #e2e8f0",
          background: "rgba(255,255,255,0.94)",
        }}
      >
        <div
          style={{
            ...containerStyle,
            minHeight: "70px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            padding: "12px 0",
          }}
        >
          <a
            href="/"
            style={{
              color: "#111827",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "18px",
            }}
          >
            OMS Hook Connector
          </a>

          <nav
            aria-label="Public information pages"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "18px",
            }}
          >
            <a href="/privacy" style={navLinkStyle}>
              Privacy
            </a>

            <a href="/terms" style={navLinkStyle}>
              Terms
            </a>

            <a href="/support" style={navLinkStyle}>
              Support
            </a>

            <a href="/security" style={navLinkStyle}>
              Security
            </a>
          </nav>
        </div>
      </header>

      <main
        style={{
          ...containerStyle,
          padding: "64px 0 80px",
        }}
      >
        <section
          style={{
            maxWidth: "760px",
            marginBottom: "34px",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "6px 10px",
              borderRadius: "999px",
              background: "#e8efff",
              color: "#214c9a",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            Trendy Deal BD
          </div>

          <h1
            style={{
              margin: "18px 0 12px",
              fontSize: "clamp(34px, 6vw, 52px)",
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              color: "#0f172a",
            }}
          >
            {title}
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: "720px",
              color: "#475569",
              fontSize: "18px",
              lineHeight: 1.7,
            }}
          >
            {description}
          </p>

          <p
            style={{
              marginTop: "16px",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Last updated: {lastUpdated}
          </p>
        </section>

        <article
          style={{
            padding: "clamp(24px, 5vw, 48px)",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            background: "#ffffff",
            boxShadow:
              "0 24px 60px rgba(15, 23, 42, 0.07)",
          }}
        >
          {children}
        </article>
      </main>

      <footer
        style={{
          borderTop: "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            ...containerStyle,
            padding: "30px 0",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          <span>
            © {new Date().getFullYear()} Trendy Deal BD
          </span>

          <a
            href="mailto:trendysarverbd@gmail.com"
            style={{
              color: "#1d4ed8",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            trendysarverbd@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}

export function PolicySection({
  title,
  children,
}: PolicySectionProps) {
  return (
    <section style={sectionStyle}>
      <h2
        style={{
          margin: 0,
          color: "#0f172a",
          fontSize: "23px",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h2>

      <div style={paragraphStyle}>
        {children}
      </div>
    </section>
  );
}

export function PolicyList({
  items,
}: PolicyListProps) {
  return (
    <ul
      style={{
        margin: "12px 0 0",
        paddingLeft: "22px",
        color: "#475569",
        lineHeight: 1.75,
      }}
    >
      {items.map((item, index) => (
        <li
          key={index}
          style={{
            marginBottom: "8px",
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}