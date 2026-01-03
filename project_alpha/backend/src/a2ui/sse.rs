//! A2UI SSE (Server-Sent Events) Support
//!
//! Utilities for streaming A2UI messages over SSE.

use axum::response::sse::{Event, KeepAlive, Sse};
use futures::stream::Stream;
use std::convert::Infallible;
use std::time::Duration;
use tokio::sync::mpsc;

use super::types::A2UIMessage;

/// Create an SSE response from a stream of A2UI messages
pub fn sse_response<S>(stream: S) -> Sse<impl Stream<Item = Result<Event, Infallible>>>
where
    S: Stream<Item = A2UIMessage> + Send + 'static,
{
    use futures::StreamExt;

    let stream = stream.map(|msg| {
        let json = serde_json::to_string(&msg).unwrap_or_else(|e| {
            tracing::error!("Failed to serialize A2UI message: {}", e);
            "{}".to_string()
        });
        Ok(Event::default().data(json))
    });

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("keep-alive"),
    )
}

/// A channel-based A2UI message sender
#[derive(Clone)]
pub struct A2UISender {
    tx: mpsc::Sender<A2UIMessage>,
}

impl A2UISender {
    /// Send an A2UI message
    pub async fn send(&self, message: A2UIMessage) -> Result<(), mpsc::error::SendError<A2UIMessage>> {
        self.tx.send(message).await
    }

    /// Send multiple messages
    pub async fn send_all(&self, messages: Vec<A2UIMessage>) -> Result<(), mpsc::error::SendError<A2UIMessage>> {
        for msg in messages {
            self.tx.send(msg).await?;
        }
        Ok(())
    }
}

/// Create a channel for A2UI messages
pub fn create_channel(buffer_size: usize) -> (A2UISender, mpsc::Receiver<A2UIMessage>) {
    let (tx, rx) = mpsc::channel(buffer_size);
    (A2UISender { tx }, rx)
}

/// Convert a receiver to a stream for SSE
pub fn receiver_to_stream(
    rx: mpsc::Receiver<A2UIMessage>,
) -> impl Stream<Item = A2UIMessage> + Send + 'static {
    tokio_stream::wrappers::ReceiverStream::new(rx)
}

/// Helper to create an SSE stream from a channel receiver
pub fn sse_from_channel(
    rx: mpsc::Receiver<A2UIMessage>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    sse_response(receiver_to_stream(rx))
}
