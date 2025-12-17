# Build stage
FROM rust:latest AS builder

RUN apk add --no-cache musl-dev

WORKDIR /app

# Copy manifests
COPY Cargo.toml ./

# Create dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Build actual application
RUN touch src/main.rs
RUN cargo build --release

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy binary and migrations
COPY --from=builder /app/target/release/ticket-backend ./
COPY --from=builder /app/migrations ./migrations

# Create uploads directory
RUN mkdir -p /app/uploads

ENV RUST_LOG=info

EXPOSE 3000

CMD ["./ticket-backend"]

