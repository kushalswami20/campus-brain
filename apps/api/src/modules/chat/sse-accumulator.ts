/**
 * Parses a Server-Sent Events byte stream while it is being forwarded to the
 * client, accumulating the final answer, citations, usage, and agent trace so
 * the assistant message can be persisted once the stream completes.
 *
 * Handles frames split across chunk boundaries via an internal buffer.
 */
export interface AccumulatedAnswer {
  content: string;
  citations: unknown[];
  usage: Record<string, unknown>;
  grounded: boolean;
  trace: string[];
  errored: boolean;
}

export class SseAccumulator {
  private buffer = '';
  private content = '';
  private citations: unknown[] = [];
  private usage: Record<string, unknown> = {};
  private grounded = false;
  private trace: string[] = [];
  private errored = false;

  /** Feed a raw chunk of SSE bytes (already decoded to string). */
  push(chunk: string): void {
    this.buffer += chunk;
    let separator = this.buffer.indexOf('\n\n');
    while (separator !== -1) {
      const frame = this.buffer.slice(0, separator);
      this.buffer = this.buffer.slice(separator + 2);
      this.handleFrame(frame);
      separator = this.buffer.indexOf('\n\n');
    }
  }

  result(): AccumulatedAnswer {
    return {
      content: this.content,
      citations: this.citations,
      usage: this.usage,
      grounded: this.grounded,
      trace: this.trace,
      errored: this.errored,
    };
  }

  private handleFrame(frame: string): void {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (event) {
      case 'token':
        this.content += String(parsed.text ?? '');
        break;
      case 'citations':
        this.citations = Array.isArray(parsed.citations) ? parsed.citations : [];
        break;
      case 'usage':
        this.usage = parsed;
        break;
      case 'done':
        this.grounded = Boolean(parsed.grounded);
        this.trace = Array.isArray(parsed.trace)
          ? (parsed.trace as string[])
          : [];
        break;
      case 'error':
        this.errored = true;
        break;
    }
  }
}
