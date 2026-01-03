//! A2UI v0.8 Protocol Implementation
//!
//! Server-Driven UI module for generating JSONL messages
//! that the frontend A2UI renderer can consume via SSE.

pub mod builder;
pub mod sse;
pub mod types;

pub use builder::*;
pub use sse::*;
pub use types::*;
