# Multi-stage Dockerfile for Rust Backend

# Development stage
FROM rust:1.88-bookworm AS development

WORKDIR /app

# Install development dependencies (nasm required by rav1e/AVIF encoder)
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    nasm \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 8080

# Development - build and run
CMD ["cargo", "run"]

# Builder stage
FROM rust:1.88-bookworm AS builder

WORKDIR /app

# Install build dependencies (nasm required by rav1e/AVIF encoder)
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    nasm \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for dependency caching
COPY Cargo.toml Cargo.lock ./

# Create dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY . .

# Touch main.rs to force rebuild of our code only
RUN touch src/main.rs

# Build the application in release mode
RUN cargo build --release

# Production stage
FROM debian:bookworm-slim AS production

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash appuser

# Copy binary from builder
COPY --from=builder /app/target/release/tour_backend /app/tour_backend

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

ENV RUST_LOG=info
ENV PORT=8080
ENV HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/api/live || exit 1

CMD ["/app/tour_backend"]
