# VaultLister 3.0 — System Architecture Diagram

FigJam: https://www.figma.com/online-whiteboard/create-diagram/ee005b48-d20a-4ae2-a671-4fb46a651547?utm_source=claude&utm_content=edit_in_figjam

## Mermaid Source

```mermaid
flowchart LR
    Browser["Vanilla JS SPA + WebSocket"]

    subgraph CF["Cloudflare"]
        CDN["CDN + WAF + R2 Storage"]
    end

    subgraph RAIL["Railway"]
        HTTP["Bun.js HTTP Server\n67 Routes · Middleware · WebSocket"]
        PG[("PostgreSQL\n189 tables · TSVECTOR+GIN")]
        RD[("Redis + BullMQ")]
        subgraph WORK["Worker"]
            Bots["Playwright Bots\nPoshmark · Mercari · Depop\nGrailed · Facebook · Whatnot"]
        end
    end

    subgraph EXT["External Services"]
        AI["Anthropic API\nListing · Image AI · Vault Buddy"]
        Mkt["OAuth REST APIs\neBay · Etsy · Shopify"]
        Ops["Resend · EasyPost · Backblaze B2"]
    end

    CI["GitHub Actions CI/CD"]

    Browser -->|"HTTP + WebSocket"| CDN
    CDN --> HTTP
    HTTP --> PG & RD
    RD --> Bots
    HTTP --> AI & Mkt & Ops
    CI -.->|"deploy"| RAIL
```
