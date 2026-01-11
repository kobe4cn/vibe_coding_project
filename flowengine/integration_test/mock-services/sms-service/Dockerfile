FROM rust:latest as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
  build-essential pkg-config curl ca-certificates \
  clang cmake \
  libssl-dev \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/sms-service /usr/local/bin/
EXPOSE 8080
CMD ["sms-service"]
