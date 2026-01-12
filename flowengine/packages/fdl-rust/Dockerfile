FROM rust:slim AS builder
WORKDIR /app

COPY . .
RUN cargo build --release -p fdl-runtime --locked

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/fdl-server /usr/local/bin/

ENV FDL_HOST=0.0.0.0
ENV FDL_PORT=3001

EXPOSE 3001
CMD ["fdl-server"]
